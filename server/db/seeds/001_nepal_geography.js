const geography = require('./data/nepal-geography.json');

const LOCAL_LEVEL_TYPES = new Set([
  'METROPOLITAN_CITY',
  'SUB_METROPOLITAN_CITY',
  'MUNICIPALITY',
  'RURAL_MUNICIPALITY'
]);

async function upsertProvince(client, province) {
  const result = await client.query(
    `
      INSERT INTO geo_provinces (source_id, code, name, sort_order)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source_id) DO UPDATE
      SET code = EXCLUDED.code, name = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order, updated_at = NOW()
      RETURNING id
    `,
    [province.sourceId, province.code, province.name, province.sortOrder]
  );
  return result.rows[0].id;
}

async function upsertDistrict(client, district, provinceId) {
  const result = await client.query(
    `
      INSERT INTO geo_districts (source_id, province_id, code, name, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (source_id) DO UPDATE
      SET province_id = EXCLUDED.province_id, code = EXCLUDED.code,
          name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = NOW()
      RETURNING id
    `,
    [district.sourceId, provinceId, district.code, district.name, district.sortOrder]
  );
  return result.rows[0].id;
}

async function upsertLocalLevel(client, localLevel, districtId) {
  if (!LOCAL_LEVEL_TYPES.has(localLevel.type)) {
    throw new Error(`Unknown Nepal local-level type: ${localLevel.type}`);
  }

  const result = await client.query(
    `
      INSERT INTO geo_local_levels (
        source_id, district_id, code, name, type, ward_count, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (source_id) DO UPDATE
      SET district_id = EXCLUDED.district_id, code = EXCLUDED.code,
          name = EXCLUDED.name, type = EXCLUDED.type,
          ward_count = EXCLUDED.ward_count, sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
      RETURNING id
    `,
    [
      localLevel.sourceId,
      districtId,
      localLevel.code,
      localLevel.name,
      localLevel.type,
      localLevel.wardCount,
      localLevel.sortOrder
    ]
  );
  return result.rows[0].id;
}

async function seedWards(client, localLevel, localLevelId) {
  for (let wardNumber = 1; wardNumber <= localLevel.wardCount; wardNumber += 1) {
    const sourceKey = `${localLevel.sourceId}-${wardNumber}`;
    await client.query(
      `
        INSERT INTO geo_wards (source_key, local_level_id, ward_number, name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (source_key) DO UPDATE
        SET local_level_id = EXCLUDED.local_level_id,
            ward_number = EXCLUDED.ward_number,
            name = EXCLUDED.name,
            updated_at = NOW()
      `,
      [sourceKey, localLevelId, wardNumber, `Ward ${wardNumber}`]
    );
  }
}

async function seedDemoOperationalMappings(client) {
  const mappings = [
    ['ZONE-A', 1],
    ['ZONE-B', 278],
    ['ZONE-C', 753]
  ];

  for (const [zoneCode, localLevelSourceId] of mappings) {
    await client.query(
      `
        INSERT INTO flood_zone_wards (zone_id, ward_id, is_primary)
        SELECT z.id, w.id, TRUE
        FROM flood_zones z
        INNER JOIN geo_local_levels ll ON ll.source_id = $2
        INNER JOIN geo_wards w ON w.local_level_id = ll.id AND w.ward_number = 1
        WHERE z.code = $1
        ON CONFLICT (zone_id, ward_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
      `,
      [zoneCode, localLevelSourceId]
    );
  }
}

module.exports = async function seedNepalGeography(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const provinceIds = new Map();
    for (const province of geography.provinces) {
      provinceIds.set(province.sourceId, await upsertProvince(client, province));
    }

    const districtIds = new Map();
    for (const district of geography.districts) {
      const provinceId = provinceIds.get(district.provinceSourceId);
      if (!provinceId) throw new Error(`Province ${district.provinceSourceId} is missing`);
      districtIds.set(district.sourceId, await upsertDistrict(client, district, provinceId));
    }

    for (const localLevel of geography.localLevels) {
      const districtId = districtIds.get(localLevel.districtSourceId);
      if (!districtId) throw new Error(`District ${localLevel.districtSourceId} is missing`);
      const localLevelId = await upsertLocalLevel(client, localLevel, districtId);
      await seedWards(client, localLevel, localLevelId);
    }

    await seedDemoOperationalMappings(client);

    await client.query('COMMIT');
    console.log('Nepal geography ready: 7 provinces, 77 districts, 753 local levels and 6,743 wards');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
