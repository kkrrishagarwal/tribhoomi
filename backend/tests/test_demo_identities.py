"""Every role must offer one ready-made demo identity that lands on a screen with real data."""
from .conftest import hdr

ROLES = ("public", "builder", "investor", "owner", "admin")


def test_every_role_has_a_demo_identity(client):
    demo = client.get("/api/identities").json()["demo"]
    assert set(demo) == set(ROLES)
    for role in ROLES:
        d = demo[role]
        assert d and d["name"].strip() and isinstance(d["shows"], str)
        assert "user" in d          # public signs in with an empty user, which is intended


def test_picks_are_real_records_not_invented(client):
    ids = client.get("/api/identities").json()
    demo = ids["demo"]
    assert demo["builder"]["user"] in ids["builders"]
    assert demo["owner"]["user"] in {i["email"] for i in ids["investors"]}
    assert demo["admin"]["user"] == ids["admin"]["user"]


def test_the_builder_and_owner_picks_actually_have_something_to_show(client):
    demo = client.get("/api/identities").json()["demo"]
    b = client.get("/api/builder/dashboard", headers=hdr("builder", demo["builder"]["user"])).json()
    assert b["projects"], "the demo builder would land on an empty desk"
    assert sum(sum(p["counts"].values()) for p in b["projects"]) > 0
    o = client.get("/api/owner/properties", headers=hdr("owner", demo["owner"]["user"])).json()
    assert o["properties"], "the demo owner would land on an empty page"


def test_the_owner_pick_prefers_someone_with_a_decision_to_make(client):
    """A demo owner with a pending change can actually approve or dispute it."""
    demo = client.get("/api/identities").json()["demo"]
    props = client.get("/api/owner/properties", headers=hdr("owner", demo["owner"]["user"])).json()["properties"]
    interesting = [p for p in props if p["pending_modification"] or p["disputes_open"] or p["flags"]["has_unapproved_change"]]
    assert interesting, "the seeded stories give at least one owner something to act on"
    assert demo["owner"]["shows"]


def test_the_on_demand_flagship_builder_is_never_the_pick(client):
    """It is created by the demo page and wiped by a reseed, so it must not be the default."""
    client.post("/api/demo/flagship?stage=setup")
    demo = client.get("/api/identities").json()["demo"]
    assert "(demo)" not in demo["builder"]["user"]


def test_counts_read_as_english(client):
    demo = client.get("/api/identities").json()["demo"]
    joined = " ".join(d["shows"] for d in demo.values())
    for wrong in ("propertys", "1 units", "1 projects", "1 properties", "1 conflicts", "1 changes"):
        assert wrong not in joined
