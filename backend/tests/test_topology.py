from app.topology import (
    box_intersection_volume,
    check_duplicates,
    check_outside_footprint,
    check_underground_clash,
    check_unit_overlaps,
)


def test_disjoint_boxes_have_zero_overlap():
    a = (0, 0, 0, 10, 10, 3)
    b = (10, 0, 0, 20, 10, 3)   # touching face, not overlapping
    assert box_intersection_volume(a, b) == 0.0


def test_overlapping_boxes_are_flagged():
    a = (0, 0, 0, 10, 10, 3)
    b = (8, 0, 0, 18, 10, 3)   # 2 m overlap in x
    assert box_intersection_volume(a, b) == 60.0
    conflicts = check_unit_overlaps([("A", a), ("B", b)])
    assert len(conflicts) == 1
    assert conflicts[0].kind == "UNIT_OVERLAP"
    assert {conflicts[0].ulpin_a, conflicts[0].ulpin_b} == {"A", "B"}


def test_units_on_different_floors_do_not_conflict():
    a = (0, 0, 0, 10, 10, 3)
    b = (0, 0, 3, 10, 10, 6)
    assert check_unit_overlaps([("A", a), ("B", b)]) == []


def test_metro_tunnel_clashes_with_deep_basement():
    basement = ("U", (0, 0, -6, 20, 20, -3))
    tunnel = ("T", [[-50, 5], [50, 5], [50, 12], [-50, 12]], -4.0, -12.0)   # top -4, bottom -12
    conflicts = check_underground_clash([basement], [tunnel])
    assert len(conflicts) == 1 and conflicts[0].kind == "UNDERGROUND_CLASH"
    shallow = ("U2", (0, 0, -3, 20, 20, 0))
    assert check_underground_clash([shallow], [tunnel]) == []


def test_outside_footprint_warning():
    fp = [[0, 0], [20, 0], [20, 20], [0, 20]]
    inside = ("I", (1, 1, 0, 10, 10, 3))
    outside = ("O", (15, 15, 0, 25, 25, 3))
    kinds = [c.kind for c in check_outside_footprint([inside, outside], fp)]
    assert kinds == ["OUTSIDE_FOOTPRINT"]


def test_duplicates():
    assert len(check_duplicates(["a", "b", "a"])) == 1
