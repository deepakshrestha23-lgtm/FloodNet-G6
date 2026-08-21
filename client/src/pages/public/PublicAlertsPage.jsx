import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchActiveAlerts, fetchVerifiedIncidents } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import AlertCard from '../../components/alert/AlertCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import FilterBar from '../../components/common/FilterBar';
import LocationFilter from '../../components/geography/LocationFilter';
import { OBSERVED_SEVERITY, ROAD_CONDITION } from '../../utils/enums';
import { describeArea, formatDateTime } from '../../utils/formatters';

/**
 * Every alert in effect across Nepal, reachable without an account.
 *
 * Someone deciding whether to leave their house should not have to register
 * first, so this is deliberately public. Alerts and verified incidents stay
 * visually separate: an alert is an official instruction, an incident is an
 * observation an officer has confirmed, and conflating the two would overstate
 * what the platform actually knows.
 */
function PublicAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Kept in the URL so a filtered view can be sent to someone else.
  const location = {
    provinceId: searchParams.get('provinceId') || '',
    districtId: searchParams.get('districtId') || '',
    localLevelId: searchParams.get('localLevelId') || '',
    wardId: searchParams.get('wardId') || ''
  };

  const loader = useCallback(async () => {
    const area = {
      provinceId: location.provinceId || undefined,
      districtId: location.districtId || undefined,
      localLevelId: location.localLevelId || undefined,
      wardId: location.wardId || undefined
    };

    const [alertPayload, incidentPayload] = await Promise.all([
      fetchActiveAlerts(area),
      fetchVerifiedIncidents({ ...area, limit: 30 })
    ]);

    return {
      data: {
        alerts: alertPayload.data.alerts,
        totalActive: alertPayload.data.totalActive,
        incidents: incidentPayload.data.incidents
      }
    };
  }, [location.provinceId, location.districtId, location.localLevelId, location.wardId]);

  const { data, loading, error, reload } = useApiResource(loader);

  function updateLocation(next) {
    const params = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(next)) {
      if (val) params.set(key, val); else params.delete(key);
    }
    setSearchParams(params);
  }

  return (
    <>
      <section className="public-page-head">
        <div className="container">
          <span className="eyebrow">
            <Icon name="bell" size={12} strokeWidth={2} />
            In effect now
          </span>
          <h1 className="public-section-title mt-3 mb-2">Active FloodNet alerts</h1>
          <p className="public-section-lead mb-0">
            Official warnings published by Flood Monitoring Officers, with the verified incidents
            behind them. Sign in and set your home ward to see your own area first.
          </p>
        </div>
      </section>

      <section className="public-section">
        <div className="container">
          <FilterBar
            values={location}
            onReset={() => setSearchParams(new URLSearchParams())}
            resultSummary={data ? `${data.alerts.length} of ${data.totalActive} active alerts` : ''}
          >
            <LocationFilter value={location} onChange={updateLocation} labelPrefix="Filter by location" />
          </FilterBar>

          {loading && <LoadingState label="Loading alerts..." />}
          {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

          {!loading && !error && data && (
            <>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <h2 className="h5 fw-bold mb-0">Official alerts</h2>
                <span className="fn-live-pill">
                  <span className="fn-live-dot" />
                  {data.alerts.length} active
                </span>
              </div>

              {data.alerts.length === 0 ? (
                <EmptyState
                  title={
                    Object.values(location).some(Boolean)
                      ? 'No active alerts for the selected area'
                      : 'No active alerts anywhere in Nepal'
                  }
                  description={
                    Object.values(location).some(Boolean) && data.totalActive > 0
                      ? `Nothing is in effect there. ${data.totalActive} alert${data.totalActive === 1 ? ' is' : 's are'} active elsewhere in Nepal.`
                      : 'No published FloodNet alerts are in effect right now. This page updates as officers publish them.'
                  }
                />
              ) : (
                <div className="row g-4">
                  {data.alerts.map((alert) => (
                    <div className="col-12 col-xl-6" key={alert.id}>
                      <AlertCard alert={alert} />
                    </div>
                  ))}
                </div>
              )}

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-5 pt-4 mb-3">
                <div>
                  <h2 className="h5 fw-bold mb-1">Verified incidents</h2>
                  <p className="small text-secondary mb-0">
                    Community reports an officer has assessed as sufficiently supported. These are
                    observations, not warnings, and not scientific flood measurements.
                  </p>
                </div>
                <Link className="btn btn-outline-primary btn-sm" to="/centres">
                  <Icon name="shelter" size={15} />
                  Find shelter
                </Link>
              </div>

              {data.incidents.length === 0 ? (
                <EmptyState
                  title="No verified incidents"
                  description="No community reports have been verified by an officer yet."
                />
              ) : (
                <div className="row g-3">
                  {data.incidents.map((incident) => (
                    <div className="col-12 col-lg-6" key={incident.reportReference}>
                      <article className="panel-card p-3 p-md-4 h-100 rounded-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                          <h3 className="h6 fw-bold mb-0">{describeArea(incident)}</h3>
                          <StatusBadge map={OBSERVED_SEVERITY} value={incident.observedSeverity} />
                        </div>
                        <p className="small text-secondary mb-2">{incident.locationDescription}</p>
                        <p className="mb-3 preserve-lines">{incident.incidentDescription}</p>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <StatusBadge map={ROAD_CONDITION} value={incident.roadCondition} />
                          <span className="small text-secondary ms-auto">
                            Observed {formatDateTime(incident.observedAt)}
                          </span>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

export default PublicAlertsPage;
