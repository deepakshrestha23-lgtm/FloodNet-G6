INSERT INTO roles (code, display_name)
VALUES
  ('RESIDENT', 'Resident'),
  ('FLOOD_MONITORING_OFFICER', 'Flood Monitoring Officer'),
  ('EVACUATION_OFFICER', 'Evacuation Officer'),
  ('ADMINISTRATOR', 'System Administrator')
ON CONFLICT (code) DO NOTHING;

INSERT INTO flood_zones (code, name, locality, description)
VALUES
  ('ZONE-A', 'Riverbank North', 'North District', 'Northern riverbank communities'),
  ('ZONE-B', 'Central Lowlands', 'Central District', 'Central low-lying communities'),
  ('ZONE-C', 'South Valley', 'South District', 'Southern valley communities')
ON CONFLICT (code) DO NOTHING;

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
