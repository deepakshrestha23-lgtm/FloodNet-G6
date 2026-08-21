INSERT INTO roles (code, display_name)
VALUES
  ('RESIDENT', 'Resident'),
  ('FLOOD_MONITORING_OFFICER', 'Flood Monitoring Officer'),
  ('EVACUATION_OFFICER', 'Evacuation Officer'),
  ('ADMINISTRATOR', 'System Administrator')
ON CONFLICT (code) DO NOTHING;

INSERT INTO flood_zones (code, name, locality, description, zone_type, is_demo_data)
VALUES
  ('ZONE-A', 'Riverbank North — DEMO DATA', 'Demo operational area', 'Fictional demonstration river corridor. Not an official administrative boundary.', 'RIVER_CORRIDOR', TRUE),
  ('ZONE-B', 'Central Lowlands — DEMO DATA', 'Demo operational area', 'Fictional demonstration floodplain. Not an official administrative boundary.', 'FLOODPLAIN', TRUE),
  ('ZONE-C', 'South Valley — DEMO DATA', 'Demo operational area', 'Fictional demonstration flood area. Not an official administrative boundary.', 'FLASH_FLOOD_AREA', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  locality = EXCLUDED.locality,
  description = EXCLUDED.description,
  zone_type = EXCLUDED.zone_type,
  is_demo_data = EXCLUDED.is_demo_data,
  updated_at = NOW();

INSERT INTO centre_facility_types (code, display_name)
VALUES
  ('DRINKING_WATER', 'Drinking water'),
  ('FOOD', 'Food'),
  ('FIRST_AID', 'First aid / medical assistance'),
  ('TOILETS', 'Toilets'),
  ('DISABILITY_ACCESS', 'Disability accessibility'),
  ('CHARGING', 'Charging / electricity'),
  ('SHELTER', 'Shelter availability')
ON CONFLICT (code) DO NOTHING;
