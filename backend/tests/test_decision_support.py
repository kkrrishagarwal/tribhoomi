"""API tests for the analysis layer, permissions and the flagship scenario."""
from tests.conftest import hdr

A = hdr("authority", "Authority Demo User")
B = hdr("builder", "Aravalli Heights Developers (demo)")
I = hdr("investor", "buyer@example.in")
O = hdr("owner", "anita.sharma@example.in")
TAMPERED = "TRB-AR46-F03-U03"   # Aravalli Residency Floor 3-C -> 3-D story


def test_risk_timeline_and_priority_for_tampered_unit(client):
    r = client.get(f"/api/property/{TAMPERED}/analysis"); assert r.status_code == 200
    d = r.json()
    risks = [e["risk"] for e in d["timeline"]]
    assert "critical" in risks and "high" in risks                      # dispute + unapproved overlap
    assert d["timeline"] == sorted(d["timeline"], key=lambda e: e["at"])
    assert d["priority"]["level"] in ("critical", "high") and d["priority"]["factors"]
    assert "heuristic" in d["priority"]["method"]
    assert d["trust"]["overall"] == "Potential conflict detected"
    assert d["completeness"]["missing"] == ["Official land-record linkage"] or "Official land-record linkage" in d["completeness"]["missing"]
    assert "modified" in d["insight"].lower() or "overlap" in d["insight"].lower()
    assert d["graph"]["nodes"][0]["type"] == "Land parcel" and d["graph"]["conflicts"]


def test_simulation_never_modifies_stored_geometry(client):
    before = client.get(f"/api/property/{TAMPERED}").json()["volume"]
    huge = {"min": [before["min"][0], before["min"][1]], "max": [before["max"][0] + 6, before["max"][1] + 6]}
    r = client.post(f"/api/authority/simulate/{TAMPERED}", json={"volume": huge}, headers=A); assert r.status_code == 200
    s = r.json()
    assert s["saved"] is False and s["badge"].startswith("SIMULATION")
    assert s["change"]["area_pct"] > 0 and s["priority_after"]["score"] >= s["priority_before"]["score"]
    after = client.get(f"/api/property/{TAMPERED}").json()["volume"]
    assert after == before
    assert client.post(f"/api/authority/simulate/{TAMPERED}", json={"volume": huge}, headers=I).status_code == 403


def test_public_verification_hides_private_data(client):
    r = client.get(f"/api/property/{TAMPERED}"); d = r.json()
    assert "owner" not in d and d["tpid"] == TAMPERED
    v = client.get(f"/api/property/{TAMPERED}/verify").json()
    assert v["result"] == "Conflict detected"
    assert client.get("/api/property/TRB-NOPE-F01-U01").status_code == 404


def test_permission_boundaries(client):
    assert client.get("/api/authority/queue", headers=I).status_code == 403
    assert client.get("/api/authority/map", headers=B).status_code == 403
    assert client.post(f"/api/authority/units/{TAMPERED}/decide", json={"decision": "approve"}, headers=B).status_code == 403
    assert client.post("/api/builder/units", json={"building_id": 1, "floor_number": 0, "label": "x", "volume": {"min": [0, 0, 0], "max": [5, 5, 0]}}, headers=I).status_code == 403


def test_watch_and_alerts(client):
    r = client.post(f"/api/watch/{TAMPERED}", headers=I); assert r.json()["watching"] is True
    a = client.get("/api/alerts", headers=I).json()
    assert TAMPERED in a["watching"]
    assert client.post(f"/api/watch/{TAMPERED}", headers=I).json()["watching"] is False
    owner = client.get("/api/alerts", headers=O).json()
    assert any(x["tpid"] == TAMPERED for x in owner["alerts"])   # owners are alerted about their own property


def test_flagship_scenario_end_to_end(client):
    r = client.post("/api/demo/flagship?stage=setup"); assert r.status_code == 200
    d = r.json(); c, dd = d["units"]["3-C"], d["units"]["3-D"]
    # verified baseline exists, modification pending with a detected new overlap
    an = client.get(f"/api/property/{c}/analysis").json()
    assert an["change"]["mode"] == "registered_vs_proposed"
    assert [x["label"] for x in an["change"]["new_conflicts"]] == ["3-D"]
    assert an["change"]["area_pct"] > 10 and an["change"]["edge_moves"][0]["edge"] == "east"
    assert any(x["tpid"] == dd for x in an["impacted"])
    assert an["priority"]["level"] in ("high", "critical")
    q = client.get("/api/authority/queue", headers=A).json()["queue"]
    assert any(x["tpid"] == c for x in q) and q[0]["priority"]["level"] in ("critical", "high")
    # authority requests a correction with a structured reason; decision lands in the audit trail
    r = client.post(f"/api/change-requests/{d['change_request_id']}/decide", json={"decision": "changes", "category": "Neighbour conflict", "note": "Overlaps 3-D"}, headers=A)
    assert r.status_code == 200 and r.json()["change_request"]["status"] == "changes_requested"
    dec = client.get(f"/api/property/{c}/analysis").json()["decisions"]
    assert dec and dec[-1]["category"] == "Neighbour conflict"
    # builder resubmits a corrected boundary; authority approves; a new version is recorded
    land = client.get(f"/api/property/{c}").json()["land_record_id"]
    r = client.post(f"/api/builder/units/{land}/change-requests", json={"dw": 0.4, "reason": "Corrected boundary"}, headers=B); assert r.status_code == 200
    cr2 = r.json()["change_request"]["id"]
    r = client.post(f"/api/change-requests/{cr2}/decide", json={"decision": "approve", "category": "Boundary correction"}, headers=A); assert r.status_code == 200
    prop = client.get(f"/api/property/{c}").json()
    assert prop["version_count"] == 2 and prop["versions"][-1]["approval_status"] == "approved"
    pv = client.get(f"/api/property/{c}/verify").json()
    assert pv["result"] == "Property appears consistent"
    # simulation on the verified unit does not change it
    vol = prop["volume"]
    client.post(f"/api/authority/simulate/{c}", json={"volume": {"min": vol["min"][:2], "max": [vol["max"][0] + 3, vol["max"][1]]}}, headers=A)
    assert client.get(f"/api/property/{c}").json()["volume"] == vol


def test_checklist_and_project_health(client):
    d = client.post("/api/demo/flagship?stage=full").json()
    ck = client.get(f"/api/builder/units/{d['units']['3-B']}/checklist").json()
    assert ck["ready"] is True and len(ck["items"]) == 7
    h = client.get(f"/api/projects/{d['project_id']}/health").json()
    assert h["units"] >= 3 and h["verified"] >= 3 and 0 <= h["readiness_percent"] <= 100 and "readiness" in h["method"].lower()


def test_decision_requires_reason(client):
    d = client.post("/api/demo/flagship?stage=setup").json()
    # a fresh pending unit to reject without a reason
    r = client.post("/api/builder/units", json={"building_id": d["building_id"], "floor_number": 5, "label": "5-A", "unit_type": "2 BHK", "volume": {"min": [-20, -20, 0], "max": [-10, -10, 0]}}, headers=B)
    assert r.status_code == 200
    t = r.json()["unit"]["tpid"]; client.post(f"/api/builder/units/{t}/submit", headers=B)
    assert client.post(f"/api/authority/units/{t}/decide", json={"decision": "reject"}, headers=A).status_code == 400
    assert client.post(f"/api/authority/units/{t}/decide", json={"decision": "reject", "category": "Missing information"}, headers=A).status_code == 200
