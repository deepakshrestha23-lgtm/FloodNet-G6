import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
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
import Icon from '../../components/common/Icon';
import FloodMap from '../../components/map/FloodMap';
import { CENTRE_STATUS, toOptions } from '../../utils/enums';
import { getGeolocationAvailability } from '../../utils/coordinates';

/**
 * Shared by residents and public visitors. It renders only what the public
 * endpoint returns, which excludes operational notes and personal details.
 */
function CentreDirectoryPage({ eyebrow = 'Resident' }) {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);
  const [proximity, setProximity] = useState(null);
  const [locating, setLocating] = useState(false);

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
  const homeWard = user?.profile?.homeWard;
  const homeLocalLevelId = homeWard?.localLevel?.id;
  const scopedToHome = Boolean(homeLocalLevelId) && !proximity && !showingAll && !zoneId && !hasLocationFilter;
  const wardId = location.wardId || '';
  const effectiveLocalLevelId = location.localLevelId || (scopedToHome ? homeLocalLevelId : '');

  const loader = useCallback(
    () => fetchPublicCentres({
      zoneId: zoneId || undefined,
      wardId: wardId || undefined,
      provinceId: location.provinceId || undefined,
      districtId: location.districtId || undefined,
      localLevelId: effectiveLocalLevelId || undefined,
      latitude: proximity?.latitude,
      longitude: proximity?.longitude
    }),
    [zoneId, wardId, location.provinceId, location.districtId, effectiveLocalLevelId, proximity]
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
    ? `centres in ${homeWard.localLevel?.name}, ${homeWard.district?.name}`
    : '';

  function useCurrentLocation() {
    const geolocationAvailability = getGeolocationAvailability();
    if (geolocationAvailability === 'unsupported') {
      notify({ tone: 'warning', title: 'Location unavailable', message: 'This browser cannot read your position. Use the administrative filters instead.', icon: 'warning' });
      return;
    }
    if (geolocationAvailability === 'insecure') {
      notify({ tone: 'warning', title: 'HTTPS required for GPS', message: 'This deployed address is HTTP, so the browser blocks device location. Use the district and local-level filters for now.', icon: 'warning', duration: 8000 });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setProximity({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
        notify({ tone: 'success', title: 'Nearby centres ranked', message: 'Distances are straight-line estimates from your current position.', icon: 'pin' });
      },
      () => {
        setLocating(false);
        notify({ tone: 'warning', title: 'Location not available', message: 'Check browser location permission or use the district and local-level filters.', icon: 'warning', duration: 6000 });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function showAllOfNepal() {
    const next = new URLSearchParams(searchParams);
    next.delete('zoneId');
    next.set('area', 'all');
    setProximity(null);
    setSearchParams(next);
  }

  function resetFilters() {
    setProximity(null);
    setSearchParams(new URLSearchParams());
  }

  const totals = useMemo(() => centres.reduce((accumulator, centre) => ({
    capacity: accumulator.capacity + centre.maximumCapacity,
    available: accumulator.available + centre.availableSpace
  }), { capacity: 0, available: 0 }), [centres]);

  const centreMarkers = useMemo(() => centres.map((centre) => ({
    id: centre.id,
    latitude: centre.latitude,
    longitude: centre.longitude,
    title: centre.name,
    description: centre.locationDescription,
    detail: `${centre.availableSpace.toLocaleString()} spaces available`,
    tone: centre.operationalStatus === 'CLOSED'
      ? 'secondary'
      : centre.availableSpace === 0 ? 'danger'
        : centre.operationalStatus === 'NEAR_CAPACITY' ? 'warning' : 'success'
  })), [centres]);

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
            label: 'Operational risk area',
            type: 'select',
            placeholder: 'Any risk area',
            columnClass: 'col-12 col-sm-6 col-lg-4',
            options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
          }
        ]}
        values={{ ...location, status, zoneId }}
        onChange={updateFilter}
        onReset={resetFilters}
        resultSummary={data ? `${centres.length} of ${data.totalActive} centres${proximity ? ' ranked by proximity' : ''}` : ''}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div className="flex-grow-1">
            <LocationFilter value={location} onChange={updateLocation} labelPrefix="Where are you looking?" />
          </div>
          <button
            type="button"
            className={`btn btn-sm ${proximity ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={proximity ? () => setProximity(null) : useCurrentLocation}
            disabled={locating}
          >
            <Icon name="pin" size={15} />
            {locating ? 'Finding you...' : proximity ? 'Stop using location' : 'Use my current location'}
          </button>
        </div>
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

          {proximity && (
            <div className="fn-scope-notice d-flex align-items-center gap-2 mb-3" role="status">
              <Icon name="pin" size={16} />
              <span className="small">
                Centres are ranked using operational status, straight-line distance and available capacity.
                Confirm current route conditions before travelling.
              </span>
            </div>
          )}

          <AreaScopeNotice
            areaLabel={scopeLabel}
            shownCount={data.centres.length}
            totalCount={data.totalActive}
            onShowAll={showAllOfNepal}
            noun="centre"
          />

          {centres.length > 0 && (
            <section className="panel-card p-3 p-md-4 rounded-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                <div>
                  <h2 className="h6 fw-semibold mb-1">Centres on the map</h2>
                  <p className="small text-secondary mb-0">
                    Markers show centres that have exact coordinates. Always confirm road conditions before travelling.
                  </p>
                </div>
                <span className="small text-secondary">
                  {centreMarkers.filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)).length} mapped
                </span>
              </div>
              <FloodMap
                ariaLabel="Map of evacuation centres matching the current filters"
                height="24rem"
                markers={centreMarkers}
                center={proximity || undefined}
              />
            </section>
          )}

          {centres.length === 0 ? (
            <EmptyState
              title={scopeLabel ? "No centres near you match these filters" : "No evacuation centres match these filters"}
              description={
                scopeLabel && data.totalActive > 0
                  ? `Nothing matches near where you live. ${data.totalActive} centre${data.totalActive === 1 ? " is" : "s are"} listed elsewhere in Nepal.`
                  : "Try clearing the filters or selecting a different administrative area."
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
