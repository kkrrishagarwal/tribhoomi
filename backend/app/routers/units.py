from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Unit
from ..services.model3d import parcel_summary, unit_dict
from ..ulpin import parent_of, parse_ulpin, to_2d, UlpinError

router = APIRouter(prefix="/api/units", tags=["units"])


@router.get("/{ulpin}")
def get_unit(ulpin: str, db: Session = Depends(get_db)):
    """Ownership record for one 3D ULPIN, plus its full parent chain."""
    u = db.query(Unit).filter(Unit.unit_ulpin == ulpin.upper()).first()
    if not u:
        raise HTTPException(404, f"no unit with ULPIN {ulpin}")
    f = u.floor
    b = f.building
    p = b.parcel
    try:
        parsed = parse_ulpin(u.unit_ulpin)
    except UlpinError as e:
        raise HTTPException(500, str(e))
    return {
        "unit": unit_dict(u),
        "floor": {"floor_number": f.floor_number, "floor_ulpin": f.floor_ulpin, "height_m": f.height_m,
                  "base_elevation_m": f.base_elevation_m, "layer_type": f.layer_type},
        "building": {"id": b.id, "name": b.name, "building_ulpin": b.building_ulpin, "num_floors": b.num_floors},
        "parcel": parcel_summary(p),
        "hierarchy": {
            "unit": u.unit_ulpin,
            "floor": parent_of(u.unit_ulpin),
            "building": parent_of(parent_of(u.unit_ulpin)),
            "parcel_2d": to_2d(u.unit_ulpin),
            "layer": parsed.layer.label,
        },
    }
