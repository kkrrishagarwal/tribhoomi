"""
ORM tables. Geometry is stored as GeoJSON text so the same code runs on SQLite
(demo) and Postgres. `schema_postgis.sql` shows the equivalent PostGIS DDL with
real geometry columns for a production deployment.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id: Mapped[int] = mapped_column(primary_key=True)
    ulpin_2d: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(60))
    district: Mapped[str] = mapped_column(String(60))
    village_ward: Mapped[str] = mapped_column(String(80))
    state_code: Mapped[int] = mapped_column(Integer)
    district_code: Mapped[int] = mapped_column(Integer)
    village_ward_code: Mapped[int] = mapped_column(Integer)
    parcel_no: Mapped[int] = mapped_column(Integer)
    land_use: Mapped[str] = mapped_column(String(40), default="mixed")
    builder: Mapped[str] = mapped_column(String(120), default="")   # the developer who registered the layout
    area_sqm: Mapped[float] = mapped_column(Float, default=0)
    geometry: Mapped[str] = mapped_column(Text)  # GeoJSON Polygon (WGS84 lon/lat)
    centroid_lat: Mapped[float] = mapped_column(Float)
    centroid_lng: Mapped[float] = mapped_column(Float)

    buildings: Mapped[list[Building]] = relationship(back_populates="parcel", cascade="all, delete-orphan")
    underground_layers: Mapped[list[UndergroundLayer]] = relationship(back_populates="parcel", cascade="all, delete-orphan")

    @property
    def geometry_json(self) -> dict:
        return json.loads(self.geometry)


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    parcel_id: Mapped[int] = mapped_column(ForeignKey("parcels.id"), index=True)
    building_no: Mapped[int] = mapped_column(Integer)
    building_ulpin: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    num_floors: Mapped[int] = mapped_column(Integer)      # above ground incl. ground floor
    num_basements: Mapped[int] = mapped_column(Integer, default=0)
    floor_height_m: Mapped[float] = mapped_column(Float, default=3.2)
    footprint: Mapped[str] = mapped_column(Text)          # GeoJSON Polygon
    # footprint in building-local metres (x east, y north) relative to parcel centroid
    local_footprint: Mapped[str] = mapped_column(Text)    # JSON [[x,y],...]

    parcel: Mapped[Parcel] = relationship(back_populates="buildings")
    floors: Mapped[list[Floor]] = relationship(back_populates="building", cascade="all, delete-orphan",
                                               order_by="Floor.floor_number")

    __table_args__ = (UniqueConstraint("parcel_id", "building_no"),)


class Floor(Base):
    __tablename__ = "floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"), index=True)
    floor_number: Mapped[int] = mapped_column(Integer)   # negative for basements
    floor_ulpin: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    height_m: Mapped[float] = mapped_column(Float)
    base_elevation_m: Mapped[float] = mapped_column(Float)  # 0 = ground level
    layer_type: Mapped[str] = mapped_column(String(1))

    building: Mapped[Building] = relationship(back_populates="floors")
    units: Mapped[list[Unit]] = relationship(back_populates="floor", cascade="all, delete-orphan",
                                             order_by="Unit.unit_no")

    __table_args__ = (UniqueConstraint("building_id", "floor_number"),)


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id"), index=True)
    unit_no: Mapped[int] = mapped_column(Integer)
    unit_ulpin: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(40))       # e.g. "Flat 7-B"
    area_sqm: Mapped[float] = mapped_column(Float)
    usage_type: Mapped[str] = mapped_column(String(20))  # residential | commercial | utility | parking
    # bounding volume in building-local metres; z is absolute elevation (0 = ground)
    min_x: Mapped[float] = mapped_column(Float)
    min_y: Mapped[float] = mapped_column(Float)
    min_z: Mapped[float] = mapped_column(Float)
    max_x: Mapped[float] = mapped_column(Float)
    max_y: Mapped[float] = mapped_column(Float)
    max_z: Mapped[float] = mapped_column(Float)

    floor: Mapped[Floor] = relationship(back_populates="units")
    ownerships: Mapped[list[Ownership]] = relationship(back_populates="unit", cascade="all, delete-orphan")
    versions: Mapped[list[PlotVersion]] = relationship(back_populates="unit", cascade="all, delete-orphan",
                                                       order_by="PlotVersion.version_number")
    change_requests: Mapped[list[ChangeRequest]] = relationship(back_populates="unit", cascade="all, delete-orphan")
    disputes: Mapped[list[Dispute]] = relationship(back_populates="unit", cascade="all, delete-orphan")

    @property
    def is_locked(self) -> bool:
        """Registration locks the baseline: once anyone owns the unit, the builder cannot edit it directly."""
        return len(self.ownerships) > 0

    __table_args__ = (UniqueConstraint("floor_id", "unit_no"),)

    @property
    def volume(self) -> tuple[float, float, float, float, float, float]:
        return (self.min_x, self.min_y, self.min_z, self.max_x, self.max_y, self.max_z)


class Ownership(Base):
    __tablename__ = "ownership"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    owner_name: Mapped[str] = mapped_column(String(120))
    owner_email: Mapped[str] = mapped_column(String(120), default="", index=True)
    ownership_type: Mapped[str] = mapped_column(String(30))  # freehold | leasehold | joint | government | cooperative
    share_percent: Mapped[float] = mapped_column(Float, default=100.0)
    registered_date: Mapped[date] = mapped_column(Date)
    registration_no: Mapped[str] = mapped_column(String(40))

    unit: Mapped[Unit] = relationship(back_populates="ownerships")


class UndergroundLayer(Base):
    __tablename__ = "underground_layers"

    id: Mapped[int] = mapped_column(primary_key=True)
    parcel_id: Mapped[int] = mapped_column(ForeignKey("parcels.id"), index=True)
    layer_no: Mapped[int] = mapped_column(Integer)          # maps to the Unn segment under B00
    layer_ulpin: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    layer_type: Mapped[str] = mapped_column(String(20))     # utility | parking | metro | air_rights
    name: Mapped[str] = mapped_column(String(120))
    top_m: Mapped[float] = mapped_column(Float)             # elevation of top (negative = below ground)
    bottom_m: Mapped[float] = mapped_column(Float)
    geometry: Mapped[str] = mapped_column(Text)             # GeoJSON Polygon
    local_footprint: Mapped[str] = mapped_column(Text)      # JSON [[x,y],...] building-local metres
    operator: Mapped[str] = mapped_column(String(120), default="")

    parcel: Mapped[Parcel] = relationship(back_populates="underground_layers")


# --------------------------------------------------------------------------- #
# Builder–investor layout integrity
# --------------------------------------------------------------------------- #

class PlotVersion(Base):
    """
    Append-only history of a unit's registered record. Version 1 is the baseline
    snapshot taken the moment the unit is first assigned to an owner. Rows are
    never updated or deleted — that is what makes tampering visible.
    """
    __tablename__ = "plot_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    version_number: Mapped[int] = mapped_column(Integer)
    geometry: Mapped[str] = mapped_column(Text)          # GeoJSON Polygon (lon/lat) of the unit footprint
    bounding_volume: Mapped[str] = mapped_column(Text)   # JSON {"min":[x,y,z],"max":[x,y,z]} building-local metres
    plot_number: Mapped[str] = mapped_column(String(40))
    ulpin: Mapped[str] = mapped_column(String(40), index=True)
    changed_by: Mapped[str] = mapped_column(String(120))
    change_reason: Mapped[str] = mapped_column(Text, default="")
    approval_status: Mapped[str] = mapped_column(String(20))  # baseline | approved | unapproved
    change_request_id: Mapped[int | None] = mapped_column(ForeignKey("change_requests.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    unit: Mapped[Unit] = relationship(back_populates="versions")

    __table_args__ = (UniqueConstraint("unit_id", "version_number"),)


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    requested_by: Mapped[str] = mapped_column(String(120))          # builder name
    proposed_geometry: Mapped[str] = mapped_column(Text)           # GeoJSON Polygon
    proposed_bounding_volume: Mapped[str] = mapped_column(Text)    # JSON min/max
    proposed_plot_number: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    affected_owner_id: Mapped[int | None] = mapped_column(ForeignKey("ownership.id"), nullable=True)
    resolution_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    unit: Mapped[Unit] = relationship(back_populates="change_requests")
    affected_owner: Mapped[Ownership | None] = relationship()


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    raised_by: Mapped[str] = mapped_column(String(120))            # investor email
    change_request_id: Mapped[int | None] = mapped_column(ForeignKey("change_requests.id"), nullable=True)
    plot_version_id: Mapped[int | None] = mapped_column(ForeignKey("plot_versions.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | investigating | resolved
    created_at: Mapped[datetime] = mapped_column(DateTime)

    unit: Mapped[Unit] = relationship(back_populates="disputes")


class Notification(Base):
    """In-app inbox. `recipient` is an investor email or the builder name or 'admin'."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient: Mapped[str] = mapped_column(String(120), index=True)
    message: Mapped[str] = mapped_column(Text)
    unit_ulpin: Mapped[str] = mapped_column(String(40), default="")
    change_request_id: Mapped[int | None] = mapped_column(ForeignKey("change_requests.id"), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)


# --------------------------------------------------------------------------- #
# Market context — real NCR projects, informational only
# --------------------------------------------------------------------------- #

class MarketContextProject(Base):
    """
    Read-only background layer of REAL projects (real builders, RERA IDs, coordinates).
    Deliberately has no foreign key to parcels/units and is never touched by the ULPIN
    engine, ownership assignment or the dispute/integrity system, so the demo can never
    imply a real company had a fraud or dispute. Fields we could not confirm are 'unknown'.
    """
    __tablename__ = "market_context_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    builder_name: Mapped[str] = mapped_column(String(120))
    project_name: Mapped[str] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(60))
    locality: Mapped[str] = mapped_column(String(80))
    property_type: Mapped[str] = mapped_column(String(30))
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)    # None = not confidently known
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_units: Mapped[str] = mapped_column(String(20))   # number or 'unknown'
    towers: Mapped[str] = mapped_column(String(20))
    floors: Mapped[str] = mapped_column(String(20))
    rera_id: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(40))
    data_source: Mapped[str] = mapped_column(String(80))
    data_date: Mapped[str] = mapped_column(String(10))
    confidence: Mapped[str] = mapped_column(String(20))    # verified | listing_based | unknown
    notes: Mapped[str] = mapped_column(Text, default="")
