"""
Builder–investor layout integrity.

The one rule everything here enforces:

    Registration locks the baseline.
    A unit is editable by its builder only while nobody owns it. The moment it
    gets an ownership record we snapshot geometry + plot number + ULPIN as
    plot_versions v1 and from then on every change must go through a
    change_request that the affected investor approves.

Geometry vocabulary:
  * bounding volume  – {"min":[x,y,z],"max":[x,y,z]} in building-local metres (what the 3D viewer and the
                       topology validator use)
  * footprint        – the same box as a GeoJSON polygon in lon/lat (what maps and the public verify page show)
"""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from ..geo import local_to_lnglat
from ..models import ChangeRequest, Dispute, Notification, Ownership, Parcel, PlotVersion, Unit
from . import audit


class IntegrityError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------------------------------------------------------------- geometry helpers

def unit_volume(u: Unit) -> dict:
    return {"min": [u.min_x, u.min_y, u.min_z], "max": [u.max_x, u.max_y, u.max_z]}


def volume_to_footprint(vol: dict, parcel: Parcel) -> dict:
    (x0, y0, _), (x1, y1, _) = vol["min"], vol["max"]
    ring = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    coords = [list(local_to_lnglat(x, y, parcel.centroid_lng, parcel.centroid_lat)) for x, y in ring]
    return {"type": "Polygon", "coordinates": [coords]}


def unit_footprint(u: Unit) -> dict:
    return volume_to_footprint(unit_volume(u), u.floor.building.parcel)


def apply_volume(u: Unit, vol: dict) -> None:
    u.min_x, u.min_y, u.min_z = vol["min"]
    u.max_x, u.max_y, u.max_z = vol["max"]
    u.area_sqm = round((u.max_x - u.min_x) * (u.max_y - u.min_y), 1)


def shifted_volume(u: Unit, dx: float = 0, dy: float = 0, dw: float = 0, dd: float = 0) -> dict:
    """Builder-friendly way to propose a boundary: move by dx/dy metres, grow width/depth by dw/dd."""
    return {
        "min": [round(u.min_x + dx, 2), round(u.min_y + dy, 2), u.min_z],
        "max": [round(u.max_x + dx + dw, 2), round(u.max_y + dy + dd, 2), u.max_z],
    }


# ---------------------------------------------------------------- versions

def latest_version(u: Unit) -> PlotVersion | None:
    return u.versions[-1] if u.versions else None


def append_version(db: Session, u: Unit, changed_by: str, reason: str, approval_status: str,
                   change_request_id: int | None = None, when: datetime | None = None) -> PlotVersion:
    v = PlotVersion(
        unit_id=u.id,
        version_number=(latest_version(u).version_number + 1) if u.versions else 1,
        geometry=json.dumps(unit_footprint(u)),
        bounding_volume=json.dumps(unit_volume(u)),
        plot_number=u.label,
        ulpin=u.unit_ulpin,
        changed_by=changed_by,
        change_reason=reason,
        approval_status=approval_status,
        change_request_id=change_request_id,
        created_at=when or datetime.utcnow(),
    )
    db.add(v)
    u.versions.append(v)
    db.flush()
    return v


# ---------------------------------------------------------------- builder actions

def assign_unit(db: Session, u: Unit, owner_name: str, owner_email: str, ownership_type: str,
                builder: str, when: datetime | None = None) -> Ownership:
    """Sell/register a unit. This is the moment the baseline gets locked."""
    if u.is_locked:
        raise IntegrityError(409, f"{u.unit_ulpin} is already registered to {u.ownerships[0].owner_name}; "
                                  "use a change request to alter it.")
    when = when or datetime.utcnow()
    o = Ownership(unit_id=u.id, owner_name=owner_name, owner_email=owner_email.lower().strip(),
                  ownership_type=ownership_type, share_percent=100.0, registered_date=when.date(),
                  registration_no=f"SR-UP-{when.year}-{u.id:04d}")
    db.add(o)
    u.ownerships.append(o)
    db.flush()
    if not u.versions:
        append_version(db, u, changed_by=builder, reason="Registered baseline at sale", approval_status="baseline", when=when)
    audit.record(db, actor=builder, role="builder", action="unit.assigned", unit=u, new=f"{owner_name} ({o.owner_email})", status="registered", when=when)
    notify(db, o.owner_email, f"{u.label} ({u.unit_ulpin}) has been registered in your name. Baseline v1 locked.", u.unit_ulpin)
    return o


