"""
Plain-language validation of a proposed unit, built on the existing topology checks.
Returns a checklist a builder can read, plus a 0-100 score. Technical details stay in
`technical` for the Advanced view.
"""
from __future__ import annotations

from shapely.geometry import Polygon

from ..models import Building, Floor, Parcel, Unit
from ..topology import box_intersection_volume

Box = tuple[float, float, float, float, float, float]


def _rect(b: Box) -> Polygon:
    return Polygon([(b[0], b[1]), (b[3], b[1]), (b[3], b[4]), (b[0], b[4])])


def validate_unit(*, building: Building, floor: Floor, parcel: Parcel, label: str, volume: dict,
                  area_sqm: float | None, exclude_unit_id: int | None = None) -> dict:
    checks: list[dict] = []
    conflicts: list[dict] = []
    technical: list[str] = []
    score = 100

    def ok(key: str, text: str):
        checks.append({"key": key, "ok": True, "text": text})

    def bad(key: str, text: str, why: str, penalty: int, severity: str = "error"):
        nonlocal score
        checks.append({"key": key, "ok": False, "text": text, "why": why, "severity": severity})
        score -= penalty

    # ---- geometry
    try:
        box: Box = (float(volume["min"][0]), float(volume["min"][1]), float(volume["min"][2]),
                    float(volume["max"][0]), float(volume["max"][1]), float(volume["max"][2]))
    except Exception:
        return {"valid": False, "score": 0, "checks": [{"key": "geometry", "ok": False, "text": "The property boundary is incomplete or incorrectly drawn.",
                "why": "No boundary was received.", "severity": "error"}], "conflicts": [], "technical": ["volume missing"]}
    w, d = box[3] - box[0], box[4] - box[1]
    if w <= 0.5 or d <= 0.5:
        bad("geometry", "The property boundary is incomplete or incorrectly drawn.",
            "A unit must be at least 0.5 m wide and deep.", 60)
    else:
        ok("geometry", "Boundary is a valid closed shape")
    drawn_area = round(max(w, 0) * max(d, 0), 1)
    technical.append(f"box {box}")

    # ---- unit info
    if not label.strip():
        bad("identity", "Unit number is missing.", "Every unit needs a number such as 8-C.", 20)
    elif any(u.label.strip().lower() == label.strip().lower() and u.id != exclude_unit_id for u in floor.units):
        bad("identity", f"Unit number {label} already exists on this floor.", "Two units cannot share one number.", 25)
    else:
        ok("identity", "Unit number is unique on this floor")

    if area_sqm is not None:
        if area_sqm <= 10:
            bad("area", "Declared area is too small to be a property unit.", "Areas under 10 m² are not accepted.", 15, "warning")
        elif drawn_area and abs(area_sqm - drawn_area) / max(area_sqm, 1) > 0.15:
            bad("area", f"Declared area ({area_sqm:.0f} m²) differs from the drawn boundary ({drawn_area:.0f} m²) by more than 15%.",
                "The declared area and the drawn boundary should match.", 10, "warning")
        else:
            ok("area", "Declared area matches the drawn boundary")

    # ---- spatial
    fp = Polygon([tuple(pt) for pt in __import__("json").loads(building.local_footprint)])
    upoly = _rect(box)
    outside = upoly.difference(fp.buffer(0.05)).area if upoly.is_valid else 0
    if outside > 0.5:
        bad("footprint", "Part of this unit extends outside the registered building area.",
            f"About {outside:.1f} m² lies beyond the building footprint.", 20)
    else:
        ok("footprint", "Within the building boundary")

    from ..geo import polygon_to_local
    ppoly = Polygon(polygon_to_local(parcel.geometry_json, parcel.centroid_lng, parcel.centroid_lat))
    if upoly.difference(ppoly.buffer(0.05)).area > 0.5:
        bad("parcel", "Part of this unit extends outside the land parcel.", "Units must sit inside the project's land.", 20)
    else:
        ok("parcel", "Within the land parcel")

    worst = 0.0
    for u in floor.units:
        if u.id == exclude_unit_id:
            continue
        v = box_intersection_volume(box, u.volume)
        if v > 0.01:
            inter = _rect(box).intersection(_rect(u.volume)).area
            worst = max(worst, inter)
            conflicts.append({"with_unit": u.label, "with_tpid": u.tpid, "with_ulpin": u.unit_ulpin,
                              "overlap_sqm": round(inter, 1), "with_volume": {"min": list(u.volume[:3]), "max": list(u.volume[3:])}})
    if conflicts:
        names = ", ".join(c["with_unit"] for c in conflicts)
        bad("overlap", f"Two property boundaries overlap: this unit shares about {worst:.1f} m² with {names}.",
            "Two property units cannot occupy the same registered space.", 30)
    else:
        ok("overlap", "No overlap with neighbouring units")

    ok("structure", f"Belongs to {building.name}, floor {floor.floor_number if floor.floor_number >= 0 else f'basement {-floor.floor_number}'}")
    score = max(0, min(100, score))
    return {"valid": all(c["ok"] or c.get("severity") == "warning" for c in checks), "score": score,
            "checks": checks, "conflicts": conflicts, "drawn_area_sqm": drawn_area, "technical": technical}


def integrity_score(u: Unit) -> dict:
    """Tribhoomi Integrity Score (not an official score): five simple components."""
    from .integrity import unit_flags
    f = unit_flags(u)
    floor, b, p = u.floor, u.floor.building, u.floor.building.parcel
    v = validate_unit(building=b, floor=floor, parcel=p, label=u.label, volume={"min": list(u.volume[:3]), "max": list(u.volume[3:])},
                      area_sqm=None, exclude_unit_id=u.id)
    boundary = 100 - (40 if any(c["key"] == "overlap" and not c["ok"] for c in v["checks"]) else 0) \
               - (20 if any(c["key"] in ("footprint", "parcel") and not c["ok"] for c in v["checks"]) else 0)
    identity = 100 if all(c["ok"] for c in v["checks"] if c["key"] == "identity") else 60
    consistency = 100 - (50 if f["has_unapproved_change"] else 0) - (20 if f["has_open_dispute"] else 0)
    history = 100 - (10 * max(0, f["version_count"] - 1)) - (15 if f["has_pending_request"] else 0)
    verification = {"verified": 100, "pending": 60, "conflict": 30, "rejected": 20}.get(u.verification_status, 40)
    parts = {"Boundary integrity": max(0, boundary), "Unit identity": identity, "Record consistency": max(0, consistency),
             "Modification history": max(0, history), "Verification status": verification}
    total = round(sum(parts.values()) / len(parts))
    return {"score": total, "parts": parts}
