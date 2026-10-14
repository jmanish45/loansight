"""Local regex-based parsing for PAN and Aadhaar from PyMuPDF-extracted text.

No AI/Gemini calls — intended for digital PDFs with a native text layer.
"""

import re
import logging
from typing import Optional

from schemas.identity import PanCardData, AadhaarCardData

logger = logging.getLogger(__name__)

PAN_PATTERN = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
AADHAAR_PATTERN = re.compile(r"\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b")
MONTHS = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"

DOB_PATTERNS = [
    re.compile(r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b"),
    re.compile(rf"\b(\d{{1,2}}[\/\-\.\s]{MONTHS}[\/\-\.\s,]\s*\d{{2,4}})\b", re.IGNORECASE),
    re.compile(rf"\b({MONTHS}\s+\d{{1,2}}[\/\-\.\s,]\s*\d{{2,4}})\b", re.IGNORECASE),
    re.compile(r"\b((?:19|20)\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b"),
]
DOB_PATTERN = DOB_PATTERNS[0]
YOB_PATTERN = re.compile(r"\b(19|20)\d{2}\b")
GENDER_PATTERN = re.compile(r"\b(Male|Female|Transgender|MALE|FEMALE|TRANSGENDER|M|F)\b", re.IGNORECASE)

PAN_LABELS = {
    "name": re.compile(r"(?:name|नाम)\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "fathers_name": re.compile(
        r"(?:father(?:'?s)?\s*name|pita\s*ka\s*naam|पिता\s*का\s*नाम)\s*[:\-]?\s*(.+)",
        re.IGNORECASE,
    ),
    "date_of_birth": re.compile(
        rf"(?:date\s*of\s*birth|d\.?\s*o\.?\s*b\.?|जन्म\s*तिथि)\s*[:\-]?\s*(\d{{1,2}}[\/\-\.\s](?:\d{{1,2}}|{MONTHS})[\/\-\.\s]\d{{2,4}})",
        re.IGNORECASE,
    ),
}

AADHAAR_LABELS = {
    "name": re.compile(r"(?:name|नाम)\s*[:\-]?\s*(.+)", re.IGNORECASE),
    "date_of_birth": re.compile(
        r"(?:date\s*of\s*birth|d\.?\s*o\.?\s*b\.?|year\s*of\s*birth|y\.?\s*o\.?\s*b\.?|जन्म\s*तिथि)\s*[:\-]?\s*(\S.+)",
        re.IGNORECASE,
    ),
    "gender": re.compile(r"(?:gender|sex|लिंग)\s*[:\-]?\s*(Male|Female|Transgender|M|F)", re.IGNORECASE),
    "address": re.compile(r"(?:address|पता)\s*[:\-]?\s*(.+)", re.IGNORECASE),
}


def _normalize_pan(value: str) -> str:
    return value.strip().upper()


def _normalize_aadhaar(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    return digits if len(digits) == 12 else value.strip()


def _clean_line(value: str) -> str:
    cleaned = value.strip()
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.rstrip(",.;")


def _find_labeled_value(text: str, pattern: re.Pattern) -> Optional[str]:
    for line in text.splitlines():
        match = pattern.search(line.strip())
        if match:
            return _clean_line(match.group(1))
    return None


def _normalize_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = re.sub(r"\s+", " ", name).strip()
    # Split camelCase e.g., AjitChavan -> Ajit Chavan
    cleaned = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned)

    # If it's a single concatenated word (e.g. Ajitchavan)
    if " " not in cleaned and len(cleaned) >= 6:
        common_surnames = [
            "chavan", "kadam", "sawant", "sharma", "patil", "pawar", "deshmukh",
            "kumar", "singh", "patel", "verma", "gupta", "joshi", "yadav", "shah",
            "mishra", "tiwari", "pandey", "reddy", "nair", "rao", "bose", "sen",
            "das", "ghosh", "roy", "bhatt", "shukla", "tripathi", "agarwal", "mehta"
        ]
        lower = cleaned.lower()
        for s in common_surnames:
            if lower.endswith(s) and len(lower) > len(s) + 2:
                first = cleaned[: len(cleaned) - len(s)].strip()
                last = cleaned[len(cleaned) - len(s) :].strip()
                cleaned = f"{first.capitalize()} {last.capitalize()}"
                break
    return cleaned.title()


def _find_pan_number(text: str) -> Optional[str]:
    upper = text.upper()
    # 1. Standard Indian PAN (5 letters, 4 digits, 1 letter)
    match = PAN_PATTERN.search(upper)
    if match:
        return _normalize_pan(match.group(1))

    # 2. Check lines immediately following "Permanent Account"
    lines = [ln.strip() for ln in upper.splitlines() if ln.strip()]
    for i, line in enumerate(lines):
        if "PERMANENT" in line or "ACCOUNT NUMBER" in line or "CARD" in line or "स्थायी लेखा" in line:
            for nxt in lines[i + 1 : i + 3]:
                cand = re.sub(r"[^A-Z0-9]", "", nxt)
                if len(cand) == 10 and any(c.isdigit() for c in cand) and any(c.isalpha() for c in cand):
                    return cand

    # 3. 10-char alphanumeric fallback containing mixed letters and digits
    for m in re.finditer(r"\b([A-Z0-9]{10})\b", upper):
        token = m.group(1)
        if any(c.isdigit() for c in token) and any(c.isalpha() for c in token):
            if not any(k in token for k in ["DEPARTMENT", "GOVERNMENT", "INCOMETAX"]):
                return token

    return None


def _find_aadhaar_number(text: str) -> Optional[str]:
    # 1. Masked Aadhaar (e.g. XXXX-XXXX-9012 or XXXX XXXX 9012)
    masked = re.search(r"\b([Xx]{4}[\s-]?[Xx]{4}[\s-]?\d{4})\b", text)
    if masked:
        return re.sub(r"[\s]", "-", masked.group(1).upper())

    # 2. Standard 12-digit format with spaces/hyphens
    for match in AADHAAR_PATTERN.finditer(text):
        normalized = _normalize_aadhaar(match.group(1))
        if len(normalized) == 12:
            return normalized

    # 3. Across newlines (e.g. 7693 5093 \n 3092)
    digits_match = re.search(r"\b(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})\b", text)
    if digits_match:
        return f"{digits_match.group(1)}{digits_match.group(2)}{digits_match.group(3)}"

    return None


def _find_gender(text: str) -> Optional[str]:
    match = re.search(r"\b(Male|Female|Transgender)\b", text, re.IGNORECASE)
    if match:
        val = match.group(1).lower()
        if val in ("male", "m"):
            return "Male"
        elif val in ("female", "f"):
            return "Female"
        return "Transgender"
    if re.search(r"पुरुष|पुरूष", text):
        return "Male"
    if re.search(r"महिला|स्त्री", text):
        return "Female"
    return None


def _is_noise_or_label_pan(line: str, pan_number: Optional[str] = None) -> bool:
    """Check if a line is a header, metadata, label, or noise in a PAN card."""
    if not line:
        return True
    cleaned = line.strip()
    upper = cleaned.upper()
    if len(cleaned) < 2:
        return True

    # Common PAN card header lines and labels
    noise_keywords = [
        "INCOME TAX", "INCOMETAX", "आयकर", "DEPARTMENT", "विभाग",
        "GOVT", "GOVERNMENT", "INDIA", "BHARAT", "भारत", "सरकार",
        "PERMANENT", "ACCOUNT NUMBER", "CARD", "लेखा", "संख्या",
        "SIGNATURE", "हस्ताक्षर", "FATHER", "PITA", "पिता",
        "DATE OF BIRTH", "DOB", "जन्म", "तारीख", "MALE", "FEMALE"
    ]
    for kw in noise_keywords:
        if kw in upper:
            return True

    # Standalone or corrupted label patterns like "a4 / Name", "नाम / Name", "Name /", "T / Name", "/ Name"
    if re.match(r"^[\W\d_]*(?:name|नाम|naam|a4|ft|aa)[\s\/\:\-_]*(?:name|नाम)?[\s\/\:\-_]*$", cleaned, re.IGNORECASE):
        return True

    # PAN Number or DOB pattern on line
    if PAN_PATTERN.search(upper) or (pan_number and pan_number in upper):
        return True
    for dp in DOB_PATTERNS:
        if dp.search(upper):
            return True

    # Pure digits/symbols or mixed 10-char alphanumeric
    cand_alpha_num = re.sub(r"[^A-Z0-9]", "", upper)
    if len(cand_alpha_num) == 10 and any(c.isdigit() for c in cand_alpha_num) and any(c.isalpha() for c in cand_alpha_num):
        return True

    if not re.search(r"[A-Za-z]", cleaned):
        return True

    # Sample/Demo watermarks
    if any(w in upper for w in ["SAMPLE", "DEMO", "NOT AN ORIGINAL", "DEMONSTRATION"]):
        return True

    # Gibberish lines without vowels or with excessive consonant clusters
    if not re.search(r"[aeiouyAEIOUY]", cleaned):
        return True
    if re.search(r"[BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz]{5,}", cleaned):
        return True

    return False


def _find_dob(text: str) -> Optional[str]:
    labeled = _find_labeled_value(text, PAN_LABELS["date_of_birth"])
    if labeled:
        for pat in DOB_PATTERNS:
            dob_match = pat.search(labeled)
            if dob_match:
                return dob_match.group(1).strip()
        return labeled.strip()

    for pat in DOB_PATTERNS:
        match = pat.search(text)
        if match:
            return match.group(1).strip()
    return None


def _find_fathers_name_after_label(text: str) -> Optional[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i, line in enumerate(lines):
        if re.search(r"father|पिता|pita", line, re.IGNORECASE):
            inline = re.search(r"(?:father(?:'?s)?\s*name|pita\s*ka\s*naam|पिता\s*का\s*नाम)\s*[:\-]\s*([A-Za-z\s\.]{3,})", line, re.IGNORECASE)
            if inline:
                cand = _clean_line(inline.group(1))
                if not _is_noise_or_label_pan(cand):
                    return cand
            for nxt in lines[i + 1 : i + 4]:
                cand = _clean_line(nxt)
                if not _is_noise_or_label_pan(cand):
                    clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
                    if len(clean_name) >= 3:
                        return clean_name
    return None


def _find_holder_name_pan(text: str, pan_number: Optional[str] = None, fathers_name: Optional[str] = None) -> Optional[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 1. Look for Name label lines (e.g., "नाम / Name", "a4 / Name", "Name:")
    for i, line in enumerate(lines):
        is_name_label = (
            re.search(r"(?:name|नाम|naam)", line, re.IGNORECASE) or 
            re.search(r"^a4\s*\/\s*name", line, re.IGNORECASE)
        ) and not re.search(r"father|पिता|pita", line, re.IGNORECASE)

        if is_name_label:
            inline = re.search(r"(?:name|नाम|naam)\s*[:\-]\s*([A-Za-z\s\.]{3,})", line, re.IGNORECASE)
            if inline:
                cand = _clean_line(inline.group(1))
                if not _is_noise_or_label_pan(cand) and len(cand) >= 3:
                    return cand

            for nxt in lines[i + 1 : i + 4]:
                cand = _clean_line(nxt)
                if not _is_noise_or_label_pan(cand):
                    if fathers_name and cand.upper() == fathers_name.upper():
                        continue
                    clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
                    if len(clean_name) >= 3:
                        return clean_name

    # 2. Look above Father's Name line
    for i, line in enumerate(lines):
        if re.search(r"father|पिता|pita", line, re.IGNORECASE):
            for prev in reversed(lines[max(0, i - 3) : i]):
                cand = _clean_line(prev)
                if not _is_noise_or_label_pan(cand):
                    if fathers_name and cand.upper() == fathers_name.upper():
                        continue
                    clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
                    if len(clean_name) >= 3:
                        return clean_name

    # 3. Fallback heuristic: first clean alpha line
    for line in lines:
        cand = _clean_line(line)
        if not _is_noise_or_label_pan(cand):
            if fathers_name and cand.upper() == fathers_name.upper():
                continue
            clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
            if len(clean_name) >= 3:
                return clean_name

    return None


def parse_pan_text(text: str) -> dict:
    """Extract structured PAN fields from native PDF / OCR text."""
    if not text or len(text.strip()) < 5:
        return {}

    pan_number = _find_pan_number(text)
    fathers_name = _normalize_name(_find_fathers_name_after_label(text))
    name = _normalize_name(_find_holder_name_pan(text, pan_number=pan_number, fathers_name=fathers_name))
    if name and name.lower() == "image uploaded for record storage":
        name = None
    date_of_birth = _find_dob(text)

    data = PanCardData(
        pan_number=pan_number,
        name=name,
        fathers_name=fathers_name,
        date_of_birth=date_of_birth,
    )
    return data.model_dump(exclude_none=True)


def _is_noise_or_label_aadhaar(line: str) -> bool:
    """Check if a line is a header, metadata, label, or noise in an Aadhaar card."""
    if not line:
        return True
    cleaned = line.strip()
    upper = cleaned.upper()
    if len(cleaned) < 2:
        return True

    noise_keywords = [
        "UNIQUE IDENTIFICATION", "AUTHORITY OF INDIA", "UIDAI", "GOVERNMENT OF INDIA", "GOVT",
        "MERA AADHAAR", "MERI PEHCHAN", "ENROLMENT", "HELP@UIDAI", "WWW.UIDAI.GOV.IN",
        "DATE OF BIRTH", "DOB", "YEAR OF BIRTH", "YOB", "MALE", "FEMALE", "TRANSGENDER",
        "ADDRESS", "S/O", "D/O", "W/O", "C/O", "PIN CODE", "PO BOX", "SIGNATURE", "VID"
    ]
    for kw in noise_keywords:
        if kw in upper:
            return True

    if re.match(r"^[\W\d_]*(?:name|नाम|naam|to|shri|smt)[\s\/\:\-_]*(?:name|नाम)?[\s\/\:\-_]*$", cleaned, re.IGNORECASE):
        return True

    if AADHAAR_PATTERN.search(upper):
        return True
    for dp in DOB_PATTERNS:
        if dp.search(upper):
            return True

    if not re.search(r"[A-Za-z]", cleaned):
        return True

    return False


def _find_holder_name_aadhaar(text: str) -> Optional[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 1. Look for Name label or "To" lines
    for i, line in enumerate(lines):
        if re.search(r"(?:name|नाम|naam|^to\b)", line, re.IGNORECASE):
            inline = re.search(r"(?:name|नाम|naam|^to)\s*[:\-]\s*([A-Za-z\s\.]{3,})", line, re.IGNORECASE)
            if inline:
                cand = _clean_line(inline.group(1))
                if not _is_noise_or_label_aadhaar(cand) and len(cand) >= 3:
                    return cand

            for nxt in lines[i + 1 : i + 4]:
                cand = _clean_line(nxt)
                if not _is_noise_or_label_aadhaar(cand):
                    clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
                    if len(clean_name) >= 3:
                        return clean_name

    # 2. Look above DOB / Gender line (Aadhaar cards place holder name right above DOB/Gender)
    for i, line in enumerate(lines):
        if re.search(r"dob|date\s*of\s*birth|year\s*of\s*birth|male|female|लिंग|जन्म", line, re.IGNORECASE):
            for prev in reversed(lines[max(0, i - 3) : i]):
                cand = _clean_line(prev)
                if not _is_noise_or_label_aadhaar(cand):
                    clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
                    if len(clean_name) >= 3:
                        return clean_name

    # 3. Fallback
    for line in lines:
        cand = _clean_line(line)
        if not _is_noise_or_label_aadhaar(cand):
            clean_name = re.sub(r"^[^A-Za-z]+|[^A-Za-z\s\.]+$", "", cand).strip()
            if len(clean_name) >= 3:
                return clean_name

    return None


def parse_aadhaar_text(text: str) -> dict:
    """Extract structured Aadhaar fields from native PDF / OCR text."""
    if not text or len(text.strip()) < 5:
        return {}

    aadhaar_number = _find_aadhaar_number(text)
    name = _normalize_name(_find_holder_name_aadhaar(text))
    if name and name.lower() == "image uploaded for record storage":
        name = None
    date_of_birth = _find_dob(text) or _find_labeled_value(text, AADHAAR_LABELS["date_of_birth"])
    gender = _find_gender(text) or _find_labeled_value(text, AADHAAR_LABELS["gender"])
    address = _find_labeled_value(text, AADHAAR_LABELS["address"])

    if date_of_birth:
        for pat in DOB_PATTERNS:
            dob_match = pat.search(date_of_birth)
            if dob_match:
                date_of_birth = dob_match.group(1).strip()
                break

    data = AadhaarCardData(
        aadhaar_number=aadhaar_number,
        name=name,
        date_of_birth=date_of_birth,
        gender=gender,
        address=address,
    )
    return data.model_dump(exclude_none=True)


def parse_identity_text(document_type: str, text: str) -> dict | None:
    """Parse identity document text based on expected type."""
    doc_type = (document_type or "").lower()
    if doc_type in ("pan", "PAN"):
        result = parse_pan_text(text)
    elif doc_type in ("aadhaar", "aadhar", "AADHAAR"):
        result = parse_aadhaar_text(text)
    else:
        return None

    if not result:
        logger.info(f"No identity fields parsed for {doc_type}")
        return None

    logger.info(f"Parsed {doc_type} fields locally: {list(result.keys())}")
    return result
