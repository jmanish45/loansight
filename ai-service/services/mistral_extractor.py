"""Mistral-based PDF document extraction pipeline.

Implements native PyMuPDF text extraction with OCR fallback (Tesseract + image preprocessing),
followed by structured Pydantic extraction using Mistral LLM (mistral-small-2506).
"""

from __future__ import annotations

import io
import os
import logging
from typing import Tuple, Optional, Any, Type
import numpy as np
from PIL import Image, ImageOps
import fitz  # PyMuPDF
import pytesseract
from pydantic import BaseModel
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings
from schemas.common import DocumentType
from schemas.payment_slip import PaymentSlip
from schemas.salary_slip import SalarySlipData
from schemas.bank_statement import BankStatementData
from schemas.form16_itr import Form16Data
from schemas.identity import PanCardData, AadhaarCardData

logger = logging.getLogger(__name__)

# Minimum characters expected from the native text layer before considering it valid
MIN_NATIVE_TEXT_CHARS = 40

# OCR render resolution (DPI).
OCR_DPI = 350

# Ensure Tesseract binary is set if on Windows standard path
TESSERACT_WINDOWS_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(TESSERACT_WINDOWS_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_WINDOWS_PATH


# ---------------------------------------------------------------------------
# Schema Mapping & System Prompts
# ---------------------------------------------------------------------------

SCHEMA_MAP: dict[str, Type[BaseModel]] = {
    "PAYMENT_SLIP": PaymentSlip,
    "payment_slip": PaymentSlip,
    "SALARY_SLIP": SalarySlipData,
    "salary_slip": SalarySlipData,
    "BANK_STATEMENT": BankStatementData,
    "bank_statement": BankStatementData,
    "FORM_16": Form16Data,
    "form16": Form16Data,
    "PAN": PanCardData,
    "pan": PanCardData,
    "AADHAAR": AadhaarCardData,
    "aadhaar": AadhaarCardData,
}

SYSTEM_PROMPTS: dict[str, str] = {
    "PAYMENT_SLIP": """You are a document-extraction assistant for payment slips.
Read the raw text extracted from a payment slip (it may contain minor OCR noise/typos) and extract clean, structured data.

Rules:
- Only extract values that are actually present or clearly inferable from the text; never invent data.
- Correct obvious OCR artifacts (e.g. 'O' vs '0', stray symbols) when reconstructing numeric fields, but do not alter the actual values.
- Strip currency symbols and thousands separators from amounts (return plain numbers).
- "components" must list each row of the payment details table (component name, amount, and its status/note if present).
- If a field is missing from the text, use empty string/null for text fields and 0 for numeric fields.
""",
    "SALARY_SLIP": """You are a document-extraction assistant for Indian salary slips / payslips.
Read the raw text extracted from a salary slip (it may contain minor OCR noise/typos) and extract clean, structured data.

Rules:
- Extract employee_name, employer (or employer_name, usually company name at the top or header of the slip), salary_month, basic_salary, gross_salary, total_deductions, pan_number, and net_salary (also called Net Payable / Take Home).
- Strip currency symbols (₹, Rs.) and commas from amounts.
- Set missing fields to null.
- Never invent data not present in the document.
""",
    "BANK_STATEMENT": """You are a document-extraction assistant for bank account statements.
Read the raw text extracted from a bank statement and extract structured data.

Rules:
- Extract account holder name, bank name, branch, account number, IFSC code, statement period, opening balance, closing balance, total credits, total debits, and average balance.
- Identify all recurring salary/payroll/income credit transactions (e.g. descriptions mentioning SALARY, SAL, PAYROLL, NEFT CR, company deposit) and place them in the `salary_credits` list with [date, description, amount, transaction_type: "CREDIT", balance].
- Identify recurring loan EMI debit transactions and place them in `emi_debits` with [date, description, amount, transaction_type: "DEBIT", balance].
- Extract sample regular transactions in `sample_transactions`.
- Strip currency symbols and commas from amounts.
- Set missing fields to null or empty list.
- Never invent data not present in the document.
""",
    "FORM_16": """You are a document-extraction assistant for Form 16 (TDS certificate from employer).
Read the raw text extracted from Form 16 and extract structured financial data.

Rules:
- Extract employee name, PAN of employee, employer name, TAN of employer, assessment year, financial year, gross salary, total exemptions, net taxable salary, total deductions, total taxable income, and TDS deducted.
- Strip currency symbols and commas from amounts.
- Set missing fields to null.
""",
    "PAN": """You are a document-extraction assistant for PAN cards.
Extract pan_number, name, fathers_name, and date_of_birth from the text.
Strip invalid characters from PAN number (standard format: 5 letters, 4 digits, 1 letter).
""",
    "AADHAAR": """You are a document-extraction assistant for Aadhaar cards.
Extract aadhaar_number (12 digits), name, date_of_birth, gender, and address.
""",
}


# ---------------------------------------------------------------------------
# Step 1: Text extraction (Native first, Tesseract OCR fallback)
# ---------------------------------------------------------------------------

def _extract_native_text(doc: fitz.Document) -> str:
    """Pull embedded text layer directly via PyMuPDF."""
    parts = [page.get_text() for page in doc]
    return "\n".join(parts).strip()


def _preprocess_for_ocr(pix: fitz.Pixmap) -> Image.Image:
    """Convert a rendered page to a cleaned-up image to boost OCR accuracy.

    Steps: grayscale -> autocontrast -> binarize (simple threshold).
    Helps with scanned/photographed documents (shadows, low contrast).
    """
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    img = img.convert("L")  # grayscale
    img = ImageOps.autocontrast(img)

    # Simple global threshold binarization
    arr = np.array(img)
    threshold = arr.mean() * 0.9  # slightly below mean tends to preserve thin text
    binarized = np.where(arr > threshold, 255, 0).astype(np.uint8)
    return Image.fromarray(binarized)


def _extract_ocr_text(doc: fitz.Document) -> str:
    """Render each page to an image and run Tesseract OCR on it."""
    zoom = OCR_DPI / 72  # fitz default render is 72 DPI
    matrix = fitz.Matrix(zoom, zoom)

    ocr_parts = []
    # psm 6: assume a uniform block of text — works well for slip/table layouts.
    tesseract_config = "--oem 3 --psm 6"

    for page_num, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=matrix)
        processed_img = _preprocess_for_ocr(pix)
        page_text = pytesseract.image_to_string(processed_img, config=tesseract_config)
        ocr_parts.append(page_text)
        logger.info(f"    OCR'd page {page_num}/{len(doc)} ({len(page_text)} chars)")

    return "\n".join(ocr_parts).strip()


