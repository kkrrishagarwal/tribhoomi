"""Turn ORM rows into the JSON the Three.js viewer needs."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session, selectinload

from ..models import Building, Floor, Parcel, Unit
from ..ulpin import LayerType, parse_ulpin


def parcel_summary(p: Parcel) -> dict:
    return {
        "id": p.id,
        "ulpin_2d": p.ulpin_2d,
        "ulpin_2d_compact": p.ulpin_2d.replace("-", ""),
        "name": p.name,
        "state": p.state, "district": p.district, "village_ward": p.village_ward,
        "land_use": p.land_use, "builder": p.builder,
        "area_sqm": p.area_sqm,
        "centroid": {"lat": p.centroid_lat, "lng": p.centroid_lng},
        "buildings": [{"id": b.id, "name": b.name, "num_floors": b.num_floors, "num_basements": b.num_basements,
                       "building_ulpin": b.building_ulpin} for b in p.buildings],
        "underground_layers": [{"id": l.id, "name": l.name, "layer_type": l.layer_type, "layer_ulpin": l.layer_ulpin,
                                "top_m": l.top_m, "bottom_m": l.bottom_m, "operator": l.operator}
                               for l in p.underground_layers],
    }


def parcel_feature(p: Parcel) -> dict:
    return {"type": "Feature", "id": p.id, "geometry": p.geometry_json, "properties": parcel_summary(p)}


def unit_dict(u: Unit, with_owner: bool = True) -> dict:
    d = {
        "id": u.id, "unit_no": u.unit_no, "unit_ulpin": u.unit_ulpin, "label": u.label,
        "area_sqm": u.area_sqm, "usage_type": u.usage_type,
        "volume": {"min": [u.min_x, u.min_y, u.min_z], "max": [u.max_x, u.max_y, u.max_z]},
    }
    if with_owner:
        d["ownership"] = [
            {"owner_name": o.owner_name, "owner_email": o.owner_email, "ownership_type": o.ownership_type,
             "share_percent": o.share_percent, "registered_date": o.registered_date.isoformat(),
             "registration_no": o.registration_no}
            for o in u.ownerships
        ]
        from .integrity import unit_flags
        d["flags"] = unit_flags(u)
    return d


def building_model(b: Building) -> dict:
    return {
        "id": b.id, "building_no": b.building_no, "building_ulpin": b.building_ulpin, "name": b.name,
        "num_floors": b.num_floors, "num_basements": b.num_basements, "floor_height_m": b.floor_height_m,
        "footprint_local": json.loads(b.local_footprint),
        "footprint": json.loads(b.footprint),
        "floors": [
            {
                "id": f.id, "floor_number": f.floor_number, "floor_ulpin": f.floor_ulpin,
                "height_m": f.height_m, "base_elevation_m": f.base_elevation_m,
                "layer_type": f.layer_type, "layer_label": LayerType(f.layer_type).label,
                "units": [unit_dict(u) for u in f.units],
            }
            for f in b.floors
        ],
    }


def parcel_model(db: Session, parcel_id: int) -> dict | None:
    p = (
        db.query(Parcel)
        .options(
            selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.ownerships),
            selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.versions),
            selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.change_requests),
            selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.disputes),
            selectinload(Parcel.underground_layers),
        )
        .filter(Parcel.id == parcel_id)
        .first()
    )
    if not p:
        return None
    from ..geo import polygon_to_local
    return {
        "parcel": parcel_summary(p),
        "parcel_local": polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat),
        "buildings": [building_model(b) for b in p.buildings],
        "layers": [
            {
                "id": l.id, "layer_no": l.layer_no, "layer_ulpin": l.layer_ulpin, "layer_type": l.layer_type,
                "layer_label": LayerType(parse_ulpin(l.layer_ulpin).layer).label,
                "name": l.name, "top_m": l.top_m, "bottom_m": l.bottom_m, "operator": l.operator,
                "footprint_local": json.loads(l.local_footprint),
            }
            for l in p.underground_layers
        ],
    }
