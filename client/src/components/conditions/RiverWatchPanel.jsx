import { useState } from 'react';
import ConditionsPanel from './ConditionsPanel';

/**
 * Situational awareness for an officer who is not looking at a specific report.
 *
 * The reference points below are well-known locations on Nepal's main monsoon
 * rivers, given as approximate coordinates so an officer has somewhere to start
 * without typing numbers. They are map references, NOT official DHM gauge
 * stations, and nothing here should be read as an official gauge reading. An
 * officer who needs a precise location enters the coordinates directly.
 */
const REFERENCE_POINTS = [
  { id: 'bagmati-kathmandu', label: 'Bagmati at Kathmandu', latitude: 27.6939, longitude: 85.3140 },
  { id: 'koshi-chatara', label: 'Koshi at Chatara', latitude: 26.8690, longitude: 87.1560 },
  { id: 'rapti-nepalgunj', label: 'West Rapti near Nepalgunj', latitude: 28.0500, longitude: 81.6167 },
  { id: 'karnali-chisapani', label: 'Karnali at Chisapani', latitude: 28.6440, longitude: 81.2890 },
  { id: 'narayani-narayanghat', label: 'Narayani at Narayanghat', latitude: 27.6870, longitude: 84.4300 }
];

const CUSTOM = 'custom';

function RiverWatchPanel() {
  const [selectedId, setSelectedId] = useState(REFERENCE_POINTS[0].id);
  const [custom, setCustom] = useState({ latitude: '', longitude: '' });
  const [applied, setApplied] = useState(null);

  const preset = REFERENCE_POINTS.find((point) => point.id === selectedId);
  const usingCustom = selectedId === CUSTOM;

  const active = usingCustom ? applied : preset;

  function applyCustom(event) {
    event.preventDefault();
    const latitude = Number(custom.latitude);
    const longitude = Number(custom.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return;
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;

    setApplied({ latitude, longitude, label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
  }

  return (
    <div>
      <form className="panel-card p-3 p-md-4 rounded-4 mb-3" onSubmit={applyCustom}>
        <label className="form-label fw-semibold" htmlFor="river-watch-location">River watch location</label>
        <select
          id="river-watch-location"
          className="form-select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {REFERENCE_POINTS.map((point) => (
            <option key={point.id} value={point.id}>{point.label}</option>
          ))}
          <option value={CUSTOM}>Enter coordinates...</option>
        </select>

        {usingCustom ? (
          <div className="row g-2 mt-1">
            <div className="col-6 col-md-4">
              <label className="form-label small mb-1" htmlFor="river-watch-lat">Latitude</label>
              <input
                id="river-watch-lat"
                className="form-control"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={custom.latitude}
                onChange={(event) => setCustom((c) => ({ ...c, latitude: event.target.value }))}
              />
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label small mb-1" htmlFor="river-watch-lon">Longitude</label>
              <input
                id="river-watch-lon"
                className="form-control"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={custom.longitude}
                onChange={(event) => setCustom((c) => ({ ...c, longitude: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-4 d-flex align-items-end">
              <button className="btn btn-outline-primary w-100" type="submit">Check conditions</button>
            </div>
          </div>
        ) : (
          <p className="form-text mb-0">
            Approximate map references on Nepal's main monsoon rivers, not official gauge stations.
          </p>
        )}
      </form>

      {active
        ? (
          <ConditionsPanel
            key={`${active.latitude},${active.longitude}`}
            latitude={active.latitude}
            longitude={active.longitude}
            title={active.label}
          />
        )
        : (
          <section className="panel-card p-3 p-md-4 rounded-4">
            <p className="small text-secondary mb-0">Enter a latitude and longitude to check conditions.</p>
          </section>
        )}
    </div>
  );
}

export default RiverWatchPanel;
