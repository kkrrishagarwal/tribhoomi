"""
Small geometry helpers. We keep coordinates in WGS84 (lon/lat) in the database
and convert to local metres (x east, y north) around the parcel centroid for
the 3D viewer and the overlap checks. For parcels a few hundred metres across,
this flat-earth approximation is accurate to centimetres.
"""
import math

from shapely.geometry import Polygon, shape

EARTH_M_PER_DEG_LAT = 111_320.0


def m_per_deg_lng(lat: float) -> float:
    return EARTH_M_PER_DEG_LAT * math.cos(math.radians(lat))


def lnglat_to_local(lng: float, lat: float, origin_lng: float, origin_lat: float) -> tuple[float, float]:
    x = (lng - origin_lng) * m_per_deg_lng(origin_lat)
    y = (lat - origin_lat) * EARTH_M_PER_DEG_LAT
    return round(x, 3), round(y, 3)


def local_to_lnglat(x: float, y: float, origin_lng: float, origin_lat: float) -> tuple[float, float]:
    lng = origin_lng + x / m_per_deg_lng(origin_lat)
    lat = origin_lat + y / EARTH_M_PER_DEG_LAT
    return lng, lat


def polygon_to_local(geojson_polygon: dict, origin_lng: float, origin_lat: float) -> list[list[float]]:
    ring = geojson_polygon["coordinates"][0]
    return [list(lnglat_to_local(lng, lat, origin_lng, origin_lat)) for lng, lat in ring]


def polygon_area_sqm(geojson_polygon: dict) -> float:
    poly: Polygon = shape(geojson_polygon)
    c = poly.centroid
    local = Polygon(polygon_to_local(geojson_polygon, c.x, c.y))
    return round(local.area, 2)


def centroid(geojson_polygon: dict) -> tuple[float, float]:
    c = shape(geojson_polygon).centroid
    return c.y, c.x  # lat, lng
