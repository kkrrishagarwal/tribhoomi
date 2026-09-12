"""
Seed the database from seed/parcels.geojson.

Run:  cd backend && .venv/bin/python -m seed.seed

Layout creation lives in app/services/layout.py (shared with the builder tool).
This file adds the demo story on top: owners, unsold units, and two integrity
scenarios (a silent unapproved change with a dispute, and a pending change request).
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta

import csv

from app.config import SEED_FILE
from app.db import Base, SessionLocal, engine
from app.models import Floor, MarketContextProject, Parcel, Unit
from app.services import integrity
from app.services.layout import create_layout
from app.ulpin import ParcelKey

OWNER_NAMES = [
    "Anita Sharma", "Rajesh Kumar", "Priya Nair", "Mohammed Irfan", "Sunita Devi", "Vikram Singh",
    "Deepa Iyer", "Harpreet Kaur", "Arjun Mehta", "Fatima Begum", "Suresh Reddy", "Kavita Joshi",
    "Rohan Gupta", "Meera Pillai", "Amitabh Chatterjee", "Neha Verma", "Sanjay Patel", "Lakshmi Rao",
    "Imran Khan", "Pooja Malhotra", "Tarun Bhatia", "Rekha Menon", "Nikhil Desai", "Shalini Agarwal",
]
COMMERCIAL_OWNERS = [
    "Bharat Traders Pvt Ltd", "Suryodaya Textiles LLP", "Noida Cafe Co.", "Vasant Pharmacy",
    "InfoBridge Software Pvt Ltd", "Kesar Sweets & Bakers", "Metro Cable Networks", "Gyan Book Depot",
]
GOVT_OWNERS = ["Noida Authority", "Greater Noida Industrial Development Authority", "UP Jal Nigam", "Paschimanchal Vidyut Vitran Nigam Ltd"]

# Fixed identities used by the role switcher in the UI
DEMO_INVESTORS = {
    "Anita Sharma": "anita.sharma@example.in",
    "Rajesh Kumar": "rajesh.kumar@example.in",
    "Priya Nair": "priya.nair@example.in",
}


def email_for(name: str) -> str:
    if name in DEMO_INVESTORS:
        return DEMO_INVESTORS[name]
    slug = name.lower().replace("&", "and").replace(".", "").replace(",", "")
    slug = "".join(ch if ch.isalnum() or ch == " " else "" for ch in slug).strip().replace(" ", ".")
    return f"{slug}@example.in"


def pick_owner(usage: str, rng: random.Random) -> tuple[str, str]:
    if usage == "utility":
        return rng.choice(GOVT_OWNERS), "government"
    if usage == "parking":
        return "Residents' Welfare Association", "cooperative"
    if usage == "commercial":
        return rng.choice(COMMERCIAL_OWNERS), rng.choice(["leasehold", "leasehold", "freehold"])
    return rng.choice(OWNER_NAMES), rng.choice(["freehold", "freehold", "joint", "leasehold"])


def seed_parcel(db, feature: dict, rng: random.Random) -> Parcel:
    props = feature["properties"]
    key = ParcelKey(props["state_code"], props["district_code"], props["village_ward_code"], props["parcel_no"])
    parcel = create_layout(
        db, geometry=feature["geometry"], key=key, name=props["name"],
        state=props["state"], district=props["district"], village_ward=props["village_ward"],
        builder=props.get("builder", "Unknown Developer"), land_use=props.get("land_use", "mixed"),
        building=props["building"], underground_layers=props.get("underground_layers"), air_rights=props.get("air_rights"),
    )
    bld = parcel.buildings[0]
    unsold_top_floors = props.get("unsold_top_floors", 2)
    for floor in bld.floors:
        for unit in floor.units:
            # keep the top floors unsold so the builder dashboard has editable units
            if floor.floor_number >= bld.num_floors - unsold_top_floors:
                continue
            name, otype = pick_owner(unit.usage_type, rng)
            when = datetime(2012, 1, 1) + timedelta(days=rng.randint(0, 365 * 13))
            integrity.assign_unit(db, unit, name, email_for(name), otype, builder=parcel.builder, when=when)
            if otype == "joint":
                unit.ownerships[0].share_percent = 50.0
    return parcel


def find_unit(db, label: str, building_name: str) -> Unit:
    return (db.query(Unit).join(Floor).join(Floor.building)
            .filter(Unit.label == label, Floor.building.has(name=building_name)).one())


def seed_integrity_scenarios(db) -> None:
    """Two stories for the demo: one caught fraud, one proper change request in flight."""
    # --- Scenario 1: silent change, disputed (Aravalli Residency, Floor 3-C -> "Floor 3-D", boundary shifted)
    u = find_unit(db, "Floor 3-C", "Aravalli Residency")
    owner = u.ownerships[0]
    owner.owner_name, owner.owner_email = "Anita Sharma", DEMO_INVESTORS["Anita Sharma"]
    # the tampering: label renamed and boundary pushed 1.8 m into the neighbour, recorded without any approval
    u.label = "Floor 3-D"
    integrity.apply_volume(u, integrity.shifted_volume(u, dx=1.8))
    integrity.append_version(db, u, changed_by="Aravalli Builders LLP", reason="Layout revision per revised Noida Authority sanction plan",
                             approval_status="unapproved", when=datetime(2025, 11, 14, 10, 30))
    integrity.raise_dispute(db, u, raised_by=owner.owner_email,
                            description="My flat was registered as 3-C. The registry now shows 3-D with a different boundary. "
                                        "I never approved any change.", when=datetime(2026, 1, 9, 9, 15))

    # --- Scenario 2: builder follows the process — pending change request awaiting the investor (Tribhoomi Tower, Floor 5-A)
    u2 = find_unit(db, "Floor 5-A", "Tribhoomi Tower")
    owner2 = u2.ownerships[0]
    owner2.owner_name, owner2.owner_email = "Rajesh Kumar", DEMO_INVESTORS["Rajesh Kumar"]
    integrity.create_change_request(db, u2, builder="Tribhoomi Developers Pvt Ltd",
                                    proposed_volume=integrity.shifted_volume(u2, dw=1.2),
                                    proposed_plot_number="Floor 5-A",
                                    reason="Align eastern wall with as-built survey (+1.2 m); no change to neighbours.",
                                    when=datetime(2026, 8, 30, 15, 0))

    # --- Scenario 3: a properly approved change (Yamuna Commercial Plaza, Ground-B) so the timeline shows a good example
    u3 = find_unit(db, "Ground-B", "Yamuna Commercial Plaza")
    owner3 = u3.ownerships[0]
    owner3.owner_name, owner3.owner_email = "Priya Nair", DEMO_INVESTORS["Priya Nair"]
    cr = integrity.create_change_request(db, u3, builder="Yamuna Infra Ltd",
                                         proposed_volume=integrity.shifted_volume(u3, dd=-0.5),
                                         proposed_plot_number="Shop G-2",
                                         reason="Renumber shop per Ghaziabad Nagar Nigam trade licence; give up 0.5 m at the rear for the service corridor.",
                                         when=datetime(2025, 5, 2, 11, 0))
    integrity.decide_change_request(db, cr, "approve", owner3.owner_email, note="Agreed; corridor access benefits the shop.")

    # --- Scenario 4: the topology overlap on Tribhoomi Tower floor 7 is also disputed by the owner of 7-B
    u4 = find_unit(db, "Floor 7-B", "Tribhoomi Tower")
    d = integrity.raise_dispute(db, u4, raised_by=u4.ownerships[0].owner_email,
                                description="Neighbouring unit 7-C has been surveyed 2.5 m into my flat (validator UNIT_OVERLAP).",
                                when=datetime(2026, 3, 22, 17, 45))
    d.status = "investigating"


def seed_market_context(db) -> int:
    """Real NCR projects from seed/market_context.csv — informational layer, never linked to units."""
    path = SEED_FILE.parent / "market_context.csv"
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        db.add(MarketContextProject(
            builder_name=r["builder_name"], project_name=r["project_name"], city=r["city"], locality=r["locality"],
            property_type=r["property_type"],
            latitude=float(r["latitude"]) if r["latitude"] not in ("", "unknown") else None,
            longitude=float(r["longitude"]) if r["longitude"] not in ("", "unknown") else None,
            total_units=r["total_units"] or "unknown", towers=r["towers"] or "unknown", floors=r["floors"] or "unknown",
            rera_id=r["rera_id"] or "unknown", status=r["status"] or "unknown", data_source=r["data_source"],
            data_date=r["data_date"], confidence=r["confidence"] or "unknown", notes=r.get("notes", "") or "",
        ))
    db.flush()
    return len(rows)


def run(reset: bool = True) -> None:
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    rng = random.Random(26011)  # fixed seed -> same demo data every time
    data = json.loads(SEED_FILE.read_text())
    with SessionLocal() as db:
        for feature in data["features"]:
            p = seed_parcel(db, feature, rng)
            print(f"seeded parcel {p.ulpin_2d}  {p.name}")
        seed_integrity_scenarios(db)
        n = seed_market_context(db)
        db.commit()
        print("units:", db.query(Unit).count(), "floors:", db.query(Floor).count(), "market-context projects:", n)


if __name__ == "__main__":
    run()
