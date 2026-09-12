"""
3D ULPIN engine — pure functions, no database, no framework.

Format (8 segments, hyphen separated):

    SS-DDD-VVVV-PPPPP-Bnn-Fnn-Unn-L
    |  |   |    |     |   |   |   +-- LayerType letter (S/A/G/R)
    |  |   |    |     |   |   +------ Unit   (U00 = whole level, U01..U99)
    |  |   |    |     |   +---------- Level  (F00 = whole building, F01 = ground floor, F02 = 1st floor ...
    |  |   |    |     |               L01 = basement 1, L02 = basement 2 ...)
    |  |   |    |     +-------------- Building (B00 = none/parcel level, B01..B99)
    |  |   |    +-------------------- Parcel number (5 digits)
    |  |   +------------------------- Village / Ward code (4 digits)
    |  +----------------------------- District code (3 digits)
    +-------------------------------- State code (2 digits, Census of India)

The first four segments are the existing 2D ULPIN. They are 14 digits when
compacted (2+3+4+5), the same length as the real ULPIN used by DILRMP, so any
3D ULPIN can be mapped back to its surface parcel by simple truncation.

Zero always means "the whole thing one level up": B00 = the parcel itself,
F00 = the whole building, U00 = the whole level. That keeps every ID in the
hierarchy unique and lets `parent_of` walk upwards by zeroing one segment.

Levels are counted like storeys (ground floor = level 1) so that F00 is free
to mean "whole building". `level_from_floor_number` converts from the usual
Indian labelling (ground = 0, first = 1, basement = -1).

Why so strict about fixed widths?  Fixed widths make the ID deterministic
(same input -> same string every time), sortable, and parseable with no lookup
table, which is exactly what a land registry needs.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import re


class UlpinError(ValueError):
    """Raised when an ID cannot be built or parsed."""


class LayerType(str, Enum):
    SURFACE = "S"       # the 2D parcel itself (ground surface)
    ABOVE_GROUND = "A"  # ordinary building floors (F00 and up)
    UNDERGROUND = "G"   # basements, utilities, metro (L01 and down)
    AIR_RIGHTS = "R"    # air-space corridor above a parcel (e.g. skywalk, flyover)

    @property
    def label(self) -> str:
        return {
            "S": "Surface parcel",
            "A": "Above-ground floor",
            "G": "Underground layer",
            "R": "Air-rights corridor",
        }[self.value]


@dataclass(frozen=True)
class ParcelKey:
    """The four parts that identify a surface parcel (the 2D ULPIN)."""

    state: int
    district: int
    village_ward: int
    parcel: int

    def __post_init__(self) -> None:
        _check_range("state", self.state, 1, 99)
        _check_range("district", self.district, 1, 999)
        _check_range("village_ward", self.village_ward, 1, 9999)
        _check_range("parcel", self.parcel, 1, 99999)


@dataclass(frozen=True)
class ParsedUlpin:
    key: ParcelKey
    building: int          # 0 = parcel level
    floor: int             # negative = below ground
    unit: int              # 0 = whole floor
    layer: LayerType

    @property
    def is_2d(self) -> bool:
        return self.building == 0 and self.floor == 0 and self.unit == 0 and self.layer == LayerType.SURFACE

    @property
    def ulpin_2d(self) -> str:
        return make_2d_ulpin(self.key)

    @property
    def ulpin_3d(self) -> str:
        return make_3d_ulpin(self.key, self.building, self.floor, self.unit, self.layer)


# --------------------------------------------------------------------------- #
# Building IDs
# --------------------------------------------------------------------------- #

def make_2d_ulpin(key: ParcelKey) -> str:
    return f"{key.state:02d}-{key.district:03d}-{key.village_ward:04d}-{key.parcel:05d}"


def level_from_floor_number(floor_number: int) -> int:
    """Ground floor (0) -> level 1, first floor (1) -> level 2, basement 1 (-1) -> level -1."""
    return floor_number + 1 if floor_number >= 0 else floor_number


def floor_number_from_level(level: int) -> int:
    return level - 1 if level > 0 else level


def _floor_code(floor: int) -> str:
    if floor >= 0:
        return f"F{floor:02d}"
    return f"L{-floor:02d}"


def infer_layer(building: int, floor: int, unit: int) -> LayerType:
    """Decide the layer letter from the numeric parts (used when caller does not pass one)."""
    if floor < 0:
        return LayerType.UNDERGROUND
    if building == 0 and floor == 0 and unit == 0:
        return LayerType.SURFACE
    return LayerType.ABOVE_GROUND


def make_3d_ulpin(
    key: ParcelKey,
    building: int = 0,
    floor: int = 0,
    unit: int = 0,
    layer: LayerType | None = None,
) -> str:
    """Build a full 3D ULPIN. Every call with the same inputs returns the same string."""
    _check_range("building", building, 0, 99)
    _check_range("floor", floor, -99, 99)
    _check_range("unit", unit, 0, 99)

    if layer is None:
        layer = infer_layer(building, floor, unit)
    layer = LayerType(layer)
    _check_layer_consistency(building, floor, unit, layer)

    return f"{make_2d_ulpin(key)}-B{building:02d}-{_floor_code(floor)}-U{unit:02d}-{layer.value}"


def _check_layer_consistency(building: int, floor: int, unit: int, layer: LayerType) -> None:
    """The layer letter must agree with the numbers; otherwise the ID would lie."""
    if layer == LayerType.SURFACE and not (building == 0 and floor == 0 and unit == 0):
        raise UlpinError("SURFACE layer is only valid for the parcel itself (B00-F00-U00)")
    if layer == LayerType.UNDERGROUND and floor >= 0:
        raise UlpinError("UNDERGROUND layer requires a below-ground floor (L01 or lower)")
    if layer == LayerType.ABOVE_GROUND and floor < 0:
        raise UlpinError("ABOVE_GROUND layer cannot have a below-ground floor")
    if layer == LayerType.ABOVE_GROUND and building == 0 and floor == 0 and unit == 0:
        raise UlpinError("B00-F00-U00 is the surface parcel; use layer S")
    if layer == LayerType.AIR_RIGHTS and floor < 0:
        raise UlpinError("AIR_RIGHTS layer must be above ground")


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #

_RE_2D = re.compile(r"^(\d{2})-(\d{3})-(\d{4})-(\d{5})$")
_RE_3D = re.compile(r"^(\d{2})-(\d{3})-(\d{4})-(\d{5})-B(\d{2})-([FL])(\d{2})-U(\d{2})-([SAGR])$")
_RE_COMPACT_2D = re.compile(r"^\d{14}$")


def parse_ulpin(text: str) -> ParsedUlpin:
    """Accepts a 2D ULPIN (hyphenated or 14 compact digits) or a full 3D ULPIN."""
    text = text.strip().upper()

    if _RE_COMPACT_2D.match(text):
        text = f"{text[0:2]}-{text[2:5]}-{text[5:9]}-{text[9:14]}"

    m = _RE_2D.match(text)
    if m:
        key = ParcelKey(*(int(g) for g in m.groups()))
        return ParsedUlpin(key, 0, 0, 0, LayerType.SURFACE)

    m = _RE_3D.match(text)
    if not m:
        raise UlpinError(f"Not a valid ULPIN: {text!r}")

    s, d, v, p, b, fl_sign, fl, u, layer = m.groups()
    key = ParcelKey(int(s), int(d), int(v), int(p))
    floor = int(fl) if fl_sign == "F" else -int(fl)
    if fl_sign == "L" and floor == 0:
        raise UlpinError("L00 is not a valid floor (below-ground floors start at L01)")
    parsed = ParsedUlpin(key, int(b), floor, int(u), LayerType(layer))
    _check_layer_consistency(parsed.building, parsed.floor, parsed.unit, parsed.layer)
    return parsed


def to_2d(text: str) -> str:
    """Truncate any ULPIN to the surface parcel's 2D ULPIN."""
    return parse_ulpin(text).ulpin_2d


