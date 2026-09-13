"""Analysis, decision-support and demo-story endpoints (all read-only except watches and the flagship scenario)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from ..auth import Actor, current_actor, require_role
from ..db import get_db
from ..models import AuditEvent, Building, ChangeRequest, Floor, Parcel, Unit, Watch
from ..services import analysis as an, audit, integrity as svc
from ..services.validation import validate_unit
from .lifecycle import DECISION_CATEGORIES, _unit, unit_public, unit_row

router = APIRouter(prefix="/api", tags=["analysis"])


def _analysis(db: Session, u: Unit) -> dict:
    events = db.query(AuditEvent).filter(AuditEvent.unit_id == u.id).order_by(AuditEvent.at).all()
    chg = an.current_change(u)
    prio = an.review_priority(u)
    comp = an.completeness(u, len(events))
    tl = an.risk_timeline(u, events)
    return {
        "labels": {"fact": "Stored record", "analysis": "Tribhoomi analysis", "demo": "Demonstration dataset"},
        "change": chg, "impacted": chg["impacted"] if chg else [], "timeline": tl, "priority": prio,
        "completeness": comp, "trust": an.trust_summary(u, comp, chg), "insight": an.insight(u, chg, prio, tl),
        "graph": an.dependency_graph(u), "decision_categories": DECISION_CATEGORIES,
        "decisions": [audit.to_dict(e) for e in events if e.action in ("unit.verified", "unit.rejected", "unit.changes_requested", "modification.approved", "modification.rejected", "modification.changes_requested")],
    }


@router.get("/property/{ident}/analysis")
def property_analysis(ident: str, db: Session = Depends(get_db)):
    return _analysis(db, _unit(db, ident))


class SimBody(BaseModel):
    volume: dict


@router.post("/authority/simulate/{ident}")
def simulate(ident: str, body: SimBody, actor: Actor = Depends(require_role("admin", "builder")), db: Session = Depends(get_db)):
    """What-if evaluation. Never writes: the session is discarded without commit."""
    u = _unit(db, ident)
    vol = {"min": [float(body.volume["min"][0]), float(body.volume["min"][1]), u.min_z], "max": [float(body.volume["max"][0]), float(body.volume["max"][1]), u.max_z]}
    result = an.simulate(u, vol)
    db.rollback()
    return {**result, "badge": "SIMULATION — NOT SAVED", "tpid": u.tpid}


@router.get("/authority/queue")
def authority_queue(actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Every unit that needs attention, ordered by the explainable review-priority heuristic."""
    units = db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes), selectinload(Unit.ownerships)).all()
    rows = []
    for u in units:
        needs = u.verification_status in ("pending", "conflict") or any(cr.status == "pending" for cr in u.change_requests) or any(d.status != "resolved" for d in u.disputes) or any(v.approval_status == "unapproved" for v in u.versions)
        if not needs:
            continue
        pr = an.review_priority(u)
        r = unit_row(u); r["priority"] = pr
        r["pending_modification"] = any(cr.status == "pending" for cr in u.change_requests)
        rows.append(r)
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    rows.sort(key=lambda r: (order[r["priority"]["level"]], -r["priority"]["score"]))
    return {"queue": rows, "method": rows[0]["priority"]["method"] if rows else an.review_priority.__doc__}


