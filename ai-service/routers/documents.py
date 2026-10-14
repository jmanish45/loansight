"""Document processing API router — optimized for minimal Gemini calls."""

import hashlib
import json
import logging
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional

from schemas.common import ProcessingResult, ProcessingStatus, DocumentType
from schemas.verification import (
    VerifyApplicationRequest,
    VerificationAnalysisResult,
    VerificationStatus,
    SeverityLevel,
    RecommendedAction,
)
from pydantic import BaseModel
from services.text_extraction import extract_text, compact_bank_statement
from services.gemini_gateway import generate, _parse_json_response, get_stats
from services.mistral_extractor import extract_text_from_pdf_data, extract_structured_data_mistral
from services.deterministic_validator import run_deterministic_validation
from services.groq_reasoning import run_groq_reasoning

class TextExtractionResult(BaseModel):
    text: str
    has_text: bool
    page_count: int
    ocr_engine: Optional[str] = None
    extraction_method: Optional[str] = None
    file_hash: str
    extracted_data: Optional[dict] = None
    error: Optional[str] = None

class DocumentForAI(BaseModel):
    document_id: str
    expected_type: str
    text: str

class ApplicationProcessRequest(BaseModel):
    documents: list[DocumentForAI]

class ApplicationProcessResult(BaseModel):
    documents: list[ProcessingResult]
    gemini_calls_made: int
    processing_error: Optional[str] = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["documents"])


def _compute_file_hash(file_bytes: bytes) -> str:
    """Compute SHA-256 hash of file contents."""
    return hashlib.sha256(file_bytes).hexdigest()


def _map_expected_type(expected_type: str | None) -> str:
    """Map frontend document type names to AI type names."""
    from utils.prompts import FRONTEND_TO_AI_TYPE

    if not expected_type:
        return "UNKNOWN"
    return FRONTEND_TO_AI_TYPE.get(expected_type, "OTHER")


def _validate_extracted_data(document_type: str, raw_data: dict | None) -> dict | None:
    """Validate extracted data through Pydantic models."""
    if not raw_data or not document_type:
        return raw_data

    try:
        from schemas.common import DocumentType as DT
        from services.extraction import EXTRACTION_MODELS

        dt = DT(document_type)
        model = EXTRACTION_MODELS.get(dt)
        if model:
            validated = model(**raw_data)
            return validated.model_dump(exclude_none=True)
    except Exception as e:
        logger.warning(f"Pydantic validation failed, returning raw data: {e}")

    return raw_data


@router.post("/extract-text", response_model=TextExtractionResult)
async def extract_text_endpoint(
    file: UploadFile = File(...),
    document_type: Optional[str] = Query(None, description="Expected document type (pan, aadhaar, etc.)"),
):
    """Extract raw text locally from a document (PDF via PyMuPDF, images via Tesseract). No Gemini calls."""
    if not file.content_type:
        raise HTTPException(status_code=400, detail="File content type is required")

    try:
        file_bytes = await file.read()
        file_hash = _compute_file_hash(file_bytes)
        
        logger.info(f"Extracting text locally from {file.filename} ({file.content_type}, type={document_type})")
        extraction_result = extract_text(file_bytes, file.content_type, document_type=document_type)

        extracted_data = None
        if document_type and document_type.lower() in ("pan", "aadhaar", "aadhar"):
            from services.identity_parser import parse_identity_text
            extracted_data = parse_identity_text(document_type, extraction_result.get("text", ""))
        
        return TextExtractionResult(
            text=extraction_result["text"],
            has_text=extraction_result["has_text"],
            page_count=extraction_result.get("page_count", 1),
            ocr_engine=extraction_result.get("ocr_engine", "pymupdf"),
            file_hash=file_hash,
            extracted_data=extracted_data,
        )
    except Exception as e:
        logger.error(f"Text extraction failed: {e}", exc_info=True)
        return TextExtractionResult(
            text="",
            has_text=False,
            page_count=0,
            file_hash="",
            error=str(e)
        )


