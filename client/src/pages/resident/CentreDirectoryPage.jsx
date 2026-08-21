import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPublicCentres, fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import FilterBar from '../../components/common/FilterBar';
import CentreSummaryCard from '../../components/centre/CentreSummaryCard';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import { CENTRE_STATUS, toOptions } from '../../utils/enums';

/**
 * Shared by residents and public visitors. It renders only what the public
 * endpoint returns, which excludes operational notes and personal details.
 */
function CentreDirectoryPage({ eyebrow = 'Resident' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);

  const zoneId = searchParams.get('zoneId') || '';
  const status = searchParams.get('status') || '';

  const loader = useCallback(() => fetchPublicCentres(zoneId || undefined), [zoneId]);
  const { data, loading, error, reload } = useApiResource(loader);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  const centres = useMemo(() => {
    if (!data) return [];
    return status ? data.centres.filter((centre) => centre.operationalStatus === status) : data.centres;
  }, [data, status]);

  const totals = useMemo(() => centres.reduce((accumulator, centre) => ({
    capacity: accumulator.capacity + centre.maximumCapacity,
    available: accumulator.available + centre.availableSpace
  }), { capacity: 0, available: 0 }), [centres]);

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title="Evacuation centres"
        icon="shelter"
        description="Where shelter is available right now, kept up to date by evacuation officers."
      />

      <FilterBar
        filters={[
          {
            name: 'zoneId',
            label: 'Flood zone',
            type: 'select',
            options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
          },
          { name: 'status', label: 'Availability', type: 'select', options: toOptions(CENTRE_STATUS) }
        ]}
        values={{ zoneId, status }}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading evacuation centres..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-4">
              <DashboardStatCard label="Centres shown" value={centres.length} />
            </div>
            <div className="col-6 col-lg-4">
              <DashboardStatCard label="Total capacity" value={totals.capacity} />
            </div>
            <div className="col-12 col-lg-4">
              <DashboardStatCard
                label="Spaces available"
                value={totals.available}
                tone={totals.available === 0 ? 'danger' : 'success'}
              />
            </div>
          </div>

          {centres.length === 0 ? (
            <EmptyState
              title="No evacuation centres match these filters"
              description="Try clearing the filters or selecting a different flood zone."
            />
          ) : (
            <div className="row g-3">
              {centres.map((centre) => (
                <div className="col-12 col-md-6 col-xl-4" key={centre.id}>
                  <CentreSummaryCard centre={centre} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default CentreDirectoryPage;
