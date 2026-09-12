from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Building, ChangeRequest, Dispute, Floor, Ownership, Parcel, PlotVersion, UndergroundLayer, Unit
from ..services.validate import validate

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    parcels = db.query(func.count(Parcel.id)).scalar()
    buildings = db.query(func.count(Building.id)).scalar()
    floors = db.query(func.count(Floor.id)).scalar()
    units = db.query(func.count(Unit.id)).scalar()
    layers = db.query(func.count(UndergroundLayer.id)).scalar()
    owners = db.query(func.count(Ownership.id)).scalar()
    usage = dict(db.query(Unit.usage_type, func.count(Unit.id)).group_by(Unit.usage_type).all())
    otypes = dict(db.query(Ownership.ownership_type, func.count(Ownership.id)).group_by(Ownership.ownership_type).all())
    layer_types = dict(db.query(UndergroundLayer.layer_type, func.count(UndergroundLayer.id)).group_by(UndergroundLayer.layer_type).all())
    versions = db.query(func.count(PlotVersion.id)).scalar()
    tampered = db.query(func.count(func.distinct(PlotVersion.unit_id))).filter(PlotVersion.approval_status == "unapproved").scalar()
    disputes_open = db.query(func.count(Dispute.id)).filter(Dispute.status != "resolved").scalar()
    requests_pending = db.query(func.count(ChangeRequest.id)).filter(ChangeRequest.status == "pending").scalar()
    locked = db.query(func.count(func.distinct(Ownership.unit_id))).scalar()
    v = validate(db)
    by_kind: dict[str, int] = {}
    for c in v["conflicts"]:
        by_kind[c["kind"]] = by_kind.get(c["kind"], 0) + 1
    per_parcel = [
        {"id": p.id, "name": p.name, "ulpin_2d": p.ulpin_2d,
         "units": sum(len(f.units) for b in p.buildings for f in b.floors),
         "floors": sum(len(b.floors) for b in p.buildings),
         "conflicts": sum(1 for c in v["conflicts"] if c["parcel_id"] == p.id)}
        for p in db.query(Parcel).order_by(Parcel.id).all()
    ]
    return {
        "counts": {
            "parcels": parcels, "buildings": buildings, "floors": floors, "units": units,
            "underground_layers": layers, "ownership_records": owners,
            # every parcel, building, floor, unit and layer carries its own ID
            "ulpins_generated": parcels + buildings + floors + units + layers,
            "conflicts_flagged": v["conflict_count"],
            "units_locked": locked, "units_unsold": units - locked,
            "plot_versions": versions, "tampered_units": tampered,
            "disputes_open": disputes_open, "requests_pending": requests_pending,
        },
        "units_by_usage": usage,
        "ownership_by_type": otypes,
        "layers_by_type": layer_types,
        "conflicts_by_kind": by_kind,
        "per_parcel": per_parcel,
        "recent_conflicts": v["conflicts"][:10],
    }
