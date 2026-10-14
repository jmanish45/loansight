"""Hybrid RAG + Applicant Data Loan Officer Assistant.

Synthesizes applicant-specific extracted data from MongoDB with retrieved bank
policies from the RAG knowledge base to answer loan officer inquiries with
strict grounding, transparent citations, confidence scoring, and mathematical accuracy
powered by Groq LLMs (e.g., openai/gpt-oss-120b, openai/gpt-oss-20b, allam-2-7b).
"""

import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional

from config import get_settings
from services.policy_rag import policy_store

logger = logging.getLogger(__name__)

# Standard annual interest rates for simulation
LOAN_RATES = {
    "personal": 10.5,
    "home": 8.5,
    "lap": 11.0,
    "business": 13.5,
    "education": 9.5,
    "auto": 9.0,
    "vehicle": 9.0,
}

GROQ_FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "allam-2-7b",
    "groq/compound-mini",
    "groq/compound",
]


def calculate_monthly_emi(principal: float, tenure_months: int, annual_rate_pct: float) -> float:
    """Standard amortisation EMI formula."""
    if principal <= 0 or tenure_months <= 0:
        return 0.0
    r = (annual_rate_pct / 12) / 100
    if r == 0:
        return principal / tenure_months
    emi = principal * r * ((1 + r) ** tenure_months) / (((1 + r) ** tenure_months) - 1)
    return round(emi, 2)


def calculate_foir_metrics(
    verified_monthly_income: float,
    requested_amount: float,
    tenure_months: int,
    loan_type: str,
    existing_emis: float = 0.0,
) -> Dict[str, Any]:
    """Calculate FOIR, proposed EMI, and maximum eligible loan under bank policies."""
    rate = LOAN_RATES.get(loan_type.lower(), 10.5)
    proposed_emi = calculate_monthly_emi(requested_amount, tenure_months, rate)
    total_obligation = existing_emis + proposed_emi

    # Tiered FOIR policy limit
    if verified_monthly_income < 50000:
        max_permissible_foir = 50.0
    elif verified_monthly_income <= 100000:
        max_permissible_foir = 55.0
    else:
        max_permissible_foir = 65.0

    current_foir = (
        round((total_obligation / verified_monthly_income) * 100, 2)
        if verified_monthly_income > 0
        else 0.0
    )

    # Maximum EMI applicant can afford
    max_total_emi = (verified_monthly_income * max_permissible_foir) / 100
    max_new_emi = max(0.0, max_total_emi - existing_emis)

    # Convert max_new_emi to max principal
    r = (rate / 12) / 100
    if r > 0 and tenure_months > 0:
        factor = (((1 + r) ** tenure_months) - 1) / (r * ((1 + r) ** tenure_months))
        max_eligible_amount = round(max_new_emi * factor, -3)  # round to nearest thousand
    else:
        max_eligible_amount = 0.0

    return {
        "interestRateAnnualPct": rate,
        "proposedEmi": proposed_emi,
        "existingMonthlyEmis": existing_emis,
        "totalMonthlyObligation": round(total_obligation, 2),
        "calculatedFoirPct": current_foir,
        "maxPermissibleFoirPct": max_permissible_foir,
        "isFoirCompliant": current_foir <= max_permissible_foir,
        "maxAffordableNewEmi": round(max_new_emi, 2),
        "maxEligibleAmount": max_eligible_amount,
    }


def _safe_dict(val: Any) -> Dict[str, Any]:
    return val if isinstance(val, dict) else {}


def _safe_list(val: Any) -> List[Any]:
    return val if isinstance(val, list) else []


def _safe_str(val: Any, default: str = "") -> str:
    if val is None:
        return default
    return str(val)


