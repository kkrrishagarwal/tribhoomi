"""Builder, investor, admin and public 'verify' endpoints for the layout-integrity module."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from ..auth import Actor, current_actor, require_role
from ..db import get_db
from ..models import Building, ChangeRequest, Dispute, Floor, Notification, Parcel, Unit
from ..services import integrity as svc
from ..services.model3d import unit_dict
from ..ulpin import UlpinError, parse_ulpin

router = APIRouter(prefix="/api", tags=["integrity"])


def _unit(db: Session, ulpin: str) -> Unit:
    u = (db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests),
                                selectinload(Unit.disputes), selectinload(Unit.ownerships))
         .filter(Unit.unit_ulpin == ulpin.upper()).first())
    if not u:
        raise HTTPException(404, f"no unit with ULPIN {ulpin}")
    return u


def _run(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except svc.IntegrityError as e:
        raise HTTPException(e.status, e.message)


def _unit_row(u: Unit) -> dict:
    d = unit_dict(u)
    d["parcel_id"] = u.floor.building.parcel_id
    d["building_name"] = u.floor.building.name
    d["floor_number"] = u.floor.floor_number
    d["footprint"] = svc.unit_footprint(u)
    d["current_version"] = svc.version_dict(svc.latest_version(u)) if u.versions else None
    d["pending_request"] = next((svc.change_request_dict(cr) for cr in u.change_requests if cr.status == "pending"), None)
    return d


# ------------------------------------------------------------------ identities (for the role switcher)

@router.get("/identities")
def identities(db: Session = Depends(get_db)):
    builders = sorted({p.builder for p in db.query(Parcel).all() if p.builder})
    investors = (db.query(Unit).options(selectinload(Unit.ownerships)).all())
    seen: dict[str, str] = {}
    for u in investors:
        for o in u.ownerships:
            if o.owner_email and "@" in o.owner_email and o.owner_email not in seen:
                seen[o.owner_email] = o.owner_name
    demo = [e for e in seen if e.endswith("@example.in") and seen[e] in ("Anita Sharma", "Rajesh Kumar", "Priya Nair")]
    others = [e for e in seen if e not in demo][:6]
    return {
        "builders": builders,
        "investors": [{"email": e, "name": seen[e]} for e in demo + others],
        "admin": {"name": "DoLR Land Records Officer", "user": "admin"},
    }


# ------------------------------------------------------------------ builder

@router.get("/builder/overview")
def builder_overview(actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    q = db.query(Parcel).options(
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.ownerships),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.versions),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.change_requests),
        selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.disputes),
    )
    if actor.role == "builder":
        q = q.filter(Parcel.builder == actor.user)
    parcels = q.all()
    editable, locked = [], []
    for p in parcels:
        for b in p.buildings:
            for f in b.floors:
                for u in f.units:
                    row = _unit_row(u)
                    (locked if u.is_locked else editable).append(row)
    crs = [svc.change_request_dict(cr) for cr in db.query(ChangeRequest).order_by(ChangeRequest.created_at.desc()).all()
           if actor.role == "admin" or cr.requested_by == actor.user]
    return {"builder": actor.user, "parcels": [{"id": p.id, "name": p.name, "ulpin_2d": p.ulpin_2d} for p in parcels],
            "editable": editable, "locked": locked, "change_requests": crs,
            "notifications": [svc.notification_dict(n) for n in db.query(Notification).filter(Notification.recipient == actor.user)
                              .order_by(Notification.created_at.desc()).limit(20)]}


class AssignBody(BaseModel):
    owner_name: str = Field(..., min_length=2)
    owner_email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    ownership_type: str = "freehold"


@router.post("/builder/units/{ulpin}/assign")
def assign(ulpin: str, body: AssignBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    u = _unit(db, ulpin)
    o = _run(svc.assign_unit, db, u, body.owner_name, body.owner_email, body.ownership_type, builder=actor.user)
    db.commit()
    return {"ok": True, "message": f"{u.label} registered to {o.owner_name}. Baseline v1 locked.", "unit": _unit_row(u)}


class EditBody(BaseModel):
    plot_number: str | None = None
    dx: float = 0
    dy: float = 0
    dw: float = 0
    dd: float = 0


@router.patch("/builder/units/{ulpin}")
def edit(ulpin: str, body: EditBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    u = _unit(db, ulpin)
    vol = svc.shifted_volume(u, body.dx, body.dy, body.dw, body.dd) if any((body.dx, body.dy, body.dw, body.dd)) else None
    _run(svc.direct_edit, db, u, actor.user, body.plot_number, vol)
    db.commit()
    return {"ok": True, "unit": _unit_row(u)}


class ChangeBody(EditBody):
    reason: str = Field(..., min_length=5)


@router.post("/builder/units/{ulpin}/preview")
def preview(ulpin: str, body: EditBody, db: Session = Depends(get_db)):
    """Old vs proposed boundary for the diff preview, without saving anything."""
    u = _unit(db, ulpin)
    vol = svc.shifted_volume(u, body.dx, body.dy, body.dw, body.dd)
    parcel = u.floor.building.parcel
    return {"before": {"plot_number": u.label, "geometry": svc.unit_footprint(u), "bounding_volume": svc.unit_volume(u)},
            "after": {"plot_number": body.plot_number or u.label, "geometry": svc.volume_to_footprint(vol, parcel), "bounding_volume": vol}}


@router.post("/builder/units/{ulpin}/change-requests")
def request_change(ulpin: str, body: ChangeBody, actor: Actor = Depends(require_role("builder", "admin")), db: Session = Depends(get_db)):
    u = _unit(db, ulpin)
    vol = svc.shifted_volume(u, body.dx, body.dy, body.dw, body.dd)
    cr = _run(svc.create_change_request, db, u, actor.user, vol, body.plot_number or u.label, body.reason)
    db.commit()
    return {"ok": True, "message": f"Change request #{cr.id} sent to {cr.affected_owner.owner_name} for approval.",
            "change_request": svc.change_request_dict(cr)}


# ------------------------------------------------------------------ investor

@router.get("/investor/overview")
def investor_overview(actor: Actor = Depends(require_role("investor", "admin")), db: Session = Depends(get_db)):
    email = actor.user.lower()
    units = (db.query(Unit).options(selectinload(Unit.ownerships), selectinload(Unit.versions),
                                    selectinload(Unit.change_requests), selectinload(Unit.disputes)).all())
    mine = [u for u in units if any(o.owner_email == email for o in u.ownerships)]
    rows = []
    for u in mine:
        r = _unit_row(u)
        o = next(o for o in u.ownerships if o.owner_email == email)
        r["registered_on"] = o.registered_date.isoformat()
        r["flags"] = svc.unit_flags(u)
        r["disputes"] = [svc.dispute_dict(d) for d in u.disputes]
        rows.append(r)
    pending = [svc.change_request_dict(cr) for u in mine for cr in u.change_requests if cr.status == "pending"]
    history = [svc.change_request_dict(cr, with_diff=False) for u in mine for cr in u.change_requests if cr.status != "pending"]
    notes = db.query(Notification).filter(Notification.recipient == email).order_by(Notification.created_at.desc()).limit(20).all()
    return {"investor": email, "units": rows, "pending_requests": pending, "past_requests": history,
            "notifications": [svc.notification_dict(n) for n in notes]}


class DecideBody(BaseModel):
    decision: str
    note: str = ""


@router.post("/change-requests/{cr_id}/decide")
def decide(cr_id: int, body: DecideBody, actor: Actor = Depends(require_role("investor", "admin")), db: Session = Depends(get_db)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(404, "change request not found")
    email = actor.user if actor.role == "investor" else (cr.affected_owner.owner_email if cr.affected_owner else "")
    _run(svc.decide_change_request, db, cr, body.decision, email, body.note)
    db.commit()
    return {"ok": True, "change_request": svc.change_request_dict(cr, with_diff=False), "unit": _unit_row(cr.unit)}


class DisputeBody(BaseModel):
    unit_ulpin: str
    description: str = Field(..., min_length=5)
    change_request_id: int | None = None
    raised_by: str | None = None   # for the public verify page (no login)


@router.post("/disputes")
def file_dispute(body: DisputeBody, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    u = _unit(db, body.unit_ulpin)
    who = actor.user or body.raised_by or "anonymous"
    d = _run(svc.raise_dispute, db, u, who, body.description, body.change_request_id)
    db.commit()
    return {"ok": True, "message": f"Dispute #{d.id} filed against {u.unit_ulpin} (version {u.versions[-1].version_number if u.versions else '-'}).",
            "dispute": svc.dispute_dict(d)}


# ------------------------------------------------------------------ public verify

@router.get("/verify/{ulpin}")
def verify(ulpin: str, db: Session = Depends(get_db)):
    try:
        parse_ulpin(ulpin)
    except UlpinError as e:
        raise HTTPException(400, str(e))
    u = _unit(db, ulpin)
    versions = [svc.version_dict(v) for v in u.versions]
    flags = svc.unit_flags(u)
    warnings = []
    if flags["has_unapproved_change"]:
        warnings.append("This record was changed WITHOUT the registered owner's approval.")
    if flags["has_open_dispute"]:
        warnings.append("An unresolved dispute is filed against this record.")
    if flags["has_pending_request"]:
        warnings.append("A change request is pending the owner's decision.")
    return {
        "unit": _unit_row(u),
        "parcel": {"id": u.floor.building.parcel_id, "name": u.floor.building.parcel.name, "ulpin_2d": u.floor.building.parcel.ulpin_2d,
                   "builder": u.floor.building.parcel.builder},
        "owner": {"name": u.ownerships[0].owner_name, "registered_on": u.ownerships[0].registered_date.isoformat(),
                  "registration_no": u.ownerships[0].registration_no} if u.ownerships else None,
        "versions": versions,
        "baseline": versions[0] if versions else None,
        "current": versions[-1] if versions else None,
        "boundary_changed": len(versions) > 1 and versions[0]["geometry"] != versions[-1]["geometry"],
        "change_requests": [svc.change_request_dict(cr, with_diff=False) for cr in u.change_requests],
        "disputes": [svc.dispute_dict(d) for d in u.disputes],
        "flags": flags, "warnings": warnings,
        "status": "TAMPERED" if flags["has_unapproved_change"] else "DISPUTED" if flags["has_open_dispute"]
                  else "PENDING CHANGE" if flags["has_pending_request"] else "VERIFIED" if flags["locked"] else "UNREGISTERED",
    }


# ------------------------------------------------------------------ admin

@router.get("/admin/overview")
def admin_overview(actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    disputes = db.query(Dispute).order_by(Dispute.created_at.desc()).all()
    crs = db.query(ChangeRequest).order_by(ChangeRequest.created_at.desc()).all()
    units = db.query(Unit).options(selectinload(Unit.versions)).all()
    return {
        "open_disputes": [svc.dispute_dict(d) for d in disputes if d.status != "resolved"],
        "resolved_disputes": [svc.dispute_dict(d) for d in disputes if d.status == "resolved"],
        "pending_requests": [svc.change_request_dict(cr) for cr in crs if cr.status == "pending"],
        "decided_requests": [svc.change_request_dict(cr) for cr in crs if cr.status != "pending"],
        "tampered_units": [{"unit_ulpin": u.unit_ulpin, "label": u.label, "parcel_id": u.floor.building.parcel_id}
                           for u in units if any(v.approval_status == "unapproved" for v in u.versions)],
        "counts": {"disputes_open": sum(1 for d in disputes if d.status != "resolved"),
                   "requests_pending": sum(1 for cr in crs if cr.status == "pending"),
                   "versions_total": sum(len(u.versions) for u in units)},
    }


class DisputeStatus(BaseModel):
    status: str


@router.patch("/admin/disputes/{dispute_id}")
def set_dispute_status(dispute_id: int, body: DisputeStatus, actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    d = db.get(Dispute, dispute_id)
    if not d:
        raise HTTPException(404, "dispute not found")
    if body.status not in ("open", "investigating", "resolved"):
        raise HTTPException(400, "status must be open | investigating | resolved")
    d.status = body.status
    svc.notify(db, d.raised_by, f"Dispute #{d.id} on {d.unit.unit_ulpin} is now {d.status}.", d.unit.unit_ulpin)
    db.commit()
    return {"ok": True, "dispute": svc.dispute_dict(d)}


@router.get("/notifications")
def my_notifications(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    if not actor.user:
        return []
    return [svc.notification_dict(n) for n in db.query(Notification).filter(Notification.recipient == actor.user)
            .order_by(Notification.created_at.desc()).limit(30)]
