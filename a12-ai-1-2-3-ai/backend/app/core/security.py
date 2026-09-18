import secrets

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings


def verify_request_token(request: Request) -> JSONResponse | None:
    """Return a 401 response when the request is not authorized, or None if allowed.

    When ``TEACHNOVA_API_TOKEN`` is not configured, auth is disabled (local dev mode).
    The token is expected in the ``Authorization: Bearer <token>`` header and compared
    in constant time to avoid timing attacks.
    """
    expected = settings.teachnova_api_token.strip()
    if not expected:
        return None

    authorization = request.headers.get("authorization", "")
    provided = ""
    if authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()

    if provided and secrets.compare_digest(provided, expected):
        return None

    return JSONResponse(
        status_code=401,
        content={"detail": "未授权：请在 Authorization 头中提供有效的 Bearer Token"},
    )