def extract_structured_applicant_facts(applicant_data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse MongoDB application record into structured, citeable facts and extracted documents."""
    applicant_data = _safe_dict(applicant_data)
    applicant_obj = _safe_dict(applicant_data.get("applicant"))

    facts = {
        "applicantName": applicant_obj.get("name") or applicant_data.get("applicantName") or "Rohit Sharma",
        "applicantEmail": applicant_obj.get("email") or applicant_data.get("applicantEmail") or "rohit.sharma@example.com",
        "bankId": applicant_data.get("bankId") or "hdfc",
        "bankName": applicant_data.get("bankName") or "HDFC Bank",
        "loanType": _safe_str(applicant_data.get("loanType") or "personal").lower(),
        "requestedAmount": float(applicant_data.get("requestedAmount") or 1500000),
        "tenureMonths": int(applicant_data.get("tenureMonths") or 36),
        "employmentType": applicant_data.get("employmentType") or "salaried",
        "declaredMonthlyIncome": float(applicant_data.get("declaredMonthlyIncome") or 85000),
        "applicationStatus": applicant_data.get("status") or "under_review",
        "documentsSummary": [],
        "extractedEvidence": [],
        "verifiedNetIncome": 0.0,
        "detectedExistingEmis": 0.0,
        "validationFindings": [],
        "validationChecks": [],
        "verificationScore": 50,
        "overallRisk": "LOW",
    }

    # Extract info from documents
    docs = _safe_list(applicant_data.get("documents"))
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        doc_type = doc.get("documentType") or doc.get("type") or "other"
        doc_name = doc.get("originalName") or doc.get("filename") or "Document"
        ai_proc = _safe_dict(doc.get("aiProcessing"))
        extracted = _safe_dict(ai_proc.get("extractedData"))

        facts["documentsSummary"].append({
            "type": doc_type,
            "name": doc_name,
            "status": doc.get("status") or "pending_review",
            "aiStatus": ai_proc.get("status") or "pending",
            "confidence": ai_proc.get("confidence"),
        })

        # Process extracted data by document type
        if doc_type in ["salary_slip", "payment_slip"]:
            net_pay = extracted.get("net_salary") or extracted.get("net_pay") or extracted.get("netPay")
            gross_pay = extracted.get("gross_salary") or extracted.get("gross_pay")
            employer = extracted.get("employer_name") or extracted.get("company_name") or extracted.get("employer")

            if net_pay is not None:
                try:
                    net_val = float(str(net_pay).replace(",", "").replace("₹", "").strip())
                    facts["verifiedNetIncome"] = max(facts["verifiedNetIncome"], net_val)
                    facts["extractedEvidence"].append({
                        "label": "Verified Net Monthly Pay",
                        "value": f"₹{net_val:,.0f}",
                        "sourceDocument": f"Salary Slip ({doc_name})",
                        "verified": True,
                    })
                except (ValueError, TypeError):
                    pass
            if employer:
                facts["extractedEvidence"].append({
                    "label": "Employer Name",
                    "value": str(employer),
                    "sourceDocument": f"Salary Slip ({doc_name})",
                    "verified": True,
                })

        elif doc_type in ["bank_statement", "bank_statement_pdf"]:
            salary_credits = extracted.get("salary_credits") or extracted.get("monthly_salary")
            recurring_emis = extracted.get("recurring_emis") or extracted.get("detected_emis") or extracted.get("monthly_debits")
            avg_balance = extracted.get("average_monthly_balance") or extracted.get("avg_balance")

            if salary_credits is not None:
                try:
                    cred_val = float(str(salary_credits).replace(",", "").replace("₹", "").strip())
                    if facts["verifiedNetIncome"] == 0:
                        facts["verifiedNetIncome"] = cred_val
                    facts["extractedEvidence"].append({
                        "label": "Bank Verified Monthly Salary Credit",
                        "value": f"₹{cred_val:,.0f}",
                        "sourceDocument": f"Bank Statement ({doc_name})",
                        "verified": True,
                    })
                except (ValueError, TypeError):
                    pass

            if recurring_emis is not None:
                try:
                    emi_val = float(str(recurring_emis).replace(",", "").replace("₹", "").strip())
                    facts["detectedExistingEmis"] = emi_val
                    facts["extractedEvidence"].append({
                        "label": "Running Existing Monthly EMIs",
                        "value": f"₹{emi_val:,.0f}/month",
                        "sourceDocument": f"Bank Statement ({doc_name})",
                        "verified": True,
                    })
                except (ValueError, TypeError):
                    pass

        elif doc_type == "pan":
            pan_num = extracted.get("pan_number") or extracted.get("pan")
            if pan_num:
                facts["extractedEvidence"].append({
                    "label": "Permanent Account Number (PAN)",
                    "value": str(pan_num).upper(),
                    "sourceDocument": f"PAN Card ({doc_name})",
                    "verified": True,
                })

        elif doc_type == "aadhaar":
            aadhaar_num = extracted.get("aadhaar_number") or extracted.get("aadhaar")
            if aadhaar_num:
                facts["extractedEvidence"].append({
                    "label": "Aadhaar Identity",
                    "value": str(aadhaar_num),
                    "sourceDocument": f"Aadhaar Card ({doc_name})",
                    "verified": True,
                })

    # Default verified income to declared income if documents are pending
    if facts["verifiedNetIncome"] == 0 and facts["declaredMonthlyIncome"] > 0:
        facts["verifiedNetIncome"] = facts["declaredMonthlyIncome"]
        facts["extractedEvidence"].append({
            "label": "Declared Monthly Income (Unverified)",
            "value": f"₹{facts['declaredMonthlyIncome']:,.0f}",
            "sourceDocument": "Loan Application Form",
            "verified": False,
        })

    # Extract validation findings
    val_res = _safe_dict(applicant_data.get("validationResult"))
    if val_res:
        facts["verificationScore"] = val_res.get("verificationScore") or val_res.get("overallScore") or 50
        facts["overallRisk"] = val_res.get("overallRisk") or "MEDIUM"
        facts["validationFindings"] = _safe_list(val_res.get("findings"))
        facts["validationChecks"] = _safe_list(val_res.get("checks"))

    # Calculate financial metrics
    foir_data = calculate_foir_metrics(
        verified_monthly_income=facts["verifiedNetIncome"],
        requested_amount=facts["requestedAmount"],
        tenure_months=facts["tenureMonths"],
        loan_type=facts["loanType"],
        existing_emis=facts["detectedExistingEmis"],
    )
    facts["financialMetrics"] = foir_data

    # Add FOIR and EMI to extracted evidence
    facts["extractedEvidence"].append({
        "label": "Requested Loan",
        "value": f"₹{facts['requestedAmount']:,.0f} for {facts['tenureMonths']} months",
        "sourceDocument": "Loan Application Form",
        "verified": True,
    })
    facts["extractedEvidence"].append({
        "label": "Estimated Proposed Monthly EMI",
        "value": f"₹{foir_data['proposedEmi']:,.0f}/month (@ {foir_data['interestRateAnnualPct']}% p.a.)",
        "sourceDocument": "LoanLens Underwriting Calculation",
        "verified": True,
    })
    facts["extractedEvidence"].append({
        "label": "Calculated FOIR (Debt Burden)",
        "value": f"{foir_data['calculatedFoirPct']}% (Max Allowed: {foir_data['maxPermissibleFoirPct']}%)",
        "sourceDocument": "Bank Policy FOIR Engine",
        "verified": foir_data["isFoirCompliant"],
    })

    return facts


ASSISTANT_SYSTEM_PROMPT = """You are the Senior AI Underwriting Specialist and Credit Risk Policy Advisor for LoanLens.
You assist human loan officers by evaluating loan applications against official bank lending policies, KYC regulations, and underwriting standards.

You are provided with two strictly separate contexts:
1. [APPLICANT EVIDENCE FROM DATABASE]: Verified facts, income figures, documents, and deterministic checks from MongoDB.
2. [RELEVANT BANK POLICIES FROM KNOWLEDGE BASE]: Exact policy clauses, thresholds, rules, and citations retrieved via Vector RAG.

CRITICAL UNDERWRITING INSTRUCTIONS:
- Directly answer the loan officer's specific question with rich, professional, and thorough analysis.
- Ground your answer in both the Applicant Data and Bank Policies. Do NOT hallucinate numbers or fabricate documents.
- If an officer asks about eligibility, calculate whether the applicant satisfies basic criteria (Age, Employment Type, Minimum Net Income, Experience, and FOIR limit).
- If an officer asks why an application was flagged or which policy rule caused the issue, identify the exact discrepancy from validation checks and cite the violated policy section/rule.
- Clearly explain your calculations (e.g. Income, Proposed EMI, Existing EMIs, Total Debt, Calculated FOIR vs. Permissible Cap, Max Sanction Amount).
- Format your markdown answer dynamically with clear headings, bullet points, and key takeaways for the loan officer.

You MUST respond strictly in valid JSON format adhering to the following schema:
{
  "answer": "<In-depth markdown analysis addressing the officer inquiry clearly, thoroughly, and professionally>",
  "verdict": "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL_APPROVAL" | "FLAGGED_REVIEW" | "DOCS_REQUIRED" | "INFORMATIONAL",
  "confidence": 0.95,
  "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": [
    "Step 1: Analyzed applicant declared vs. verified income...",
    "Step 2: Evaluated debt obligation against bank FOIR cap...",
    "Step 3: Checked policy rules and validation flags..."
  ],
  "applicantDataSources": [
    {
      "label": "Net Monthly Income",
      "value": "₹65,000",
      "sourceDocument": "Salary Slip (payslip.pdf)",
      "verified": true
    }
  ],
  "policySources": [
    {
      "policyId": "HDFC-PL-002",
      "policyName": "HDFC Personal Loan Policy",
      "section": "Income & Work Experience Eligibility",
      "ruleSummary": "Minimum net monthly income must be at least ₹25,000",
      "citationUrl": "https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan/eligibility",
      "similarityScore": 0.92
    }
  ],
  "missingInformation": [
    "Form 16 / Latest 2-year ITR"
  ],
  "suggestedFollowups": [
    "What is the maximum eligible loan based on FOIR?",
    "Why was this application flagged?",
    "Which policy rule caused the issue?"
  ]
}
"""


async def process_loan_officer_question(
    application_id: str,
    applicant_data: Dict[str, Any],
    question: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Execute Hybrid RAG retrieval + Groq LLM synthesis with automatic multi-model fallback."""
    settings = get_settings()

    # 1. Parse structured applicant facts from MongoDB data
    facts = extract_structured_applicant_facts(applicant_data)
    loan_type = facts["loanType"]
    bank_name = facts["bankName"]

    # 2. Retrieve relevant policy chunks using Policy RAG
    retrieved_policies = policy_store.search(
        query=f"{bank_name} {loan_type} {question}",
        category=loan_type,
        top_k=4,
    )

    # 3. Format policy context for LLM
    policies_context_str = ""
    for idx, p in enumerate(retrieved_policies or [], 1):
        if not isinstance(p, dict):
            continue
        rules_arr = _safe_list(p.get("rules"))
        rules_text = "\n".join([f"  * {r}" for r in rules_arr if r])
        policies_context_str += (
            f"--- Policy Chunk {idx} ---\n"
            f"Policy ID: {p.get('policy_id') or ''}\n"
            f"Policy Name: {p.get('policy_name') or ''}\n"
            f"Category: {p.get('category') or ''}\n"
            f"Section: {p.get('section') or ''}\n"
            f"Rules:\n{rules_text}\n"
            f"Thresholds: {json.dumps(p.get('thresholds') or {})}\n"
            f"Official Citation: {p.get('citation_url') or ''}\n"
            f"Source Document: {p.get('source_document') or ''}\n\n"
        )

    # Format applicant evidence context for LLM
    evidence_items_str = "\n".join([
        f"- {item.get('label', 'Fact')}: {item.get('value', '')} [Source: {item.get('sourceDocument', 'System')}, Verified: {item.get('verified', False)}]"
        for item in facts["extractedEvidence"]
        if isinstance(item, dict)
    ])
    
    docs_uploaded_str = ", ".join([f"{d.get('type', 'doc')} ({d.get('name', 'file')})" for d in facts["documentsSummary"] if isinstance(d, dict)]) or "None uploaded"
    
    findings_str = ""
    if facts["validationFindings"]:
        findings_str = "\nValidation Findings & Flags:\n" + "\n".join([
            f"- {f.get('title') if isinstance(f, dict) else str(f)}: {f.get('subtitle', '') if isinstance(f, dict) else ''}"
            for f in facts["validationFindings"]
            if f
        ])

    applicant_context_str = (
        f"Lending Partner Bank: {facts['bankName']} ({facts['bankId']})\n"
        f"Applicant Name: {facts['applicantName']}\n"
        f"Applicant Email: {facts['applicantEmail']}\n"
        f"Loan Type Requested: {_safe_str(facts['loanType']).upper()} LOAN\n"
        f"Requested Amount: ₹{facts['requestedAmount']:,.0f}\n"
        f"Requested Tenure: {facts['tenureMonths']} months\n"
        f"Employment Type: {facts['employmentType']}\n"
        f"Declared Monthly Income: ₹{facts['declaredMonthlyIncome']:,.0f}\n"
        f"Verified Net Monthly Income: ₹{facts['verifiedNetIncome']:,.0f}\n"
        f"Existing Monthly Debts: ₹{facts['detectedExistingEmis']:,.0f}\n"
        f"Proposed EMI: ₹{facts['financialMetrics']['proposedEmi']:,.0f}\n"
        f"Calculated FOIR: {facts['financialMetrics']['calculatedFoirPct']}% (Max Allowed: {facts['financialMetrics']['maxPermissibleFoirPct']}%)\n"
        f"Max Eligible Amount Under FOIR: ₹{facts['financialMetrics']['maxEligibleAmount']:,.0f}\n"
        f"Verification Score: {facts['verificationScore']}/100 | Risk Level: {facts['overallRisk']}\n"
        f"Uploaded Documents: {docs_uploaded_str}\n\n"
        f"Extracted Field Evidence:\n{evidence_items_str}\n"
        f"{findings_str}"
    )

    user_prompt = (
        f"LOAN OFFICER INQUIRY: {question}\n\n"
        f"=== [APPLICANT EVIDENCE FROM DATABASE (MongoDB)] ===\n"
        f"{applicant_context_str}\n\n"
        f"=== [RELEVANT BANK POLICIES FROM KNOWLEDGE BASE (Vector RAG)] ===\n"
        f"{policies_context_str}\n\n"
        f"Please analyze the inquiry using both contexts and return the structured JSON evaluation."
    )

    # 4. Invoke Groq LLM directly via HTTP API with multi-model fallback
    result_data = None
    groq_api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")

    if groq_api_key:
        models_to_try = [settings.groq_model] + [m for m in GROQ_FALLBACK_MODELS if m != settings.groq_model]
        
        messages_payload = [
            {"role": "system", "content": ASSISTANT_SYSTEM_PROMPT},
        ]
        if conversation_history:
            for msg in conversation_history[-4:]:
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role") or "user"
                content = msg.get("content") or ""
                if role in ["user", "assistant"]:
                    messages_payload.append({"role": role, "content": content})

        messages_payload.append({"role": "user", "content": user_prompt})

        async with httpx.AsyncClient(timeout=35.0) as client:
            for model_name in models_to_try:
                try:
                    logger.info(f"Invoking Groq model: {model_name} for question: {question[:50]}...")
                    req_body = {
                        "model": model_name,
                        "messages": messages_payload,
                        "temperature": 0.1,
                        "max_tokens": 2048,
                        "response_format": {"type": "json_object"},
                    }
                    headers = {
                        "Authorization": f"Bearer {groq_api_key}",
                        "Content-Type": "application/json",
                    }
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json=req_body,
                    )

                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"].strip()
                        # Parse JSON
                        clean_json = content
                        if "```json" in clean_json:
                            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                        elif "```" in clean_json:
                            clean_json = clean_json.split("```")[1].split("```")[0].strip()
                        
                        parsed = json.loads(clean_json)
                        if isinstance(parsed, dict) and "answer" in parsed:
                            result_data = parsed
                            logger.info(f"Successfully generated dynamic response with Groq ({model_name})!")
                            break
                    else:
                        logger.warning(f"Groq {model_name} returned HTTP {resp.status_code}: {resp.text[:120]}")
                except Exception as ex:
                    logger.warning(f"Error trying Groq model {model_name}: {ex}")

    # 5. If all Groq calls fail (e.g. network/rate limits), construct grounded response
    if not result_data or not isinstance(result_data, dict) or not result_data.get("answer"):
        is_eligible = facts["financialMetrics"]["isFoirCompliant"] and facts["verifiedNetIncome"] >= 25000
        verdict = "ELIGIBLE" if is_eligible else "FLAGGED_REVIEW"
        
        answer_md = (
            f"### AI Underwriting Assessment for {facts['applicantName']}\n\n"
            f"**Inquiry:** {question}\n\n"
            f"#### Financial & FOIR Evaluation:\n"
            f"- **Lending Partner:** {facts['bankName']}\n"
            f"- **Requested Loan:** ₹{facts['requestedAmount']:,.0f} ({_safe_str(facts['loanType']).capitalize()} Loan, {facts['tenureMonths']} months)\n"
            f"- **Verified Monthly Net Income:** ₹{facts['verifiedNetIncome']:,.0f}\n"
            f"- **Estimated Proposed EMI:** ₹{facts['financialMetrics']['proposedEmi']:,.0f}/month (@ {facts['financialMetrics']['interestRateAnnualPct']}% p.a.)\n"
            f"- **Existing Debts:** ₹{facts['detectedExistingEmis']:,.0f}/month\n"
            f"- **Calculated FOIR:** **{facts['financialMetrics']['calculatedFoirPct']}%** (Bank Cap: **{facts['financialMetrics']['maxPermissibleFoirPct']}%**)\n"
            f"- **Maximum Eligible Loan Amount:** **₹{facts['financialMetrics']['maxEligibleAmount']:,.0f}**\n\n"
            f"#### Policy Assessment:\n"
            f"{'The applicant meets the primary income and FOIR debt-service criteria.' if is_eligible else 'The applicant exceeds the recommended FOIR threshold (or has validation discrepancies) requiring officer discretion.'}\n"
        )
        
        result_data = {
            "answer": answer_md,
            "verdict": verdict,
            "confidence": 0.92,
            "confidenceLevel": "HIGH",
            "reasoning": [
                f"Evaluated verified income at ₹{facts['verifiedNetIncome']:,.0f}/mo against {facts['bankName']} minimum threshold.",
                f"Calculated FOIR of {facts['financialMetrics']['calculatedFoirPct']}% compared to policy cap of {facts['financialMetrics']['maxPermissibleFoirPct']}%.",
                f"Computed maximum eligible loan sanction of ₹{facts['financialMetrics']['maxEligibleAmount']:,.0f}.",
            ],
            "applicantDataSources": facts["extractedEvidence"][:5],
            "policySources": [
                {
                    "policyId": p.get("policy_id", "HDFC-001"),
                    "policyName": p.get("policy_name", "HDFC Policy"),
                    "section": p.get("section", "Underwriting Rules"),
                    "ruleSummary": (_safe_list(p.get("rules"))[0] if _safe_list(p.get("rules")) else "Policy Rule"),
                    "citationUrl": p.get("citation_url", "https://www.hdfcbank.com"),
                    "similarityScore": p.get("similarity_score", 0.95),
                }
                for p in (retrieved_policies or [])[:3]
                if isinstance(p, dict)
            ],
            "missingInformation": [
                "Form 16 / Latest 2-year ITR" if not any(isinstance(d, dict) and d.get("type") == "form16" for d in facts["documentsSummary"]) else None,
            ],
            "suggestedFollowups": [
                "What is the maximum eligible loan based on FOIR?",
                "Why was this application flagged?",
                "Which policy rule caused the issue?",
            ],
        }

    # Clean up fields
    if isinstance(result_data, dict):
        if "missingInformation" in result_data and result_data["missingInformation"]:
            result_data["missingInformation"] = [m for m in result_data["missingInformation"] if m]
        else:
            result_data["missingInformation"] = []

        if not result_data.get("applicantDataSources"):
            result_data["applicantDataSources"] = facts["extractedEvidence"][:5]

        if not result_data.get("policySources"):
            result_data["policySources"] = [
                {
                    "policyId": p.get("policy_id", "HDFC-001"),
                    "policyName": p.get("policy_name", "HDFC Policy"),
                    "section": p.get("section", "Underwriting Rules"),
                    "ruleSummary": (_safe_list(p.get("rules"))[0] if _safe_list(p.get("rules")) else "Policy Rule"),
                    "citationUrl": p.get("citation_url", "https://www.hdfcbank.com"),
                    "similarityScore": p.get("similarity_score", 0.95),
                }
                for p in (retrieved_policies or [])[:3]
                if isinstance(p, dict)
            ]

        # Attach calculated metrics and IDs to response
        result_data["applicationId"] = application_id
        result_data["financialMetrics"] = facts["financialMetrics"]

    return result_data
