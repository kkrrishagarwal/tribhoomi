"""Read-only market-context layer: real NCR projects for background only (no ULPIN, no ownership)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import MarketContextProject

router = APIRouter(prefix="/api/market-context", tags=["market-context"])


@router.get("")
def market_context(db: Session = Depends(get_db)):
    rows = db.query(MarketContextProject).order_by(MarketContextProject.city, MarketContextProject.project_name).all()
    def props(r: MarketContextProject) -> dict:
        return {
            "builder_name": r.builder_name, "project_name": r.project_name, "city": r.city, "locality": r.locality,
            "property_type": r.property_type, "total_units": r.total_units, "towers": r.towers, "floors": r.floors,
            "rera_id": r.rera_id, "status": r.status, "data_source": r.data_source, "data_date": r.data_date,
            "confidence": r.confidence, "notes": r.notes, "has_location": r.latitude is not None,
        }
    unmapped = [{"id": r.id, "properties": props(r)} for r in rows if r.latitude is None or r.longitude is None]
    feats = [{
        "type": "Feature", "id": r.id,
        "geometry": {"type": "Point", "coordinates": [r.longitude, r.latitude]},
        "properties": props(r),
    } for r in rows if r.latitude is not None and r.longitude is not None]
    by_conf: dict[str, int] = {}
    for r in rows:
        by_conf[r.confidence] = by_conf.get(r.confidence, 0) + 1
    return {"type": "FeatureCollection", "features": feats, "unmapped": unmapped,
            "summary": {"projects": len(rows), "mapped": len(feats), "by_confidence": by_conf,
                        "disclaimer": "Informational layer of real projects. Not connected to ULPINs, ownership or disputes. "
                                      "Fields marked unknown were not confidently verifiable."}}
