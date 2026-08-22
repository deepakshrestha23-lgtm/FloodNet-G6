import { lazy, Suspense, useMemo, useState } from 'react';
import Icon from '../common/Icon';
import {
  DEFAULT_NEPAL_MAP_VIEW,
  MAP_TILE_CONFIG,
  NEPAL_MAP_BOUNDS,
  NEPAL_MAP_MAX_ZOOM,
  NEPAL_MAP_MIN_ZOOM,
  hasValidCoordinates,
  openStreetMapUrl
} from '../../config/map';

const LeafletMapCanvas = lazy(() => import('./LeafletMapCanvas'));

function normaliseMarker(marker, index) {
  if (!hasValidCoordinates(marker?.latitude, marker?.longitude)) return null;

  return {
    id: marker.id || `map-marker-${index}`,
    latitude: Number(marker.latitude),
    longitude: Number(marker.longitude),
    title: marker.title || 'Selected location',
    description: marker.description || '',
    detail: marker.detail || '',
    tone: marker.tone || 'primary'
  };
}

/**
 * Reusable, read-only-by-default FloodNet map.
 *
 * It never fetches reports or centres itself. Callers supply only the records
 * that the current API route has already authorised, preserving the existing
 * public/resident/officer data boundaries.
 */
function FloodMap({
  markers = [],
  center,
  zoom,
  onSelect,
  height = '20rem',
  ariaLabel = 'Location map',
  emptyMessage = 'No exact coordinates are available for this location.'
}) {
  const [tileFailed, setTileFailed] = useState(false);
  const validMarkers = useMemo(
    () => markers.map(normaliseMarker).filter(Boolean),
    [markers]
  );

  const mapCenter = hasValidCoordinates(center?.latitude, center?.longitude)
    ? { latitude: Number(center.latitude), longitude: Number(center.longitude) }
    : validMarkers[0] || DEFAULT_NEPAL_MAP_VIEW;

  const firstLocationUrl = validMarkers.length === 1
    ? openStreetMapUrl(validMarkers[0].latitude, validMarkers[0].longitude)
    : null;

  if (!MAP_TILE_CONFIG || tileFailed) {
    return (
      <div className="fn-map-fallback" style={{ '--fn-map-height': height }} role="status">
        <span className="fn-map-fallback-icon"><Icon name="map" size={24} /></span>
        <div>
          <p className="fw-semibold mb-1">Interactive map unavailable</p>
          <p className="small text-secondary mb-2">
            The map background could not be displayed. Coordinates and all other FloodNet location
            features continue to work normally.
          </p>
          {firstLocationUrl && (
            <a href={firstLocationUrl} target="_blank" rel="noreferrer noopener" className="small">
              Open this location in OpenStreetMap
            </a>
          )}
        </div>
      </div>
    );
  }

  if (validMarkers.length === 0 && !onSelect) {
    return (
      <div className="fn-map-empty" role="status">
        <Icon name="pin" size={20} />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="fn-map" style={{ '--fn-map-height': height }} role="region" aria-label={ariaLabel}>
      <Suspense fallback={<div className="fn-map-loading">Loading map…</div>}>
        <LeafletMapCanvas
          center={mapCenter}
          zoom={zoom || (validMarkers.length === 0 ? DEFAULT_NEPAL_MAP_VIEW.zoom : 16)}
          markers={validMarkers}
          onSelect={onSelect}
          onTileError={() => setTileFailed(true)}
          tileConfig={MAP_TILE_CONFIG}
          mapBounds={NEPAL_MAP_BOUNDS}
          minZoom={NEPAL_MAP_MIN_ZOOM}
          maxZoom={NEPAL_MAP_MAX_ZOOM}
        />
      </Suspense>
      {onSelect && (
        <div className="fn-map-instruction">
          <Icon name="pin" size={14} />
          Click or tap the map to set the exact coordinates.
        </div>
      )}
    </div>
  );
}

export default FloodMap;
