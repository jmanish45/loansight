"""Text extraction service — handles PDF text extraction and image preparation.

For native/digital PDFs: uses PyMuPDF only (NO Gemini call needed).
For images/scanned PDFs: uses Tesseract OCR locally (lazy-loaded).
"""

import fitz  # PyMuPDF
import logging

logger = logging.getLogger(__name__)

# Page limits for fast extraction (digital PDFs rarely need every page parsed slowly)
DOC_PAGE_LIMITS = {
    "pan": 1,
    "aadhaar": 1,
    "aadhar": 1,
    "salary_slip": 3,
    "form16": 4,
    "bank_statement": 30,
}


def _fast_page_text(page: fitz.Page) -> str:
    """Fast single-pass text extraction for digital PDF pages."""
    text = page.get_text("text")
    if text.strip():
        return text

    blocks = page.get_text("blocks")
    lines = []
    for block in blocks:
        if len(block) >= 5 and block[6] == 0 and isinstance(block[4], str):
            cleaned = block[4].strip()
            if cleaned:
                lines.append(cleaned)
    return "\n".join(lines)


def extract_text_from_pdf(
    file_bytes: bytes,
    document_type: str | None = None,
) -> dict:
    """Extract text from a digital PDF using PyMuPDF (fitz).

    Uses a fast single-pass strategy tuned per document type.
    """
    text_parts = []
    page_count = 0
    pages_read = 0

    doc_type = (document_type or "").lower()
    page_limit = DOC_PAGE_LIMITS.get(doc_type)

    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            page_count = len(doc)
            limit = page_limit if page_limit is not None else page_count
            pages_to_read = min(page_count, limit)

            for page_idx in range(pages_to_read):
                page_text = _fast_page_text(doc[page_idx])
                pages_read += 1
                if page_text.strip():
                    text_parts.append(page_text)

            if pages_to_read < page_count:
                logger.info(
                    f"Fast PDF extract: read {pages_to_read}/{page_count} pages for {doc_type or 'unknown'}"
                )
    except Exception as e:
        logger.error(f"PyMuPDF text extraction failed: {e}")

    full_text = "\n\n".join(text_parts)
    has_native_text = len(full_text.strip()) >= 40
    engine = "pymupdf"

    if not has_native_text:
        logger.info(f"Native PDF text layer short ({len(full_text.strip())} chars). Triggering Tesseract OCR fallback...")
        try:
            with fitz.open(stream=file_bytes, filetype="pdf") as doc:
                ocr_text = _ocr_pdf_pages(doc, max_pages=page_limit if page_limit else 5)
                if ocr_text.strip():
                    full_text = ocr_text.strip()
                    engine = "tesseract_pdf"
        except Exception as ocr_err:
            logger.warning(f"PDF OCR fallback failed: {ocr_err}")

    has_text = len(full_text.strip()) > 5

    return {
        "text": full_text,
        "tables": [],
        "page_count": page_count,
        "pages_read": pages_read,
        "has_text": has_text,
        "ocr_engine": engine,
        "needs_vision": False,
    }


