from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.validate import validate

router = APIRouter(prefix="/api/validate", tags=["validate"])


@router.get("")
def validate_all(db: Session = Depends(get_db)):
    return validate(db)


@router.get("/{parcel_id}")
def validate_one(parcel_id: int, db: Session = Depends(get_db)):
    return validate(db, parcel_id)
