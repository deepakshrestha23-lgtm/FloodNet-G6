import { useState } from 'react';
import Icon from './Icon';
import { parseCoordinates, swapWouldFixNepal, isOutsideNepal } from '../../utils/coordinates';

/**
 * Optional GPS position, entered the way people actually have one to hand.
 *
 * Three routes in, because typing decimal degrees from memory is not one:
 * reading the device position, pasting from a map application, or typing the
 * numbers when they are already known. The section stays collapsed so the form
 * does not open looking like it demands a position it can manage without.
 *
 * A pair outside Nepal is flagged rather than blocked. The usual cause is a
 * transposed pair, which is offered as a one-click fix, but an officer working
 * a border area is not prevented from saving what they mean.
 */
function CoordinateField({
  latitude,
  longitude,
  onChange,
  disabled = false,
  helpText = 'Helps responders and drivers find the exact place. You can leave this empty.'
}) {
  const hasValue = latitude !== '' && latitude !== null && latitude !== undefined;
  const [open, setOpen] = useState(hasValue);
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const onlyOneSet =
    (latitude !== '' && latitude !== null) !== (longitude !== '' && longitude !== null);
  const suspectTransposed = hasValue && swapWouldFixNepal(latitude, longitude);
  const outsideNepal = hasValue && !suspectTransposed && isOutsideNepal(latitude, longitude);

  function set(nextLatitude, nextLongitude) {
    onChange({
      latitude: nextLatitude === null ? '' : String(nextLatitude),
      longitude: nextLongitude === null ? '' : String(nextLongitude)
    });
  }

  function applyPaste() {
    const parsed = parseCoordinates(paste);

    if (!parsed) {
      setPasteError('That did not look like a position. Try "27.6939, 85.3140" or paste a map link.');
      return;
    }

    setPasteError('');
    setPaste('');
    set(parsed.latitude.toFixed(6), parsed.longitude.toFixed(6));
  }

  function useMyLocation() {
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('This browser cannot read a location. Paste one from a map instead.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set(position.coords.latitude.toFixed(6), position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setLocationError('We could not read your location. Check the browser permission, or paste one from a map.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  if (!open) {
    return (
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <Icon name="pin" size={16} />
          Add GPS coordinates (optional)
        </button>
      </div>
    );
  }

  return (
    <fieldset className="border rounded-3 p-3 mb-3">
      <legend className="float-none w-auto px-2 fs-6 fw-semibold mb-0">
        GPS coordinates <span className="text-secondary fw-normal">(optional)</span>
      </legend>
      <p className="small text-secondary mb-3">{helpText}</p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
          onClick={useMyLocation}
          disabled={disabled || locating}
        >
          <Icon name="pin" size={16} />
          {locating ? 'Reading location...' : 'Use my location'}
        </button>
        {hasValue && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => set(null, null)}
            disabled={disabled}
          >
            Clear
          </button>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold" htmlFor="coordinate-paste">
          Or paste from a map application
        </label>
        <div className="d-flex flex-column flex-sm-row gap-2">
          <input
            id="coordinate-paste"
            className={`form-control ${pasteError ? 'is-invalid' : ''}`}
            value={paste}
            disabled={disabled}
            placeholder="27.6939, 85.3140 or a Google Maps link"
            onChange={(event) => { setPaste(event.target.value); setPasteError(''); }}
            onKeyDown={(event) => {
              // The field sits inside a larger form, so Enter must fill the
              // coordinates rather than submit the whole record.
              if (event.key === 'Enter') { event.preventDefault(); applyPaste(); }
            }}
          />
          <button
            type="button"
            className="btn btn-outline-secondary flex-shrink-0"
            onClick={applyPaste}
            disabled={disabled || !paste.trim()}
          >
            Use this
          </button>
        </div>
        {pasteError && <p className="form-text text-danger mb-0">{pasteError}</p>}
        <p className="form-text mb-0">
          In Google Maps, long-press the place and copy the numbers it shows.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-6">
          <label className="form-label small fw-semibold" htmlFor="coordinate-latitude">Latitude</label>
          <input
            id="coordinate-latitude"
            className="form-control"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            disabled={disabled}
            value={latitude ?? ''}
            onChange={(event) => onChange({ latitude: event.target.value, longitude: longitude ?? '' })}
          />
        </div>
        <div className="col-6">
          <label className="form-label small fw-semibold" htmlFor="coordinate-longitude">Longitude</label>
          <input
            id="coordinate-longitude"
            className="form-control"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            disabled={disabled}
            value={longitude ?? ''}
            onChange={(event) => onChange({ latitude: latitude ?? '', longitude: event.target.value })}
          />
        </div>
      </div>

      {onlyOneSet && (
        <p className="form-text text-danger mb-0 mt-2">
          Latitude and longitude must be filled in together, or both left empty.
        </p>
      )}

      {suspectTransposed && (
        <div className="alert alert-warning py-2 small mb-0 mt-3" role="alert">
          <strong>These look swapped.</strong> This position is outside Nepal, but it would be
          inside if the two values were the other way round.
          <button
            type="button"
            className="btn btn-sm btn-warning ms-2"
            onClick={() => set(longitude, latitude)}
            disabled={disabled}
          >
            Swap them
          </button>
        </div>
      )}

      {outsideNepal && (
        <p className="form-text text-warning mb-0 mt-2">
          This position is outside Nepal. Save it anyway if that is correct.
        </p>
      )}
    </fieldset>
  );
}

export default CoordinateField;
