"""The lock rule, end to end, on an in-memory database."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.services import integrity as svc
from app.services.layout import create_layout
from app.ulpin import ParcelKey

SQUARE = {"type": "Polygon", "coordinates": [[[77.2170, 28.6308], [77.2176, 28.6308], [77.2176, 28.6303], [77.2170, 28.6303], [77.2170, 28.6308]]]}


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as s:
        yield s


@pytest.fixture
def unit(db):
    p = create_layout(db, geometry=SQUARE, key=ParcelKey(7, 91, 12, 1), name="T", state="Delhi", district="ND",
                      village_ward="CP", builder="Acme Builders", building={"num_floors": 2, "units_per_floor": 2})
    return p.buildings[0].floors[0].units[0]


def test_unsold_unit_is_directly_editable(db, unit):
    assert not unit.is_locked and unit.versions == []
    svc.direct_edit(db, unit, "Acme Builders", "Shop 1", svc.shifted_volume(unit, dx=1))
    assert unit.label == "Shop 1" and unit.versions == []          # no history until it is sold


def test_assignment_locks_and_snapshots_baseline(db, unit):
    svc.assign_unit(db, unit, "Asha", "asha@example.in", "freehold", builder="Acme Builders")
    assert unit.is_locked
    assert [v.version_number for v in unit.versions] == [1]
    assert unit.versions[0].approval_status == "baseline"
    with pytest.raises(svc.IntegrityError) as e:
        svc.direct_edit(db, unit, "Acme Builders", "Shop 9", None)
    assert e.value.status == 423
    with pytest.raises(svc.IntegrityError):                          # cannot be sold twice
        svc.assign_unit(db, unit, "Bala", "bala@example.in", "freehold", builder="Acme Builders")


def test_change_needs_owner_approval(db, unit):
    svc.assign_unit(db, unit, "Asha", "asha@example.in", "freehold", builder="Acme Builders")
    cr = svc.create_change_request(db, unit, "Acme Builders", svc.shifted_volume(unit, dw=1), "Shop 1A", "as-built survey")
    assert cr.status == "pending" and len(unit.versions) == 1        # nothing changed yet
    with pytest.raises(svc.IntegrityError):                          # a stranger cannot decide
        svc.decide_change_request(db, cr, "approve", "someone@else.in")
    svc.decide_change_request(db, cr, "approve", "asha@example.in")
    assert cr.status == "approved"
    assert unit.label == "Shop 1A"
    assert [v.approval_status for v in unit.versions] == ["baseline", "approved"]
    assert unit.versions[0].plot_number != unit.versions[1].plot_number   # v1 is preserved untouched


def test_rejection_leaves_record_unchanged(db, unit):
    svc.assign_unit(db, unit, "Asha", "asha@example.in", "freehold", builder="Acme Builders")
    before = svc.unit_volume(unit)
    cr = svc.create_change_request(db, unit, "Acme Builders", svc.shifted_volume(unit, dx=2), "X", "reason here")
    svc.decide_change_request(db, cr, "reject", "asha@example.in", "no")
    assert cr.status == "rejected" and svc.unit_volume(unit) == before and len(unit.versions) == 1


def test_dispute_links_to_current_version_and_flags(db, unit):
    svc.assign_unit(db, unit, "Asha", "asha@example.in", "freehold", builder="Acme Builders")
    # simulate a silent edit recorded without approval
    unit.label = "Shop 7"
    svc.append_version(db, unit, "Acme Builders", "silent", approval_status="unapproved")
    d = svc.raise_dispute(db, unit, "asha@example.in", "my shop number changed")
    assert d.plot_version_id == unit.versions[-1].id
    flags = svc.unit_flags(unit)
    assert flags["has_unapproved_change"] and flags["has_open_dispute"] and flags["version_count"] == 2
