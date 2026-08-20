const { hashPassword } = require('../../utils/password');

/**
 * Demonstration accounts and operational data for local development and the
 * Task 1 walkthrough. The password is read from DEMO_PASSWORD so no credential
 * is committed to source control, and the seed refuses to run against a
 * production environment unless it is explicitly permitted.
 */
const DEMO_ACCOUNTS = [
  {
    email: 'resident@floodnet.local',
    roleCode: 'RESIDENT',
    firstName: 'Rina',
    lastName: 'Alvarez',
    phone: '+60123456701',
    homeZoneCode: 'ZONE-A'
  },
  {
    email: 'officer@floodnet.local',
    roleCode: 'FLOOD_MONITORING_OFFICER',
    firstName: 'Daniel',
    lastName: 'Okafor',
    phone: '+60123456702'
  },
  {
    email: 'evacuation@floodnet.local',
    roleCode: 'EVACUATION_OFFICER',
    firstName: 'Mei',
    lastName: 'Tan',
    phone: '+60123456703'
  },
  {
    email: 'admin@floodnet.local',
    roleCode: 'ADMINISTRATOR',
    firstName: 'Sofia',
    lastName: 'Haddad',
    phone: '+60123456704'
  }
];

const DEMO_CENTRES = [
  {
    zoneCode: 'ZONE-A',
    name: 'Riverbank Community Hall',
    locationDescription: 'Jalan Sungai Utara 12, beside the north district clinic',
    contactPhone: '+60123456710',
    maximumCapacity: 250,
    currentOccupancy: 40,
    facilityCodes: ['DRINKING_WATER', 'FOOD', 'TOILETS', 'FIRST_AID', 'SHELTER']
  },
  {
    zoneCode: 'ZONE-B',
    name: 'Central Sports Complex',
    locationDescription: 'Central district sports complex, main indoor arena',
    contactPhone: '+60123456711',
    maximumCapacity: 500,
    currentOccupancy: 430,
    facilityCodes: ['DRINKING_WATER', 'FOOD', 'TOILETS', 'CHARGING', 'DISABILITY_ACCESS', 'SHELTER']
  },
  {
    zoneCode: 'ZONE-C',
    name: 'South Valley Secondary School',
    locationDescription: 'South Valley secondary school assembly hall',
    contactPhone: '+60123456712',
    maximumCapacity: 180,
    currentOccupancy: 0,
    facilityCodes: ['DRINKING_WATER', 'TOILETS', 'SHELTER']
  }
];

const DEMO_REPORTS = [
  {
    zoneCode: 'ZONE-A',
    locationDescription: 'Jalan Sungai Utara, near the pedestrian bridge',
    observedSeverity: 'HIGH',
    roadCondition: 'BLOCKED',
    incidentDescription: 'Water has risen above the kerb and covers both lanes. Several cars have turned back.',
    hoursAgo: 5,
    status: 'PENDING_REVIEW'
  },
  {
    zoneCode: 'ZONE-B',
    locationDescription: 'Central market car park, lower level',
    observedSeverity: 'MODERATE',
    roadCondition: 'RESTRICTED',
    incidentDescription: 'Ankle-deep water across the lower car park. Drains appear to be backing up.',
    hoursAgo: 26,
    status: 'VERIFIED'
  },
  {
    zoneCode: 'ZONE-B',
    locationDescription: 'Residential lane behind the community centre',
    observedSeverity: 'LOW',
    roadCondition: 'CLEAR',
    incidentDescription: 'Shallow pooling near the drain outlet. Passable but worth monitoring.',
    hoursAgo: 50,
    status: 'MORE_INFORMATION_REQUIRED'
  },
  {
    zoneCode: 'ZONE-C',
    locationDescription: 'South Valley main road at the river crossing',
    observedSeverity: 'SEVERE',
    roadCondition: 'BLOCKED',
    incidentDescription: 'River has overtopped the crossing. The road is impassable to all vehicles.',
    hoursAgo: 74,
    status: 'VERIFIED'
  }
];

