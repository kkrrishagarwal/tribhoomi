-- Reference PostGIS schema for a production deployment.
-- The prototype ORM (app/models.py) stores geometry as GeoJSON text so it runs on SQLite;
-- this file shows the same tables with native geometry columns and spatial indexes.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS parcels (
  id SERIAL PRIMARY KEY,
  ulpin_2d VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  state VARCHAR(60), district VARCHAR(60), village_ward VARCHAR(80),
  state_code INT, district_code INT, village_ward_code INT, parcel_no INT,
  land_use VARCHAR(40), area_sqm DOUBLE PRECISION,
  geometry GEOMETRY(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS parcels_geom_idx ON parcels USING GIST (geometry);

CREATE TABLE IF NOT EXISTS buildings (
  id SERIAL PRIMARY KEY,
  parcel_id INT REFERENCES parcels(id) ON DELETE CASCADE,
  building_no INT NOT NULL,
  building_ulpin VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(120), num_floors INT, num_basements INT, floor_height_m DOUBLE PRECISION,
  footprint GEOMETRY(Polygon, 4326) NOT NULL,
  UNIQUE (parcel_id, building_no)
);
CREATE INDEX IF NOT EXISTS buildings_fp_idx ON buildings USING GIST (footprint);

CREATE TABLE IF NOT EXISTS floors (
  id SERIAL PRIMARY KEY,
  building_id INT REFERENCES buildings(id) ON DELETE CASCADE,
  floor_number INT NOT NULL,
  floor_ulpin VARCHAR(40) UNIQUE NOT NULL,
  height_m DOUBLE PRECISION, base_elevation_m DOUBLE PRECISION, layer_type CHAR(1),
  UNIQUE (building_id, floor_number)
);

CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
  unit_no INT NOT NULL,
  unit_ulpin VARCHAR(40) UNIQUE NOT NULL,
  label VARCHAR(40), area_sqm DOUBLE PRECISION, usage_type VARCHAR(20),
  -- bounding volume; with PostGIS 3D you could also store a GEOMETRY(PolyhedralSurfaceZ)
  min_x DOUBLE PRECISION, min_y DOUBLE PRECISION, min_z DOUBLE PRECISION,
  max_x DOUBLE PRECISION, max_y DOUBLE PRECISION, max_z DOUBLE PRECISION,
  UNIQUE (floor_id, unit_no)
);

CREATE TABLE IF NOT EXISTS ownership (
  id SERIAL PRIMARY KEY,
  unit_id INT REFERENCES units(id) ON DELETE CASCADE,
  owner_name VARCHAR(120), ownership_type VARCHAR(30), share_percent DOUBLE PRECISION,
  registered_date DATE, registration_no VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS underground_layers (
  id SERIAL PRIMARY KEY,
  parcel_id INT REFERENCES parcels(id) ON DELETE CASCADE,
  layer_no INT, layer_ulpin VARCHAR(40) UNIQUE NOT NULL,
  layer_type VARCHAR(20), name VARCHAR(120), top_m DOUBLE PRECISION, bottom_m DOUBLE PRECISION,
  geometry GEOMETRY(Polygon, 4326) NOT NULL, operator VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS layers_geom_idx ON underground_layers USING GIST (geometry);
