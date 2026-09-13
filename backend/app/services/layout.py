"""
Create a parcel + building + floors + units from a polygon and a small spec.
Used by the seed script AND by the builder's draw/upload tool, so a drawn plot
gets exactly the same IDs and volumes as seeded data would.
"""
from __future__ import annotations

import json

from shapely.geometry import Polygon
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..geo import centroid, local_to_lnglat, polygon_area_sqm, polygon_to_local
from ..models import Building, Floor, Parcel, UndergroundLayer, Unit
from ..ulpin import LayerType, ParcelKey, level_from_floor_number, make_2d_ulpin, make_3d_ulpin

DEFAULT_SPEC = {"num_floors": 4, "num_basements": 0, "floor_height_m": 3.2, "units_per_floor": 2,
                "ground_floor_usage": "residential", "basement_usage": "parking", "footprint_inset_m": 3}


def next_parcel_no(db: Session, state: int, district: int, village_ward: int) -> int:
    cur = db.query(func.max(Parcel.parcel_no)).filter(
        Parcel.state_code == state, Parcel.district_code == district, Parcel.village_ward_code == village_ward
    ).scalar()
    return (cur or 0) + 1


def unit_label(fno: int, u: int, n: int) -> str:
    letter = "ABCDEFGH"[u - 1] if n > 1 else ""
    if fno < 0:
        return f"Basement {-fno}" + (f"-{letter}" if letter else "")
    if fno == 0:
        return f"Ground-{letter}" if letter else "Ground"
    return f"Floor {fno}-{letter}" if letter else f"Floor {fno}"


def strip_polygon(parcel_local: list[list[float]], strip: dict) -> list[list[float]]:
    """A long rectangle crossing the whole parcel, used for pipes / tunnels / corridors."""
    xs = [p[0] for p in parcel_local]
    ys = [p[1] for p in parcel_local]
    off, w = strip["offset_m"], strip["width_m"]
    pad = 20
    if strip["axis"] == "x":
        return [[min(xs) - pad, off - w / 2], [max(xs) + pad, off - w / 2], [max(xs) + pad, off + w / 2], [min(xs) - pad, off + w / 2], [min(xs) - pad, off - w / 2]]
    return [[off - w / 2, min(ys) - pad], [off + w / 2, min(ys) - pad], [off + w / 2, max(ys) + pad], [off - w / 2, max(ys) + pad], [off - w / 2, min(ys) - pad]]


def local_ring_to_geojson(ring: list[list[float]], lng0: float, lat0: float) -> dict:
    coords = [list(local_to_lnglat(x, y, lng0, lat0)) for x, y in ring]
    return {"type": "Polygon", "coordinates": [coords]}


