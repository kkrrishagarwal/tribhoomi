"""Unit tests for the analysis layer (pure functions on boxes)."""
from app.services.analysis import area_sqm, geometry_change, impacted_neighbours

B = {"min": [0, 0, 0], "max": [10, 12, 3]}          # 120 m²
N = [{"label": "3-D", "tpid": "TRB-X-F03-U04", "volume": {"min": [10.5, 0, 0], "max": [20, 12, 3]}},
     {"label": "3-B", "tpid": "TRB-X-F03-U02", "volume": {"min": [-12, 0, 0], "max": [-2, 12, 3]}}]


def test_area_and_percentage_difference():
    after = {"min": [0, 0, 0], "max": [10, 13.4, 3]}   # north edge +1.4 m -> 134 m²
    g = geometry_change(B, after)
    assert area_sqm(B) == 120.0 and g["area_after_sqm"] == 134.0
    assert g["area_diff_sqm"] == 14.0 and g["area_pct"] == 11.7
    assert g["area_diff_sqft"] == round(14.0 * 10.7639)


def test_boundary_displacement_and_direction():
    after = {"min": [0, 0, 0], "max": [10, 13.4, 3]}
    g = geometry_change(B, after)
    assert g["edge_moves"][0]["edge"] == "north" and g["edge_moves"][0]["metres"] == 1.4 and g["edge_moves"][0]["outward"]
    assert g["direction"] == "N" and g["centroid_shift_m"] == 0.7
    assert g["changed_region_sqm"] == 14.0


def test_new_overlap_detection_and_risk():
    after = {"min": [0, 0, 0], "max": [11.5, 12, 3]}   # east edge +1.5 m -> overlaps 3-D by 1 m x 12 m
    g = geometry_change(B, after, neighbours=N)
    assert [c["label"] for c in g["new_conflicts"]] == ["3-D"]
    assert g["new_conflicts"][0]["overlap_sqm"] == 12.0
    assert g["risk"] == "high" and "overlaps" in g["why_it_matters"]


def test_unchanged_geometry_is_low_risk():
    g = geometry_change(B, dict(B))
    assert g["area_pct"] == 0.0 and g["risk"] == "low" and g["edge_moves"] == [] and g["new_conflicts"] == []


def test_impacted_neighbours_overlap_and_adjacency():
    proposed = {"min": [0, 0, 0], "max": [11.5, 12, 3]}
    imp = impacted_neighbours(proposed, N)
    assert imp[0]["tpid"] == "TRB-X-F03-U04" and imp[0]["kind"] == "overlap" and imp[0]["overlap_sqm"] == 12.0
    near = impacted_neighbours({"min": [-1.6, 0, 0], "max": [10, 12, 3]}, N)   # 0.4 m from 3-B
    assert any(x["label"] == "3-B" and x["kind"] == "adjacent" and x["distance_m"] == 0.4 for x in near)


def test_containment_change_flags_leaving_building():
    fp = [[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]
    g = geometry_change(B, {"min": [0, 0, 0], "max": [35, 12, 3]}, footprint=fp)
    assert g["leaves_building"] and g["risk"] == "high"
