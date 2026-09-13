"""
The connected property lifecycle:
  builder creates project/building/unit -> validation -> submit -> authority verifies
  -> property gets a TPID + passport -> investors/owners verify, see history, detect changes.
Reuses the existing parcels/buildings/floors/units tables, the integrity module and the
topology validator. Nothing here bypasses the backend role checks.
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..auth import Actor, current_actor, require_role
from ..db import get_db
from ..geo import polygon_to_local
from ..models import AuditEvent, Building, ChangeRequest, Dispute, Floor, Parcel, Unit
from ..services import audit, integrity as svc
from ..services.layout import create_building, create_layout, next_parcel_no
from ..services.validation import integrity_score, validate_unit
from ..ulpin import ParcelKey, UlpinError

router = APIRouter(prefix="/api", tags=["lifecycle"])

CITY_CENTRES = {  # demonstration parcels are placed near these (lng, lat); nothing here is a government record
    "Greater Noida": (77.4790, 28.5715), "Noida": (77.3250, 28.5705), "Ghaziabad": (77.3390, 28.6440),
    "Gurugram": (77.0880, 28.4960), "Delhi": (77.2180, 28.6320), "Faridabad": (77.3170, 28.4089),
}
STATE_FOR_CITY = {"Greater Noida": ("Uttar Pradesh", "Gautam Buddh Nagar", 9, 141), "Noida": ("Uttar Pradesh", "Gautam Buddh Nagar", 9, 141),
                  "Ghaziabad": ("Uttar Pradesh", "Ghaziabad", 9, 140), "Gurugram": ("Haryana", "Gurugram", 6, 86),
                  "Delhi": ("Delhi", "New Delhi", 7, 94), "Faridabad": ("Haryana", "Faridabad", 6, 88)}
SQFT = 10.7639


# ------------------------------------------------------------------ helpers

def _unit(db: Session, ident: str) -> Unit:
    """Accepts a TPID (TRB-...) or a technical land-record ID (ULPIN format)."""
    q = db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes), selectinload(Unit.ownerships))
    ident = ident.strip().upper()
    if ident.startswith("TRB-"):
        for u in q.all():
            if u.tpid == ident:
                return u
        raise HTTPException(404, f"No property with Tribhoomi Property ID {ident}. Check the ID on the passport or search by project name.")
    u = q.filter(Unit.unit_ulpin == ident).first()
    if not u:
        raise HTTPException(404, f"No property found for {ident}.")
    return u


def _status_label(u: Unit) -> str:
    return {"draft": "Draft", "pending": "Pending verification", "verified": "Verified", "rejected": "Rejected", "conflict": "Conflict"}.get(u.verification_status, u.verification_status)


def unit_public(u: Unit, with_geometry: bool = True) -> dict:
    """Public-safe view: no owner name, email or registration number."""
    f, b, p = u.floor, u.floor.building, u.floor.building.parcel
    flags = svc.unit_flags(u)
    d = {
        "id": u.id, "tpid": u.tpid, "land_record_id": u.unit_ulpin, "label": u.label, "unit_type": u.unit_type or u.usage_type,
        "usage_type": u.usage_type, "area_sqm": u.area_sqm, "area_sqft": round(u.area_sqm * SQFT),
        "floor_number": f.floor_number, "floor_label": ("Basement %d" % -f.floor_number) if f.floor_number < 0 else ("Ground floor" if f.floor_number == 0 else f"Floor {f.floor_number}"),
        "building": {"id": b.id, "name": b.name, "num_floors": b.num_floors},
        "project": {"id": p.id, "name": p.name, "city": p.city or p.district, "locality": p.village_ward, "developer": p.builder, "land_record_id": p.ulpin_2d, "is_demo": p.is_demo_parcel},
        "verification_status": u.verification_status, "status_label": _status_label(u),
        "verification_id": u.verification_id, "verified_at": u.verified_at.isoformat() if u.verified_at else None,
        "sale_status": u.sale_status, "has_owner": u.is_locked,
        "flags": flags, "integrity": integrity_score(u),
        "version_count": len(u.versions),
    }
    if with_geometry:
        d["volume"] = svc.unit_volume(u)
        d["footprint"] = svc.unit_footprint(u)
    return d


def unit_row(u: Unit, with_geometry: bool = False) -> dict:
    d = unit_public(u, with_geometry=with_geometry)
    d["owner"] = {"name": u.ownerships[0].owner_name, "email": u.ownerships[0].owner_email, "registered_on": u.ownerships[0].registered_date.isoformat()} if u.ownerships else None
    return d


def project_summary(p: Parcel) -> dict:
    units = [u for b in p.buildings for f in b.floors for u in f.units]
    counts = {"buildings": len(p.buildings), "floors": sum(len(b.floors) for b in p.buildings), "units": len(units),
              "pending": sum(1 for u in units if u.verification_status == "pending"),
              "verified": sum(1 for u in units if u.verification_status == "verified"),
              "conflicts": sum(1 for u in units if u.verification_status == "conflict" or svc.unit_flags(u)["has_open_dispute"]),
              "draft": sum(1 for u in units if u.verification_status == "draft"),
              "modification_requests": sum(1 for u in units for cr in u.change_requests if cr.status == "pending")}
    status = "Draft" if not units else ("Verified" if counts["verified"] == len(units) else "Under verification" if counts["pending"] or counts["verified"] else "Draft")
    return {"id": p.id, "name": p.name, "developer": p.builder, "city": p.city or p.district, "locality": p.village_ward, "address": p.address,
            "project_type": p.land_use, "land_record_id": p.ulpin_2d, "is_demo": p.is_demo_parcel, "status": status, "counts": counts,
            "centroid": {"lat": p.centroid_lat, "lng": p.centroid_lng}}


def _project_query(db: Session):
    return db.query(Parcel).options(
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.ownerships),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.versions),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.change_requests),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.disputes),
    )


# ------------------------------------------------------------------ builder: dashboard & projects

@router.get("/builder/dashboard")
def builder_dashboard(actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    q = _project_query(db)
    if actor.role == "builder":
        q = q.filter(Parcel.builder == actor.user)
    projects = q.order_by(Parcel.id).all()
    units = [u for p in projects for b in p.buildings for f in b.floors for u in f.units]
    return {
        "builder": actor.user, "demo": True,
        "counts": {"projects": len(projects), "buildings": sum(len(p.buildings) for p in projects), "units": len(units),
                   "pending": sum(1 for u in units if u.verification_status == "pending"),
                   "issues": sum(1 for u in units if u.verification_status == "conflict" or svc.unit_flags(u)["has_open_dispute"] or svc.unit_flags(u)["has_unapproved_change"]),
                   "verified": sum(1 for u in units if u.verification_status == "verified"),
                   "modification_requests": sum(1 for u in units for cr in u.change_requests if cr.status == "pending")},
        "projects": [project_summary(p) for p in projects],
    }


class ProjectBody(BaseModel):
    name: str = Field(..., min_length=2)
    developer: str = ""
    city: str = "Greater Noida"
    locality: str = ""
    address: str = ""
    project_type: str = "residential"     # residential | commercial | mixed
    existing_parcel_id: int | None = None
    size_m: int = Field(60, ge=30, le=200)  # demonstration parcel side length


@router.post("/builder/projects")
def create_project(body: ProjectBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    owner_name = actor.user if actor.role == "builder" else (body.developer or actor.user)
    if db.query(Parcel).filter(Parcel.name == body.name.strip(), Parcel.builder == owner_name).first():
        raise HTTPException(409, f"You already have a project called '{body.name}'. Open it from your dashboard or choose a different name.")
    if body.existing_parcel_id:
        p = db.get(Parcel, body.existing_parcel_id)
        if not p:
            raise HTTPException(404, "That parcel does not exist.")
        if p.buildings:
            raise HTTPException(409, "That parcel already has a project on it.")
        p.name, p.builder, p.city, p.address, p.land_use = body.name.strip(), owner_name, body.city, body.address, body.project_type
    else:
        state, district, sc, dc = STATE_FOR_CITY.get(body.city, ("Uttar Pradesh", "Gautam Buddh Nagar", 9, 141))
        lng, lat = CITY_CENTRES.get(body.city, CITY_CENTRES["Greater Noida"])
        # spread demonstration parcels so several projects in one city do not stack on the same spot
        n = db.query(Parcel).filter(Parcel.city == body.city).count()
        lng += 0.0012 * (n % 6); lat -= 0.0009 * (n // 6 + 1)
        w, h = body.size_m / 97_500, body.size_m / 111_320
        geom = {"type": "Polygon", "coordinates": [[[lng, lat], [lng + w, lat], [lng + w, lat - h], [lng, lat - h], [lng, lat]]]}
        ward = 900 + (n % 99)
        key = ParcelKey(sc, dc, ward, next_parcel_no(db, sc, dc, ward))
        p = create_layout(db, geometry=geom, key=key, name=body.name.strip(), state=state, district=district,
                          village_ward=body.locality or f"{body.city} – demonstration parcel", builder=owner_name,
                          land_use=body.project_type, building={"num_floors": 1, "units_per_floor": 0, "name": "__placeholder__"})
        # create_layout always makes building 1; we do not want a placeholder building for a fresh project
        for b in list(p.buildings):
            db.delete(b)
        db.flush(); db.refresh(p)
        p.city, p.address, p.is_demo_parcel = body.city, body.address, True
    audit.record(db, actor=actor.user, role=actor.role, action="project.created", parcel_id=p.id, subject=p.name, new=f"{body.city} · {body.project_type}", status="Draft")
    db.commit()
    return {"ok": True, "message": f"Project '{p.name}' created (demonstration parcel {p.ulpin_2d}).", "project": project_summary(p)}


@router.get("/projects/{project_id}")
def project_dashboard(project_id: int, db: Session = Depends(get_db)):
    p = _project_query(db).filter(Parcel.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found.")
    d = project_summary(p)
    d["buildings"] = [{
        "id": b.id, "name": b.name, "num_floors": b.num_floors, "num_basements": b.num_basements, "land_record_id": b.building_ulpin,
        "units": sum(len(f.units) for f in b.floors),
        "pending": sum(1 for f in b.floors for u in f.units if u.verification_status == "pending"),
        "verified": sum(1 for f in b.floors for u in f.units if u.verification_status == "verified"),
        "conflicts": sum(1 for f in b.floors for u in f.units if u.verification_status == "conflict"),
    } for b in p.buildings]
    d["parcel_local"] = polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat)
    return d


class BuildingBody(BaseModel):
    name: str = Field(..., min_length=1)
    num_floors: int = Field(..., ge=1, le=99)
    building_type: str = "residential"
    num_basements: int = Field(0, ge=0, le=9)
    parking_levels: int = Field(0, ge=0, le=9)
    commercial_ground_floor: bool = False
    amenities: str = ""
    auto_units_per_floor: int = Field(0, ge=0, le=8, description="0 = builder adds units one by one")


@router.post("/builder/projects/{project_id}/buildings")
def add_building(project_id: int, body: BuildingBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    p = _project_query(db).filter(Parcel.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found.")
    if actor.role == "builder" and p.builder != actor.user:
        raise HTTPException(403, "This project belongs to another builder.")
    if any(b.name.strip().lower() == body.name.strip().lower() for b in p.buildings):
        raise HTTPException(409, f"'{body.name}' already exists in this project. Use a different building name.")
    key = ParcelKey(p.state_code, p.district_code, p.village_ward_code, p.parcel_no)
    usage = "commercial" if body.building_type == "commercial" else "residential"
    b = create_building(db, p, key, {
        "name": body.name.strip(), "num_floors": body.num_floors, "num_basements": max(body.num_basements, body.parking_levels),
        "units_per_floor": body.auto_units_per_floor, "ground_floor_usage": "commercial" if (body.commercial_ground_floor or usage == "commercial") else "residential",
        "all_floors_usage": "commercial" if usage == "commercial" else None, "footprint_inset_m": 4,
    })
    audit.record(db, actor=actor.user, role=actor.role, action="building.created", parcel_id=p.id, subject=f"{p.name} · {b.name}", new=f"{body.num_floors} floors · {body.building_type}")
    db.commit()
    return {"ok": True, "message": f"{b.name} added with {b.num_floors} floors.", "building_id": b.id}


@router.get("/buildings/{building_id}")
def building_detail(building_id: int, db: Session = Depends(get_db)):
    b = db.query(Building).options(selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.ownerships),
                                   selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.versions),
                                   selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.change_requests),
                                   selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.disputes)).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(404, "Building not found.")
    p = b.parcel
    return {
        "id": b.id, "name": b.name, "num_floors": b.num_floors, "num_basements": b.num_basements, "land_record_id": b.building_ulpin,
        "project": project_summary(p), "footprint_local": json.loads(b.local_footprint),
        "parcel_local": polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat),
        "floors": [{"floor_number": f.floor_number, "label": ("Basement %d" % -f.floor_number) if f.floor_number < 0 else ("Ground floor" if f.floor_number == 0 else f"Floor {f.floor_number}"),
                    "base_elevation_m": f.base_elevation_m, "height_m": f.height_m, "units": [unit_row(u, with_geometry=True) for u in f.units]} for f in b.floors],
    }


# ------------------------------------------------------------------ builder: units

class UnitBody(BaseModel):
    building_id: int
    floor_number: int
    label: str = Field(..., min_length=1)
    unit_type: str = "3 BHK"
    usage_type: str = "residential"
    declared_area_sqft: float | None = None
    sale_status: str = "available"
    volume: dict                     # {"min":[x,y,z],"max":[x,y,z]} in building-local metres (from the boundary editor)
    unit_id: int | None = None       # when editing an existing draft


def _floor(db: Session, building_id: int, floor_number: int) -> tuple[Building, Floor]:
    b = db.query(Building).options(selectinload(Building.floors).selectinload(Floor.units)).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(404, "Building not found.")
    f = next((f for f in b.floors if f.floor_number == floor_number), None)
    if not f:
        raise HTTPException(404, f"{b.name} has no floor {floor_number}. Choose a floor that exists in the building.")
    return b, f


@router.post("/builder/units/validate")
def validate_only(body: UnitBody, db: Session = Depends(get_db)):
    b, f = _floor(db, body.building_id, body.floor_number)
    vol = dict(body.volume); vol["min"] = [vol["min"][0], vol["min"][1], f.base_elevation_m]; vol["max"] = [vol["max"][0], vol["max"][1], f.base_elevation_m + f.height_m]
    area = body.declared_area_sqft / SQFT if body.declared_area_sqft else None
    return validate_unit(building=b, floor=f, parcel=b.parcel, label=body.label, volume=vol, area_sqm=area, exclude_unit_id=body.unit_id)


@router.post("/builder/units")
def create_unit(body: UnitBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    b, f = _floor(db, body.building_id, body.floor_number)
    if actor.role == "builder" and b.parcel.builder != actor.user:
        raise HTTPException(403, "This building belongs to another builder.")
    vol = dict(body.volume); vol["min"] = [round(float(vol["min"][0]), 2), round(float(vol["min"][1]), 2), f.base_elevation_m]
    vol["max"] = [round(float(vol["max"][0]), 2), round(float(vol["max"][1]), 2), f.base_elevation_m + f.height_m]
    area = body.declared_area_sqft / SQFT if body.declared_area_sqft else None
    v = validate_unit(building=b, floor=f, parcel=b.parcel, label=body.label, volume=vol, area_sqm=area, exclude_unit_id=body.unit_id)
    hard = [c for c in v["checks"] if not c["ok"] and c.get("severity") != "warning" and c["key"] in ("geometry", "identity")]
    if hard:
        raise HTTPException(400, hard[0]["text"] + " " + hard[0].get("why", ""))
    key = ParcelKey(b.parcel.state_code, b.parcel.district_code, b.parcel.village_ward_code, b.parcel.parcel_no)
    from ..ulpin import level_from_floor_number, make_3d_ulpin
    if body.unit_id:
        u = db.get(Unit, body.unit_id)
        if not u or u.floor_id != f.id:
            raise HTTPException(404, "Unit not found on this floor.")
        if u.verification_status in ("verified", "pending"):
            raise HTTPException(423, "This unit is already submitted or verified. Use 'Request modification' instead of editing it directly.")
        if u.is_locked:
            raise HTTPException(423, "This unit has a registered owner; changes need a modification request.")
        prev = f"{u.label} · {u.area_sqm} m²"
        u.label, u.unit_type, u.usage_type, u.sale_status = body.label.strip(), body.unit_type, body.usage_type, body.sale_status
        svc.apply_volume(u, vol)
        if area: u.area_sqm = round(area, 1)
        action, new = "unit.created", f"{u.label} · {u.area_sqm} m² (edited)"
    else:
        unit_no = max((x.unit_no for x in f.units), default=0) + 1
        u = Unit(floor_id=f.id, unit_no=unit_no, unit_ulpin=make_3d_ulpin(key, b.building_no, level_from_floor_number(f.floor_number), unit_no),
                 label=body.label.strip(), area_sqm=round(area or v["drawn_area_sqm"], 1), usage_type=body.usage_type, unit_type=body.unit_type,
                 sale_status=body.sale_status, verification_status="draft", created_by=actor.user,
                 min_x=vol["min"][0], min_y=vol["min"][1], min_z=vol["min"][2], max_x=vol["max"][0], max_y=vol["max"][1], max_z=vol["max"][2])
        db.add(u); db.flush()
        prev, action, new = "", "unit.created", f"{u.label} · {u.area_sqm} m² · {u.unit_type}"
    u.verification_status = "conflict" if v["conflicts"] else "draft"
    audit.record(db, actor=actor.user, role=actor.role, action=action, unit=u, previous=prev, new=new, status=u.verification_status)
    audit.record(db, actor="Tribhoomi validation", role="system", action="unit.validated", unit=u, new=f"score {v['score']}/100", status="conflict" if v["conflicts"] else "valid")
    db.commit()
    return {"ok": True, "unit": unit_row(u, with_geometry=True), "validation": v, "message": f"Unit {u.label} saved as draft. Tribhoomi Property ID {u.tpid}."}


@router.post("/builder/units/{ident}/submit")
def submit_unit(ident: str, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    u = _unit(db, ident)
    if actor.role == "builder" and u.floor.building.parcel.builder != actor.user:
        raise HTTPException(403, "This unit belongs to another builder.")
    if u.verification_status == "verified":
        raise HTTPException(409, "This unit is already verified.")
    if u.verification_status == "pending":
        raise HTTPException(409, "This unit is already waiting for the authority.")
    b, f = u.floor.building, u.floor
    v = validate_unit(building=b, floor=f, parcel=b.parcel, label=u.label, volume=svc.unit_volume(u), area_sqm=None, exclude_unit_id=u.id)
    prev = u.verification_status
    u.verification_status, u.submitted_at = "pending", datetime.utcnow()
    audit.record(db, actor=actor.user, role=actor.role, action="unit.submitted", unit=u, previous=prev, new="pending",
                 status="pending", note=f"validation score {v['score']}/100" + (" · conflict flagged for authority" if v["conflicts"] else ""))
    svc.notify(db, "admin", f"{actor.user} submitted {u.label} ({u.tpid}) in {b.parcel.name} for verification.", u.unit_ulpin)
    db.commit()
    return {"ok": True, "message": f"{u.label} submitted. Status: pending authority verification.", "unit": unit_row(u), "validation": v}


@router.get("/builder/units")
def builder_units(actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    q = _project_query(db)
    if actor.role == "builder":
        q = q.filter(Parcel.builder == actor.user)
    rows = [unit_row(u) for p in q.all() for b in p.buildings for f in b.floors for u in f.units]
    return {"units": rows}


@router.get("/audit")
def audit_log(unit: str | None = None, project_id: int | None = None, limit: int = 200, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    q = db.query(AuditEvent)
    if unit:
        u = _unit(db, unit); q = q.filter(AuditEvent.unit_id == u.id)
    elif project_id:
        q = q.filter(AuditEvent.parcel_id == project_id)
    elif actor.role == "builder":
        ids = [p.id for p in db.query(Parcel).filter(Parcel.builder == actor.user).all()]
        q = q.filter(AuditEvent.parcel_id.in_(ids)) if ids else q.filter(False)
    elif actor.role not in ("admin",):
        q = q.filter(False)   # investors/public read a property's audit through /property/{id}
    return [audit.to_dict(e) for e in q.order_by(AuditEvent.at.desc()).limit(limit).all()]


# ------------------------------------------------------------------ authority

@router.get("/authority/dashboard")
def authority_dashboard(actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    units = db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes), selectinload(Unit.ownerships)).all()
    pending = [u for u in units if u.verification_status == "pending"]
    return {
        "authority": actor.user, "demo": True,
        "counts": {"pending": len(pending), "conflicts": sum(1 for u in units if u.verification_status == "conflict" or svc.unit_flags(u)["has_unapproved_change"]),
                   "modification_requests": db.query(ChangeRequest).filter(ChangeRequest.status == "pending").count(),
                   "disputes": db.query(Dispute).filter(Dispute.status != "resolved").count(),
                   "verified": sum(1 for u in units if u.verification_status == "verified")},
        "pending": [unit_row(u) for u in sorted(pending, key=lambda x: x.submitted_at or datetime.min, reverse=True)],
        "conflicts": [unit_row(u) for u in units if u.verification_status == "conflict" or svc.unit_flags(u)["has_unapproved_change"]],
    }


@router.get("/authority/review/{ident}")
def authority_review(ident: str, actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    u = _unit(db, ident)
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    v = validate_unit(building=b, floor=f, parcel=p, label=u.label, volume=svc.unit_volume(u), area_sqm=None, exclude_unit_id=u.id)
    return {
        "unit": unit_row(u, with_geometry=True), "validation": v,
        "building": {"id": b.id, "name": b.name, "footprint_local": json.loads(b.local_footprint), "num_floors": b.num_floors},
        "parcel": {"id": p.id, "name": p.name, "local": polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat), "land_record_id": p.ulpin_2d, "is_demo": p.is_demo_parcel},
        "neighbours": [{"label": n.label, "tpid": n.tpid, "volume": svc.unit_volume(n), "status": n.verification_status} for n in f.units if n.id != u.id],
        "unit_geometry": svc.unit_volume(u),
        "versions": [svc.version_dict(x) for x in u.versions],
        "change_requests": [svc.change_request_dict(cr) for cr in u.change_requests],
        "disputes": [svc.dispute_dict(d) for d in u.disputes],
        "audit": [audit.to_dict(e) for e in db.query(AuditEvent).filter(AuditEvent.unit_id == u.id).order_by(AuditEvent.at.desc()).all()],
    }


DECISION_CATEGORIES = ["Boundary correction", "Duplicate property", "Area mismatch", "Missing information", "Parcel conflict", "Neighbour conflict", "Documentation issue", "Other"]


class DecisionBody(BaseModel):
    decision: str   # approve | reject | changes
    note: str = ""
    category: str = ""


@router.post("/authority/units/{ident}/decide")
def authority_decide(ident: str, body: DecisionBody, actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    u = _unit(db, ident)
    if u.verification_status != "pending":
        raise HTTPException(409, f"This unit is {_status_label(u).lower()}, not pending. Only pending submissions can be decided.")
    prev = u.verification_status
    if body.decision in ("reject", "changes") and not (body.category or body.note.strip()):
        raise HTTPException(400, "Please choose a reason category or write a note so the decision is explainable in the audit trail.")
    if body.decision == "approve":
        u.verification_status, u.verified_by, u.verified_at = "verified", actor.user, datetime.utcnow()
        u.verification_id = f"TRB-VER-{u.verified_at.strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
        if not u.versions:   # first verification locks the geometry as version 1 even before a sale
            svc.append_version(db, u, changed_by=actor.user, reason="Authority verification baseline", approval_status="baseline")
        audit.record(db, actor=actor.user, role=actor.role, action="unit.verified", unit=u, previous=prev, new="verified", status="verified", note=body.note or u.verification_id, category=body.category)
        msg = f"{u.label} verified. Verification ID {u.verification_id}."
    elif body.decision == "reject":
        u.verification_status = "rejected"
        audit.record(db, actor=actor.user, role=actor.role, action="unit.rejected", unit=u, previous=prev, new="rejected", status="rejected", note=body.note, category=body.category)
        msg = f"{u.label} rejected." + (f" Reason: {body.note}" if body.note else "")
    elif body.decision == "changes":
        u.verification_status = "draft"
        audit.record(db, actor=actor.user, role=actor.role, action="unit.changes_requested", unit=u, previous=prev, new="draft", status="draft", note=body.note, category=body.category)
        msg = f"Changes requested for {u.label}. The builder can edit and resubmit."
    else:
        raise HTTPException(400, "decision must be approve, reject or changes")
    svc.notify(db, u.floor.building.parcel.builder, msg, u.unit_ulpin)
    db.commit()
    return {"ok": True, "message": msg, "unit": unit_row(u)}


# ------------------------------------------------------------------ investor / owner / public

@router.get("/discover")
def discover(q: str = "", status: str = "", db: Session = Depends(get_db)):
    """Public search by project, building, unit number or TPID. Never returns owner data."""
    q = q.strip().lower()
    units = db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes), selectinload(Unit.ownerships)).all()
    out = []
    for u in units:
        b, p = u.floor.building, u.floor.building.parcel
        hay = " ".join([p.name, b.name, u.label, u.tpid, u.unit_ulpin, p.city or "", p.village_ward]).lower()
        if q and q not in hay and q.replace("-", "") not in hay.replace("-", ""):
            continue
        if status and u.verification_status != status:
            continue
        if u.usage_type in ("parking", "utility"):
            continue
        out.append(unit_public(u, with_geometry=False))
    out.sort(key=lambda d: (d["verification_status"] != "verified", d["project"]["name"], d["building"]["name"], d["floor_number"], d["label"]))
    projects = sorted({(d["project"]["id"], d["project"]["name"], d["project"]["city"]) for d in out})
    return {"count": len(out), "results": out[:200], "projects": [{"id": i, "name": n, "city": c} for i, n, c in projects]}


def _history(db: Session, u: Unit) -> list[dict]:
    """One timeline merging audit events, versions, modification requests and disputes."""
    items = []
    for e in db.query(AuditEvent).filter(AuditEvent.unit_id == u.id).all():
        items.append({"at": e.at.isoformat(), "kind": e.action, "text": f"{e.actor}: {audit.VERBS.get(e.action, e.action)}" + (f" — {e.note}" if e.note else ""), "tone": "ok" if e.action in ("unit.verified", "modification.approved") else "warn" if "requested" in e.action or e.action == "dispute.raised" else "bad" if "rejected" in e.action else "neutral"})
    for v in u.versions:
        items.append({"at": v.created_at.isoformat(), "kind": "version", "text": f"Version {v.version_number}: {v.plot_number} · {round((v.bounding_volume and __import__('json').loads(v.bounding_volume) and 0) or 0)}".rstrip(" · 0") if False else f"Version {v.version_number} recorded — {v.change_reason or 'registered baseline'}",
                      "tone": "bad" if v.approval_status == "unapproved" else "ok", "version": v.version_number, "approval_status": v.approval_status})
    for cr in u.change_requests:
        items.append({"at": cr.created_at.isoformat(), "kind": "modification", "text": f"Modification requested by {cr.requested_by}: {cr.reason}", "tone": "warn"})
        if cr.resolved_at:
            items.append({"at": cr.resolved_at.isoformat(), "kind": "modification", "text": f"Modification {cr.status}" + (f" — {cr.resolution_note}" if cr.resolution_note else ""), "tone": "ok" if cr.status == "approved" else "bad"})
    for d in u.disputes:
        items.append({"at": d.created_at.isoformat(), "kind": "dispute", "text": f"Dispute raised: {d.description}", "tone": "bad"})
    items.sort(key=lambda x: x["at"])
    return items


@router.get("/property/{ident}")
def property_page(ident: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    """Property page + passport data. Owner details only for the owner themself or the authority."""
    u = _unit(db, ident)
    d = unit_public(u)
    base = u.versions[0] if u.versions else None
    cur = u.versions[-1] if u.versions else None
    d["history"] = _history(db, u)
    d["versions"] = [{"version_number": v.version_number, "created_at": v.created_at.isoformat(), "approval_status": v.approval_status,
                      "plot_number": v.plot_number, "geometry": json.loads(v.geometry), "bounding_volume": json.loads(v.bounding_volume),
                      "area_sqm": _vol_area(json.loads(v.bounding_volume)), "changed_by": v.changed_by, "reason": v.change_reason} for v in u.versions]
    d["change"] = None
    if base and cur and base.geometry != cur.geometry:
        a0, a1 = _vol_area(json.loads(base.bounding_volume)), _vol_area(json.loads(cur.bounding_volume))
        b0, b1 = json.loads(base.bounding_volume), json.loads(cur.bounding_volume)
        moved = round(((b1["min"][0] - b0["min"][0]) ** 2 + (b1["min"][1] - b0["min"][1]) ** 2) ** 0.5, 1)
        d["change"] = {"previous_sqm": a0, "current_sqm": a1, "difference_sqm": round(a1 - a0, 1), "previous_sqft": round(a0 * SQFT), "current_sqft": round(a1 * SQFT),
                       "moved_m": moved, "previous_label": base.plot_number, "current_label": cur.plot_number,
                       "before": json.loads(base.geometry), "after": json.loads(cur.geometry), "approved": cur.approval_status != "unapproved"}
    d["pending_modification"] = next((svc.change_request_dict(cr) for cr in u.change_requests if cr.status == "pending"), None)
    d["disputes_open"] = sum(1 for x in u.disputes if x.status != "resolved")
    is_owner = actor.role == "owner" and u.ownerships and u.ownerships[0].owner_email == actor.user.lower()
    if actor.role == "admin" or is_owner:
        d["owner"] = {"name": u.ownerships[0].owner_name, "registered_on": u.ownerships[0].registered_date.isoformat(), "registration_no": u.ownerships[0].registration_no} if u.ownerships else None
    d["demo_dataset"] = True
    return d


def _vol_area(vol: dict) -> float:
    return round((vol["max"][0] - vol["min"][0]) * (vol["max"][1] - vol["min"][1]), 1)


@router.get("/property/{ident}/verify")
def verify_before_investing(ident: str, db: Session = Depends(get_db)):
    """'Verify Before You Invest': plain-language checklist and an overall result."""
    u = _unit(db, ident)
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    flags = svc.unit_flags(u)
    v = validate_unit(building=b, floor=f, parcel=p, label=u.label, volume=svc.unit_volume(u), area_sqm=None, exclude_unit_id=u.id)
    checks = [
        {"text": "Property identity exists", "ok": True, "detail": f"{u.tpid} · {u.label}, {b.name}, {p.name}"},
        {"text": "Authority verification", "ok": u.verification_status == "verified", "detail": _status_label(u) + (f" · {u.verification_id}" if u.verification_id else "")},
        {"text": "Unit exists on the registered floor", "ok": True, "detail": f"{f.floor_number if f.floor_number >= 0 else 'Basement ' + str(-f.floor_number)}, {b.num_floors}-floor building"},
        {"text": "No boundary overlap with neighbours", "ok": not v["conflicts"], "detail": (f"Overlaps {v['conflicts'][0]['with_unit']} by {v['conflicts'][0]['overlap_sqm']} m²" if v["conflicts"] else "clear")},
        {"text": "No unapproved changes to the record", "ok": not flags["has_unapproved_change"], "detail": "record changed without owner approval" if flags["has_unapproved_change"] else f"{len(u.versions)} version(s), all approved"},
        {"text": "No open disputes", "ok": not flags["has_open_dispute"], "detail": f"{sum(1 for d in u.disputes if d.status != 'resolved')} open" if flags["has_open_dispute"] else "none"},
        {"text": "No modification pending", "ok": not flags["has_pending_request"], "detail": "a boundary change is awaiting decision" if flags["has_pending_request"] else "none"},
    ]
    bad = [c for c in checks if not c["ok"]]
    if any(c["text"].startswith(("No boundary overlap", "No unapproved")) for c in bad) or flags["has_open_dispute"]:
        result, tone = "Conflict detected", "bad"
    elif bad:
        result, tone = "Review recommended", "warn"
    else:
        result, tone = "Property appears consistent", "ok"
    return {"tpid": u.tpid, "result": result, "tone": tone, "checks": checks, "integrity": integrity_score(u),
            "explanation": "; ".join(c["text"] + ": " + c["detail"] for c in bad) or "All checks passed on the current registry record.", "demo_dataset": True}


@router.get("/owner/properties")
def owner_properties(actor: Actor = Depends(require_role("owner", "investor", "admin")), db: Session = Depends(get_db)):
    email = actor.user.lower()
    units = db.query(Unit).options(selectinload(Unit.ownerships), selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes)).all()
    mine = [u for u in units if any(o.owner_email == email for o in u.ownerships)]
    rows = []
    for u in mine:
        d = property_page(u.tpid, actor, db)
        rows.append(d)
    return {"owner": email, "properties": rows}
