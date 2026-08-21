import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  archiveCentre,
  fetchCentres,
  updateCentreStatus,
  updateOccupancy
} from '../../services/centreApi';
import { fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { CENTRE_STATUS, toOptions } from '../../utils/enums';
import { describeArea, formatDateTime, formatNumber } from '../../utils/formatters';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

/**
 * Occupancy is edited inline per centre, because during an incident an officer
 * updates numbers repeatedly and should not have to open a separate form.
 */
function CentreCard({ centre, onSaved, onArchiveRequest }) {
  const [occupancy, setOccupancy] = useState(String(centre.currentOccupancy));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setOccupancy(String(centre.currentOccupancy));
  }, [centre.currentOccupancy]);

  const occupancyRate = centre.maximumCapacity > 0
    ? Math.round((centre.currentOccupancy / centre.maximumCapacity) * 100)
    : 0;

  async function saveOccupancy(event) {
    event.preventDefault();
    const value = Number(occupancy);

    if (!Number.isInteger(value) || value < 0) {
      setError({ message: 'Occupancy must be zero or a positive whole number.' });
      return;
    }

    if (value > centre.maximumCapacity) {
      setError({ message: `Occupancy cannot exceed the capacity of ${centre.maximumCapacity}.` });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateOccupancy(centre.id, value);
      setSavedAt(new Date());
      await onSaved();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status) {
    setSaving(true);
    setError(null);

    try {
      await updateCentreStatus(centre.id, status);
      await onSaved();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="panel-card p-3 p-md-4 rounded-4 h-100 d-flex flex-column">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 className="h6 fw-semibold mb-1">{centre.name}</h3>
          <p className="small text-secondary mb-0">
            {describeArea(centre)} {centre.zone?.code && <span className="text-body-tertiary">({centre.zone.code})</span>}
          </p>
        </div>
        <StatusBadge map={CENTRE_STATUS} value={centre.operationalStatus} />
      </div>

      <p className="small mb-2">{centre.locationDescription}</p>
      {centre.contactPhone && (
        <p className="small text-secondary mb-2">Contact: {centre.contactPhone}</p>
      )}

      <div className="capacity-meter mb-1" role="img" aria-label={`${occupancyRate}% occupied`}>
        <div
          className={`capacity-meter-fill capacity-${centre.operationalStatus.toLowerCase()}`}
          style={{ width: `${Math.min(occupancyRate, 100)}%` }}
        />
      </div>
      <p className="small text-secondary mb-3">
        {formatNumber(centre.currentOccupancy)} of {formatNumber(centre.maximumCapacity)} occupied
        {' · '}
        <strong className={centre.availableSpace === 0 ? 'text-danger' : 'text-success'}>
          {formatNumber(centre.availableSpace)} available
        </strong>
      </p>

      {centre.facilities.length > 0 && (
        <ul className="list-unstyled d-flex flex-wrap gap-1 mb-3">
          {centre.facilities.map((facility) => (
            <li key={facility.code || facility.id} className="badge text-bg-light border">
              {facility.name}
            </li>
          ))}
        </ul>
      )}

      <form className="mt-auto" onSubmit={saveOccupancy}>
        <label className="form-label small fw-semibold" htmlFor={`occupancy-${centre.id}`}>
          Update current occupancy
        </label>
        <div className="input-group input-group-sm mb-2">
          <input
            id={`occupancy-${centre.id}`}
            type="number"
            className="form-control"
            min={0}
            max={centre.maximumCapacity}
            value={occupancy}
            onChange={(event) => setOccupancy(event.target.value)}
            disabled={saving}
          />
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <p className="form-text mt-0 mb-2">
          Available spaces are calculated automatically. Status follows occupancy unless the centre is closed.
        </p>

        <div className="d-flex flex-wrap gap-1">
          {centre.operationalStatus === 'CLOSED' ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => changeStatus('OPEN')}
              disabled={saving}
            >
              Reopen centre
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => changeStatus('CLOSED')}
              disabled={saving}
            >
              Close centre
            </button>
          )}
          <Link className="btn btn-sm btn-outline-primary" to={`/evacuation/centres/${centre.id}/edit`}>
            Edit
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => onArchiveRequest(centre)}
            disabled={saving}
          >
            Archive
          </button>
        </div>

        {savedAt && !error && (
          <p className="small text-success mb-0 mt-2" role="status">
            Saved at {formatDateTime(savedAt)}
          </p>
        )}
        {error && (
          <div className="alert alert-danger py-2 small mt-2 mb-0" role="alert">
            {error.message}
          </div>
        )}
      </form>
    </article>
  );
}

function CentreListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  const geography = useMemo(() => ({
    provinceId: searchParams.get('provinceId') || '',
    districtId: searchParams.get('districtId') || '',
    localLevelId: searchParams.get('localLevelId') || '',
    wardId: searchParams.get('wardId') || ''
  }), [searchParams]);

  const filters = useMemo(() => ({
    zoneId: searchParams.get('zoneId') || '',
    status: searchParams.get('status') || '',
    provinceId: searchParams.get('provinceId') || '',
    districtId: searchParams.get('districtId') || '',
    localLevelId: searchParams.get('localLevelId') || '',
    wardId: searchParams.get('wardId') || ''
  }), [searchParams]);

  const loader = useCallback(() => fetchCentres(filters), [filters]);
  const { data, loading, error, reload } = useApiResource(loader);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  function updateGeography(nextGeography) {
    const next = new URLSearchParams(searchParams);
    ['provinceId', 'districtId', 'localLevelId', 'wardId'].forEach((field) => {
      if (nextGeography[field]) next.set(field, nextGeography[field]);
      else next.delete(field);
    });
    setSearchParams(next);
  }

  async function confirmArchive() {
    if (!archiveTarget) return;

    setArchiving(true);
    setArchiveError(null);

    try {
      await archiveCentre(archiveTarget.id);
      setArchiveTarget(null);
      await reload();
    } catch (caughtError) {
      setArchiveError(caughtError);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Evacuation coordination"
        title="Evacuation centres"
        description="Maintain centre details, capacity and live occupancy."
        actions={<Link className="btn btn-primary" to="/evacuation/centres/new">Add centre</Link>}
      />

      <FilterBar
        filters={[
          {
            name: 'zoneId',
            label: 'Flood zone',
            type: 'select',
            options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
          },
          { name: 'status', label: 'Operational status', type: 'select', options: toOptions(CENTRE_STATUS) }
        ]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      <section className="panel-card p-3 rounded-4 mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div><h2 className="h6 fw-semibold mb-1">Administrative location</h2><p className="small text-secondary mb-0">Filter centres by the official Nepal hierarchy.</p></div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => updateGeography(EMPTY_GEOGRAPHY)}>Clear location</button>
        </div>
        <div className="mt-3 mb-0"><GeographySelector value={geography} onChange={updateGeography} required={false} /></div>
      </section>

      {loading && <LoadingState label="Loading centres..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        data.centres.length === 0 ? (
          <EmptyState
            title="No evacuation centres match these filters"
            description="Add a centre or clear the filters to see existing centres."
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('/evacuation/centres/new')}>
                Add centre
              </button>
            }
          />
        ) : (
          <div className="row g-3">
            {data.centres.map((centre) => (
              <div className="col-12 col-md-6 col-xl-4" key={centre.id}>
                <CentreCard centre={centre} onSaved={reload} onArchiveRequest={setArchiveTarget} />
              </div>
            ))}
          </div>
        )
      )}

      <ConfirmationModal
        open={Boolean(archiveTarget)}
        title="Archive this centre?"
        description="An archived centre stops appearing to residents and can no longer be edited. Its history is retained."
        confirmLabel="Archive centre"
        confirmVariant="danger"
        busy={archiving}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
      >
        {archiveTarget && (
          <div className="alert alert-light border mb-0">
            <strong>{archiveTarget.name}</strong>
            <span className="d-block small text-secondary">
              Currently {formatNumber(archiveTarget.currentOccupancy)} people recorded as accommodated.
            </span>
          </div>
        )}
        {archiveError && (
          <div className="alert alert-danger mt-3 mb-0 py-2 small" role="alert">{archiveError.message}</div>
        )}
      </ConfirmationModal>
    </>
  );
}

export default CentreListPage;
