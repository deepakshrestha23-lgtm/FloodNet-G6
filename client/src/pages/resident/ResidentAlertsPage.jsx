import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchActiveAlerts, fetchVerifiedIncidents, fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import FilterBar from '../../components/common/FilterBar';
import AlertCard from '../../components/alert/AlertCard';
import AreaScopeNotice from '../../components/common/AreaScopeNotice';
import StatusBadge from '../../components/common/StatusBadge';
import { OBSERVED_SEVERITY, ROAD_CONDITION } from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';

function ResidentAlertsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);

  const zoneId = searchParams.get('zoneId') || user?.profile?.homeZoneId || '';
  // An explicit zone filter from the URL is a deliberate override, so the
  // resident's home ward is only applied while they are not filtering.
  const wardId = searchParams.get('zoneId') ? '' : (user?.profile?.homeWardId || '');

  // "showAll" is an explicit override the resident can reach from the notice
  // below, so being scoped to a home area is never a dead end.
  const showingAll = searchParams.get('area') === 'all';
  const effectiveZoneId = showingAll ? '' : zoneId;
  const effectiveWardId = showingAll ? '' : wardId;

  const loader = useCallback(async () => {
    const [alertPayload, incidentPayload] = await Promise.all([
      fetchActiveAlerts({ zoneId: effectiveZoneId || undefined, wardId: effectiveWardId || undefined }),
      fetchVerifiedIncidents({ zoneId: effectiveZoneId || undefined, wardId: effectiveWardId || undefined, limit: 25 })
    ]);

    return {
      data: {
        alerts: alertPayload.data.alerts,
        totalActive: alertPayload.data.totalActive,
        incidents: incidentPayload.data.incidents
      }
    };
  }, [effectiveZoneId, effectiveWardId]);

  const { data, loading, error, reload } = useApiResource(loader);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  const filters = useMemo(() => ({ zoneId: effectiveZoneId }), [effectiveZoneId]);

  const homeWard = user?.profile?.homeWard;
  const scopeLabel = showingAll || !(effectiveZoneId || effectiveWardId)
    ? ''
    : (effectiveWardId && homeWard
        ? `alerts for ${homeWard.name}, ${homeWard.localLevel?.name}, ${homeWard.district?.name}`
        : 'alerts for the selected area');

  function showAllOfNepal() {
    const next = new URLSearchParams(searchParams);
    next.delete('zoneId');
    next.set('area', 'all');
    setSearchParams(next);
  }

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  return (
    <>
      <PageHeader
        eyebrow="Resident"
        title="Alerts and verified incidents"
        icon="bell"
        description="Official FloodNet alerts and officer-verified incidents are listed separately."
      />

      <FilterBar
        filters={[{
          name: 'zoneId',
          label: 'Flood zone',
          type: 'select',
          placeholder: 'All zones',
          columnClass: 'col-12 col-md-6 col-lg-4',
          options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
        }]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading alerts..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <section className="mb-5">
            <h2 className="h5 fw-bold mb-1">Active FloodNet alerts</h2>
            <p className="small text-secondary mb-3">
              Published by an authorised Flood Monitoring Officer and currently in effect.
            </p>

            <AreaScopeNotice
              areaLabel={scopeLabel}
              shownCount={data.alerts.length}
              totalCount={data.totalActive}
              onShowAll={showAllOfNepal}
              noun="alert"
            />

            {data.alerts.length === 0 ? (
              <EmptyState
                title={scopeLabel ? 'No active alerts for your area' : 'No active alerts'}
                description={
                  scopeLabel && data.totalActive > 0
                    ? `Nothing is in effect where you live. ${data.totalActive} alert${data.totalActive === 1 ? ' is' : 's are'} active elsewhere in Nepal.`
                    : 'No published alerts are in effect anywhere in Nepal right now.'
                }
              />
            ) : (
              <div className="row g-3">
                {data.alerts.map((alert) => (
                  <div className="col-12 col-xl-6" key={alert.id}>
                    <AlertCard alert={alert} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="h5 fw-bold mb-1">Verified incidents</h2>
            <p className="small text-secondary mb-3">
              Community reports an officer has assessed as sufficiently supported. These are not scientific
              flood measurements and are not warnings in themselves.
            </p>

            {data.incidents.length === 0 ? (
              <EmptyState
                title="No verified incidents"
                description="No community reports for this area have been verified yet."
              />
            ) : (
              <div className="row g-3">
                {data.incidents.map((incident) => (
                  <div className="col-12 col-md-6 col-xl-4" key={incident.reportReference}>
                    <article className="panel-card p-3 rounded-4 h-100">
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        <StatusBadge map={OBSERVED_SEVERITY} value={incident.observedSeverity} />
                        <StatusBadge map={ROAD_CONDITION} value={incident.roadCondition} />
                      </div>
                      <h3 className="h6 fw-semibold mb-1">{incident.geography ? `${incident.geography.ward.name}, ${incident.geography.district.name}` : incident.zone?.name || 'Location not specified'}</h3>
                      <p className="small text-secondary mb-2">{incident.locationDescription}</p>
                      <p className="small mb-2 preserve-lines">{incident.incidentDescription}</p>
                      <p className="small text-secondary mb-0">
                        Observed {formatDateTime(incident.observedAt)} · {incident.reportReference}
                      </p>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default ResidentAlertsPage;
