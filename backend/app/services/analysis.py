"""
Tribhoomi analysis layer — deterministic, explainable, and derived only from stored data.

Everything here answers three questions about a unit:
  * What exactly changed?           -> geometry_change, impacted_neighbours
  * Is the current state trustworthy? -> risk_timeline, trust_summary, completeness, insight
  * What should the authority do next? -> review_priority, simulate

Nothing in this module writes to the database. Every score explains its factors and is
labelled as a Tribhoomi heuristic, never as an official government value.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta

from shapely.geometry import Polygon

from ..models import Building, Floor, Parcel, Unit
from ..topology import box_intersection_volume
from .validation import validate_unit

SQFT = 10.7639
Vol = dict  # {"min":[x,y,z], "max":[x,y,z]} in building-local metres


# ------------------------------------------------------------------ geometry helpers

def _rect(v: Vol) -> Polygon:
    return Polygon([(v["min"][0], v["min"][1]), (v["max"][0], v["min"][1]), (v["max"][0], v["max"][1]), (v["min"][0], v["max"][1])])


def area_sqm(v: Vol) -> float:
    return round(max(0.0, v["max"][0] - v["min"][0]) * max(0.0, v["max"][1] - v["min"][1]), 1)


def _box(v: Vol):
    return (v["min"][0], v["min"][1], v["min"][2], v["max"][0], v["max"][1], v["max"][2])


def _direction(dx: float, dy: float) -> str:
    if abs(dx) < 0.05 and abs(dy) < 0.05:
        return "none"
    ang = math.degrees(math.atan2(dy, dx))  # 0 = east, 90 = north
    names = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"]
    return names[int(((ang + 22.5) % 360) // 45)]


def geometry_change(before: Vol, after: Vol, *, neighbours: list[dict] | None = None,
                    footprint: list[list[float]] | None = None, parcel_local: list[list[float]] | None = None) -> dict:
    """
    Compare two boundaries (building-local metres). Pure function.
    neighbours: [{"label","tpid","volume"}] used to find overlaps introduced by the change.
    """
    a0, a1 = area_sqm(before), area_sqm(after)
    diff = round(a1 - a0, 1)
    pct = round((diff / a0) * 100, 1) if a0 else 0.0
    edges = {
        "north": round(after["max"][1] - before["max"][1], 2), "south": round(after["min"][1] - before["min"][1], 2),
        "east": round(after["max"][0] - before["max"][0], 2), "west": round(after["min"][0] - before["min"][0], 2),
    }
    moves = []
    for edge, d in edges.items():
        if abs(d) >= 0.05:
            outward = (d > 0) if edge in ("north", "east") else (d < 0)
            moves.append({"edge": edge, "metres": abs(d), "outward": outward,
                          "text": f"{edge.capitalize()} boundary moved {'outward' if outward else 'inward'} by about {abs(d):.1f} m"})
    cx0, cy0 = (before["min"][0] + before["max"][0]) / 2, (before["min"][1] + before["max"][1]) / 2
    cx1, cy1 = (after["min"][0] + after["max"][0]) / 2, (after["min"][1] + after["max"][1]) / 2
    shift = round(math.hypot(cx1 - cx0, cy1 - cy0), 2)
    direction = _direction(cx1 - cx0, cy1 - cy0)
    p0, p1 = _rect(before), _rect(after)
    changed_region = round(p0.symmetric_difference(p1).area, 1) if p0.is_valid and p1.is_valid else 0.0

    overlaps_before, overlaps_after = {}, {}
    for n in neighbours or []:
        nv = n["volume"]
        ob = box_intersection_volume(_box(before), _box(nv)); oa = box_intersection_volume(_box(after), _box(nv))
        if ob > 0.01: overlaps_before[n["tpid"]] = round(_rect(before).intersection(_rect(nv)).area, 1)
        if oa > 0.01: overlaps_after[n["tpid"]] = round(_rect(after).intersection(_rect(nv)).area, 1)
    new_conflicts = [{"tpid": n["tpid"], "label": n["label"], "overlap_sqm": overlaps_after[n["tpid"]],
                      "overlap_pct": round(overlaps_after[n["tpid"]] / a1 * 100, 1) if a1 else 0}
                     for n in (neighbours or []) if n["tpid"] in overlaps_after and n["tpid"] not in overlaps_before]
    persisting = [n["tpid"] for n in (neighbours or []) if n["tpid"] in overlaps_after and n["tpid"] in overlaps_before]

    containment = {}
    if footprint:
        fp = Polygon([tuple(p) for p in footprint])
        containment["building_outside_before_sqm"] = round(p0.difference(fp.buffer(0.05)).area, 1)
        containment["building_outside_after_sqm"] = round(p1.difference(fp.buffer(0.05)).area, 1)
    if parcel_local:
        pp = Polygon([tuple(p) for p in parcel_local])
        containment["parcel_outside_before_sqm"] = round(p0.difference(pp.buffer(0.05)).area, 1)
        containment["parcel_outside_after_sqm"] = round(p1.difference(pp.buffer(0.05)).area, 1)
    leaves_building = containment.get("building_outside_after_sqm", 0) > 0.5 and containment.get("building_outside_before_sqm", 0) <= 0.5

    if new_conflicts or leaves_building:
        risk, why = "high", "The proposed boundary now overlaps an existing registered unit." if new_conflicts else "The proposed boundary now extends beyond the registered building area."
    elif abs(pct) >= 5:
        risk, why = "medium", f"Unusual change: the recorded area changes by {pct:+.1f}%."
    elif abs(pct) >= 2 or shift >= 1.0:
        risk, why = "low", "Small boundary adjustment; requires review as part of the modification."
    else:
        risk, why = "low", "Negligible geometric change."
    return {
        "kind": "tribhoomi_analysis",
        "area_before_sqm": a0, "area_after_sqm": a1, "area_before_sqft": round(a0 * SQFT), "area_after_sqft": round(a1 * SQFT),
        "area_diff_sqm": diff, "area_diff_sqft": round(diff * SQFT), "area_pct": pct,
        "edge_moves": moves, "centroid_shift_m": shift, "direction": direction, "changed_region_sqm": changed_region,
        "new_conflicts": new_conflicts, "persisting_conflicts": persisting, "containment": containment,
        "leaves_building": leaves_building, "risk": risk, "why_it_matters": why,
    }


def impacted_neighbours(proposed: Vol, neighbours: list[dict], near_m: float = 0.5) -> list[dict]:
    """Registered units that overlap the proposed boundary or come within `near_m` of it."""
    out = []
    p = _rect(proposed); a = area_sqm(proposed)
    for n in neighbours:
        q = _rect(n["volume"])
        inter = p.intersection(q).area
        if inter > 0.01:
            out.append({"tpid": n["tpid"], "label": n["label"], "kind": "overlap", "overlap_sqm": round(inter, 1),
                        "overlap_pct": round(inter / a * 100, 1) if a else 0, "distance_m": 0.0,
                        "reason": f"Proposed geometry overlaps {n['label']} by approximately {inter:.1f} m² ({inter / a * 100 if a else 0:.1f}% of the unit)."})
        else:
            d = p.distance(q)
            if d <= near_m:
                out.append({"tpid": n["tpid"], "label": n["label"], "kind": "adjacent", "overlap_sqm": 0.0, "overlap_pct": 0.0, "distance_m": round(d, 2),
                            "reason": f"Proposed boundary comes within {d:.1f} m of {n['label']}."})
    out.sort(key=lambda x: (x["kind"] != "overlap", -x["overlap_sqm"], x["distance_m"]))
    return out


# ------------------------------------------------------------------ unit-level analysis (reads ORM objects, no writes)

def _neighbours_of(u: Unit) -> list[dict]:
    return [{"label": n.label, "tpid": n.tpid, "volume": {"min": [n.min_x, n.min_y, n.min_z], "max": [n.max_x, n.max_y, n.max_z]}, "status": n.verification_status}
            for n in u.floor.units if n.id != u.id]


def _vol(u: Unit) -> Vol:
    return {"min": [u.min_x, u.min_y, u.min_z], "max": [u.max_x, u.max_y, u.max_z]}


def current_change(u: Unit) -> dict | None:
    """Registered baseline (v1) vs current record, or current vs a pending proposal if one exists."""
    b = u.floor.building; p = b.parcel
    fp = json.loads(b.local_footprint)
    from ..geo import polygon_to_local
    pl = polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat)
    pending = next((cr for cr in u.change_requests if cr.status == "pending"), None)
    if pending:
        before, after, mode = _vol(u), json.loads(pending.proposed_bounding_volume), "registered_vs_proposed"
    elif len(u.versions) > 1:
        before, after, mode = json.loads(u.versions[0].bounding_volume), _vol(u), "baseline_vs_current"
    else:
        return None
    d = geometry_change(before, after, neighbours=_neighbours_of(u), footprint=fp, parcel_local=pl)
    d.update({"mode": mode, "before": before, "after": after, "impacted": impacted_neighbours(after, _neighbours_of(u)),
              "proposal_id": pending.id if pending else None, "proposed_by": pending.requested_by if pending else None,
              "approved": (u.versions[-1].approval_status != "unapproved") if (not pending and u.versions) else None})
    return d


def risk_timeline(u: Unit, audit_events: list) -> list[dict]:
    """Chronological risk events derived from versions, change requests, disputes and audit. No invented events."""
    ev: list[dict] = []
    role_of = {e.actor: e.role for e in audit_events}
    created = next((e for e in audit_events if e.action == "unit.created"), None)
    if created:
        ev.append({"at": created.at.isoformat(), "event": "Property registered", "version": 1 if u.versions else None, "area_change_pct": None,
                   "movement_m": None, "conflict": None, "risk": "low", "actor_role": created.role, "source": "audit"})
    for e in audit_events:
        if e.action == "unit.verified":
            ev.append({"at": e.at.isoformat(), "event": "Authority verified the record", "version": None, "area_change_pct": None, "movement_m": None,
                       "conflict": None, "risk": "low", "actor_role": e.role, "source": "audit"})
    prev = None
    for v in u.versions:
        vol = json.loads(v.bounding_volume)
        if prev is None:
            if not created:
                ev.append({"at": v.created_at.isoformat(), "event": "Baseline recorded (version 1)", "version": 1, "area_change_pct": None,
                           "movement_m": None, "conflict": None, "risk": "low", "actor_role": "builder", "source": "version"})
        else:
            g = geometry_change(prev, vol, neighbours=_neighbours_of(u))
            unapproved = v.approval_status == "unapproved"
            risk = "high" if unapproved or g["new_conflicts"] else ("medium" if abs(g["area_pct"]) >= 5 else "low")
            ev.append({"at": v.created_at.isoformat(), "event": "Boundary modified" + (" without owner approval" if unapproved else " (approved)"),
                       "version": v.version_number, "area_change_pct": g["area_pct"], "movement_m": g["centroid_shift_m"],
                       "conflict": ", ".join(c["label"] for c in g["new_conflicts"]) or None, "risk": risk,
                       "actor_role": role_of.get(v.changed_by, "builder"), "source": "version"})
        prev = vol
    for cr in u.change_requests:
        if cr.status == "pending":
            g = geometry_change(_vol(u), json.loads(cr.proposed_bounding_volume), neighbours=_neighbours_of(u))
            ev.append({"at": cr.created_at.isoformat(), "event": "Modification proposed (pending review)", "version": None, "area_change_pct": g["area_pct"],
                       "movement_m": g["centroid_shift_m"], "conflict": ", ".join(c["label"] for c in g["new_conflicts"]) or None,
                       "risk": "high" if g["new_conflicts"] else "medium", "actor_role": "builder", "source": "change_request"})
        elif cr.status in ("rejected", "changes_requested"):
            ev.append({"at": (cr.resolved_at or cr.created_at).isoformat(), "event": f"Modification {cr.status.replace('_', ' ')}", "version": None,
                       "area_change_pct": None, "movement_m": None, "conflict": None, "risk": "low", "actor_role": "authority", "source": "change_request"})
    # a conflict that exists right now, dated at the latest geometry change we know of
    now_overlap = [n for n in _neighbours_of(u) if box_intersection_volume(_box(_vol(u)), _box(n["volume"])) > 0.01]
    if now_overlap:
        when = (u.versions[-1].created_at if u.versions else (u.submitted_at or datetime.utcnow())).isoformat()
        ev.append({"at": when, "event": "Potential overlap detected with " + ", ".join(n["label"] for n in now_overlap), "version": u.versions[-1].version_number if u.versions else None,
                   "area_change_pct": None, "movement_m": None, "conflict": ", ".join(n["label"] for n in now_overlap), "risk": "high", "actor_role": "tribhoomi", "source": "analysis"})
    for d in u.disputes:
        ev.append({"at": d.created_at.isoformat(), "event": "Dispute submitted" + (f" ({d.status})" if d.status != "open" else ""), "version": None,
                   "area_change_pct": None, "movement_m": None, "conflict": None, "risk": "critical" if d.status != "resolved" else "low", "actor_role": "owner", "source": "dispute"})
    ev.sort(key=lambda x: x["at"])
    return ev


LEVELS = [(70, "critical"), (40, "high"), (20, "medium"), (0, "low")]


def review_priority(u: Unit, now: datetime | None = None) -> dict:
    """Transparent review-priority heuristic: every point is listed with its reason."""
    now = now or datetime.utcnow()
    factors: list[dict] = []
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    v = validate_unit(building=b, floor=f, parcel=p, label=u.label, volume=_vol(u), area_sqm=None, exclude_unit_id=u.id)
    chg = current_change(u)

    def add(points: int, reason: str):
        if points:
            factors.append({"points": points, "reason": reason})

    overlaps = v["conflicts"]
    if overlaps:
        worst = max(overlaps, key=lambda c: c["overlap_sqm"])
        pct = round(worst["overlap_sqm"] / max(u.area_sqm, 1) * 100, 1)
        add(40 + (10 if pct >= 5 else 0), f"{pct}% overlap with {worst['with_unit']}")
    elif chg and chg["new_conflicts"]:
        c = chg["new_conflicts"][0]
        add(35, f"Proposed boundary would overlap {c['label']} by {c['overlap_pct']}%")
    if any(d.status != "resolved" for d in u.disputes):
        add(30, "Active dispute on this record")
    if any(x.approval_status == "unapproved" for x in u.versions):
        add(25, "A version was recorded without owner approval")
    if chg and abs(chg["area_pct"]) >= 10:
        add(25, f"Area change of {chg['area_pct']:+.1f}%")
    elif chg and abs(chg["area_pct"]) >= 5:
        add(15, f"Area change of {chg['area_pct']:+.1f}%")
    recent = [cr for cr in u.change_requests if cr.created_at >= now - timedelta(days=30)] + [x for x in u.versions if x.created_at >= now - timedelta(days=30) and x.version_number > 1]
    if len(recent) >= 2:
        add(10, f"Modified {len(recent)} times in the last 30 days")
    hard = [c for c in v["checks"] if not c["ok"] and c.get("severity") != "warning" and c["key"] != "overlap"]
    if hard:
        add(min(20, 10 * len(hard)), "Validation failure: " + "; ".join(c["text"] for c in hard))
    if not u.unit_type or not u.area_sqm:
        add(5, "Missing property type or area")
    if chg and chg["impacted"]:
        add(min(15, 5 * len(chg["impacted"])), f"{len(chg['impacted'])} neighbouring unit(s) affected")
    if u.verification_status == "pending" and u.submitted_at:
        weeks = int((now - u.submitted_at).days // 7)
        if weeks >= 1:
            add(min(15, 5 * weeks), f"Waiting for review for {weeks} week(s)")
    score = min(100, sum(x["points"] for x in factors))
    level = next(l for t, l in LEVELS if score >= t)
    action = {"critical": "Review now", "high": "Review today", "medium": "Review this week", "low": "Routine"}[level]
    return {"level": level, "score": score, "factors": factors, "action": action,
            "method": "Tribhoomi review-priority heuristic: points are added per listed factor and capped at 100; ≥70 critical, ≥40 high, ≥20 medium, otherwise low. Not an official risk score."}


def completeness(u: Unit, audit_count: int) -> dict:
    b, p = u.floor.building, u.floor.building.parcel
    fields = [
        ("Tribhoomi Property ID", bool(u.tpid)), ("Project", bool(p.name)), ("Building", bool(b.name)), ("Floor", True),
        ("Unit number", bool(u.label.strip())), ("Geometry", (u.max_x - u.min_x) > 0 and (u.max_y - u.min_y) > 0), ("Area", u.area_sqm > 0),
        ("Verification record", u.verification_status == "verified" and bool(u.verification_id)),
        ("Version history", len(u.versions) > 0), ("Audit trail", audit_count > 0),
        ("Official land-record linkage", False),   # prototype IDs are ULPIN-format, not an official linkage
    ]
    have = [n for n, ok in fields if ok]; missing = [n for n, ok in fields if not ok]
    return {"available": len(have), "total": len(fields), "percent": round(len(have) / len(fields) * 100), "missing": missing,
            "note": "Official land-record linkage is not available in the demonstration dataset; the technical ID shown is ULPIN-format, not an official ULPIN."}


def trust_summary(u: Unit, comp: dict, chg: dict | None) -> dict:
    active_disputes = sum(1 for d in u.disputes if d.status != "resolved")
    overlaps = [n for n in _neighbours_of(u) if box_intersection_volume(_box(_vol(u)), _box(n["volume"])) > 0.01]
    mods = [cr for cr in u.change_requests]
    unapproved = any(x.approval_status == "unapproved" for x in u.versions)
    if overlaps or unapproved:
        overall, tone = "Potential conflict detected", "bad"
    elif active_disputes or u.verification_status != "verified" or any(cr.status == "pending" for cr in mods) or (chg and chg["new_conflicts"]):
        overall, tone = "Review recommended", "warn"
    else:
        overall, tone = "Currently consistent", "ok"
    return {
        "verification": {"label": {"verified": "Complete", "pending": "Pending", "conflict": "Blocked by conflict", "rejected": "Rejected", "draft": "Not submitted"}.get(u.verification_status, u.verification_status),
                         "ok": u.verification_status == "verified", "id": u.verification_id or None, "at": u.verified_at.isoformat() if u.verified_at else None},
        "geometry": {"label": "No active conflicts" if not overlaps else f"Potential conflict with {', '.join(n['label'] for n in overlaps)}", "ok": not overlaps},
        "history": {"label": f"{len(u.versions)} recorded version(s)", "count": len(u.versions)},
        "changes": {"label": f"{len(mods)} boundary modification(s)" + (f", {sum(1 for c in mods if c.status == 'pending')} pending" if any(c.status == 'pending' for c in mods) else ""),
                    "count": len(mods), "pending": sum(1 for c in mods if c.status == "pending"), "unapproved_versions": unapproved},
        "disputes": {"label": f"{active_disputes} active", "count": active_disputes, "ok": active_disputes == 0},
        "completeness": {"label": f"{comp['percent']}%", "percent": comp["percent"]},
        "overall": overall, "tone": tone,
        "note": "Tribhoomi property integrity status, computed from stored records. It is not a legal ownership verification.",
    }


def insight(u: Unit, chg: dict | None, prio: dict, timeline: list[dict]) -> str:
    """Plain-language explanation assembled from already-computed facts (no model, no guessing)."""
    parts = []
    mods = len(u.versions) - 1 if u.versions else 0
    pend = [cr for cr in u.change_requests if cr.status == "pending"]
    if mods > 0:
        parts.append(f"This property has been modified {mods} time{'s' if mods != 1 else ''} after initial registration.")
    elif not u.versions:
        parts.append("This property has not yet been verified, so no baseline version is locked.")
    else:
        parts.append("This property has not been modified since its baseline was recorded.")
    if chg:
        who = "The pending proposal" if chg["mode"] == "registered_vs_proposed" else "The latest modification"
        parts.append(f"{who} changes the recorded area by {chg['area_pct']:+.1f}% ({chg['area_before_sqft']:,} → {chg['area_after_sqft']:,} sq ft)"
                     + (f" and introduces an overlap with {', '.join(c['label'] for c in chg['new_conflicts'])}." if chg["new_conflicts"] else "."))
        if chg["edge_moves"]:
            parts.append(chg["edge_moves"][0]["text"] + ".")
    if pend:
        parts.append(f"{len(pend)} modification request{'s are' if len(pend) != 1 else ' is'} awaiting a decision.")
    crit = [e for e in timeline if e["risk"] in ("high", "critical")]
    if crit:
        parts.append(f"The record first needed attention on {crit[0]['at'][:10]} ({crit[0]['event'].lower()}).")
    parts.append(f"Review priority: {prio['level'].upper()} ({prio['action'].lower()}).")
    return " ".join(parts)


def simulate(u: Unit, proposed: Vol) -> dict:
    """What-if: evaluate a boundary without saving anything."""
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    v = validate_unit(building=b, floor=f, parcel=p, label=u.label, volume={"min": [proposed["min"][0], proposed["min"][1], u.min_z], "max": [proposed["max"][0], proposed["max"][1], u.max_z]},
                      area_sqm=None, exclude_unit_id=u.id)
    from ..geo import polygon_to_local
    g = geometry_change(_vol(u), proposed, neighbours=_neighbours_of(u), footprint=json.loads(b.local_footprint), parcel_local=polygon_to_local(p.geometry_json, p.centroid_lng, p.centroid_lat))
    before = review_priority(u)
    # priority if this scenario were the pending proposal: reuse the factor logic on a lightweight shadow
    extra = []
    if g["new_conflicts"]:
        extra.append({"points": 35, "reason": f"Scenario would overlap {g['new_conflicts'][0]['label']} by {g['new_conflicts'][0]['overlap_pct']}%"})
    if abs(g["area_pct"]) >= 10:
        extra.append({"points": 25, "reason": f"Scenario changes area by {g['area_pct']:+.1f}%"})
    elif abs(g["area_pct"]) >= 5:
        extra.append({"points": 15, "reason": f"Scenario changes area by {g['area_pct']:+.1f}%"})
    imp = impacted_neighbours(proposed, _neighbours_of(u))
    if imp:
        extra.append({"points": min(15, 5 * len(imp)), "reason": f"{len(imp)} neighbouring unit(s) affected"})
    score = min(100, before["score"] + sum(x["points"] for x in extra))
    level = next(l for t, l in LEVELS if score >= t)
    rec = "Review required before approval." if (g["new_conflicts"] or not v["valid"]) else ("Acceptable with routine review." if abs(g["area_pct"]) < 5 else "Unusual change; review recommended.")
    return {"simulation": True, "saved": False, "validation": v, "change": g, "impacted": imp,
            "priority_before": before, "priority_after": {"level": level, "score": score, "factors": before["factors"] + extra}, "recommendation": rec}


def dependency_graph(u: Unit) -> dict:
    b, f, p = u.floor.building, u.floor, u.floor.building.parcel
    nodes = [
        {"id": "parcel", "type": "Land parcel", "label": p.ulpin_2d, "href": f"/map"},
        {"id": "project", "type": "Project", "label": p.name, "href": f"/builder/projects/{p.id}"},
        {"id": "building", "type": "Building", "label": b.name, "href": f"/builder/buildings/{b.id}"},
        {"id": "floor", "type": "Floor", "label": ("Basement %d" % -f.floor_number) if f.floor_number < 0 else ("Ground floor" if f.floor_number == 0 else f"Floor {f.floor_number}"), "href": f"/builder/buildings/{b.id}"},
        {"id": "unit", "type": "Unit", "label": f"{u.label} · {u.tpid}", "href": f"/property/{u.tpid}"},
        {"id": "version", "type": "Property version", "label": f"v{len(u.versions)}" if u.versions else "no version yet", "href": f"/property/{u.tpid}"},
    ]
    conflicts = [{"tpid": n["tpid"], "label": n["label"], "href": f"/property/{n['tpid']}"} for n in _neighbours_of(u) if box_intersection_volume(_box(_vol(u)), _box(n["volume"])) > 0.01]
    return {"nodes": nodes, "conflicts": conflicts}
