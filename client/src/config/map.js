import { NEPAL_BOUNDS } from '../utils/coordinates';

const mapTilerApiKey = (import.meta.env.VITE_MAPTILER_API_KEY || '').trim();

/**
 * MapTiler browser keys are intentionally public, read-only identifiers. The
 * production key must still be restricted to FloodNet's allowed HTTP origins
 * in MapTiler so another site cannot consume the project's quota.
 */
export const MAP_TILE_CONFIG = mapTilerApiKey
  ? {
      url: `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerApiKey)}`,
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 20
    }
  : null;

export const DEFAULT_NEPAL_MAP_VIEW = {
  latitude: 28.3949,
  longitude: 84.1240,
  zoom: 7
};

// This is a deliberately generous rectangular viewport around Nepal. It keeps
// every existing map centred on the application's operating country without
// treating a rectangle as an authoritative international border.
export const NEPAL_MAP_BOUNDS = [
  [NEPAL_BOUNDS.minLat, NEPAL_BOUNDS.minLon],
  [NEPAL_BOUNDS.maxLat, NEPAL_BOUNDS.maxLon]
];

export const NEPAL_MAP_MIN_ZOOM = 7;
export const NEPAL_MAP_MAX_ZOOM = 20;

export function hasValidCoordinates(latitude, longitude) {
  const latitudeMissing = latitude === null || latitude === undefined || String(latitude).trim() === '';
  const longitudeMissing = longitude === null || longitude === undefined || String(longitude).trim() === '';
  if (latitudeMissing || longitudeMissing) return false;

  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90
    && lon >= -180 && lon <= 180;
}

export function openStreetMapUrl(latitude, longitude, zoom = 16) {
  if (!hasValidCoordinates(latitude, longitude)) return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`;
}
