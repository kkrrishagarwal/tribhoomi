"""Builder layout tool: create a parcel+building from a drawn polygon or an uploaded GeoJSON."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from shapely.geometry import shape
from sqlalchemy.orm import Session

from ..auth import Actor, require_role
from ..db import get_db
from ..services.layout import create_layout, next_parcel_no
from ..services.model3d import parcel_feature
from ..ulpin import ParcelKey, UlpinError

router = APIRouter(prefix="/api/layouts", tags=["layouts"])


class LayoutBody(BaseModel):
    name: str = Field(..., min_length=2)
    geometry: dict                     # GeoJSON Polygon, lon/lat
    state_code: int = 9        # Uttar Pradesh (Census of India)
    district_code: int = 141   # Gautam Buddh Nagar (140 = Ghaziabad)
    village_ward_code: int = 18
    state: str = "Uttar Pradesh"
    district: str = "Gautam Buddh Nagar"
    village_ward: str = "Noida – Sector 18"
    land_use: str = "residential"
    num_floors: int = Field(4, ge=1, le=99)
    num_basements: int = Field(0, ge=0, le=9)
    units_per_floor: int = Field(2, ge=1, le=8)
    floor_height_m: float = 3.2


def _create(db: Session, body: LayoutBody, builder: str):
    geom = body.geometry
    if geom.get("type") != "Polygon":
        raise HTTPException(400, "geometry must be a GeoJSON Polygon")
    poly = shape(geom)
    if not poly.is_valid or poly.area == 0:
        raise HTTPException(400, "polygon is not valid")
    try:
        key = ParcelKey(body.state_code, body.district_code, body.village_ward_code,
                        next_parcel_no(db, body.state_code, body.district_code, body.village_ward_code))
    except UlpinError as e:
        raise HTTPException(400, str(e))
    usage = "commercial" if body.land_use == "commercial" else "residential"
    p = create_layout(
        db, geometry=geom, key=key, name=body.name, state=body.state, district=body.district,
        village_ward=body.village_ward, builder=builder, land_use=body.land_use,
        building={"name": body.name, "num_floors": body.num_floors, "num_basements": body.num_basements,
                  "units_per_floor": body.units_per_floor, "floor_height_m": body.floor_height_m,
                  "ground_floor_usage": usage, "all_floors_usage": "commercial" if usage == "commercial" else None},
    )
    return p


@router.post("")
def create_from_drawing(body: LayoutBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    p = _create(db, body, actor.user)
    db.commit()
    return {"ok": True, "message": f"Layout registered as parcel {p.ulpin_2d} with "
                                   f"{sum(len(f.units) for b in p.buildings for f in b.floors)} units.", "parcel": parcel_feature(p)}


@router.post("/upload")
async def create_from_geojson(file: UploadFile = File(...), name: str = "Uploaded layout", num_floors: int = 4,
                              units_per_floor: int = 2, land_use: str = "residential",
                              actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    """Upload a GeoJSON Feature / FeatureCollection of polygons; each polygon becomes a parcel with a building."""
    try:
        data = json.loads((await file.read()).decode())
    except Exception:
        raise HTTPException(400, "file is not valid JSON/GeoJSON")
    feats = data.get("features", [data]) if data.get("type") == "FeatureCollection" else [data]
    created = []
    for i, f in enumerate(feats, 1):
        geom = f.get("geometry", f) if f.get("type") == "Feature" else f
        if geom.get("type") == "MultiPolygon":
            geom = {"type": "Polygon", "coordinates": geom["coordinates"][0]}
        if geom.get("type") != "Polygon":
            continue
        props = f.get("properties", {}) if f.get("type") == "Feature" else {}
        body = LayoutBody(name=props.get("name") or f"{name} {i}", geometry=geom,
                          num_floors=int(props.get("num_floors", num_floors)),
                          units_per_floor=int(props.get("units_per_floor", units_per_floor)),
                          land_use=props.get("land_use", land_use))
        created.append(parcel_feature(_create(db, body, actor.user)))
    if not created:
        raise HTTPException(400, "no Polygon geometries found in the file")
    db.commit()
    return {"ok": True, "message": f"{len(created)} parcel(s) registered.", "parcels": created}
