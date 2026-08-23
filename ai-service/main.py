"""LoanLens AI Service — Document Intelligence API."""

import hmac
import logging

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from routers.documents import router as documents_router
from routers.assistant import router as assistant_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LoanLens AI Service",
    description="AI-powered document intelligence for loan processing",
    version="1.0.0",
)

# CORS — allow Node.js backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_service_token(
    x_internal_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    """Fail-closed service-to-service auth for every /api route.

    The Node backend is the ONLY legitimate caller. It presents the shared
    secret via `X-Internal-Token` (or `Authorization: Bearer <token>`).

    - No token configured on the service  -> 503 (refuse to serve; never open).
    - Missing or mismatched caller token   -> 401.
    Comparison uses hmac.compare_digest to avoid timing side-channels.
    """
    from config import get_settings

    expected = get_settings().ai_service_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service authentication is not configured (set AI_SERVICE_TOKEN).",
        )

    provided = x_internal_token
    if not provided and authorization and authorization.lower().startswith("bearer "):
        provided = authorization.split(" ", 1)[1].strip()

    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service token.",
        )


# Register routers — EVERY /api route requires the shared service token.
app.include_router(documents_router, dependencies=[Depends(require_service_token)])
app.include_router(assistant_router, dependencies=[Depends(require_service_token)])


@app.get("/")
async def root():
    """Public, unauthenticated liveness probe (no sensitive data)."""
    return {"service": "LoanLens AI Service", "status": "ok"}


@app.on_event("startup")
async def startup_event():
    from config import get_settings

    settings = get_settings()
    if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":
        logger.warning(
            "⚠️  GEMINI_API_KEY not configured! "
            "Set it in ai-service/.env — Get a key from https://aistudio.google.com/"
        )
    else:
        logger.info(f"✅ Gemini API key configured (model: {settings.gemini_model})")

    if not settings.mistral_api_key:
        logger.warning(
            "⚠️  MISTRAL_API_KEY not configured! "
            "Set it in ai-service/.env for Mistral document extraction"
        )
    else:
        logger.info(f"✅ Mistral API key configured (model: {settings.mistral_model})")

    if not settings.groq_api_key:
        logger.warning(
            "⚠️  GROQ_API_KEY not configured! "
            "Set it in ai-service/.env for Groq cross-document verification analysis"
        )
    else:
        logger.info(f"✅ Groq API key configured (model: {settings.groq_model})")

    if not settings.ai_service_token:
        logger.warning(
            "🔒 AI_SERVICE_TOKEN not configured! All /api routes will return 503. "
            "Set the SAME value in ai-service/.env and backend/.env to allow the backend to call this service."
        )
    else:
        logger.info("🔒 Service token configured — /api routes require X-Internal-Token")

    logger.info("🚀 LoanLens AI Service started on http://localhost:8000")
    logger.info("📄 API docs: http://localhost:8000/docs")
