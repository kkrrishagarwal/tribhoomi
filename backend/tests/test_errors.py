"""Error bodies must always be JSON with a readable string `detail` (the UI shows it as-is)."""
from fastapi.testclient import TestClient

from .conftest import hdr


def test_validation_error_is_a_sentence_not_a_json_array(client):
    r = client.post("/api/disputes", json={"unit_ulpin": "zz", "description": ""}, headers=hdr("investor", "anita.sharma@example.in"))
    assert r.status_code == 422
    body = r.json()
    assert isinstance(body["detail"], str)
    assert "Description" in body["detail"] and "at least 5 characters" in body["detail"]
    assert "{" not in body["detail"] and "[" not in body["detail"]
    assert body["errors"][0]["loc"][-1] == "description"   # raw list kept for developers


def test_missing_fields_are_named(client):
    r = client.post("/api/builder/units", json={}, headers=hdr("builder", "Aravalli Builders LLP"))
    assert r.status_code == 422
    assert "Building id: Field required." in r.json()["detail"]


def test_not_found_and_forbidden_keep_their_plain_messages(client):
    assert client.get("/api/property/NOPE").json()["detail"] == "No property found for NOPE."
    r = client.post("/api/builder/units", json={})
    assert r.status_code == 403 and "needs role" in r.json()["detail"]


def test_unexpected_crash_returns_json_detail(client):
    from app.main import app

    @app.get("/api/_boom")
    def boom():
        raise RuntimeError("secret internals")

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/_boom")
    assert r.status_code == 500
    body = r.json()
    assert "try again" in body["detail"] and "secret internals" not in body["detail"]
    assert body["error_type"] == "RuntimeError"


def test_two_demo_setups_at_once_both_succeed(client):
    """A double-click on 'Create the demo scenario' used to return HTTP 500 (duplicate building ULPIN)."""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post("/api/demo/flagship?stage=setup"), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    towers = {r.json()["building_id"] for r in results}
    assert len(towers) == 2   # each call got its own tower, nothing collided
