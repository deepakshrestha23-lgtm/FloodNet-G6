INSERT INTO roles (code, display_name)
VALUES
  ('RESIDENT', 'Resident'),
  ('FLOOD_MONITORING_OFFICER', 'Flood Monitoring Officer'),
  ('EVACUATION_OFFICER', 'Evacuation Officer'),
  ('ADMINISTRATOR', 'System Administrator')
ON CONFLICT (code) DO NOTHING;

-- Flood zones follow Nepal's recurring monsoon flood corridors: the Bagmati
-- through Kathmandu Valley, and the Koshi, West Rapti, Karnali and Narayani
-- basins across the Terai, which flood most years between June and September.
--
-- Unlike the other reference tables this one upserts, so re-running the seed
-- refreshes zone descriptions on a database that was created earlier. The zone
-- code stays the permanent identity that centres and reports are keyed to.
INSERT INTO flood_zones (code, name, locality, description)
VALUES
  ('ZONE-A', 'Bagmati Riverside', 'Kathmandu', 'Settlements along the Bagmati river corridor through Kathmandu Metropolitan City'),
  ('ZONE-B', 'Koshi Basin', 'Sunsari', 'Low-lying wards near the Koshi barrage and embankment in Sunsari district'),
  ('ZONE-C', 'West Rapti Valley', 'Banke', 'West Rapti floodplain around Nepalgunj sub-metropolitan city'),
  ('ZONE-D', 'Karnali Floodplain', 'Bardiya', 'Karnali river spill zone covering Rajapur and the surrounding villages'),
  ('ZONE-E', 'Narayani Corridor', 'Chitwan', 'Narayani riverbank communities near Bharatpur and Kasara')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  locality = EXCLUDED.locality,
  description = EXCLUDED.description;

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
