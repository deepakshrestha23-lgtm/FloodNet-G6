import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchActiveAlerts, fetchVerifiedIncidents } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import AlertCard from '../../components/alert/AlertCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
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
  const loader = useCallback(async () => {
    const [alertPayload, incidentPayload] = await Promise.all([
      fetchActiveAlerts(),
      fetchVerifiedIncidents({ limit: 30 })
    ]);

    return {
      data: {
        alerts: alertPayload.data.alerts,
        incidents: incidentPayload.data.incidents
      }
    };
  }, []);

  const { data, loading, error, reload } = useApiResource(loader);

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
                  title="No active alerts anywhere in Nepal"
                  description="No published FloodNet alerts are in effect right now. This page updates as officers publish them."
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
