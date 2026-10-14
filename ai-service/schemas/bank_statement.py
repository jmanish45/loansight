"""Bank statement extraction schema."""

from __future__ import annotations

from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator


def _clean_float(v: Any) -> Optional[float]:
    """Safely convert string/numeric/None values to float or None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        cleaned = "".join(ch for ch in v if ch.isdigit() or ch in ".-")
        if cleaned in ("", "-", "."):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


class TransactionItem(BaseModel):
    """A single bank transaction."""

    date: Optional[str] = Field(default=None, description="Transaction date")
    description: Optional[str] = Field(default="", description="Transaction narration / description")
    amount: Optional[float] = Field(default=0.0, description="Transaction amount")
    transaction_type: Optional[str] = Field(default=None, description="CREDIT or DEBIT")
    balance: Optional[float] = Field(default=None, description="Running balance after transaction")

    @field_validator("amount", mode="before")
    @classmethod
    def clean_amount(cls, v: Any) -> Optional[float]:
        val = _clean_float(v)
        return val if val is not None else 0.0

    @field_validator("balance", mode="before")
    @classmethod
    def clean_balance(cls, v: Any) -> Optional[float]:
        return _clean_float(v)


class BankStatementData(BaseModel):
    """Structured data extracted from a bank statement."""

    account_holder: Optional[str] = Field(default=None, description="Account holder name")
    bank_name: Optional[str] = Field(default=None, description="Bank name")
    branch: Optional[str] = Field(default=None, description="Branch name or code")
    account_number: Optional[str] = Field(default=None, description="Account number (may be partial)")
    ifsc_code: Optional[str] = Field(default=None, description="IFSC code")
    account_type: Optional[str] = Field(default=None, description="Savings / Current")

    statement_period_from: Optional[str] = Field(default=None, description="Statement start date")
    statement_period_to: Optional[str] = Field(default=None, description="Statement end date")
    employer_name: Optional[str] = Field(default=None, description="Employer name detected from salary credits or transaction narrations")

    # Summary
    opening_balance: Optional[float] = Field(default=None, description="Opening balance")
    closing_balance: Optional[float] = Field(default=None, description="Closing balance")
    total_credits: Optional[float] = Field(default=None, description="Total credit amount")
    total_debits: Optional[float] = Field(default=None, description="Total debit amount")
    average_balance: Optional[float] = Field(default=None, description="Average monthly balance")

    # Key transactions (salary credits, EMI debits)
    salary_credits: Optional[List[TransactionItem]] = Field(
        default_factory=list, description="Identified salary/income credit transactions"
    )
    emi_debits: Optional[List[TransactionItem]] = Field(
        default_factory=list, description="Identified EMI/loan debit transactions"
    )

    # Sample transactions
    transaction_count: Optional[int] = Field(default=None, description="Total number of transactions")
    sample_transactions: Optional[List[TransactionItem]] = Field(
        default_factory=list, description="First few transactions as a sample (max 10)"
    )

    @field_validator(
        "opening_balance",
        "closing_balance",
        "total_credits",
        "total_debits",
        "average_balance",
        mode="before",
    )
    @classmethod
    def clean_numeric_fields(cls, v: Any) -> Optional[float]:
        return _clean_float(v)