@router.get("/authority/map")
def authority_map(actor: Actor = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Actual stored units with their status and priority, as lon/lat footprints. No synthetic density."""
    units = db.query(Unit).options(selectinload(Unit.versions), selectinload(Unit.change_requests), selectinload(Unit.disputes)).all()
    feats = []
    for u in units:
        if u.usage_type in ("parking", "utility"):
            continue
        state = "disputed" if any(d.status != "resolved" for d in u.disputes) else "modification" if any(cr.status == "pending" for cr in u.change_requests) else u.verification_status
        pr = an.review_priority(u) if state in ("disputed", "modification", "conflict", "pending") else None
        feats.append({"type": "Feature", "geometry": svc.unit_footprint(u), "properties": {
            "tpid": u.tpid, "label": u.label, "building": u.floor.building.name, "project": u.floor.building.parcel.name, "floor": u.floor.floor_number,
            "status": state, "priority": pr["level"] if pr else None, "score": pr["score"] if pr else None}})
    return {"type": "FeatureCollection", "features": feats, "method": "Each polygon is a stored unit footprint coloured by its stored status; priority uses the Tribhoomi review-priority heuristic."}


@router.get("/builder/units/{ident}/checklist")
def submission_checklist(ident: str, db: Session = Depends(get_db)):
    u = _unit(db, ident)
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    v = validate_unit(building=b, floor=f, parcel=p, label=u.label, volume=svc.unit_volume(u), area_sqm=None, exclude_unit_id=u.id)
    by = {c["key"]: c for c in v["checks"]}
    items = [
        {"key": "identity", "text": "Unit number unique", "ok": by["identity"]["ok"], "fix": "editor"},
        {"key": "geometry", "text": "Geometry valid", "ok": by["geometry"]["ok"], "fix": "editor"},
        {"key": "footprint", "text": "Inside building", "ok": by["footprint"]["ok"], "fix": "editor"},
        {"key": "parcel", "text": "Inside parcel", "ok": by["parcel"]["ok"], "fix": "editor"},
        {"key": "overlap", "text": "No overlapping unit", "ok": by["overlap"]["ok"], "fix": "editor"},
        {"key": "area", "text": "Area calculated", "ok": u.area_sqm > 0, "fix": "fields"},
        {"key": "info", "text": "Required information complete", "ok": bool(u.unit_type) and bool(u.label.strip()), "fix": "fields"},
    ]
    return {"tpid": u.tpid, "ready": all(i["ok"] for i in items), "items": items, "score": v["score"]}


@router.get("/projects/{project_id}/health")
def project_health(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Parcel).options(selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.versions),
                                 selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.change_requests),
                                 selectinload(Parcel.buildings).selectinload(Building.floors).selectinload(Floor.units).selectinload(Unit.disputes)).filter(Parcel.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found.")
    units = [u for b in p.buildings for f in b.floors for u in f.units]
    changes_requested = {e.unit_id for e in db.query(AuditEvent).filter(AuditEvent.parcel_id == p.id, AuditEvent.action == "unit.changes_requested").all()}
    needs_changes = sum(1 for u in units if u.verification_status == "draft" and u.id in changes_requested)
    ready = 0
    for u in units:
        v = validate_unit(building=u.floor.building, floor=u.floor, parcel=p, label=u.label, volume=svc.unit_volume(u), area_sqm=None, exclude_unit_id=u.id)
        if v["valid"] and not v["conflicts"]:
            ready += 1
    return {"project": p.name, "units": len(units), "verified": sum(1 for u in units if u.verification_status == "verified"),
            "pending": sum(1 for u in units if u.verification_status == "pending"), "needs_changes": needs_changes,
            "conflicts": sum(1 for u in units if u.verification_status == "conflict"), "disputes": sum(1 for u in units for d in u.disputes if d.status != "resolved"),
            "modification_requests": sum(1 for u in units for cr in u.change_requests if cr.status == "pending"),
            "readiness_percent": round(ready / len(units) * 100) if units else 0,
            "method": "Submission readiness = share of units whose current geometry passes validation with no overlap."}


# ------------------------------------------------------------------ watch / alerts

@router.post("/watch/{ident}")
def toggle_watch(ident: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    if not actor.user:
        raise HTTPException(401, "Sign in (demo mode) to watch a property.")
    u = _unit(db, ident)
    w = db.query(Watch).filter(Watch.user == actor.user, Watch.unit_id == u.id).first()
    if w:
        db.delete(w); db.commit(); return {"watching": False, "tpid": u.tpid}
    db.add(Watch(user=actor.user, unit_id=u.id, created_at=datetime.utcnow()))
    audit.record(db, actor=actor.user, role=actor.role, action="property.watched", unit=u)
    db.commit()
    return {"watching": True, "tpid": u.tpid}


ALERT_ACTIONS = {"modification.requested": "A new boundary version was submitted", "unit.submitted": "Submitted for verification",
                 "unit.verified": "Verified by the authority", "modification.approved": "A modification was approved and recorded as a new version",
                 "modification.rejected": "A modification was rejected", "modification.changes_requested": "The authority asked for a correction",
                 "dispute.raised": "A dispute was raised", "unit.changes_requested": "The authority asked for changes", "unit.rejected": "Verification was rejected"}


@router.get("/alerts")
def alerts(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    """Tribhoomi application notifications for watched and owned properties (not a government alert)."""
    if not actor.user:
        return {"alerts": [], "watching": []}
    watches = db.query(Watch).filter(Watch.user == actor.user).all()
    since = {w.unit_id: w.created_at for w in watches}
    if actor.role == "owner":
        for u in db.query(Unit).options(selectinload(Unit.ownerships)).all():
            if any(o.owner_email == actor.user.lower() for o in u.ownerships):
                since.setdefault(u.id, datetime.utcnow() - timedelta(days=365 * 5))
    out = []
    for uid, t0 in since.items():
        u = db.get(Unit, uid)
        for e in db.query(AuditEvent).filter(AuditEvent.unit_id == uid, AuditEvent.at >= t0, AuditEvent.action.in_(list(ALERT_ACTIONS))).order_by(AuditEvent.at.desc()).limit(5).all():
            chg = an.current_change(u)
            out.append({"at": e.at.isoformat(), "tpid": u.tpid, "label": u.label, "building": u.floor.building.name, "event": ALERT_ACTIONS[e.action],
                        "status": u.verification_status, "pending_modification": any(cr.status == "pending" for cr in u.change_requests),
                        "area": {"before_sqft": chg["area_before_sqft"], "after_sqft": chg["area_after_sqft"]} if chg else None})
    out.sort(key=lambda x: x["at"], reverse=True)
    return {"alerts": out[:30], "watching": [db.get(Unit, w.unit_id).tpid for w in watches]}


# ------------------------------------------------------------------ flagship demo story

@router.post("/demo/flagship")
def flagship(stage: str = "setup", db: Session = Depends(get_db)):
    """
    Builds the boundary-modification story on a dedicated demo project so every step has real records:
    3-B/3-C/3-D registered and verified; 3-C modification overlapping 3-D submitted (stage=setup);
    with stage=full the authority requests a correction, the builder resubmits and it is approved.
    """
    from ..routers.lifecycle import _floor
    from ..services.layout import create_building, create_layout, next_parcel_no
    from ..ulpin import ParcelKey, level_from_floor_number, make_3d_ulpin

    builder, authority = "Aravalli Heights Developers (demo)", "Authority Demo User"
    name = "Aravalli Heights (flagship demo)"
    p = db.query(Parcel).filter(Parcel.name == name).first()
    if not p:
        lng, lat = 77.4330, 28.6010
        geom = {"type": "Polygon", "coordinates": [[[lng, lat], [lng + 0.0007, lat], [lng + 0.0007, lat - 0.0006], [lng, lat - 0.0006], [lng, lat]]]}
        key = ParcelKey(9, 141, 999, next_parcel_no(db, 9, 141, 999))
        p = create_layout(db, geometry=geom, key=key, name=name, state="Uttar Pradesh", district="Gautam Buddh Nagar", village_ward="Greater Noida West – Sector 16C",
                          builder=builder, land_use="residential", building={"num_floors": 1, "units_per_floor": 0, "name": "__placeholder__"})
        for b in list(p.buildings):
            db.delete(b)
        db.flush(); db.refresh(p); p.city, p.address = "Greater Noida", "Sector 16C"
        audit.record(db, actor=builder, role="builder", action="project.created", parcel_id=p.id, subject=p.name, status="Draft")
    n = len(p.buildings) + 1
    key = ParcelKey(p.state_code, p.district_code, p.village_ward_code, p.parcel_no)
    b = create_building(db, p, key, {"name": f"Tower {chr(64 + n)}", "num_floors": 12, "num_basements": 0, "units_per_floor": 0, "footprint_inset_m": 4})
    audit.record(db, actor=builder, role="builder", action="building.created", parcel_id=p.id, subject=f"{p.name} · {b.name}", new="12 floors")
    f = next(x for x in b.floors if x.floor_number == 3)
    minx, miny = min(pt[0] for pt in json.loads(b.local_footprint)), min(pt[1] for pt in json.loads(b.local_footprint))
    w = 11.0
    made = {}
    for i, lab in enumerate(["3-B", "3-C", "3-D"]):
        x0 = minx + 2 + i * (w + 0.5)
        u = Unit(floor_id=f.id, unit_no=i + 1, unit_ulpin=make_3d_ulpin(key, b.building_no, level_from_floor_number(3), i + 1), label=lab, area_sqm=round(w * 10.5, 1),
                 usage_type="residential", unit_type="3 BHK", sale_status="available", verification_status="draft", created_by=builder,
                 min_x=round(x0, 2), min_y=round(miny + 2, 2), min_z=f.base_elevation_m, max_x=round(x0 + w, 2), max_y=round(miny + 12.5, 2), max_z=f.base_elevation_m + f.height_m)
        db.add(u); db.flush(); made[lab] = u
        t = datetime.utcnow() - timedelta(days=40 - i)
        audit.record(db, actor=builder, role="builder", action="unit.created", unit=u, new=f"{lab} · {u.area_sqm} m²", status="draft", when=t)
        audit.record(db, actor="Tribhoomi validation", role="system", action="unit.validated", unit=u, new="score 100/100", status="valid", when=t)
        u.verification_status, u.submitted_at = "pending", t + timedelta(days=1)
        audit.record(db, actor=builder, role="builder", action="unit.submitted", unit=u, previous="draft", new="pending", status="pending", when=t + timedelta(days=1))
        u.verification_status, u.verified_by, u.verified_at = "verified", authority, t + timedelta(days=3)
        u.verification_id = f"TRB-VER-{u.verified_at.strftime('%Y%m%d')}-{u.id:04X}"
        svc.append_version(db, u, changed_by=authority, reason="Authority verification baseline", approval_status="baseline", when=t + timedelta(days=3))
        audit.record(db, actor=authority, role="admin", action="unit.verified", unit=u, previous="pending", new="verified", status="verified", note=u.verification_id, when=t + timedelta(days=3))
    c = made["3-C"]
    # STEP 5: builder proposes extending 3-C east by 1.5 m, which overlaps 3-D by 1 m
    cr = svc.create_change_request(db, c, builder, svc.shifted_volume(c, dw=1.5), "3-C", "Extend eastern wall by 1.5 m per revised plan", when=datetime.utcnow() - timedelta(days=2))
    result = {"project_id": p.id, "building_id": b.id, "units": {k: v.tpid for k, v in made.items()}, "change_request_id": cr.id, "stage": stage}
    if stage == "full":
        svc.decide_change_request(db, cr, "changes", "", "Proposed eastern boundary overlaps Unit 3-D by about 1 m. Please correct.", "Neighbour conflict")
        cr2 = svc.create_change_request(db, c, builder, svc.shifted_volume(c, dw=0.4), "3-C", "Corrected: extend eastern wall by 0.4 m (no overlap)", when=datetime.utcnow() - timedelta(hours=6))
        svc.decide_change_request(db, cr2, "approve", "", "Corrected boundary verified against 3-D.", "Boundary correction")
        result["second_change_request_id"] = cr2.id
    db.commit()
    return result
