"""Audit trail helpers. Every important action calls `record` so the trail is complete."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..models import AuditEvent, Unit

VERBS = {
    "project.created": "Created project", "building.created": "Added building", "unit.created": "Created unit",
    "unit.validated": "Ran validation", "unit.submitted": "Submitted for verification",
    "unit.verified": "Verified unit", "unit.rejected": "Rejected verification", "unit.changes_requested": "Requested changes",
    "unit.assigned": "Registered ownership", "modification.requested": "Requested boundary modification",
    "modification.approved": "Approved modification", "modification.rejected": "Rejected modification",
    "modification.changes_requested": "Requested correction to modification", "property.watched": "Started watching property",
    "dispute.raised": "Raised dispute", "dispute.updated": "Updated dispute status",
}


DISPLAY = {"admin": "Authority Demo User"}


def record(db: Session, *, actor: str, role: str, action: str, unit: Unit | None = None, parcel_id: int | None = None,
           subject: str = "", previous: str = "", new: str = "", status: str = "", note: str = "",
           when: datetime | None = None, category: str = "") -> AuditEvent:
    ev = AuditEvent(
        at=when or datetime.utcnow(), actor=DISPLAY.get(actor, actor) or "system", role=role, action=action,
        unit_id=unit.id if unit else None, parcel_id=parcel_id if parcel_id is not None else (unit.floor.building.parcel_id if unit else None),
        subject=subject or (unit.tpid if unit else ""), previous_value=previous, new_value=new, status=status, note=note, category=category,
    )
    db.add(ev)
    db.flush()
    return ev


def to_dict(ev: AuditEvent) -> dict:
    return {
        "id": ev.id, "at": ev.at.isoformat(), "actor": ev.actor, "role": ev.role, "action": ev.action,
        "label": VERBS.get(ev.action, ev.action), "subject": ev.subject, "previous_value": ev.previous_value,
        "new_value": ev.new_value, "status": ev.status, "note": ev.note, "category": ev.category, "unit_id": ev.unit_id, "parcel_id": ev.parcel_id,
    }
