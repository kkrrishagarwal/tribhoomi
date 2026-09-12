import pytest

from app.ulpin import (
    LayerType,
    ParcelKey,
    UlpinError,
    compact,
    floor_number_from_level,
    level_from_floor_number,
    generate_building_tree,
    make_2d_ulpin,
    make_3d_ulpin,
    parent_of,
    parse_ulpin,
    to_2d,
)

KEY = ParcelKey(state=7, district=91, village_ward=12, parcel=45)


def test_2d_format_is_14_digits_when_compacted():
    assert make_2d_ulpin(KEY) == "07-091-0012-00045"
    assert compact("07-091-0012-00045") == "07091001200045"
    assert len(compact("07-091-0012-00045")) == 14


def test_3d_unit_id_is_deterministic():
    a = make_3d_ulpin(KEY, building=1, floor=5, unit=3)
    b = make_3d_ulpin(KEY, building=1, floor=5, unit=3)
    assert a == b == "07-091-0012-00045-B01-F05-U03-A"


def test_layer_is_inferred_correctly():
    assert make_3d_ulpin(KEY).endswith("-B00-F00-U00-S")           # parcel itself
    assert make_3d_ulpin(KEY, 1, 0, 0).endswith("-B01-F00-U00-A")  # whole building
    assert make_3d_ulpin(KEY, 1, 1, 0).endswith("-B01-F01-U00-A")  # ground floor (level 1)
    assert make_3d_ulpin(KEY, 1, -2, 1).endswith("-B01-L02-U01-G")  # basement 2
    assert make_3d_ulpin(KEY, 0, 3, 1, LayerType.AIR_RIGHTS).endswith("-B00-F03-U01-R")


def test_truncation_recovers_2d_ulpin():
    unit = make_3d_ulpin(KEY, 2, 11, 4)
    assert to_2d(unit) == make_2d_ulpin(KEY)
    assert to_2d("07091001200045") == "07-091-0012-00045"  # compact input also accepted


def test_parse_roundtrip():
    text = "07-091-0012-00045-B01-L01-U02-G"
    p = parse_ulpin(text)
    assert p.key == KEY
    assert (p.building, p.floor, p.unit, p.layer) == (1, -1, 2, LayerType.UNDERGROUND)
    assert p.ulpin_3d == text


def test_parent_chain_walks_up_to_parcel():
    unit = make_3d_ulpin(KEY, 1, 5, 3)
    floor = parent_of(unit)
    building = parent_of(floor)
    parcel = parent_of(building)
    assert floor == "07-091-0012-00045-B01-F05-U00-A"
    assert building == "07-091-0012-00045-B01-F00-U00-A"
    assert parcel == "07-091-0012-00045"
    assert parent_of(parcel) is None


def test_generate_building_tree_counts():
    tree = generate_building_tree(KEY, 1, {-1: 2, 0: 3, 1: 3, 2: 3})
    assert tree["building_ulpin"] == "07-091-0012-00045-B01-F00-U00-A"
    assert [f["floor"] for f in tree["floors"]] == [-1, 0, 1, 2]
    assert [f["level"] for f in tree["floors"]] == [-1, 1, 2, 3]
    all_ids = [tree["building_ulpin"]] + [f["floor_ulpin"] for f in tree["floors"]] \
        + [u["unit_ulpin"] for f in tree["floors"] for u in f["units"]]
    assert len(all_ids) == 1 + 4 + 11
    assert len(set(all_ids)) == len(all_ids)    # every ID in the building is unique
    assert tree["floors"][0]["units"][0]["unit_ulpin"].endswith("-B01-L01-U01-G")
    assert tree["floors"][1]["floor_ulpin"].endswith("-B01-F01-U00-A")   # ground floor is level 1


def test_level_conversion_roundtrip():
    for fno in (-3, -1, 0, 1, 12):
        assert floor_number_from_level(level_from_floor_number(fno)) == fno
    assert level_from_floor_number(0) == 1


@pytest.mark.parametrize(
    "bad",
    [
        "07-091-0012-00045-B01-F05-U03-X",   # unknown layer
        "07-091-0012-00045-B01-L00-U03-G",   # L00 not allowed
        "07-091-0012-00045-B01-F05-U03-G",   # above-ground floor tagged underground
        "07-091-0012-00045-B00-F00-U00-A",   # parcel itself must be S
        "7-91-12-45",                         # wrong widths
        "hello",
    ],
)
def test_invalid_ids_are_rejected(bad):
    with pytest.raises(UlpinError):
        parse_ulpin(bad)


def test_out_of_range_numbers_are_rejected():
    with pytest.raises(UlpinError):
        ParcelKey(state=0, district=1, village_ward=1, parcel=1)
    with pytest.raises(UlpinError):
        make_3d_ulpin(KEY, building=100)
    with pytest.raises(UlpinError):
        make_3d_ulpin(KEY, 1, 5, 3, LayerType.SURFACE)  # surface layer on a unit
