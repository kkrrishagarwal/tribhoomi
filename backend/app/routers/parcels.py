from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Parcel
from ..services.model3d import parcel_feature, parcel_model, parcel_summary

router = APIRouter(prefix="/api/parcels", tags=["parcels"])


@router.get("")
def list_parcels(db: Session = Depends(get_db)):
    parcels = db.query(Parcel).order_by(Parcel.id).all()
    return {"type": "FeatureCollection", "features": [parcel_feature(p) for p in parcels]}


@router.get("/search")
def search_parcels(q: str = Query("", description="ULPIN (with or without hyphens), parcel name, or owner name"),
                   db: Session = Depends(get_db)):
    q = q.strip()
    if not q:
        return [parcel_summary(p) for p in db.query(Parcel).order_by(Parcel.id).all()]
    digits = q.replace("-", "")
    like = f"%{q}%"
    query = db.query(Parcel).filter(
        or_(Parcel.name.ilike(like), Parcel.ulpin_2d.like(f"%{q}%"), Parcel.village_ward.ilike(like))
    )
    results = query.all()
    if digits.isdigit():
        results += [p for p in db.query(Parcel).all() if digits in p.ulpin_2d.replace("-", "") and p not in results]
    return [parcel_summary(p) for p in results]


@router.get("/{parcel_id}")
def get_parcel(parcel_id: int, db: Session = Depends(get_db)):
    p = db.get(Parcel, parcel_id)
    if not p:
        raise HTTPException(404, "parcel not found")
    return parcel_feature(p)


@router.get("/{parcel_id}/model")
def get_parcel_model(parcel_id: int, db: Session = Depends(get_db)):
    """Everything the 3D viewer needs: building footprint, floors, units, layers, all with ULPINs."""
    model = parcel_model(db, parcel_id)
    if not model:
        raise HTTPException(404, "parcel not found")
    return model
