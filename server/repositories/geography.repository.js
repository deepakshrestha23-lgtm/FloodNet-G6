const { pool } = require('../db/pool');

function getPool() {
  if (!pool) throw new Error('Database pool is not configured');
  return pool;
}

async function listProvinces() {
  const result = await getPool().query(
    `
      SELECT id, code, name, name_ne, sort_order
      FROM geo_provinces
      WHERE is_active = TRUE
      ORDER BY sort_order ASC
    `
  );
  return result.rows;
}

async function listDistricts(provinceId) {
  const result = await getPool().query(
    `
      SELECT d.id, d.code, d.name, d.name_ne, d.sort_order,
             p.id AS province_id, p.code AS province_code, p.name AS province_name
      FROM geo_districts d
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE d.is_active = TRUE AND p.is_active = TRUE
        AND d.province_id = $1
      ORDER BY d.sort_order ASC
    `,
    [provinceId]
  );
  return result.rows;
}

async function listLocalLevels(districtId) {
  const result = await getPool().query(
    `
      SELECT ll.id, ll.code, ll.name, ll.name_ne, ll.type, ll.ward_count, ll.sort_order,
             d.id AS district_id, d.code AS district_code, d.name AS district_name,
             p.id AS province_id, p.code AS province_code, p.name AS province_name
      FROM geo_local_levels ll
      INNER JOIN geo_districts d ON d.id = ll.district_id
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE ll.is_active = TRUE AND d.is_active = TRUE AND p.is_active = TRUE
        AND ll.district_id = $1
      ORDER BY ll.sort_order ASC
    `,
    [districtId]
  );
  return result.rows;
}

async function listWards(localLevelId) {
  const result = await getPool().query(
    `
      SELECT w.id, w.source_key, w.ward_number, w.name, w.name_ne,
             ll.id AS local_level_id, ll.code AS local_level_code, ll.name AS local_level_name,
             d.id AS district_id, d.code AS district_code, d.name AS district_name,
             p.id AS province_id, p.code AS province_code, p.name AS province_name
      FROM geo_wards w
      INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
      INNER JOIN geo_districts d ON d.id = ll.district_id
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE w.is_active = TRUE AND ll.is_active = TRUE
        AND d.is_active = TRUE AND p.is_active = TRUE
        AND w.local_level_id = $1
      ORDER BY w.ward_number ASC
    `,
    [localLevelId]
  );
  return result.rows;
}

async function findWard(wardId) {
  const result = await getPool().query(
    `
      SELECT w.id, w.local_level_id, ll.district_id, d.province_id
      FROM geo_wards w
      INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
      INNER JOIN geo_districts d ON d.id = ll.district_id
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE w.id = $1 AND w.is_active = TRUE AND ll.is_active = TRUE
        AND d.is_active = TRUE AND p.is_active = TRUE
    `,
    [wardId]
  );
  return result.rows[0] || null;
}

module.exports = { listProvinces, listDistricts, listLocalLevels, listWards, findWard };