def direct_edit(db: Session, u: Unit, builder: str, plot_number: str | None, volume: dict | None) -> Unit:
    """Allowed only while the unit is unsold AND not yet verified."""
    if u.is_locked:
        raise IntegrityError(423, f"{u.unit_ulpin} is locked: it has a registered owner. Submit a change request instead.")
    if u.verification_status in ("verified", "pending"):
        raise IntegrityError(423, f"{u.label} is {u.verification_status}; verified geometry is never overwritten directly. Request a modification instead.")
    if plot_number:
        u.label = plot_number
    if volume:
        apply_volume(u, volume)
    db.flush()
    return u


def create_change_request(db: Session, u: Unit, builder: str, proposed_volume: dict,
                          proposed_plot_number: str, reason: str, when: datetime | None = None) -> ChangeRequest:
    if not u.is_locked and u.verification_status not in ("verified", "pending"):
        raise IntegrityError(400, f"{u.label} is an unsold draft; the builder can edit it directly.")
    if not reason.strip():
        raise IntegrityError(400, "A reason is required for every change request.")
    if any(cr.status == "pending" for cr in u.change_requests):
        raise IntegrityError(409, "There is already a pending change request for this unit.")
    owner = u.ownerships[0] if u.ownerships else None
    parcel = u.floor.building.parcel
    cr = ChangeRequest(
        unit_id=u.id, requested_by=builder,
        proposed_geometry=json.dumps(volume_to_footprint(proposed_volume, parcel)),
        proposed_bounding_volume=json.dumps(proposed_volume),
        proposed_plot_number=proposed_plot_number or u.label,
        reason=reason, status="pending", affected_owner_id=owner.id if owner else None, created_at=when or datetime.utcnow(),
    )
    db.add(cr)
    db.flush()
    audit.record(db, actor=builder, role="builder", action="modification.requested", unit=u, previous=f"{u.label} · {u.area_sqm} m²",
                 new=f"{proposed_plot_number or u.label} · proposed boundary", status="pending", note=reason, when=when)
    if owner:
        notify(db, owner.owner_email,
               f"{builder} requests a change to {u.label} ({u.unit_ulpin}): {reason}. Please approve or reject.",
               u.unit_ulpin, cr.id)
    notify(db, "admin", f"Modification request #{cr.id} on {u.label} ({u.unit_ulpin}) by {builder}.", u.unit_ulpin, cr.id)
    return cr


# ---------------------------------------------------------------- investor actions

def decide_change_request(db: Session, cr: ChangeRequest, decision: str, actor_email: str, note: str = "") -> ChangeRequest:
    if cr.status != "pending":
        raise IntegrityError(409, f"Change request #{cr.id} is already {cr.status}.")
    owner = cr.affected_owner
    if owner and owner.owner_email and owner.owner_email != actor_email.lower().strip():
        raise IntegrityError(403, "Only the registered owner of this unit can decide on this change request.")
    u = cr.unit
    cr.resolved_at = datetime.utcnow()
    cr.resolution_note = note
    if decision == "approve":
        cr.status = "approved"
        prev = f"{u.label} · {u.area_sqm} m²"
        u.label = cr.proposed_plot_number
        apply_volume(u, json.loads(cr.proposed_bounding_volume))
        append_version(db, u, changed_by=cr.requested_by, reason=cr.reason, approval_status="approved", change_request_id=cr.id)
        audit.record(db, actor=actor_email or "authority", role="owner" if owner and owner.owner_email == actor_email.lower().strip() else "admin",
                     action="modification.approved", unit=u, previous=prev, new=f"{u.label} · {u.area_sqm} m²", status="approved", note=note)
        notify(db, cr.requested_by, f"Change request #{cr.id} on {u.unit_ulpin} was APPROVED. New version recorded.", u.unit_ulpin, cr.id)
    elif decision == "reject":
        cr.status = "rejected"
        audit.record(db, actor=actor_email or "authority", role="owner" if owner and owner.owner_email == actor_email.lower().strip() else "admin",
                     action="modification.rejected", unit=u, status="rejected", note=note)
        notify(db, cr.requested_by, f"Change request #{cr.id} on {u.unit_ulpin} was REJECTED. {note}".strip(), u.unit_ulpin, cr.id)
    else:
        raise IntegrityError(400, "decision must be 'approve' or 'reject'")
    db.flush()
    return cr


