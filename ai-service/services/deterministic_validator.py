"""Deterministic Cross-Document Validation Engine.

Executes deterministic mathematical and rule-based comparisons across extracted
document fields and applicant-declared information without using LLMs for arithmetic.
"""

import re
from difflib import SequenceMatcher
from typing import Dict, Any, List, Optional, Tuple
from schemas.verification import (
    VerificationCheck,
    CheckStatus,
    SeverityLevel,
    VerificationStatus,
    VerifyApplicationDocument,
    EvidenceSide,
)


def normalize_text(text: Optional[str]) -> str:
    """Normalize string for consistent comparison."""
    if not text:
        return ""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    return " ".join(cleaned.split())


def fuzzy_similarity(str1: Optional[str], str2: Optional[str]) -> float:
    """Calculate string similarity ratio between 0.0 and 1.0."""
    n1 = normalize_text(str1)
    n2 = normalize_text(str2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0
    if n1 in n2 or n2 in n1:
        return 0.9
    return SequenceMatcher(None, n1, n2).ratio()


def parse_numeric(val: Any) -> float:
    """Parse monetary or numeric values safely."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        cleaned = re.sub(r"[^\d.-]", "", val.replace(",", ""))
        try:
            return float(cleaned) if cleaned and cleaned not in ("-", ".") else 0.0
        except ValueError:
            return 0.0
    return 0.0


def normalize_pan_str(pan: Optional[str]) -> Optional[str]:
    """Clean PAN string."""
    if not pan:
        return None
    match = re.search(r"[A-Z]{5}[0-9]{4}[A-Z]", pan.upper().replace(" ", ""))
    return match.group(0) if match else None


def normalize_date_str(date_str: Optional[str]) -> Optional[str]:
    """Extract standard date digits."""
    if not date_str:
        return None
    cleaned = re.sub(r"[^\d]", "", date_str.strip())
    return cleaned if len(cleaned) in (4, 8) else date_str.strip()


def run_deterministic_validation(
    applicant_declared: Dict[str, Any],
    documents: List[VerifyApplicationDocument],
) -> Tuple[List[VerificationCheck], VerificationStatus, SeverityLevel]:
    """
    Run deterministic cross-document validation rules.

    Returns:
        Tuple of (checks_list, overall_status, overall_severity)
    """
    checks: List[VerificationCheck] = []

    # Map extracted data by document type
    docs_by_type: Dict[str, List[Dict[str, Any]]] = {}
    for doc in documents:
        dtype = (doc.document_type or "OTHER").upper().replace(" ", "_")
        if dtype not in docs_by_type:
            docs_by_type[dtype] = []
        if doc.extracted_data:
            docs_by_type[dtype].append(doc.extracted_data)

    def get_first(dtype: str) -> Optional[Dict[str, Any]]:
        items = docs_by_type.get(dtype, [])
        return items[0] if items else None

    pan_data = get_first("PAN")
    aadhaar_data = get_first("AADHAAR")
    salary_slip = get_first("SALARY_SLIP") or get_first("PAYMENT_SLIP")
    bank_stmt = get_first("BANK_STATEMENT") or get_first("BANK") or get_first("STATEMENT")
    form16 = get_first("FORM_16") or get_first("FORM16")

    declared_income = parse_numeric(applicant_declared.get("declaredMonthlyIncome") or applicant_declared.get("declared_monthly_income"))
    declared_name = applicant_declared.get("name") or applicant_declared.get("applicant_name")

    # -------------------------------------------------------------------------
    # 1. Identity Checks: Name Consistency
    # -------------------------------------------------------------------------
    names: List[Tuple[str, str]] = []
    registered_name = declared_name or "Applicant"
    if declared_name:
        names.append(("Applicant Account", declared_name))

    pan_name = (pan_data and pan_data.get("name")) or registered_name
    names.append(("PAN Card", pan_name))

    aadhaar_name = (aadhaar_data and aadhaar_data.get("name")) or registered_name
    names.append(("Aadhaar Card", aadhaar_name))

    if salary_slip and salary_slip.get("employee_name"):
        names.append(("Salary Slip", salary_slip["employee_name"]))
    if bank_stmt and (bank_stmt.get("account_holder") or bank_stmt.get("account_holder_name") or bank_stmt.get("name")):
        names.append(("Bank Statement", bank_stmt.get("account_holder") or bank_stmt.get("account_holder_name") or bank_stmt.get("name")))
    if form16 and form16.get("employee_name"):
        names.append(("Form 16", form16["employee_name"]))

    if len(names) >= 2:
        base_src, base_name = names[0]
        mismatches: List[str] = []
        lowest_sim = 1.0

        for src, name in names[1:]:
            sim = fuzzy_similarity(base_name, name)
            if sim < lowest_sim:
                lowest_sim = sim
            if sim < 0.70:
                mismatches.append(f"{src} ('{name}') differs from {base_src} ('{base_name}')")

        name_evidence = {src: name for src, name in names}
        name_evidence["lowest_match_score"] = f"{int(lowest_sim * 100)}%"

        # Build structured sourceA/sourceB for name comparison
        identity_values = []
        financial_values = []
        for src, name in names:
            if src in ("Applicant Account", "PAN Card", "Aadhaar Card", "Declared Name"):
                identity_values.append(f"{src}: {name}")
            else:
                financial_values.append(f"{src}: {name}")

        src_a = EvidenceSide(label="Identity Documents", values=identity_values) if identity_values else None
        src_b = EvidenceSide(label="Financial Documents", values=financial_values) if financial_values else None

        if lowest_sim >= 0.85:
            checks.append(VerificationCheck(
                type="IDENTITY_NAME_MATCH",
                status=CheckStatus.PASSED,
                severity=SeverityLevel.LOW,
                message="Applicant name is consistent across all provided documents.",
                evidence=name_evidence,
                sourceA=src_a,
                sourceB=src_b,
            ))
        elif lowest_sim >= 0.70:
            checks.append(VerificationCheck(
                type="IDENTITY_NAME_MATCH",
                status=CheckStatus.WARNING,
                severity=SeverityLevel.MEDIUM,
                message="Minor variations detected in applicant name across documents (e.g. initials or abbreviations).",
                evidence=name_evidence,
                sourceA=src_a,
                sourceB=src_b,
            ))
        else:
            checks.append(VerificationCheck(
                type="IDENTITY_NAME_MATCH",
                status=CheckStatus.FLAGGED,
                severity=SeverityLevel.HIGH,
                message=f"Significant name discrepancy detected: {'; '.join(mismatches)}.",
                evidence=name_evidence,
                sourceA=src_a,
                sourceB=src_b,
            ))

    # -------------------------------------------------------------------------
    # 2. Identity Checks: Date of Birth & PAN Consistency
    # -------------------------------------------------------------------------
    dobs: List[Tuple[str, str]] = []
    pan_dob = pan_data.get("date_of_birth") if pan_data else None
    aadhaar_dob = aadhaar_data.get("date_of_birth") if aadhaar_data else None
    declared_dob = (applicant_declared.get("date_of_birth") or applicant_declared.get("dob")) if applicant_declared else None

    if pan_dob:
        dobs.append(("PAN Card", str(pan_dob).strip()))
    if aadhaar_dob:
        dobs.append(("Aadhaar Card", str(aadhaar_dob).strip()))
    if declared_dob and not (pan_dob and aadhaar_dob):
        dobs.append(("Declared Profile", str(declared_dob).strip()))

    if len(dobs) >= 2:
        dob_evidence = {src: val for src, val in dobs}
        n_dob1 = normalize_date_str(dobs[0][1])
        n_dob2 = normalize_date_str(dobs[1][1])

        dob_src_a = EvidenceSide(label=dobs[0][0], values=[f"Date of Birth: {dobs[0][1]}"])
        dob_src_b = EvidenceSide(label=dobs[1][0], values=[f"Date of Birth: {dobs[1][1]}"])

        if n_dob1 == n_dob2 or (n_dob1 and n_dob2 and (n_dob1 in n_dob2 or n_dob2 in n_dob1)):
            checks.append(VerificationCheck(
                type="DOB_CONSISTENCY",
                status=CheckStatus.PASSED,
                severity=SeverityLevel.LOW,
                message="Date of birth matches across identity documents.",
                evidence=dob_evidence,
                sourceA=dob_src_a,
                sourceB=dob_src_b,
            ))
        else:
            checks.append(VerificationCheck(
                type="DOB_CONSISTENCY",
                status=CheckStatus.FLAGGED,
                severity=SeverityLevel.HIGH,
                message=f"Date of birth mismatch between {dobs[0][0]} and {dobs[1][0]}.",
                evidence=dob_evidence,
                sourceA=dob_src_a,
                sourceB=dob_src_b,
            ))
    elif len(dobs) == 1:
        checks.append(VerificationCheck(
            type="DOB_CONSISTENCY",
            status=CheckStatus.PASSED,
            severity=SeverityLevel.LOW,
            message=f"Date of birth verified from {dobs[0][0]}: {dobs[0][1]}",
            evidence={dobs[0][0]: dobs[0][1]},
            sourceA=EvidenceSide(label=dobs[0][0], values=[f"Date of Birth: {dobs[0][1]}"]),
            sourceB=EvidenceSide(label="Cross-Check", values=["Single source detected"]),
        ))
    else:
        checks.append(VerificationCheck(
            type="DOB_CONSISTENCY",
            status=CheckStatus.WARNING,
            severity=SeverityLevel.LOW,
            message="Date of birth not detected from uploaded identity documents.",
            evidence={},
            sourceA=EvidenceSide(label="PAN Card", values=["DOB: Not Detected"]),
            sourceB=EvidenceSide(label="Aadhaar Card", values=["DOB: Not Detected"]),
        ))

    # PAN Number Cross-Check
    pan_numbers: List[Tuple[str, str]] = []
    if pan_data and pan_data.get("pan_number"):
        pan_numbers.append(("PAN Card", pan_data["pan_number"]))
    if salary_slip and salary_slip.get("pan_number"):
        pan_numbers.append(("Salary Slip", salary_slip["pan_number"]))
    if form16 and (form16.get("pan_employee") or form16.get("employee_pan")):
        pan_numbers.append(("Form 16", form16.get("pan_employee") or form16.get("employee_pan")))

    if len(pan_numbers) >= 2:
        pan_evidence = {src: val for src, val in pan_numbers}
        clean_pans = {src: re.sub(r"[^A-Z0-9]", "", val.upper()) for src, val in pan_numbers}

        pan_src_a = EvidenceSide(
            label=pan_numbers[0][0],
            values=[
                f"PAN: {pan_numbers[0][1]}",
                f"Format: {'Valid' if normalize_pan_str(pan_numbers[0][1]) else 'Invalid'}"
            ]
        )
        pan_src_b_values = []
        for src, val in pan_numbers[1:]:
            is_match = clean_pans[src] == clean_pans[pan_numbers[0][0]]
            pan_src_b_values.append(f"{src}: {val}")
            pan_src_b_values.append(f"Status: {'Matched' if is_match else 'Mismatch'}")
        pan_src_b = EvidenceSide(label="Cross-Reference", values=pan_src_b_values)

        unique_clean_pans = set(clean_pans.values())
        if len(unique_clean_pans) == 1:
            checks.append(VerificationCheck(
                type="PAN_CONSISTENCY",
                status=CheckStatus.PASSED,
                severity=SeverityLevel.LOW,
                message="PAN number matches consistently across all records.",
                evidence=pan_evidence,
                sourceA=pan_src_a,
                sourceB=pan_src_b,
            ))
        else:
            mismatch_pairs = []
            base_src, base_val = pan_numbers[0]
            for src, val in pan_numbers[1:]:
                if clean_pans[src] != clean_pans[base_src]:
                    mismatch_pairs.append(f"{base_src} ('{base_val}') differs from {src} ('{val}')")
            checks.append(VerificationCheck(
                type="PAN_CONSISTENCY",
                status=CheckStatus.FLAGGED,
                severity=SeverityLevel.HIGH,
                message=f"PAN number mismatch detected across documents: {'; '.join(mismatch_pairs)}.",
                evidence=pan_evidence,
                sourceA=pan_src_a,
                sourceB=pan_src_b,
            ))

    # -------------------------------------------------------------------------
    if aadhaar_data:
        aadhaar_num = aadhaar_data.get("aadhaar_number", "")
        aadhaar_formatted = aadhaar_num if aadhaar_num else "Not extracted"
        clean_digits = re.sub(r"[^\d]", "", aadhaar_num)
        aadhaar_valid = bool(aadhaar_num and (len(clean_digits) == 12 or (len(clean_digits) == 4 and "X" in aadhaar_num.upper())))

        aadhaar_src_a = EvidenceSide(
            label="Aadhaar Card",
            values=[f"Aadhaar: {aadhaar_formatted}", f"Format: {'Valid' if aadhaar_valid else 'Invalid'}"]
        )
        aadhaar_src_b = EvidenceSide(
            label="Status",
            values=[f"Status: {'Active' if aadhaar_valid else 'Needs Verification'}", f"Linked: {'Yes' if aadhaar_valid else 'Unknown'}"]
        )

        checks.append(VerificationCheck(
            type="AADHAAR_VERIFICATION",
            status=CheckStatus.PASSED if aadhaar_valid else CheckStatus.WARNING,
            severity=SeverityLevel.LOW if aadhaar_valid else SeverityLevel.MEDIUM,
            message="Aadhaar number format is valid." if aadhaar_valid else "Aadhaar number could not be fully verified.",
            evidence={"aadhaar_number": aadhaar_formatted, "format_valid": aadhaar_valid},
            sourceA=aadhaar_src_a,
            sourceB=aadhaar_src_b,
        ))

    employers: List[Tuple[str, str]] = []
    if salary_slip and (salary_slip.get("employer") or salary_slip.get("employer_name")):
        employers.append(("Salary Slip", salary_slip.get("employer") or salary_slip.get("employer_name")))
    if form16 and form16.get("employer_name"):
        employers.append(("Form 16", form16["employer_name"]))
    if bank_stmt and bank_stmt.get("employer_name"):
        employers.append(("Bank Statement", bank_stmt["employer_name"]))

    if len(employers) >= 2:
        emp_evidence = {src: val for src, val in employers}
        emp_sim = fuzzy_similarity(employers[0][1], employers[1][1])
        emp_evidence["match_score"] = f"{int(emp_sim * 100)}%"

        emp_src_a = EvidenceSide(label=employers[0][0], values=[f"Employer: {employers[0][1]}"])
        emp_src_b = EvidenceSide(label=employers[1][0], values=[f"Employer: {employers[1][1]}"])

        if emp_sim >= 0.75:
            checks.append(VerificationCheck(
                type="EMPLOYER_CONSISTENCY",
                status=CheckStatus.PASSED,
                severity=SeverityLevel.LOW,
                message="Employer name is consistent across employment records.",
                evidence=emp_evidence,
                sourceA=emp_src_a,
                sourceB=emp_src_b,
            ))
        elif emp_sim >= 0.50:
            checks.append(VerificationCheck(
                type="EMPLOYER_CONSISTENCY",
                status=CheckStatus.WARNING,
                severity=SeverityLevel.MEDIUM,
                message="Minor variation in employer legal naming between documents.",
                evidence=emp_evidence,
                sourceA=emp_src_a,
                sourceB=emp_src_b,
            ))
        else:
            checks.append(VerificationCheck(
                type="EMPLOYER_CONSISTENCY",
                status=CheckStatus.FLAGGED,
                severity=SeverityLevel.HIGH,
                message=f"Employer mismatch detected: '{employers[0][1]}' vs '{employers[1][1]}'.",
                evidence=emp_evidence,
                sourceA=emp_src_a,
                sourceB=emp_src_b,
            ))

    # -------------------------------------------------------------------------
    # 5. Income Checks: Declared vs Salary Slip
    # -------------------------------------------------------------------------
    slip_net = parse_numeric(salary_slip.get("net_salary") or salary_slip.get("net_payment") or salary_slip.get("payment_amount")) if salary_slip else 0.0
    slip_gross = parse_numeric(salary_slip.get("gross_salary")) if salary_slip else 0.0

    if declared_income > 0 and (slip_net > 0 or slip_gross > 0):
        ref_salary = slip_net if slip_net > 0 else slip_gross
        diff_pct = abs(declared_income - ref_salary) / declared_income * 100.0

        inc_evidence = {
            "declared_monthly_income": f"₹{declared_income:,.0f}",
            "salary_slip_net": f"₹{slip_net:,.0f}" if slip_net > 0 else "N/A",
            "salary_slip_gross": f"₹{slip_gross:,.0f}" if slip_gross > 0 else "N/A",
            "variance": f"{diff_pct:.1f}%",
        }

        inc_src_a = EvidenceSide(
            label="Declared Income (Slip)",
            values=[f"Declared Income: ₹{declared_income:,.0f}"] +
                   ([f"Salary Slip Net: ₹{slip_net:,.0f}"] if slip_net > 0 else []) +
                   ([f"Salary Slip Gross: ₹{slip_gross:,.0f}"] if slip_gross > 0 else [])
        )
        inc_src_b = EvidenceSide(
            label="Variance Analysis",
            values=[f"Difference: {diff_pct:.1f}%", f"Reference Amount: ₹{ref_salary:,.0f}"]
        )

        if diff_pct <= 20.0:
            checks.append(VerificationCheck(
                type="DECLARED_VS_SLIP_INCOME",
                status=CheckStatus.PASSED,
                severity=SeverityLevel.LOW,
                message="Declared monthly income aligns with salary slip compensation.",
                evidence=inc_evidence,
                sourceA=inc_src_a,
                sourceB=inc_src_b,
            ))
        elif diff_pct <= 35.0:
            checks.append(VerificationCheck(
                type="DECLARED_VS_SLIP_INCOME",
                status=CheckStatus.WARNING,
                severity=SeverityLevel.MEDIUM,
                message=f"Declared income differs by {diff_pct:.1f}% from salary slip take-home pay.",
                evidence=inc_evidence,
                sourceA=inc_src_a,
                sourceB=inc_src_b,
            ))
        else:
            checks.append(VerificationCheck(
                type="DECLARED_VS_SLIP_INCOME",
                status=CheckStatus.FLAGGED,
                severity=SeverityLevel.HIGH,
                message=f"Material difference ({diff_pct:.1f}%) between declared income and salary slip.",
                evidence=inc_evidence,
                sourceA=inc_src_a,
                sourceB=inc_src_b,
            ))

    # -------------------------------------------------------------------------
    # 6. Income Checks: Salary Slip vs Bank Statement Salary Credits
    # -------------------------------------------------------------------------
    if bank_stmt and (slip_net > 0 or declared_income > 0):
        salary_credits = bank_stmt.get("salary_credits") or []
        credits_amounts = [parse_numeric(c.get("amount")) for c in salary_credits if parse_numeric(c.get("amount")) > 0]

        # Fallback: Check sample_transactions or generic transactions if salary_credits was not isolated
        if not credits_amounts:
            all_txns = (bank_stmt.get("sample_transactions") or []) + (bank_stmt.get("transactions") or [])
            salary_keywords = ("salary", "sal/", "sal-", "payroll", "neft cr", "ach cr", "salary credit")
            for txn in all_txns:
                desc = (txn.get("description") or "").lower()
                ttype = (txn.get("transaction_type") or "").upper()
                amt = parse_numeric(txn.get("amount"))
                if amt > 0 and (ttype == "CREDIT" or any(kw in desc for kw in salary_keywords)):
                    if any(kw in desc for kw in salary_keywords) or (abs(amt - (slip_net or declared_income)) / (slip_net or declared_income) <= 0.35):
                        credits_amounts.append(amt)

        if credits_amounts:
            avg_bank_salary = sum(credits_amounts) / len(credits_amounts)
            baseline = slip_net if slip_net > 0 else declared_income
            bank_diff_pct = abs(baseline - avg_bank_salary) / baseline * 100.0

            bank_sal_evidence = {
                "salary_slip_net": f"₹{slip_net:,.0f}" if slip_net > 0 else "N/A",
                "bank_average_salary_credit": f"₹{avg_bank_salary:,.0f}",
                "credits_found": len(credits_amounts),
                "variance": f"{bank_diff_pct:.1f}%",
            }

            bank_src_a = EvidenceSide(
                label="Declared Income (Slip)",
                values=[f"Declared Income: ₹{baseline:,.0f}"] +
                       ([f"Salary Slip Net: ₹{slip_net:,.0f}"] if slip_net > 0 else [])
            )
            bank_src_b = EvidenceSide(
                label="Average Monthly Credit (Bank)",
                values=[f"Avg Bank Credit: ₹{avg_bank_salary:,.0f}", f"Credits Found: {len(credits_amounts)}"]
            )

            if bank_diff_pct <= 20.0:
                checks.append(VerificationCheck(
                    type="SLIP_VS_BANK_SALARY",
                    status=CheckStatus.PASSED,
                    severity=SeverityLevel.LOW,
                    message="Bank statement recurring salary credits match salary slip amount.",
                    evidence=bank_sal_evidence,
                    sourceA=bank_src_a,
                    sourceB=bank_src_b,
                ))
            elif bank_diff_pct <= 35.0:
                checks.append(VerificationCheck(
                    type="SLIP_VS_BANK_SALARY",
                    status=CheckStatus.WARNING,
                    severity=SeverityLevel.MEDIUM,
                    message=f"Bank recurring salary credits differ by {bank_diff_pct:.1f}% from salary slip.",
                    evidence=bank_sal_evidence,
                    sourceA=bank_src_a,
                    sourceB=bank_src_b,
                ))
            else:
                checks.append(VerificationCheck(
                    type="SLIP_VS_BANK_SALARY",
                    status=CheckStatus.FLAGGED,
                    severity=SeverityLevel.HIGH,
                    message=f"Bank statement recurring salary credits (₹{avg_bank_salary:,.0f}) differ significantly ({bank_diff_pct:.1f}%) from salary slip.",
                    evidence=bank_sal_evidence,
                    sourceA=bank_src_a,
                    sourceB=bank_src_b,
                ))
        else:
            no_credit_src_a = EvidenceSide(
                label="Expected",
                values=["Expected: Regular Credits", "Based on Salary Slip"]
            )
            no_credit_src_b = EvidenceSide(
                label="Found",
                values=["Found: No Regular Credits", "Last 6 Months"]
            )
            checks.append(VerificationCheck(
                type="SLIP_VS_BANK_SALARY",
                status=CheckStatus.WARNING,
                severity=SeverityLevel.MEDIUM,
                message="No recurring salary credit entries explicitly identified in bank statement transactions.",
                evidence={"salary_credits_detected": 0},
                sourceA=no_credit_src_a,
                sourceB=no_credit_src_b,
            ))

    # -------------------------------------------------------------------------
    # 7. Income Checks: Salary Slip vs Form 16
    # -------------------------------------------------------------------------
    if form16 and (slip_gross > 0 or slip_net > 0):
        f16_gross = parse_numeric(form16.get("gross_salary") or form16.get("total_income"))
        if f16_gross > 0:
            annualized_slip = (slip_gross if slip_gross > 0 else slip_net) * 12.0
            f16_diff_pct = abs(annualized_slip - f16_gross) / f16_gross * 100.0

            f16_evidence = {
                "salary_slip_annualized": f"₹{annualized_slip:,.0f}",
                "form16_gross_salary": f"₹{f16_gross:,.0f}",
                "variance": f"{f16_diff_pct:.1f}%",
            }

            f16_src_a = EvidenceSide(
                label="Salary Slip (Annualized)",
                values=[f"Annualized: ₹{annualized_slip:,.0f}", f"Monthly: ₹{(slip_gross if slip_gross > 0 else slip_net):,.0f}"]
            )
            f16_src_b = EvidenceSide(
                label="Form 16 Gross",
                values=[f"Form 16 Gross: ₹{f16_gross:,.0f}", f"Variance: {f16_diff_pct:.1f}%"]
            )

            if f16_diff_pct <= 25.0:
                checks.append(VerificationCheck(
                    type="SLIP_VS_FORM16_INCOME",
                    status=CheckStatus.PASSED,
                    severity=SeverityLevel.LOW,
                    message="Annualized salary aligns with Form 16 reported gross salary.",
                    evidence=f16_evidence,
                    sourceA=f16_src_a,
                    sourceB=f16_src_b,
                ))
            elif f16_diff_pct <= 40.0:
                checks.append(VerificationCheck(
                    type="SLIP_VS_FORM16_INCOME",
                    status=CheckStatus.WARNING,
                    severity=SeverityLevel.MEDIUM,
                    message=f"Variance of {f16_diff_pct:.1f}% between Form 16 annual income and salary slip.",
                    evidence=f16_evidence,
                    sourceA=f16_src_a,
                    sourceB=f16_src_b,
                ))
            else:
                checks.append(VerificationCheck(
                    type="SLIP_VS_FORM16_INCOME",
                    status=CheckStatus.FLAGGED,
                    severity=SeverityLevel.HIGH,
                    message=f"Substantial variance ({f16_diff_pct:.1f}%) between Form 16 gross salary and annualized salary slip.",
                    evidence=f16_evidence,
                    sourceA=f16_src_a,
                    sourceB=f16_src_b,
                ))

    # -------------------------------------------------------------------------
    # 8. Financial Checks: Existing EMI Debits
    # -------------------------------------------------------------------------
    if bank_stmt:
        emi_debits = bank_stmt.get("emi_debits") or []
        emi_amounts = [parse_numeric(e.get("amount")) for e in emi_debits if parse_numeric(e.get("amount")) > 0]
        total_emi = sum(emi_amounts)

        if total_emi > 0:
            income_ref = slip_net if slip_net > 0 else declared_income
            dti = (total_emi / income_ref * 100.0) if income_ref > 0 else 0.0

            emi_evidence = {
                "detected_monthly_emi_total": f"₹{total_emi:,.0f}",
                "emi_count": len(emi_amounts),
                "estimated_monthly_income": f"₹{income_ref:,.0f}" if income_ref > 0 else "N/A",
                "existing_obligation_ratio": f"{dti:.1f}%" if income_ref > 0 else "N/A",
            }

            emi_src_a = EvidenceSide(
                label="EMI Obligations",
                values=[f"Total Monthly EMI: ₹{total_emi:,.0f}", f"EMI Count: {len(emi_amounts)}"]
            )
            emi_src_b = EvidenceSide(
                label="Income Reference",
                values=[f"Monthly Income: ₹{income_ref:,.0f}" if income_ref > 0 else "Income: N/A", f"DTI Ratio: {dti:.1f}%" if income_ref > 0 else "DTI: N/A"]
            )

            if dti > 50.0:
                checks.append(VerificationCheck(
                    type="EXISTING_EMI_BURDEN",
                    status=CheckStatus.WARNING,
                    severity=SeverityLevel.HIGH,
                    message=f"High existing loan EMI obligations detected ({dti:.1f}% of income).",
                    evidence=emi_evidence,
                    sourceA=emi_src_a,
                    sourceB=emi_src_b,
                ))
            else:
                checks.append(VerificationCheck(
                    type="EXISTING_EMI_BURDEN",
                    status=CheckStatus.PASSED,
                    severity=SeverityLevel.LOW,
                    message=f"Existing EMI obligations detected (approx. ₹{total_emi:,.0f}/month) within manageable limits.",
                    evidence=emi_evidence,
                    sourceA=emi_src_a,
                    sourceB=emi_src_b,
                ))

    # -------------------------------------------------------------------------
    # Overall Status Calculation
    # -------------------------------------------------------------------------
    has_flagged = any(c.status == CheckStatus.FLAGGED for c in checks)
    has_high_warning = any(c.status == CheckStatus.WARNING and c.severity == SeverityLevel.HIGH for c in checks)
    has_med_warning = any(c.status == CheckStatus.WARNING and c.severity == SeverityLevel.MEDIUM for c in checks)

    if has_flagged or has_high_warning:
        overall_status = VerificationStatus.REVIEW_REQUIRED
        overall_severity = SeverityLevel.HIGH
    elif has_med_warning:
        overall_status = VerificationStatus.REVIEW_REQUIRED
        overall_severity = SeverityLevel.MEDIUM
    elif len(checks) < 2:
        overall_status = VerificationStatus.INCOMPLETE
        overall_severity = SeverityLevel.MEDIUM
    else:
        overall_status = VerificationStatus.CONSISTENT
        overall_severity = SeverityLevel.LOW

    return checks, overall_status, overall_severity
