from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..ulpin import LayerType, ParcelKey, UlpinError, generate_building_tree, parent_of, parse_ulpin

router = APIRouter(prefix="/api/ulpin", tags=["ulpin"])


@router.get("/parse")
def parse(ulpin: str):
    """Decode any 2D or 3D ULPIN into its parts and its parent chain."""
    try:
        p = parse_ulpin(ulpin)
    except UlpinError as e:
        raise HTTPException(400, str(e))
    chain = []
    cur: str | None = p.ulpin_3d if not p.is_2d else p.ulpin_2d
    while cur:
        chain.append(cur)
        cur = parent_of(cur)
    return {
        "input": ulpin,
        "normalized": p.ulpin_3d if not p.is_2d else p.ulpin_2d,
        "is_2d": p.is_2d,
        "parts": {
            "state": f"{p.key.state:02d}", "district": f"{p.key.district:03d}",
            "village_ward": f"{p.key.village_ward:04d}", "parcel": f"{p.key.parcel:05d}",
            "building": p.building, "floor": p.floor, "unit": p.unit,
            "layer": p.layer.value, "layer_label": p.layer.label,
        },
        "ulpin_2d": p.ulpin_2d,
        "parent_chain": chain,
    }


class GenerateRequest(BaseModel):
    state: int = Field(..., ge=1, le=99)
    district: int = Field(..., ge=1, le=999)
    village_ward: int = Field(..., ge=1, le=9999)
    parcel: int = Field(..., ge=1, le=99999)
    building: int = Field(1, ge=1, le=99)
    floors_above: int = Field(5, ge=1, le=99, description="including ground floor")
    basements: int = Field(0, ge=0, le=9)
    units_per_floor: int = Field(2, ge=0, le=99)


@router.post("/generate")
def generate(req: GenerateRequest):
    """Live demo of the engine: generate a whole building's worth of IDs from numbers alone."""
    try:
        key = ParcelKey(req.state, req.district, req.village_ward, req.parcel)
        floors = {f: req.units_per_floor for f in range(-req.basements, req.floors_above)}
        tree = generate_building_tree(key, req.building, floors)
    except UlpinError as e:
        raise HTTPException(400, str(e))
    total = sum(len(f["units"]) for f in tree["floors"]) + len(tree["floors"]) + 1
    return {"ulpin_2d": tree["building_ulpin"].rsplit("-", 4)[0], "ids_generated": total, **tree}


@router.get("/layers")
def layers():
    return [{"code": l.value, "label": l.label} for l in LayerType]
