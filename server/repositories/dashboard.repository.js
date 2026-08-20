const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

/**
 * Every figure below is aggregated in SQL from live records. No dashboard value
 * is stored, cached or hardcoded.
 */
async function getOfficerDashboard() {
  const summaryResult = await getPool().query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::INTEGER AS pending_reports,
        COUNT(*) FILTER (WHERE status = 'MORE_INFORMATION_REQUIRED')::INTEGER AS awaiting_information,
        COUNT(*) FILTER (WHERE status = 'VERIFIED')::INTEGER AS verified_reports,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::INTEGER AS rejected_reports,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::INTEGER AS closed_reports,
        COUNT(*) FILTER (
          WHERE status = 'VERIFIED' AND updated_at >= DATE_TRUNC('day', NOW())
        )::INTEGER AS verified_today,
        COUNT(*)::INTEGER AS total_reports
      FROM flood_reports
    `
  );

  const activeAlertsResult = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS active_alerts
      FROM flood_alerts
      WHERE status = 'PUBLISHED'
        AND valid_from <= NOW()
        AND expires_at > NOW()
    `
  );

  const byZoneResult = await getPool().query(
    `
      SELECT
        z.code AS zone_code,
        z.name AS zone_name,
        COUNT(fr.id)::INTEGER AS total,
        COUNT(fr.id) FILTER (WHERE fr.status = 'PENDING_REVIEW')::INTEGER AS pending,
        COUNT(fr.id) FILTER (WHERE fr.status = 'VERIFIED')::INTEGER AS verified
      FROM flood_zones z
      LEFT JOIN flood_reports fr ON fr.zone_id = z.id
      WHERE z.is_active = TRUE
      GROUP BY z.id
      ORDER BY total DESC, z.name ASC
    `
  );

  const bySeverityResult = await getPool().query(
    `
      SELECT observed_severity, COUNT(*)::INTEGER AS total
      FROM flood_reports
      GROUP BY observed_severity
      ORDER BY total DESC
    `
  );

  const byStatusResult = await getPool().query(
    `
      SELECT status, COUNT(*)::INTEGER AS total
      FROM flood_reports
      GROUP BY status
      ORDER BY total DESC
    `
  );

  // Fourteen-day trend with zero-filled days so the chart has no gaps.
  const trendResult = await getPool().query(
    `
      SELECT
        day::DATE AS day,
        COUNT(fr.id)::INTEGER AS submitted,
        COUNT(fr.id) FILTER (WHERE fr.status = 'VERIFIED')::INTEGER AS verified
      FROM GENERATE_SERIES(
        DATE_TRUNC('day', NOW()) - INTERVAL '13 days',
        DATE_TRUNC('day', NOW()),
        INTERVAL '1 day'
      ) AS day
      LEFT JOIN flood_reports fr
        ON DATE_TRUNC('day', fr.created_at) = day
      GROUP BY day
      ORDER BY day ASC
    `
  );

  const summary = summaryResult.rows[0];

  return {
    summary: {
      pendingReports: summary.pending_reports,
      awaitingInformation: summary.awaiting_information,
      verifiedReports: summary.verified_reports,
      rejectedReports: summary.rejected_reports,
      closedReports: summary.closed_reports,
      verifiedToday: summary.verified_today,
      totalReports: summary.total_reports,
      activeAlerts: activeAlertsResult.rows[0].active_alerts
    },
    reportsByZone: byZoneResult.rows.map((row) => ({
      zoneCode: row.zone_code,
      zoneName: row.zone_name,
      total: row.total,
      pending: row.pending,
      verified: row.verified
    })),
    reportsBySeverity: bySeverityResult.rows.map((row) => ({
      severity: row.observed_severity,
      total: row.total
    })),
    reportsByStatus: byStatusResult.rows.map((row) => ({
      status: row.status,
      total: row.total
    })),
    trend: trendResult.rows.map((row) => ({
      day: row.day,
      submitted: row.submitted,
      verified: row.verified
    }))
  };
}

/**
 * Occupancy percentage is computed from live capacity values, guarding against
 * division by zero for a centre recorded with zero capacity.
 */
async function getEvacuationDashboard() {
  const summaryResult = await getPool().query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_centres,
        COUNT(*) FILTER (WHERE operational_status = 'OPEN')::INTEGER AS open_centres,
        COUNT(*) FILTER (WHERE operational_status = 'NEAR_CAPACITY')::INTEGER AS near_capacity_centres,
        COUNT(*) FILTER (WHERE operational_status = 'FULL')::INTEGER AS full_centres,
        COUNT(*) FILTER (WHERE operational_status = 'CLOSED')::INTEGER AS closed_centres,
        COALESCE(SUM(maximum_capacity), 0)::INTEGER AS total_capacity,
        COALESCE(SUM(current_occupancy), 0)::INTEGER AS total_occupancy,
        COALESCE(SUM(available_space), 0)::INTEGER AS total_available
      FROM evacuation_centres
      WHERE is_active = TRUE
    `
  );

  const byZoneResult = await getPool().query(
    `
      SELECT
        z.code AS zone_code,
        z.name AS zone_name,
        COUNT(ec.id)::INTEGER AS centres,
        COALESCE(SUM(ec.maximum_capacity), 0)::INTEGER AS capacity,
        COALESCE(SUM(ec.current_occupancy), 0)::INTEGER AS occupancy,
        COALESCE(SUM(ec.available_space), 0)::INTEGER AS available
      FROM flood_zones z
      LEFT JOIN evacuation_centres ec ON ec.zone_id = z.id AND ec.is_active = TRUE
      WHERE z.is_active = TRUE
      GROUP BY z.id
      ORDER BY z.name ASC
    `
  );

  const summary = summaryResult.rows[0];
  const occupancyRate = summary.total_capacity > 0
    ? Math.round((summary.total_occupancy / summary.total_capacity) * 100)
    : 0;

  return {
    summary: {
      totalCentres: summary.total_centres,
      openCentres: summary.open_centres,
      nearCapacityCentres: summary.near_capacity_centres,
      fullCentres: summary.full_centres,
      closedCentres: summary.closed_centres,
      totalCapacity: summary.total_capacity,
      totalOccupancy: summary.total_occupancy,
      totalAvailable: summary.total_available,
      occupancyRate
    },
    byZone: byZoneResult.rows.map((row) => ({
      zoneCode: row.zone_code,
      zoneName: row.zone_name,
      centres: row.centres,
      capacity: row.capacity,
      occupancy: row.occupancy,
      available: row.available
    }))
  };
}

module.exports = { getOfficerDashboard, getEvacuationDashboard };
