import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MARKER_COLOURS = {
  primary: '#0891b2',
  success: '#0f9d6f',
  warning: '#e8820c',
  danger: '#dc2743',
  info: '#2563eb',
  secondary: '#64748b'
};

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      if (!onSelect) return;
      onSelect({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6))
      });
    }
  });

  return null;
}

function ViewportController({ center, markers, zoom }) {
  const map = useMap();
  const markerKey = markers
    .map((marker) => `${marker.latitude},${marker.longitude}`)
    .join('|');

  useEffect(() => {
    if (markers.length > 1) {
      map.fitBounds(
        markers.map((marker) => [marker.latitude, marker.longitude]),
        { padding: [36, 36], maxZoom: 15 }
      );
      return;
    }

    map.setView([center.latitude, center.longitude], zoom, { animate: false });
  }, [center.latitude, center.longitude, map, markerKey, markers, zoom]);

  return null;
}

function LeafletMapCanvas({
  center,
  zoom,
  markers,
  onSelect,
  onTileError,
  tileConfig,
  mapBounds,
  minZoom,
  maxZoom
}) {
  const initialCenter = useMemo(
    () => [center.latitude, center.longitude],
    [center.latitude, center.longitude]
  );

  return (
    <MapContainer
      center={initialCenter}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={mapBounds}
      maxBoundsViscosity={1}
      scrollWheelZoom={false}
      className="fn-map-canvas"
    >
      <TileLayer
        url={tileConfig.url}
        attribution={tileConfig.attribution}
        tileSize={tileConfig.tileSize}
        zoomOffset={tileConfig.zoomOffset}
        maxZoom={tileConfig.maxZoom}
        eventHandlers={{ tileerror: onTileError }}
      />
      <MapClickHandler onSelect={onSelect} />
      <ViewportController center={center} markers={markers} zoom={zoom} />

      {markers.map((marker) => {
        const colour = MARKER_COLOURS[marker.tone] || MARKER_COLOURS.primary;
        return (
          <CircleMarker
            key={marker.id}
            center={[marker.latitude, marker.longitude]}
            radius={9}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: colour, fillOpacity: 0.95 }}
          >
            <Popup>
              <strong>{marker.title}</strong>
              {marker.description && <span className="d-block mt-1">{marker.description}</span>}
              {marker.detail && <span className="d-block text-secondary mt-1">{marker.detail}</span>}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default LeafletMapCanvas;