def extract_text_from_pdf_data(file_bytes: bytes) -> Tuple[str, str]:
    """Extract text from PDF bytes, preferring the native layer, falling back to OCR.

    Returns:
        (text, extraction_method) where extraction_method is 'native' or 'ocr'.
    """
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        native_text = _extract_native_text(doc)

        if len(native_text) >= MIN_NATIVE_TEXT_CHARS:
            logger.info(f"Native text extracted: {len(native_text)} chars")
            return native_text, "native"

        logger.info(f"Native text layer too short ({len(native_text)} chars) — falling back to OCR...")
        ocr_text = _extract_ocr_text(doc)

        if not ocr_text:
            raise ValueError(
                "Could not extract any text from the PDF via native layer or OCR. "
                "The file may be corrupted or the scan quality too poor."
            )
        return ocr_text, "ocr"


# ---------------------------------------------------------------------------
# Step 2 & 3: Mistral LLM Structuring & Pydantic Validation
# ---------------------------------------------------------------------------

def build_structured_mistral_llm(schema_cls: Type[BaseModel]):
    """Instantiate ChatMistralAI model with structured output."""
    settings = get_settings()
    api_key = settings.mistral_api_key or os.getenv("MISTRAL_API_KEY", "")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY is not set in environment or config.")

    model_name = settings.mistral_model or "mistral-small-2506"
    model = ChatMistralAI(
        model=model_name,
        temperature=0,
        mistral_api_key=api_key
    )
    return model.with_structured_output(schema_cls)


def _clean_num(val) -> float:
    import re
    if not val:
        return 0.0
    val_str = re.sub(r"[^\d\.]", "", str(val).replace("₹", "").replace(",", ""))
    try:
        return float(val_str)
    except ValueError:
        return 0.0


