/*
 * FloodNet national geography and operational jurisdiction.
 *
 * Administrative geography is deliberately separate from flood_zones. A zone
 * is an operational flood area and may overlap many wards; it is not a
 * substitute for Nepal's government hierarchy.
 */

CREATE TABLE IF NOT EXISTS geo_provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INTEGER NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  name_ne VARCHAR(120),
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geo_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INTEGER NOT NULL UNIQUE,
  province_id UUID NOT NULL REFERENCES geo_provinces(id),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  name_ne VARCHAR(120),
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geo_local_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INTEGER NOT NULL UNIQUE,
  district_id UUID NOT NULL REFERENCES geo_districts(id),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  name_ne VARCHAR(160),
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('METROPOLITAN_CITY', 'SUB_METROPOLITAN_CITY', 'MUNICIPALITY', 'RURAL_MUNICIPALITY')),
  ward_count INTEGER NOT NULL CHECK (ward_count > 0),
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geo_wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(40) NOT NULL UNIQUE,
  local_level_id UUID NOT NULL REFERENCES geo_local_levels(id),
  ward_number INTEGER NOT NULL CHECK (ward_number > 0),
  name VARCHAR(80) NOT NULL,
  name_ne VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (local_level_id, ward_number)
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS home_ward_id UUID REFERENCES geo_wards(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_jurisdictions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scope_level VARCHAR(20) NOT NULL
    CHECK (scope_level IN ('NATIONAL', 'PROVINCE', 'DISTRICT', 'LOCAL_LEVEL', 'WARD')),
  province_id UUID REFERENCES geo_provinces(id),
  district_id UUID REFERENCES geo_districts(id),
  local_level_id UUID REFERENCES geo_local_levels(id),
  ward_id UUID REFERENCES geo_wards(id),
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_jurisdiction_scope_shape_ck CHECK (
    (scope_level = 'NATIONAL' AND province_id IS NULL AND district_id IS NULL AND local_level_id IS NULL AND ward_id IS NULL)
    OR (scope_level = 'PROVINCE' AND province_id IS NOT NULL AND district_id IS NULL AND local_level_id IS NULL AND ward_id IS NULL)
    OR (scope_level = 'DISTRICT' AND province_id IS NULL AND district_id IS NOT NULL AND local_level_id IS NULL AND ward_id IS NULL)
    OR (scope_level = 'LOCAL_LEVEL' AND province_id IS NULL AND district_id IS NULL AND local_level_id IS NOT NULL AND ward_id IS NULL)
    OR (scope_level = 'WARD' AND province_id IS NULL AND district_id IS NULL AND local_level_id IS NULL AND ward_id IS NOT NULL)
  )
);

ALTER TABLE flood_zones
  ADD COLUMN IF NOT EXISTS zone_type VARCHAR(30) NOT NULL DEFAULT 'OTHER'
    CHECK (zone_type IN ('RIVER_CORRIDOR', 'FLOODPLAIN', 'URBAN_DRAINAGE', 'FLASH_FLOOD_AREA', 'OTHER')),
  ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS flood_zone_wards (
  zone_id UUID NOT NULL REFERENCES flood_zones(id) ON DELETE CASCADE,
  ward_id UUID NOT NULL REFERENCES geo_wards(id),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (zone_id, ward_id)
);

ALTER TABLE flood_reports
  ALTER COLUMN zone_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES geo_wards(id),
  ADD COLUMN IF NOT EXISTS locality VARCHAR(160),
  ADD COLUMN IF NOT EXISTS nearest_landmark VARCHAR(240),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS flood_type VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (flood_type IN ('RIVER_OVERFLOW', 'FLASH_FLOOD', 'URBAN_DRAINAGE', 'GLACIAL_LAKE_OUTBURST', 'LANDSLIDE_BLOCKAGE', 'UNKNOWN')),
  ADD COLUMN IF NOT EXISTS people_at_risk INTEGER NOT NULL DEFAULT 0
    CHECK (people_at_risk >= 0),
  ADD CONSTRAINT flood_reports_location_reference_ck CHECK (zone_id IS NOT NULL OR ward_id IS NOT NULL),
  ADD CONSTRAINT flood_reports_latitude_ck CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT flood_reports_longitude_ck CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT flood_reports_coordinate_pair_ck CHECK ((latitude IS NULL) = (longitude IS NULL));

ALTER TABLE evacuation_centres
  ALTER COLUMN zone_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES geo_wards(id),
  ADD COLUMN IF NOT EXISTS locality VARCHAR(160),
  ADD COLUMN IF NOT EXISTS nearest_landmark VARCHAR(240),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD CONSTRAINT evacuation_centres_location_reference_ck CHECK (zone_id IS NOT NULL OR ward_id IS NOT NULL),
  ADD CONSTRAINT evacuation_centres_latitude_ck CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT evacuation_centres_longitude_ck CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT evacuation_centres_coordinate_pair_ck CHECK ((latitude IS NULL) = (longitude IS NULL));

CREATE TABLE IF NOT EXISTS alert_wards (
  alert_id UUID NOT NULL REFERENCES flood_alerts(id) ON DELETE CASCADE,
  ward_id UUID NOT NULL REFERENCES geo_wards(id),
  PRIMARY KEY (alert_id, ward_id)
);

CREATE INDEX IF NOT EXISTS geo_districts_province_idx ON geo_districts(province_id, sort_order);
CREATE INDEX IF NOT EXISTS geo_local_levels_district_idx ON geo_local_levels(district_id, sort_order);
CREATE INDEX IF NOT EXISTS geo_wards_local_level_idx ON geo_wards(local_level_id, ward_number);
CREATE INDEX IF NOT EXISTS user_jurisdictions_scope_idx ON user_jurisdictions(scope_level);
CREATE INDEX IF NOT EXISTS flood_reports_ward_idx ON flood_reports(ward_id);
CREATE INDEX IF NOT EXISTS evacuation_centres_ward_idx ON evacuation_centres(ward_id);
CREATE INDEX IF NOT EXISTS flood_zone_wards_ward_idx ON flood_zone_wards(ward_id);
CREATE INDEX IF NOT EXISTS alert_wards_ward_idx ON alert_wards(ward_id);
