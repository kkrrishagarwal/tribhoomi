"""
Topology validator. Pure Python, works on plain numbers so it is easy to test.

A "volume" is an axis-aligned box (min_x, min_y, min_z, max_x, max_y, max_z)
in building-local metres. Two property volumes must never share space: if
they do, two owners are claiming the same cubic metres, which is exactly the
kind of dispute a 3D cadastre exists to prevent.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

from shapely.geometry import Polygon

Box = tuple[float, float, float, float, float, float]


@dataclass
class Conflict:
    kind: str            # UNIT_OVERLAP | UNDERGROUND_CLASH | OUTSIDE_FOOTPRINT | DUPLICATE_ULPIN
    severity: str        # error | warning
    ulpin_a: str
    ulpin_b: str | None
    reason: str
    overlap_volume_m3: float = 0.0
    parcel_id: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def box_intersection_volume(a: Box, b: Box) -> float:
    dx = min(a[3], b[3]) - max(a[0], b[0])
    dy = min(a[4], b[4]) - max(a[1], b[1])
    dz = min(a[5], b[5]) - max(a[2], b[2])
    if dx <= 0 or dy <= 0 or dz <= 0:
        return 0.0
    return round(dx * dy * dz, 3)


def check_unit_overlaps(units: list[tuple[str, Box]], tolerance_m3: float = 0.01) -> list[Conflict]:
    """units: [(ulpin, box)] all from the same building."""
    conflicts: list[Conflict] = []
    for i in range(len(units)):
        for j in range(i + 1, len(units)):
            ua, ba = units[i]
            ub, bb = units[j]
            v = box_intersection_volume(ba, bb)
            if v > tolerance_m3:
                dx = min(ba[3], bb[3]) - max(ba[0], bb[0])
                dy = min(ba[4], bb[4]) - max(ba[1], bb[1])
                conflicts.append(
                    Conflict(
                        kind="UNIT_OVERLAP",
                        severity="error",
                        ulpin_a=ua,
                        ulpin_b=ub,
                        reason=f"Unit volumes intersect: {dx:.1f} m x {dy:.1f} m shared floor area ({v:.1f} m3). "
                               f"Two titles claim the same space.",
                        overlap_volume_m3=v,
                    )
                )
    return conflicts


def check_underground_clash(
    basement_units: list[tuple[str, Box]],
    layers: list[tuple[str, list[list[float]], float, float]],
) -> list[Conflict]:
    """
    basement_units: units whose max_z <= 0
    layers: [(layer_ulpin, local_polygon, top_m, bottom_m)] e.g. a metro tunnel
    A clash = footprints intersect AND depth ranges overlap.
    """
    conflicts: list[Conflict] = []
    for l_ulpin, ring, top, bottom in layers:
        lpoly = Polygon(ring)
        for u_ulpin, b in basement_units:
            upoly = Polygon([(b[0], b[1]), (b[3], b[1]), (b[3], b[4]), (b[0], b[4])])
            dz = min(b[5], top) - max(b[2], bottom)
            if dz <= 0:
                continue
            inter = lpoly.intersection(upoly)
            if inter.is_empty or inter.area < 0.5:
                continue
            conflicts.append(
                Conflict(
                    kind="UNDERGROUND_CLASH",
                    severity="error",
                    ulpin_a=u_ulpin,
                    ulpin_b=l_ulpin,
                    reason=f"Basement unit intrudes into an underground layer: {inter.area:.1f} m2 footprint "
                           f"overlap across {dz:.1f} m of depth ({inter.area * dz:.1f} m3).",
                    overlap_volume_m3=round(inter.area * dz, 3),
                )
            )
    return conflicts


def check_outside_footprint(units: list[tuple[str, Box]], footprint_ring: list[list[float]]) -> list[Conflict]:
    """A unit sticking out beyond its building footprint means it encroaches the neighbour or the road."""
    fp = Polygon(footprint_ring)
    conflicts: list[Conflict] = []
    for ulpin, b in units:
        upoly = Polygon([(b[0], b[1]), (b[3], b[1]), (b[3], b[4]), (b[0], b[4])])
        outside = upoly.difference(fp.buffer(0.05)).area
        if outside > 0.5:
            conflicts.append(
                Conflict(
                    kind="OUTSIDE_FOOTPRINT",
                    severity="warning",
                    ulpin_a=ulpin,
                    ulpin_b=None,
                    reason=f"{outside:.1f} m2 of the unit lies outside the building footprint.",
                )
            )
    return conflicts


def check_duplicates(ulpins: list[str]) -> list[Conflict]:
    seen: set[str] = set()
    out: list[Conflict] = []
    for u in ulpins:
        if u in seen:
            out.append(Conflict("DUPLICATE_ULPIN", "error", u, None, "Same 3D ULPIN issued twice."))
        seen.add(u)
    return out