@router.post("/process-application", response_model=ApplicationProcessResult)
async def process_application_endpoint(request: ApplicationProcessRequest):
    """Process all application documents in a SINGLE consolidated LLM call."""
    start_time = time.time()
    
    if not request.documents:
        return ApplicationProcessResult(documents=[], gemini_calls_made=0)

    try:
        logger.info(f"Step 2: Consolidated LLM Processing for {len(request.documents)} documents (1 call)...")
        
        # Build a massive prompt containing all documents
        prompt_parts = [
            "You are an expert loan document analysis AI.",
            "I will provide you with the OCR text of multiple documents from a single loan application.",
            "You must analyze EACH document independently.",
            "Do NOT mix data between documents.",
            "For each document, determine its true type, and extract structured data based on that type.",
            "Return a JSON array of objects. Each object MUST have:",
            '- "document_id": (string, exact ID provided below)',
            '- "document_type": (string, e.g., PAN, AADHAAR, SALARY_SLIP, BANK_STATEMENT, FORM_16, OTHER)',
            '- "confidence": (float, 0.0 to 1.0)',
            '- "document_type_match": (boolean, whether predicted type matches expected_type)',
            '- "extracted_data": (object, the structured fields for this doc type)',
            "\n\n--- DOCUMENTS TO PROCESS ---\n"
        ]
        
        for doc in request.documents:
            # Compact bank statements to save context window
            text_for_gemini = doc.text
            if doc.expected_type == "BANK_STATEMENT":
                text_for_gemini = compact_bank_statement(doc.text, [])
            else:
                text_for_gemini = doc.text[:8000] if len(doc.text) > 8000 else doc.text
                
            prompt_parts.append(f"\n--- DOCUMENT ID: {doc.document_id} ---")
            prompt_parts.append(f"Expected Type: {doc.expected_type}")
            prompt_parts.append(f"Text Content:\n{text_for_gemini}")
            
        prompt_parts.append("\n\n--- END OF DOCUMENTS ---")
        prompt_parts.append("Return ONLY the raw JSON array (no markdown fences).")
        
        prompt = "\n".join(prompt_parts)
        
        # ONE Gemini Call
        raw_response = await generate(prompt, purpose=f"consolidated application {len(request.documents)} docs")
        
        clean_response = _parse_json_response(raw_response)
        
        # Handle cases where Gemini wraps the array in an object
        result_json = json.loads(clean_response)
        if isinstance(result_json, dict) and "documents" in result_json:
            doc_results = result_json["documents"]
        elif isinstance(result_json, list):
            doc_results = result_json
        else:
            raise ValueError("Unexpected JSON structure from Gemini")
            
        processed_docs = []
        for doc_res in doc_results:
            doc_id = doc_res.get("document_id")
            doc_type = doc_res.get("document_type", "UNKNOWN")
            confidence = min(max(float(doc_res.get("confidence", 0)), 0.0), 1.0)
            doc_type_match = doc_res.get("document_type_match", None)
            raw_extracted = doc_res.get("extracted_data", None)
            
            validated_data = _validate_extracted_data(doc_type, raw_extracted)
            
            # We use ProcessingResult structure but repurpose 'file_hash' to store doc_id for matching
            res = ProcessingResult(
                document_type=DocumentType(doc_type),
                confidence=confidence,
                processing_status=ProcessingStatus.COMPLETED,
                extracted_data=validated_data,
                processing_error=None,
                file_hash=doc_id, # Using this to map back in Node.js
                gemini_calls_made=0,
                document_type_match=doc_type_match
            )
            processed_docs.append(res)
            
        elapsed = time.time() - start_time
        logger.info(f"Consolidated processing complete in {elapsed:.1f}s")
        
        return ApplicationProcessResult(
            documents=processed_docs,
            gemini_calls_made=1
        )
        
    except Exception as e:
        elapsed = time.time() - start_time
        error_str = str(e)
        logger.error(f"Consolidated processing failed after {elapsed:.1f}s: {e}", exc_info=True)
        return ApplicationProcessResult(
            documents=[],
            gemini_calls_made=1,
            processing_error=error_str
        )


