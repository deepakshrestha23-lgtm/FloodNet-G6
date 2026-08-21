import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchPublicCentres, fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import FilterBar from '../../components/common/FilterBar';
import CentreSummaryCard from '../../components/centre/CentreSummaryCard';
import AreaScopeNotice from '../../components/common/AreaScopeNotice';
import LocationFilter from '../../components/geography/LocationFilter';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import { CENTRE_STATUS, toOptions } from '../../utils/enums';

/**
 * Shared by residents and public visitors. It renders only what the public
 * endpoint returns, which excludes operational notes and personal details.
 */
function CentreDirectoryPage({ eyebrow = 'Resident' }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);

  const zoneId = searchParams.get('zoneId') || '';
  const status = searchParams.get('status') || '';

  /*
   * Administrative location comes from the URL so a filtered view can be
   * shared or reloaded, which matters when someone sends a link to a relative
   * looking for shelter.
   */
  const location = {
    provinceId: searchParams.get('provinceId') || '',
    districtId: searchParams.get('districtId') || '',
    localLevelId: searchParams.get('localLevelId') || '',
    wardId: searchParams.get('wardId') || ''
  };
  const hasLocationFilter = Object.values(location).some(Boolean);

  /*
   * A signed-in resident starts with the centres near where they live, which
   * is what the dashboard already did. Anonymous visitors, and anyone who has
   * asked for everything or picked a zone, see the whole country.
   */
  const showingAll = searchParams.get('area') === 'all';
  const homeWardId = user?.profile?.homeWardId;
  const homeWard = user?.profile?.homeWard;
  const scopedToHome = Boolean(homeWardId) && !showingAll && !zoneId && !hasLocationFilter;
  const wardId = scopedToHome ? homeWardId : (location.wardId || '');

  const loader = useCallback(
    () => fetchPublicCentres({
      zoneId: zoneId || undefined,
      wardId: wardId || undefined,
      provinceId: location.provinceId || undefined,
      districtId: location.districtId || undefined,
      localLevelId: location.localLevelId || undefined
    }),
    [zoneId, wardId, location.provinceId, location.districtId, location.localLevelId]
  );

  function updateLocation(next) {
    const params = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(next)) {
      if (val) params.set(key, val); else params.delete(key);
    }
    // Choosing a place is an explicit override of the home-area default.
    if (Object.values(next).some(Boolean)) params.set('area', 'all');
    setSearchParams(params);
  }
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

  const scopeLabel = scopedToHome && homeWard
    ? `centres near ${homeWard.name}, ${homeWard.localLevel?.name}, ${homeWard.district?.name}`
    : '';

  function showAllOfNepal() {
    const next = new URLSearchParams(searchParams);
    next.delete('zoneId');
    next.set('area', 'all');
    setSearchParams(next);
  }

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
          { name: 'status', label: 'Availability', type: 'select', options: toOptions(CENTRE_STATUS), columnClass: 'col-12 col-sm-6 col-lg-3' },
          {
            name: 'zoneId',
            label: 'Operational zone',
            type: 'select',
            placeholder: 'Any zone',
            columnClass: 'col-12 col-sm-6 col-lg-4',
            options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
          }
        ]}
        values={{ ...location, status, zoneId }}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
        resultSummary={data ? `${centres.length} of ${data.totalActive} centres` : ''}
      >
        <LocationFilter value={location} onChange={updateLocation} labelPrefix="Where are you looking?" />
      </FilterBar>

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

          <AreaScopeNotice
            areaLabel={scopeLabel}
            shownCount={data.centres.length}
            totalCount={data.totalActive}
            onShowAll={showAllOfNepal}
            noun="centre"
          />

          {centres.length === 0 ? (
            <EmptyState
              title={scopeLabel ? "No centres near you match these filters" : "No evacuation centres match these filters"}
              description={
                scopeLabel && data.totalActive > 0
                  ? `Nothing matches near where you live. ${data.totalActive} centre${data.totalActive === 1 ? " is" : "s are"} listed elsewhere in Nepal.`
                  : "Try clearing the filters or selecting a different flood zone."
              }
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
