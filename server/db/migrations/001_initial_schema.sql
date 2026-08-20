CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  locality VARCHAR(120),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40),
  home_zone_id UUID REFERENCES flood_zones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref VARCHAR(40) NOT NULL UNIQUE,
  resident_id UUID NOT NULL REFERENCES users(id),
  zone_id UUID NOT NULL REFERENCES flood_zones(id),
  location_description VARCHAR(500) NOT NULL,
  observed_severity VARCHAR(20) NOT NULL
    CHECK (observed_severity IN ('LOW', 'MODERATE', 'HIGH', 'SEVERE', 'UNKNOWN')),
  road_condition VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (road_condition IN ('CLEAR', 'RESTRICTED', 'BLOCKED', 'UNKNOWN')),
  incident_description TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN ('PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED', 'VERIFIED', 'REJECTED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_report_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES flood_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(40) NOT NULL
    CHECK (action IN ('VERIFY', 'REJECT', 'MORE_INFORMATION_REQUIRED', 'CLOSE')),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_notes_required_for_negative_actions CHECK (
    action NOT IN ('REJECT', 'MORE_INFORMATION_REQUIRED')
    OR NULLIF(BTRIM(review_notes), '') IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS flood_report_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES flood_reports(id) ON DELETE CASCADE,
  old_status VARCHAR(40),
  new_status VARCHAR(40) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_ref VARCHAR(40) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  published_by UUID REFERENCES users(id),
  title VARCHAR(180) NOT NULL,
  severity VARCHAR(20) NOT NULL
    CHECK (severity IN ('ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY')),
  warning_description TEXT NOT NULL,
  recommended_actions TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'EXPIRED', 'CANCELLED')),
  published_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_expiry_after_start CHECK (expires_at > valid_from)
);

CREATE TABLE IF NOT EXISTS alert_zones (
  alert_id UUID NOT NULL REFERENCES flood_alerts(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES flood_zones(id),
  PRIMARY KEY (alert_id, zone_id)
);

CREATE TABLE IF NOT EXISTS evacuation_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES flood_zones(id),
  name VARCHAR(160) NOT NULL,
  location_description VARCHAR(500) NOT NULL,
  contact_phone VARCHAR(40),
  maximum_capacity INTEGER NOT NULL CHECK (maximum_capacity >= 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0
    CHECK (current_occupancy >= 0 AND current_occupancy <= maximum_capacity),
  available_space INTEGER GENERATED ALWAYS AS (maximum_capacity - current_occupancy) STORED,
  operational_status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (operational_status IN ('OPEN', 'NEAR_CAPACITY', 'FULL', 'CLOSED')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS centre_facility_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS centre_facilities (
  centre_id UUID NOT NULL REFERENCES evacuation_centres(id) ON DELETE CASCADE,
  facility_type_id UUID NOT NULL REFERENCES centre_facility_types(id),
  notes VARCHAR(300),
  PRIMARY KEY (centre_id, facility_type_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  home_zone_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES flood_alerts(id),
  recipient_scope VARCHAR(40) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  delivery_status VARCHAR(20) NOT NULL
    CHECK (delivery_status IN ('REQUESTED', 'SENT', 'FAILED')),
  provider_message_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flood_evidence_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES flood_reports(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  object_key VARCHAR(500) NOT NULL UNIQUE,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  upload_status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
    CHECK (upload_status IN ('REQUESTED', 'UPLOADED', 'REJECTED')),
  checksum VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flood_zones
  ADD CONSTRAINT flood_zones_created_by_fk
  FOREIGN KEY (created_by) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS flood_reports_status_idx ON flood_reports(status);
CREATE INDEX IF NOT EXISTS flood_reports_zone_idx ON flood_reports(zone_id);
CREATE INDEX IF NOT EXISTS flood_reports_created_at_idx ON flood_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS flood_alerts_status_expiry_idx ON flood_alerts(status, expires_at);
CREATE INDEX IF NOT EXISTS evacuation_centres_zone_idx ON evacuation_centres(zone_id);
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users(role_id, status);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