def raise_dispute(db: Session, u: Unit, raised_by: str, description: str,
                  change_request_id: int | None = None, when: datetime | None = None) -> Dispute:
    if not description.strip():
        raise IntegrityError(400, "Please describe the problem.")
    v = latest_version(u)
    d = Dispute(unit_id=u.id, raised_by=raised_by, change_request_id=change_request_id,
                plot_version_id=v.id if v else None, description=description, status="open",
                created_at=when or datetime.utcnow())
    db.add(d)
    db.flush()
    audit.record(db, actor=raised_by, role="owner", action="dispute.raised", unit=u, status="open", note=description, when=when)
    notify(db, "admin", f"New dispute #{d.id} on {u.unit_ulpin} raised by {raised_by}.", u.unit_ulpin, change_request_id)
    return d


# ---------------------------------------------------------------- notifications & flags

def notify(db: Session, recipient: str, message: str, unit_ulpin: str = "", change_request_id: int | None = None) -> None:
    db.add(Notification(recipient=recipient, message=message, unit_ulpin=unit_ulpin,
                        change_request_id=change_request_id, read=False, created_at=datetime.utcnow()))


def unit_flags(u: Unit) -> dict:
    """The warning signals shown on the 3D viewer, verify page and dashboards."""
    return {
        "locked": u.is_locked,
        "version_count": len(u.versions),
        "changed_since_registration": len(u.versions) > 1,
        "has_unapproved_change": any(v.approval_status == "unapproved" for v in u.versions),
        "has_pending_request": any(cr.status == "pending" for cr in u.change_requests),
        "has_open_dispute": any(d.status != "resolved" for d in u.disputes),
    }


# ---------------------------------------------------------------- serialisers

def version_dict(v: PlotVersion) -> dict:
    return {
        "id": v.id, "version_number": v.version_number, "plot_number": v.plot_number, "ulpin": v.ulpin,
        "geometry": json.loads(v.geometry), "bounding_volume": json.loads(v.bounding_volume),
        "changed_by": v.changed_by, "change_reason": v.change_reason, "approval_status": v.approval_status,
        "change_request_id": v.change_request_id, "created_at": v.created_at.isoformat(),
    }


def change_request_dict(cr: ChangeRequest, with_diff: bool = True) -> dict:
    u = cr.unit
    d = {
        "id": cr.id, "unit_ulpin": u.unit_ulpin, "unit_label": u.label, "requested_by": cr.requested_by,
        "proposed_plot_number": cr.proposed_plot_number, "reason": cr.reason, "status": cr.status,
        "resolution_note": cr.resolution_note, "created_at": cr.created_at.isoformat(),
        "resolved_at": cr.resolved_at.isoformat() if cr.resolved_at else None,
        "affected_owner": {"name": cr.affected_owner.owner_name, "email": cr.affected_owner.owner_email} if cr.affected_owner else None,
        "parcel_id": u.floor.building.parcel_id, "building_name": u.floor.building.name,
    }
    if with_diff:
        d["diff"] = {
            "before": {"plot_number": u.label, "geometry": unit_footprint(u), "bounding_volume": unit_volume(u)},
            "after": {"plot_number": cr.proposed_plot_number, "geometry": json.loads(cr.proposed_geometry),
                      "bounding_volume": json.loads(cr.proposed_bounding_volume)},
        }
    return d


def dispute_dict(d: Dispute) -> dict:
    u = d.unit
    base = u.versions[0] if u.versions else None
    cur = latest_version(u)
    return {
        "id": d.id, "unit_ulpin": u.unit_ulpin, "unit_label": u.label, "raised_by": d.raised_by,
        "description": d.description, "status": d.status, "created_at": d.created_at.isoformat(),
        "change_request_id": d.change_request_id, "plot_version_id": d.plot_version_id,
        "parcel_id": u.floor.building.parcel_id, "building_name": u.floor.building.name,
        "owner": {"name": u.ownerships[0].owner_name, "email": u.ownerships[0].owner_email} if u.ownerships else None,
        "diff": {
            "before": {"plot_number": base.plot_number, "geometry": json.loads(base.geometry), "version": base.version_number} if base else None,
            "after": {"plot_number": cur.plot_number, "geometry": json.loads(cur.geometry), "version": cur.version_number,
                      "approval_status": cur.approval_status} if cur else None,
        },
        "flags": unit_flags(u),
    }


def notification_dict(n: Notification) -> dict:
    return {"id": n.id, "message": n.message, "unit_ulpin": n.unit_ulpin, "change_request_id": n.change_request_id,
            "read": n.read, "created_at": n.created_at.isoformat()}
