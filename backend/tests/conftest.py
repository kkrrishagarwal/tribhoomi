"""Shared fixtures: an isolated, seeded SQLite database and a FastAPI test client."""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from seed.seed import run
    run(reset=True)
    from app.main import app
    with TestClient(app) as c:
        yield c


def hdr(role: str, user: str) -> dict:
    return {"X-Role": role, "X-User": user}
