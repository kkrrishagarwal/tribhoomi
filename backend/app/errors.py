"""
Error responses a person can read. Every error body is JSON with a string `detail`, so the
frontend never has to show a raw validation array or a bare status code.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("tribhoomi")


def _field(loc) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return " → ".join(parts).replace("_", " ") or "request"


def readable_validation(errors: list[dict]) -> str:
    """'Description: String should have at least 5 characters. Unit ulpin: Field required.'"""
    lines = []
    for e in errors[:4]:
        msg = str(e.get("msg", "is not valid")).removeprefix("Value error, ")
        lines.append(f"{_field(e.get('loc', ())).capitalize()}: {msg}.")
    if len(errors) > 4:
        lines.append(f"(+{len(errors) - 4} more)")
    return " ".join(lines)


def install(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        errors = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": readable_validation(errors), "errors": errors})

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={
            "detail": "The server hit an unexpected problem handling this request. Nothing was saved. Please try again.",
            "error_type": type(exc).__name__,
        })
