-- Officer review queue filters on status and orders by submission time.
CREATE INDEX IF NOT EXISTS flood_reports_status_created_idx
  ON flood_reports(status, created_at DESC);

-- Zone-scoped alert lookups from the resident and public views.
CREATE INDEX IF NOT EXISTS alert_zones_zone_idx
  ON alert_zones(zone_id);

-- Report dossier loads the review trail in chronological order.
CREATE INDEX IF NOT EXISTS flood_report_reviews_report_idx
  ON flood_report_reviews(report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS flood_report_status_history_report_idx
  ON flood_report_status_history(report_id, created_at ASC);

-- Admin audit interface filters by actor, action and entity type.
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

-- Evacuation centre listings filter on operational status for active centres.
CREATE INDEX IF NOT EXISTS evacuation_centres_active_status_idx
  ON evacuation_centres(is_active, operational_status);

-- Evidence lookups per report.
CREATE INDEX IF NOT EXISTS flood_evidence_report_idx
  ON flood_evidence_metadata(report_id, upload_status);