async function lookupIdByCode(client, table, code) {
  const result = await client.query(`SELECT id FROM ${table} WHERE code = $1`, [code]);
  return result.rows[0] ? result.rows[0].id : null;
}

async function seedAccounts(client, passwordHash) {
  const accountIds = {};

  for (const account of DEMO_ACCOUNTS) {
    const roleId = await lookupIdByCode(client, 'roles', account.roleCode);

    if (!roleId) {
      throw new Error(`Role ${account.roleCode} is missing. Run the reference data seed first.`);
    }

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [account.email]);

    if (existing.rowCount > 0) {
      accountIds[account.roleCode] = existing.rows[0].id;
      continue;
    }

    const homeZoneId = account.homeZoneCode
      ? await lookupIdByCode(client, 'flood_zones', account.homeZoneCode)
      : null;

    const userResult = await client.query(
      'INSERT INTO users (role_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [roleId, account.email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `
        INSERT INTO user_profiles (user_id, first_name, last_name, phone, home_zone_id)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, account.firstName, account.lastName, account.phone, homeZoneId]
    );

    await client.query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [userId]);

    accountIds[account.roleCode] = userId;
  }

  return accountIds;
}

async function seedCentres(client, evacuationOfficerId) {
  for (const centre of DEMO_CENTRES) {
    const existing = await client.query('SELECT id FROM evacuation_centres WHERE name = $1', [centre.name]);

    if (existing.rowCount > 0) continue;

    const zoneId = await lookupIdByCode(client, 'flood_zones', centre.zoneCode);
    if (!zoneId) continue;

    const occupancyRatio = centre.maximumCapacity > 0
      ? centre.currentOccupancy / centre.maximumCapacity
      : 1;
    const operationalStatus = occupancyRatio >= 1
      ? 'FULL'
      : occupancyRatio >= 0.85 ? 'NEAR_CAPACITY' : 'OPEN';

    const centreResult = await client.query(
      `
        INSERT INTO evacuation_centres (
          zone_id, name, location_description, contact_phone,
          maximum_capacity, current_occupancy, operational_status, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        zoneId,
        centre.name,
        centre.locationDescription,
        centre.contactPhone,
        centre.maximumCapacity,
        centre.currentOccupancy,
        operationalStatus,
        evacuationOfficerId
      ]
    );

    for (const facilityCode of centre.facilityCodes) {
      const facilityTypeId = await lookupIdByCode(client, 'centre_facility_types', facilityCode);

      if (facilityTypeId) {
        await client.query(
          'INSERT INTO centre_facilities (centre_id, facility_type_id) VALUES ($1, $2)',
          [centreResult.rows[0].id, facilityTypeId]
        );
      }
    }
  }
}

async function seedReports(client, residentId, officerId) {
  for (const [index, report] of DEMO_REPORTS.entries()) {
    const reportRef = `FLD-DEMO-${String(index + 1).padStart(4, '0')}`;
    const existing = await client.query('SELECT id FROM flood_reports WHERE report_ref = $1', [reportRef]);

    if (existing.rowCount > 0) continue;

    const zoneId = await lookupIdByCode(client, 'flood_zones', report.zoneCode);
    if (!zoneId) continue;

    const reportResult = await client.query(
      `
        INSERT INTO flood_reports (
          report_ref, resident_id, zone_id, location_description,
          observed_severity, road_condition, incident_description,
          observed_at, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7,
          NOW() - ($8 || ' hours')::INTERVAL,
          $9,
          NOW() - ($8 || ' hours')::INTERVAL)
        RETURNING id
      `,
      [
        reportRef,
        residentId,
        zoneId,
        report.locationDescription,
        report.observedSeverity,
        report.roadCondition,
        report.incidentDescription,
        String(report.hoursAgo),
        report.status
      ]
    );

    const reportId = reportResult.rows[0].id;

    await client.query(
      `
        INSERT INTO flood_report_status_history (report_id, old_status, new_status, changed_by, reason, created_at)
        VALUES ($1, NULL, 'PENDING_REVIEW', $2, 'Report submitted by resident', NOW() - ($3 || ' hours')::INTERVAL)
      `,
      [reportId, residentId, String(report.hoursAgo)]
    );

    // Reports that are not awaiting first review carry the officer decision
    // that moved them, so the review trail and dashboards are consistent.
    if (report.status !== 'PENDING_REVIEW') {
      const action = report.status === 'VERIFIED' ? 'VERIFY' : 'MORE_INFORMATION_REQUIRED';
      const notes = report.status === 'VERIFIED'
        ? 'Consistent with other reports received from this area.'
        : 'Please confirm how deep the water is at its deepest point.';

      await client.query(
        `
          INSERT INTO flood_report_reviews (report_id, reviewer_id, action, review_notes, created_at)
          VALUES ($1, $2, $3, $4, NOW() - ($5 || ' hours')::INTERVAL)
        `,
        [reportId, officerId, action, notes, String(Math.max(report.hoursAgo - 2, 0))]
      );

      await client.query(
        `
          INSERT INTO flood_report_status_history (report_id, old_status, new_status, changed_by, reason, created_at)
          VALUES ($1, 'PENDING_REVIEW', $2, $3, $4, NOW() - ($5 || ' hours')::INTERVAL)
        `,
        [reportId, report.status, officerId, notes, String(Math.max(report.hoursAgo - 2, 0))]
      );
    }
  }
}

async function seedAlert(client, officerId) {
  const alertRef = 'ALT-DEMO-0001';
  const existing = await client.query('SELECT id FROM flood_alerts WHERE alert_ref = $1', [alertRef]);

  if (existing.rowCount > 0) return;

  const alertResult = await client.query(
    `
      INSERT INTO flood_alerts (
        alert_ref, created_by, published_by, title, severity,
        warning_description, recommended_actions,
        valid_from, expires_at, status, published_at
      )
      VALUES ($1, $2, $2, $3, $4, $5, $6,
        NOW() - INTERVAL '3 hours',
        NOW() + INTERVAL '21 hours',
        'PUBLISHED',
        NOW() - INTERVAL '3 hours')
      RETURNING id
    `,
    [
      alertRef,
      officerId,
      'Rising river levels in South Valley',
      'WARNING',
      'The river crossing on South Valley main road has been overtopped and water levels are continuing to rise. Verified reports confirm the road is impassable.',
      'Avoid the South Valley river crossing. If you are in a low-lying property, move valuables and important documents to an upper level and be ready to leave. Follow instructions from evacuation officers.'
    ]
  );

  const zoneId = await lookupIdByCode(client, 'flood_zones', 'ZONE-C');

  if (zoneId) {
    await client.query(
      'INSERT INTO alert_zones (alert_id, zone_id) VALUES ($1, $2)',
      [alertResult.rows[0].id, zoneId]
    );
  }
}

module.exports = async function seedDemoAccounts(pool) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('Skipping demo accounts seed: refusing to run in production');
    return;
  }

  const password = process.env.DEMO_PASSWORD;

  if (!password) {
    console.log('Skipping demo accounts seed: set DEMO_PASSWORD to create demonstration accounts');
    return;
  }

  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const accountIds = await seedAccounts(client, passwordHash);

    await seedCentres(client, accountIds.EVACUATION_OFFICER);
    await seedReports(client, accountIds.RESIDENT, accountIds.FLOOD_MONITORING_OFFICER);
    await seedAlert(client, accountIds.FLOOD_MONITORING_OFFICER);

    await client.query('COMMIT');
    console.log(`Demo accounts ready: ${DEMO_ACCOUNTS.map((a) => a.email).join(', ')}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