@router.post("/process-document-mistral", response_model=ProcessingResult)
async def process_document_mistral_endpoint(
    file: UploadFile = File(...),
    document_type: str = Query(..., description="Expected document type (payment_slip, salary_slip, bank_statement, form16, pan, aadhaar)"),
):
    """
    Process PDF document using native text layer first, OCR fallback,
    followed by structured Pydantic extraction with Mistral LLM (mistral-small-2506).
    """
    if not file.content_type:
        raise HTTPException(status_code=400, detail="File content type is required")

    try:
        file_bytes = await file.read()
        file_hash = _compute_file_hash(file_bytes)

        logger.info(f"[Mistral Pipeline] Processing {file.filename} ({file.content_type}, type={document_type})")

        # Step 1: Text extraction (Native PyMuPDF first, Tesseract OCR fallback)
        raw_text, extraction_method = extract_text_from_pdf_data(file_bytes)
        logger.info(f"[Mistral Pipeline] Extracted {len(raw_text)} chars via {extraction_method}")

        # Step 2: Structured extraction using Mistral LLM
        extracted_data = extract_structured_data_mistral(document_type, raw_text)
        logger.info(f"[Mistral Pipeline] Structured extraction complete: {list(extracted_data.keys()) if extracted_data else []}")

        # Map document_type to DocumentType enum
        doc_type_norm = document_type.lower().replace(" ", "_").replace("-", "_")
        if doc_type_norm in ("form16", "form_16"):
            target_doc_type = DocumentType.FORM_16
        else:
            try:
                target_doc_type = DocumentType(doc_type_norm.upper())
            except ValueError:
                target_doc_type = DocumentType.OTHER

        return ProcessingResult(
            document_type=target_doc_type,
            confidence=1.0 if extracted_data else 0.5,
            processing_status=ProcessingStatus.COMPLETED,
            extracted_data=extracted_data,
            raw_text_preview=raw_text[:500] if raw_text else None,
            extraction_method=extraction_method,
            file_hash=file_hash,
            gemini_calls_made=0,
            document_type_match=True,
        )

    except Exception as e:
        logger.error(f"[Mistral Pipeline] Processing failed for {file.filename}: {e}", exc_info=True)
        doc_type_upper = document_type.upper().replace(" ", "_")
        try:
            target_doc_type = DocumentType(doc_type_upper)
        except ValueError:
            target_doc_type = DocumentType.OTHER

        return ProcessingResult(
            document_type=target_doc_type,
            confidence=0.0,
            processing_status=ProcessingStatus.FAILED,
            extracted_data=None,
            processing_error=str(e),
            extraction_method=None,
            file_hash="",
            gemini_calls_made=0,
            document_type_match=False,
        )


@router.post("/verify-application", response_model=VerificationAnalysisResult)
async def verify_application_endpoint(request: VerifyApplicationRequest):
    """
    Run deterministic cross-document validation rules across extracted document data,
    followed by Groq reasoning analysis to generate the final structured officer assessment.
    """
    try:
        logger.info(f"[Verification Pipeline] Starting validation for application {request.application_id} with {len(request.documents)} documents")

        # Step 1: Python deterministic validation engine
        checks, overall_status, overall_severity = run_deterministic_validation(
            applicant_declared=request.applicant_declared or {},
            documents=request.documents or [],
        )

        logger.info(f"[Verification Pipeline] Deterministic validation complete: status={overall_status}, severity={overall_severity}, checks={len(checks)}")

        # Step 2: Groq reasoning layer (interprets validation evidence, synthesizes findings)
        groq_result = run_groq_reasoning(
            applicant_declared=request.applicant_declared or {},
            checks=checks,
            overall_status=overall_status,
            overall_severity=overall_severity,
        )

        logger.info(f"[Verification Pipeline] Groq reasoning complete: riskLevel={groq_result.riskLevel}, findings={len(groq_result.findings)}")

        from datetime import datetime, timezone

        return VerificationAnalysisResult(
            verificationStatus=groq_result.verificationStatus or overall_status,
            overallSeverity=overall_severity,
            summary=groq_result.summary,
            riskLevel=groq_result.riskLevel or overall_severity,
            verificationScore=groq_result.verificationScore,
            keyFindings=groq_result.keyFindings or [],
            findings=groq_result.findings or [],
            recommendedAction=groq_result.recommendedAction,
            checks=checks,
            validatedAt=datetime.now(timezone.utc).isoformat(),
        )

    except Exception as e:
        logger.error(f"[Verification Pipeline] Failed for application {request.application_id}: {e}", exc_info=True)
        from datetime import datetime, timezone
        return VerificationAnalysisResult(
            verificationStatus=VerificationStatus.REVIEW_REQUIRED,
            overallSeverity=SeverityLevel.HIGH,
            summary=f"Verification encountered an error: {str(e)}",
            riskLevel=SeverityLevel.HIGH,
            findings=[],
            recommendedAction=RecommendedAction.MANUAL_REVIEW,
            checks=[],
            validatedAt=datetime.now(timezone.utc).isoformat(),
        )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    stats = get_stats()
    return {"status": "ok", "service": "loanlens-ai", "gemini_gateway": stats}
