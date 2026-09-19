"""Area Insights must stay a neutral list of sourced facts: no verdicts, no invented numbers."""
import csv
import json
from pathlib import Path

DISCLAIMER = "Informational only, based on public data as noted. Not investment advice."
# words that would turn a fact list into advice or a verdict
VERDICT_WORDS = ("posh", "up-and-coming", "upcoming hotspot", "hotspot", "profitable", "appreciat", "best area", "premium locality",
                 "recommended", "good investment", "high growth", "undervalued", "score", "rating", "rank")


def test_index_lists_real_localities_with_the_disclaimer(client):
    d = client.get("/api/area-insights").json()
    assert d["disclaimer"] == DISCLAIMER
    assert {"city": "Greater Noida", "locality": "Sector 10", "known_projects": 1} in d["areas"]
    assert any(a["city"] == "Ghaziabad" for a in d["areas"])          # a city known only through infrastructure


def test_panel_has_three_neutral_items_and_never_invents_a_number(client):
    d = client.get("/api/area-insights", params={"city": "Greater Noida", "locality": "Sector 1"}).json()
    assert d["disclaimer"] == DISCLAIMER
    assert d["price_per_sqft"] == {"value": None, "text": "not publicly available", "note": d["price_per_sqft"]["note"]}
    inv = d["inventory"]
    assert inv["known_projects"] == 2 and inv["unsold_units"] == {"value": None, "text": "not publicly available"}
    assert inv["known_units"] is None or inv["known_units"] == sum(int(p["total_units"]) for p in inv["projects"] if p["total_units"].isdigit())
    assert inv["sources"], "inventory facts must name their sources"
    assert d["infrastructure"] and all(i["data_source"] and i["data_date"] and i["announced_status"] in ("planned", "under_construction", "completed") for i in d["infrastructure"])
    assert all("Noida" in i["city"] for i in d["infrastructure"])      # only this city's projects


def test_unknown_area_is_empty_not_guessed(client):
    d = client.get("/api/area-insights", params={"city": "Atlantis", "locality": "Nowhere"}).json()
    assert d["inventory"]["known_projects"] == 0 and d["inventory"]["known_units"] is None and d["infrastructure"] == []
    assert d["price_per_sqft"]["value"] is None and d["disclaimer"] == DISCLAIMER


def test_no_score_rating_or_verdict_anywhere(client):
    blobs = [json.dumps(client.get("/api/area-insights").json()).lower()]
    for c, l in (("Greater Noida", "Sector 1"), ("Gurugram", ""), ("Ghaziabad", ""), ("Noida", "")):
        blobs.append(json.dumps(client.get("/api/area-insights", params={"city": c, "locality": l}).json()).lower())
    seed = (Path(__file__).resolve().parent.parent / "seed" / "area_infrastructure.csv").read_text(encoding="utf-8").lower()
    for text in blobs + [seed]:
        text = text.replace(DISCLAIMER.lower(), "")
        assert not [w for w in VERDICT_WORDS if w in text]


def test_every_seeded_project_names_a_source_and_a_valid_status():
    path = Path(__file__).resolve().parent.parent / "seed" / "area_infrastructure.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert len(rows) >= 3
    for r in rows:
        assert r["data_source"].strip() and r["data_date"].strip() and r["expected_completion"].strip()
        assert r["project_type"] in ("metro", "expressway", "expansion", "other") and r["announced_status"] in ("planned", "under_construction", "completed")


def test_the_model_has_no_field_that_could_hold_a_verdict():
    from app.models import AreaInfrastructure
    cols = {c.name for c in AreaInfrastructure.__table__.columns}
    assert cols == {"id", "name", "locality", "city", "project_type", "description", "announced_status", "expected_completion", "data_source", "data_date"}
    assert not AreaInfrastructure.__table__.foreign_keys        # isolated from parcels, units and ownership