def create_building(db: Session, parcel: Parcel, key: ParcelKey, spec: dict, building_no: int | None = None) -> Building:
    """Add a building (with floors, and optionally auto-generated units) to an existing parcel/project."""
    spec = {**DEFAULT_SPEC, **(spec or {})}
    lat0, lng0 = parcel.centroid_lat, parcel.centroid_lng
    parcel_local = polygon_to_local(parcel.geometry_json, lng0, lat0)
    if building_no is None:
        building_no = (max((b.building_no for b in parcel.buildings), default=0) + 1)
    inset = float(spec.get("footprint_inset_m", 3))
    fp_poly: Polygon = Polygon(parcel_local).buffer(-inset, join_style=2)
    if fp_poly.is_empty or fp_poly.geom_type != "Polygon":
        fp_poly = Polygon(parcel_local).buffer(-0.5, join_style=2)
    if fp_poly.is_empty or fp_poly.geom_type != "Polygon":
        fp_poly = Polygon(parcel_local)
    # second and later buildings on the same parcel: shrink further so they do not sit on top of building 1
    if building_no > 1:
        fp_poly = fp_poly.buffer(-2.0 * (building_no - 1), join_style=2) if fp_poly.buffer(-2.0 * (building_no - 1)).area > 50 else fp_poly
    fp_ring = [[round(x, 2), round(y, 2)] for x, y in fp_poly.exterior.coords]
    minx, miny, maxx, maxy = fp_poly.bounds
    bld = Building(
        parcel_id=parcel.id, building_no=building_no, building_ulpin=make_3d_ulpin(key, building_no, 0, 0),
        name=spec.get("name") or parcel.name, num_floors=int(spec["num_floors"]), num_basements=int(spec.get("num_basements", 0)),
        floor_height_m=float(spec.get("floor_height_m", 3.2)),
        footprint=json.dumps(local_ring_to_geojson(fp_ring, lng0, lat0)), local_footprint=json.dumps(fp_ring),
    )
    db.add(bld)
    db.flush()
    h, basement_h = bld.floor_height_m, 3.0
    units_per_floor = int(spec.get("units_per_floor", 0))
    overlap = spec.get("deliberate_overlap")
    for fno in list(range(-bld.num_basements, 0)) + list(range(0, bld.num_floors)):
        if fno < 0:
            base, height, usage = fno * basement_h, basement_h, spec.get("basement_usage", "parking")
        else:
            base, height = fno * h, h
            usage = spec.get("all_floors_usage") or (spec.get("ground_floor_usage", "residential") if fno == 0 else "residential")
        level = level_from_floor_number(fno)   # ground floor 0 -> level 1, so F00 stays "whole building"
        floor = Floor(building_id=bld.id, floor_number=fno, floor_ulpin=make_3d_ulpin(key, building_no, level, 0),
                      height_m=height, base_elevation_m=round(base, 2),
                      layer_type=(LayerType.UNDERGROUND if fno < 0 else LayerType.ABOVE_GROUND).value)
        db.add(floor)
        db.flush()
        n = (1 if units_per_floor else 0) if fno < 0 and usage in ("parking", "utility") else units_per_floor
        col_w = (maxx - minx) / n if n else 0
        for u in range(1, n + 1):
            ux0, ux1 = minx + (u - 1) * col_w, minx + u * col_w
            if overlap and fno == overlap["floor"] and u == overlap["unit"]:
                ux0 += overlap["shift_m"]  # the deliberate survey error
            db.add(Unit(
                floor_id=floor.id, unit_no=u, unit_ulpin=make_3d_ulpin(key, building_no, level, u),
                label=unit_label(fno, u, n), area_sqm=round((ux1 - ux0) * (maxy - miny), 1), usage_type=usage,
                unit_type=("Shop" if usage == "commercial" else "Parking" if usage == "parking" else "Utility" if usage == "utility" else "3 BHK"),
                verification_status="draft", created_by=parcel.builder,
                min_x=round(ux0, 2), min_y=round(miny, 2), min_z=round(base, 2),
                max_x=round(ux1, 2), max_y=round(maxy, 2), max_z=round(base + height, 2),
            ))
    db.flush()
    db.refresh(parcel)
    return bld


def create_layout(
    db: Session,
    *,
    geometry: dict,
    key: ParcelKey,
    name: str,
    state: str, district: str, village_ward: str,
    builder: str,
    land_use: str = "mixed",
    building: dict | None = None,
    underground_layers: list[dict] | None = None,
    air_rights: list[dict] | None = None,
) -> Parcel:
    spec = {**DEFAULT_SPEC, **(building or {})}
    lat0, lng0 = centroid(geometry)
    parcel_local = polygon_to_local(geometry, lng0, lat0)

    parcel = Parcel(
        ulpin_2d=make_2d_ulpin(key), name=name,
        state=state, district=district, village_ward=village_ward,
        state_code=key.state, district_code=key.district, village_ward_code=key.village_ward, parcel_no=key.parcel,
        land_use=land_use, builder=builder, area_sqm=polygon_area_sqm(geometry),
        geometry=json.dumps(geometry), centroid_lat=lat0, centroid_lng=lng0,
    )
    db.add(parcel)
    db.flush()

    create_building(db, parcel, key, spec, building_no=1)

    # ---- parcel-level layers (B00) ------------------------------------------
    layer_no = 0
    for lyr in underground_layers or []:
        layer_no += 1
        ring = strip_polygon(parcel_local, lyr["strip"])
        db.add(UndergroundLayer(
            parcel_id=parcel.id, layer_no=layer_no, layer_ulpin=make_3d_ulpin(key, 0, -1, layer_no, LayerType.UNDERGROUND),
            layer_type=lyr["layer_type"], name=lyr["name"], top_m=lyr["top_m"], bottom_m=lyr["bottom_m"],
            geometry=json.dumps(local_ring_to_geojson(ring, lng0, lat0)), local_footprint=json.dumps(ring),
            operator=lyr.get("operator", ""),
        ))
    for lyr in air_rights or []:
        layer_no += 1
        ring = strip_polygon(parcel_local, lyr["strip"])
        db.add(UndergroundLayer(
            parcel_id=parcel.id, layer_no=layer_no, layer_ulpin=make_3d_ulpin(key, 0, 1, layer_no, LayerType.AIR_RIGHTS),
            layer_type="air_rights", name=lyr["name"], top_m=lyr["top_m"], bottom_m=lyr["bottom_m"],
            geometry=json.dumps(local_ring_to_geojson(ring, lng0, lat0)), local_footprint=json.dumps(ring),
            operator=lyr.get("operator", ""),
        ))
    db.flush()
    return parcel
