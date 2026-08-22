# FloodNet interactive maps

## Boundary

```text
Authorized FloodNet API response
        -> React Leaflet component
        -> MapTiler raster tiles
        -> OpenStreetMap attribution
```

The tile provider supplies only the visual map background. FloodNet continues
to own coordinates, Nepal administrative geography, officer jurisdiction and
authorization. MapTiler receives standard tile requests for the visible map
area; FloodNet does not send report descriptions, resident identity, evidence,
authentication data or other record metadata to it.

Maps are used for:

- optional click-to-select coordinates on report and centre forms;
- the owning resident's report detail;
- Flood Monitoring Officer report review;
- public/resident evacuation centres returned by the public centre API; and
- Evacuation Officer centre operations within the existing server-enforced
  jurisdiction.

All interactive map views open centred on Nepal and keep panning within a
generous Nepal viewport. The viewport is a user-interface convenience, not a
replacement for the server's Nepal geography and jurisdiction validation.

Area alerts are not represented as a single marker because an alert can cover a
province, district, local level or multiple wards.

## MapTiler browser key

1. Create a MapTiler account.
2. Create a new browser API key instead of publishing the default testing key.
3. Restrict **Allowed HTTP origins** to the actual FloodNet hostnames. Enter one
   hostname per line; do not include `http://`, `https://` or a trailing slash:

   ```text
   localhost
   floodnet-staging.eba-nyev32ns.us-east-1.elasticbeanstalk.com
   floodnet.ashmabhattarai.com.np
   ```

4. Put the key in the uncommitted local `.env` file:

   ```env
   VITE_MAPTILER_API_KEY=your-origin-restricted-browser-key
   ```

5. Restart Vite after changing the value.

The browser key is read-only and visible in the compiled frontend by design. It
is not an AWS secret, but origin restrictions prevent another website from
using the FloodNet quota. Never place a MapTiler service token in a `VITE_`
variable.

## Elastic Beanstalk

Set the environment property without committing the value:

```powershell
$mapTilerBrowserKey = Read-Host 'MapTiler protected browser key'

aws elasticbeanstalk update-environment `
  --region us-east-1 `
  --environment-name floodnet-staging `
  --option-settings "Namespace=aws:elasticbeanstalk:application:environment,OptionName=VITE_MAPTILER_API_KEY,Value=$mapTilerBrowserKey"

$mapTilerBrowserKey = $null
```

The `.platform` predeploy and configuration hooks retrieve this public client
property before running the Vite build. Deploy the application again after
setting it, then confirm that the environment is `Ready` and `Green`.

## Failure behaviour

If the key is absent, rejected or the tile provider cannot be reached:

- forms keep manual, pasted and browser-GPS coordinate entry;
- records continue saving through the existing Express API;
- a clear non-blocking map fallback is shown; and
- a record with coordinates can still be opened in OpenStreetMap.

Map tiles do not make browser geolocation available. Deployed device GPS still
requires HTTPS.