def compact(text: str) -> str:
    """Digits-and-letters only form, useful for barcodes / QR codes."""
    return parse_ulpin(text).ulpin_3d.replace("-", "") if not parse_ulpin(text).is_2d else to_2d(text).replace("-", "")


def parent_of(text: str) -> str | None:
    """
    One step up the hierarchy:
      unit  -> floor      (U03 -> U00)
      floor -> building   (F05 -> F00)
      building -> parcel  (B01 -> B00, layer S)
      parcel -> None
    """
    p = parse_ulpin(text)
    if p.unit != 0:
        return make_3d_ulpin(p.key, p.building, p.floor, 0, p.layer)
    if p.floor != 0:
        # F00 = the whole building (or, for parcel-level layers, the parcel itself)
        return make_3d_ulpin(p.key, p.building, 0, 0, LayerType.ABOVE_GROUND if p.building else LayerType.SURFACE)
    if p.building != 0:
        return make_2d_ulpin(p.key)
    return None


# --------------------------------------------------------------------------- #
# Bulk generation for a whole building (used by the seed script and API)
# --------------------------------------------------------------------------- #

def generate_building_tree(
    key: ParcelKey,
    building: int,
    floors: dict[int, int],
) -> dict:
    """
    floors: {floor_number: units_on_that_floor} using everyday numbering
    (0 = ground, 1 = first, -1 = basement 1). Converted to levels internally.

    Returns a nested dict ready to be stored or sent as JSON:
    {
      "building_ulpin": "...-B01-F00-U00-A",
      "floors": [ {"floor": 1, "floor_ulpin": ..., "units": [{"unit": 1, "unit_ulpin": ...}, ...]}, ...]
    }
    """
    _check_range("building", building, 1, 99)
    out = {"building_ulpin": make_3d_ulpin(key, building, 0, 0), "floors": []}
    for floor_no in sorted(floors):
        units = floors[floor_no]
        _check_range("units", units, 0, 99)
        level = level_from_floor_number(floor_no)
        floor_entry = {
            "floor": floor_no,
            "level": level,
            "floor_ulpin": make_3d_ulpin(key, building, level, 0),
            "units": [
                {"unit": u, "unit_ulpin": make_3d_ulpin(key, building, level, u)}
                for u in range(1, units + 1)
            ],
        }
        out["floors"].append(floor_entry)
    return out


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def _check_range(name: str, value: int, lo: int, hi: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise UlpinError(f"{name} must be an integer, got {value!r}")
    if not lo <= value <= hi:
        raise UlpinError(f"{name} must be between {lo} and {hi}, got {value}")
