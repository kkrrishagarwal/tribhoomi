"""Collect data from the DB and hand it to the pure topology checks."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session, selectinload

from ..models import Building, Floor, Parcel
from ..topology import (
    Conflict,
    check_duplicates,
    check_outside_footprint,
    check_underground_clash,
    check_unit_overlaps,
)


def validate_parcel(p: Parcel) -> list[Conflict]:
    conflicts: list[Conflict] = []
    all_ulpins = [p.ulpin_2d]
    layers = [(l.layer_ulpin, json.loads(l.local_footprint), l.top_m, l.bottom_m)
              for l in p.underground_layers if l.layer_type != "air_rights"]
    all_ulpins += [l.layer_ulpin for l in p.underground_layers]

    for b in p.buildings:
        all_ulpins.append(b.building_ulpin)
        units = []
        for f in b.floors:
            all_ulpins.append(f.floor_ulpin)
            for u in f.units:
                all_ulpins.append(u.unit_ulpin)
                units.append((u.unit_ulpin, u.volume))
        conflicts += check_unit_overlaps(units)
        conflicts += check_outside_footprint(units, json.loads(b.local_footprint))
        basement = [(ul, box) for ul, box in units if box[5] <= 0]
        conflicts += check_underground_clash(basement, layers)

    conflicts += check_duplicates(all_ulpins)
    for c in conflicts:
        c.parcel_id = p.id
    return conflicts


def _load(db: Session, parcel_id: int | None = None) -> list[Parcel]:
    q = db.query(Parcel).options(
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units),
        selectinload(Parcel.underground_layers),
    )
    if parcel_id is not None:
        q = q.filter(Parcel.id == parcel_id)
    return q.all()


def validate(db: Session, parcel_id: int | None = None) -> dict:
    parcels = _load(db, parcel_id)
    conflicts: list[Conflict] = []
    checked_units = 0
    for p in parcels:
        conflicts += validate_parcel(p)
        checked_units += sum(len(f.units) for b in p.buildings for f in b.floors)
    return {
        "parcels_checked": len(parcels),
        "units_checked": checked_units,
        "conflict_count": len(conflicts),
        "conflicts": [c.to_dict() for c in conflicts],
        "conflicting_ulpins": sorted({u for c in conflicts for u in (c.ulpin_a, c.ulpin_b) if u}),
    }