def _fallback_extract_local(doc_key: str, raw_text: str, schema_cls: Type[BaseModel]) -> dict[str, Any]:
    """Perform deterministic local regex extraction when LLM API is unavailable or rate-limited."""
    import re
    data: dict[str, Any] = {}
    key_upper = doc_key.upper()

    if "SALARY" in key_upper or "PAYMENT" in key_upper:
        emp_m = re.search(r"Employee\s*Name\s*[:\-]?\s*([A-Za-z\s]+)", raw_text, re.I)
        if emp_m:
            data["employee_name"] = emp_m.group(1).split("\n")[0].strip()
        pan_m = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", raw_text)
        if pan_m:
            data["pan_number"] = pan_m.group(1).upper()
        empr_m = re.search(r"([A-Za-z0-9\s\.,]+(?:LIMITED|LTD|PVT|PRIVATE|CORP|CORPORATION|SERVICES))", raw_text, re.I)
        if empr_m:
            data["employer_name"] = empr_m.group(1).split("\n")[0].strip()
            data["employer"] = data["employer_name"]
        basic_m = re.search(r"Basic\s*(?:Salary)?[^\d₹Rs]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if basic_m:
            data["basic_salary"] = _clean_num(basic_m.group(1))
        gross_m = re.search(r"(?:TOTAL\s*)?GROSS\s*SALARY[^\d₹Rs]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if gross_m:
            data["gross_salary"] = _clean_num(gross_m.group(1))
        net_m = re.search(r"(?:NET\s*(?:PAYABLE|TAKE\s*HOME|SALARY|PAY)[^\d₹Rs]*)[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if net_m:
            data["net_salary"] = _clean_num(net_m.group(1))
        ded_m = re.search(r"TOTAL\s*DEDUCTIONS\s*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if ded_m:
            data["total_deductions"] = _clean_num(ded_m.group(1))

    elif "BANK" in key_upper:
        holder_m = re.search(r"(?:Account\s*Holder|Name\s*of\s*Account\s*Holder|Customer\s*Name)[^\w\n]*\n*[:\-]?\s*([A-Za-z\s\.]+)", raw_text, re.I)
        if holder_m:
            clean_holder = holder_m.group(1).split("\n")[0].strip()
            data["account_holder"] = clean_holder
            data["account_holder_name"] = clean_holder
            data["name"] = clean_holder
        acc_m = re.search(r"Account\s*Number\s*[:\-]?\s*([0-9]+)", raw_text, re.I)
        if acc_m:
            data["account_number"] = acc_m.group(1).strip()
        ifsc_m = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", raw_text)
        if ifsc_m:
            data["ifsc_code"] = ifsc_m.group(1).upper()
        bank_m = re.search(r"^([A-Z0-9\s]+BANK[A-Z0-9\s]*)", raw_text, re.M | re.I)
        if bank_m:
            data["bank_name"] = bank_m.group(1).split("\n")[0].strip()
        open_m = re.search(r"Opening\s*Balance\s*[:\-]?\s*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if open_m:
            data["opening_balance"] = _clean_num(open_m.group(1))
        close_m = re.search(r"Closing\s*Balance\s*[:\-]?\s*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if close_m:
            data["closing_balance"] = _clean_num(close_m.group(1))
        avg_m = re.search(r"Average\s*Balance\s*[:\-]?\s*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if avg_m:
            data["average_balance"] = _clean_num(avg_m.group(1))
        tc_m = re.search(r"Total\s*Credits\s*[:\-]?\s*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if tc_m:
            data["total_credits"] = _clean_num(tc_m.group(1))
        td_m = re.search(r"Total\s*Debits\s*[:\-]?\s*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if td_m:
            data["total_debits"] = _clean_num(td_m.group(1))

        salary_credits = []
        clean_lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        detected_employer = None

        for idx, line in enumerate(clean_lines):
            if any(k in line.upper() for k in ("SALARY", "NEFT CR", "RTGS CR", "ACH CR")):
                # Try to extract employer from narration tokens
                tokens = [t.strip() for t in re.split(r'[\-\/]', line) if t.strip()]
                for t in tokens:
                    t_upper = t.upper()
                    if any(k in t_upper for k in ['NEFT', 'RTGS', 'ACH', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV']) and not any(k in t_upper for k in ['LTD', 'LIMITED', 'PVT', 'PRIVATE', 'TCS', 'INFOSYS', 'MAHINDRA', 'WIPRO']):
                        continue
                    if t_upper in ['SALARY', 'SAL', 'CREDIT', 'CR', 'DEBIT', 'DR']:
                        continue
                    if any(k in t_upper for k in ['LIMITED', 'LTD', 'PVT', 'PRIVATE', 'CORP', 'CORPORATION', 'SERVICES', 'HOLDINGS', 'SYSTEMS', 'TECHNOLOGIES', 'TCS', 'INFOSYS', 'WIPRO', 'MAHINDRA', 'TECH']):
                        detected_employer = t
                        break

                amt_found = None
                date_found = "01/06/2024"
                if idx > 0 and re.match(r"^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$", clean_lines[idx - 1]):
                    date_found = clean_lines[idx - 1]

                for lookahead in range(idx, min(idx + 4, len(clean_lines))):
                    look_line = clean_lines[lookahead]
                    amt_m = re.search(r"\b([0-9,]+\.[0-9]{2})\b", look_line)
                    if amt_m and _clean_num(amt_m.group(1)) > 1000:
                        amt_found = _clean_num(amt_m.group(1))
                        break

                if amt_found:
                    salary_credits.append({
                        "date": date_found,
                        "description": line,
                        "amount": amt_found,
                        "transaction_type": "CREDIT"
                    })

        data["salary_credits"] = salary_credits
        if detected_employer:
            data["employer_name"] = detected_employer

    elif "FORM" in key_upper or "16" in key_upper:
        emp_m = re.search(r"Employee\s*Name\s*[:\-]?\s*([A-Za-z\s]+)", raw_text, re.I)
        if emp_m:
            data["employee_name"] = emp_m.group(1).split("\n")[0].strip()
        pan_m = re.search(r"(?:Employee\s*PAN|PAN\s*of\s*Employee)[^\w]*([A-Z]{5}[0-9]{4}[A-Z])", raw_text, re.I)
        if pan_m:
            clean_pan = pan_m.group(1).upper()
            data["pan_employee"] = clean_pan
            data["employee_pan"] = clean_pan
        empr_m = re.search(r"Employer\s*Name\s*[:\-]?\s*([A-Za-z0-9\s\.,&]+)", raw_text, re.I)
        if empr_m:
            clean_emp = empr_m.group(1).split("\n")[0].strip()
            data["employer_name"] = clean_emp
            data["employer"] = clean_emp
            data["company_name"] = clean_emp
        tan_m = re.search(r"(?:Employer\s*TAN|TAN\s*of\s*Employer|TAN)[^\w]*([A-Z]{4}[0-9]{5}[A-Z])", raw_text, re.I)
        if tan_m:
            clean_tan = tan_m.group(1).upper()
            data["tan_employer"] = clean_tan
            data["employer_tan"] = clean_tan
        ay_m = re.search(r"Assessment\s*Year\s*[:\-]?\s*([0-9]{4}\s*[\-\/]\s*[0-9]{2,4})", raw_text, re.I)
        if ay_m:
            data["assessment_year"] = ay_m.group(1).strip()
        fy_m = re.search(r"Financial\s*Year\s*[:\-]?\s*([0-9]{4}\s*[\-\/]\s*[0-9]{2,4})", raw_text, re.I)
        if fy_m:
            data["financial_year"] = fy_m.group(1).strip()
        gross_m = re.search(r"Gross\s*Salary[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if gross_m:
            data["gross_salary"] = _clean_num(gross_m.group(1))
        net_m = re.search(r"Net\s*Taxable\s*Salary[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if net_m:
            data["net_taxable_salary"] = _clean_num(net_m.group(1))
        ded_m = re.search(r"Deductions\s*under\s*Chapter\s*VI-A[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if ded_m:
            data["total_deductions"] = _clean_num(ded_m.group(1))
        taxable_m = re.search(r"Total\s*Taxable\s*Income[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if taxable_m:
            data["total_taxable_income"] = _clean_num(taxable_m.group(1))
        tax_m = re.search(r"Total\s*Tax\s*Payable[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if tax_m:
            data["tax_payable"] = _clean_num(tax_m.group(1))
        tds_m = re.search(r"Total\s*TDS[^\n\r]*[\r\n\s]*[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]+)?)", raw_text, re.I)
        if tds_m:
            data["tds_deducted"] = _clean_num(tds_m.group(1))

    try:
        inst = schema_cls(**data)
        return inst.model_dump(exclude_none=False)
    except Exception:
        return data


def _merge_with_local(res_dict: dict, doc_key: str, raw_text: str, schema_cls: Type[BaseModel]) -> dict:
    if not res_dict:
        return _fallback_extract_local(doc_key, raw_text, schema_cls)
    local = _fallback_extract_local(doc_key, raw_text, schema_cls)
    for k, v in local.items():
        if (res_dict.get(k) is None or res_dict.get(k) == "" or res_dict.get(k) == []) and v:
            res_dict[k] = v
    return res_dict


def extract_structured_data_mistral(
    document_type: str,
    raw_text: str
) -> dict[str, Any]:
    """Send extracted raw text to Mistral LLM to produce validated structured JSON.

    Args:
        document_type: The normalized or frontend document type (e.g. 'payment_slip', 'salary_slip')
        raw_text: The OCR / native extracted raw text

    Returns:
        Dictionary of validated extracted fields
    """
    doc_key = document_type.upper().replace(" ", "_")
    schema_cls = SCHEMA_MAP.get(doc_key, SCHEMA_MAP.get(document_type, PaymentSlip))
    system_prompt = SYSTEM_PROMPTS.get(doc_key, SYSTEM_PROMPTS.get("PAYMENT_SLIP"))

    try:
        structured_llm = build_structured_mistral_llm(schema_cls)
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Extract the structured document data from this text:\n\n{data}"),
        ])
        messages = prompt.format_messages(data=raw_text)
        result = structured_llm.invoke(messages)

        if isinstance(result, BaseModel):
            res_dict = result.model_dump(exclude_none=False)
        elif isinstance(result, dict):
            res_dict = result
        else:
            res_dict = dict(result)

        # Verify extracted fields are non-empty
        if any(v for k, v in res_dict.items() if k not in ("components", "sample_transactions", "salary_credits", "emi_debits")):
            return _merge_with_local(res_dict, doc_key, raw_text, schema_cls)
    except Exception as e:
        logger.warning(f"[Mistral Extractor] Structured invocation warning: {e}. Attempting direct/local fallback.")

    try:
        settings = get_settings()
        api_key = settings.mistral_api_key or os.getenv("MISTRAL_API_KEY", "")
        if api_key:
            raw_llm = ChatMistralAI(
                model=settings.mistral_model or "mistral-small-2506",
                temperature=0,
                mistral_api_key=api_key
            )
            json_prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt + "\nReturn ONLY valid JSON matching the schema fields."),
                ("human", "Extract the structured document data from this text as pure JSON:\n\n{data}"),
            ])
            raw_res = raw_llm.invoke(json_prompt.format_messages(data=raw_text))
            import json
            content = raw_res.content if hasattr(raw_res, 'content') else str(raw_res)
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                validated = schema_cls(**parsed)
                return _merge_with_local(validated.model_dump(exclude_none=False), doc_key, raw_text, schema_cls)
    except Exception as fallback_err:
        logger.error(f"[Mistral Extractor] Fallback LLM extraction failed: {fallback_err}")

    # Step 2b: Groq Structured LLM Extraction
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    if groq_api_key:
        try:
            from groq import Groq
            import json
            import re
            client = Groq(api_key=groq_api_key)
            fields = list(schema_cls.model_fields.keys())
            groq_prompt = (
                f"You are an expert financial document parser. Extract these fields as a pure JSON object:\n"
                f"Requested fields: {', '.join(fields)}\n\n"
                f"Rules:\n"
                f"- For numeric amounts, return plain numbers (e.g. 85000.0, not '₹85,000').\n"
                f"- For employee_name, employer (company name), pan_number, gross_salary, net_salary, extract exact values from text.\n"
                f"- Set missing fields to null.\n\n"
                f"Document Text:\n{raw_text[:6000]}"
            )
            groq_res = client.chat.completions.create(
                messages=[{"role": "user", "content": groq_prompt}],
                model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
                response_format={"type": "json_object"}
            )
            raw_json = groq_res.choices[0].message.content
            parsed = json.loads(raw_json)
            if parsed.get("employer") and not parsed.get("employer_name"):
                parsed["employer_name"] = parsed["employer"]
            elif parsed.get("employer_name") and not parsed.get("employer"):
                parsed["employer"] = parsed["employer_name"]
            validated = schema_cls(**parsed)
            res_dict = validated.model_dump(exclude_none=False)
            if parsed.get("employer_name"):
                res_dict["employer_name"] = parsed["employer_name"]
            return _merge_with_local(res_dict, doc_key, raw_text, schema_cls)
        except Exception as groq_err:
            logger.warning(f"[Groq Extractor] Fallback failed: {groq_err}")

    # Step 2c: Deterministic local regex fallback
    logger.info(f"[Mistral Extractor] Running deterministic local regex extraction for '{document_type}'.")
    return _fallback_extract_local(doc_key, raw_text, schema_cls)