def _ocr_pdf_pages(doc: fitz.Document, max_pages: int = 5) -> str:
    """Render PDF pages to pixmaps and run RapidOCR / Tesseract OCR."""
    ocr_parts = []
    pages_to_ocr = min(len(doc), max_pages)

    # 1. Try RapidOCR first (native CPU ONNX model, robust, no external binaries required)
    try:
        from rapidocr_onnxruntime import RapidOCR
        rapid_engine = RapidOCR()
        for page_idx in range(pages_to_ocr):
            pix = doc[page_idx].get_pixmap(dpi=200)
            result, _ = rapid_engine(pix.tobytes("png"))
            if result:
                lines = [line[1].strip() for line in result if line[1].strip()]
                if lines:
                    ocr_parts.append("\n".join(lines))
        if ocr_parts:
            return "\n\n".join(ocr_parts)
    except Exception as rapid_err:
        logger.warning(f"RapidOCR PDF fallback error: {rapid_err}")

    # 2. Secondary fallback: Tesseract OCR
    import os
    import io
    import numpy as np
    from PIL import Image, ImageOps
    import pytesseract

    tesseract_windows_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(tesseract_windows_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_windows_path

    zoom = 300 / 72
    matrix = fitz.Matrix(zoom, zoom)
    for page_idx in range(pages_to_ocr):
        try:
            pix = doc[page_idx].get_pixmap(matrix=matrix)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
            img = ImageOps.autocontrast(img)
            arr = np.array(img)
            threshold = arr.mean() * 0.9
            binarized = np.where(arr > threshold, 255, 0).astype(np.uint8)
            processed_img = Image.fromarray(binarized)
            page_text = pytesseract.image_to_string(processed_img, config="--oem 3 --psm 6")
            if not page_text.strip():
                page_text = pytesseract.image_to_string(processed_img, config="--oem 3 --psm 3")
            if page_text.strip():
                ocr_parts.append(page_text.strip())
        except Exception as err:
            logger.warning(f"OCR page {page_idx} error: {err}")

    return "\n\n".join(ocr_parts)


def compact_bank_statement(text: str, tables: list) -> str:
    """Compact bank statement data to reduce Gemini token usage."""
    header = text[:2000]

    if tables:
        compact_parts = [header, "\n--- TRANSACTIONS (COMPACT) ---"]
        row_count = 0
        for table in tables:
            for row in table:
                clean = [str(c).strip() if c else "" for c in row]
                if not any(clean):
                    continue
                compact_parts.append(" | ".join(clean))
                row_count += 1
                if row_count > 100:
                    compact_parts.append(f"... ({row_count}+ rows total, truncated)")
                    break
            if row_count > 100:
                break
        compact_text = "\n".join(compact_parts)
    else:
        compact_text = text

    if len(compact_text) > 6000:
        compact_text = compact_text[:6000] + "\n... (truncated)"

    return compact_text


def _preprocess_image_for_ocr(file_bytes: bytes):
    from PIL import Image, ImageOps
    import io
    img = Image.open(io.BytesIO(file_bytes))
    return ImageOps.autocontrast(img.convert("L"))


def extract_text_from_image(file_bytes: bytes) -> dict:
    """Extract text from image files using RapidOCR (with Tesseract fallback)."""
    # 1. Try RapidOCR first (CPU ONNX, high precision, handles skewed / low-res ID cards)
    try:
        from rapidocr_onnxruntime import RapidOCR
        rapid_engine = RapidOCR()
        result, _ = rapid_engine(file_bytes)
        if result:
            lines = [line[1].strip() for line in result if line[1].strip()]
            text = "\n".join(lines)
            if len(text.strip()) > 5:
                return {
                    "text": text,
                    "tables": [],
                    "page_count": 1,
                    "has_text": True,
                    "ocr_engine": "rapidocr",
                    "needs_vision": False,
                }
    except Exception as rapid_err:
        logger.warning(f"RapidOCR image extraction error: {rapid_err}")

    # 2. Secondary fallback: Tesseract OCR
    try:
        import os
        import pytesseract

        tesseract_windows_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tesseract_windows_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_windows_path

        processed_img = _preprocess_image_for_ocr(file_bytes)
        text = pytesseract.image_to_string(processed_img, config="--oem 3 --psm 3").strip()
        
        if len(text) < 15:
            text_psm6 = pytesseract.image_to_string(processed_img, config="--oem 3 --psm 6").strip()
            if len(text_psm6) > len(text):
                text = text_psm6

        if len(text) < 15:
            from PIL import Image
            import io
            raw_img = Image.open(io.BytesIO(file_bytes))
            text_raw = pytesseract.image_to_string(raw_img, config="--oem 3 --psm 3").strip()
            if len(text_raw) > len(text):
                text = text_raw

        if len(text) > 10:
            return {
                "text": text,
                "tables": [],
                "page_count": 1,
                "has_text": True,
                "ocr_engine": "tesseract",
                "needs_vision": False,
            }
    except Exception as e:
        logger.warning(f"Local OCR extraction error: {e}")

    # 3. Cloud Vision Fallback (Pixtral-12b via Mistral): Zero-dependency cloud OCR for Render / headless Linux
    try:
        import base64
        import os
        from langchain_mistralai import ChatMistralAI
        from langchain_core.messages import HumanMessage
        from config import get_settings

        settings = get_settings()
        api_key = settings.mistral_api_key or os.getenv("MISTRAL_API_KEY", "")
        if api_key:
            b64_img = base64.b64encode(file_bytes).decode("utf-8")
            mime = "image/png" if file_bytes.startswith(b"\x89PNG") else "image/jpeg"
            llm = ChatMistralAI(model="pixtral-12b-2409", mistral_api_key=api_key, temperature=0)
            msg = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": "Extract all text on this identity card verbatim. Include Name, Father's Name, Date of Birth, Gender, Address, and PAN or Aadhaar number.",
                    },
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_img}"}},
                ]
            )
            res = llm.invoke([msg])
            content = res.content if hasattr(res, "content") else str(res)
            if content and len(content.strip()) > 10:
                logger.info(f"[Vision OCR] Pixtral successfully transcribed {len(content)} chars from image.")
                return {
                    "text": content.strip(),
                    "tables": [],
                    "page_count": 1,
                    "has_text": True,
                    "ocr_engine": "pixtral-vision",
                    "needs_vision": True,
                }
    except Exception as vision_err:
        logger.warning(f"[Vision OCR] Pixtral transcription error: {vision_err}")

    return {
        "text": "",
        "tables": [],
        "page_count": 1,
        "has_text": False,
        "ocr_engine": "failed",
        "needs_vision": False,
    }


def extract_text(
    file_bytes: bytes,
    content_type: str,
    document_type: str | None = None,
) -> dict:
    """Main entry point: extract text from any supported file type."""
    is_pdf = content_type == "application/pdf"
    is_image = content_type in ("image/jpeg", "image/png")

    if is_pdf:
        return extract_text_from_pdf(file_bytes, document_type=document_type)
    if is_image:
        return extract_text_from_image(file_bytes)
    raise ValueError(f"Unsupported content type: {content_type}")
