/*
 * Flood zones are optional operational risk groupings, never Nepal's
 * administrative geography. This data migration corrects databases that were
 * seeded before the distinction was made explicit. The update is deliberately
 * limited to FloodNet's three known demonstration codes.
 */

UPDATE flood_zones
SET name = 'Riverbank North (demonstration data)',
    locality = 'Demo operational area',
    description = 'Fictional demonstration river corridor. Not an official administrative boundary.',
    zone_type = 'RIVER_CORRIDOR',
    is_demo_data = TRUE,
    updated_at = NOW()
WHERE code = 'ZONE-A';

UPDATE flood_zones
SET name = 'Central Lowlands (demonstration data)',
    locality = 'Demo operational area',
    description = 'Fictional demonstration floodplain. Not an official administrative boundary.',
    zone_type = 'FLOODPLAIN',
    is_demo_data = TRUE,
    updated_at = NOW()
WHERE code = 'ZONE-B';

UPDATE flood_zones
SET name = 'South Valley (demonstration data)',
    locality = 'Demo operational area',
    description = 'Fictional demonstration flood area. Not an official administrative boundary.',
    zone_type = 'FLASH_FLOOD_AREA',
    is_demo_data = TRUE,
    updated_at = NOW()
WHERE code = 'ZONE-C';

COMMENT ON TABLE flood_zones IS
  'Optional FloodNet operational risk areas such as river corridors or floodplains; not administrative boundaries or staff authorization scopes.';

COMMENT ON TABLE flood_zone_wards IS
  'Compatibility and analysis mapping between optional operational risk areas and official Nepal wards.';
