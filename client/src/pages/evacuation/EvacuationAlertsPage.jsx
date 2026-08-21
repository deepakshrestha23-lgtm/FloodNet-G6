import { useCallback } from 'react';
import { fetchEvacuationAlerts, fetchEvacuationIncidents } from '../../services/centreApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AlertCard from '../../components/alert/AlertCard';
import StatusBadge from '../../components/common/StatusBadge';
import { OBSERVED_SEVERITY, ROAD_CONDITION } from '../../utils/enums';
import { describeArea, formatDateTime } from '../../utils/formatters';

/**
 * The warnings an evacuation officer is responding to.
 *
 * Opening a shelter is a response to a warning, so the officer who makes that
 * call needs to see the warning inside the application rather than hearing
 * about it some other way. The view is deliberately read only: publishing an
 * alert remains with the flood monitoring officer.
 */
function EvacuationAlertsPage() {
  const loader = useCallback(async () => {
    const [alerts, incidents] = await Promise.all([
      fetchEvacuationAlerts(),
      fetchEvacuationIncidents()
    ]);

    return {
      data: {
        alerts: alerts.data.alerts,
        incidents: incidents.data.incidents
      }
    };
  }, []);
  const { data, loading, error, reload } = useApiResource(loader);

  return (
    <>
      <PageHeader
        eyebrow="Evacuation"
        title="Alerts and verified incidents"
        icon="bell"
        description="Published warnings in effect across your assigned jurisdiction, most severe first."
      />

      {loading && <LoadingState label="Loading jurisdiction situation..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="d-grid gap-5">
          <section>
            <h2 className="h5 fw-bold mb-1">Published alerts</h2>
            <p className="small text-secondary mb-3">
              Published by a Flood Monitoring Officer. You cannot edit or publish alerts, but these are
              the warnings your evacuation centres are supporting.
            </p>
            {data.alerts.length === 0 ? (
              <EmptyState
                title="No active alerts in your jurisdiction"
                description="Nothing published is currently in effect for the area you cover. Centres can still be opened or updated at any time."
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
              Confirmed community observations in your jurisdiction. They support planning but are not published warnings or verified route-safety statements.
            </p>
            {data.incidents.length === 0 ? (
              <EmptyState title="No verified incidents in your jurisdiction" description="No relevant community reports are currently verified." />
            ) : (
              <div className="row g-3">
                {data.incidents.map((incident) => (
                  <div className="col-12 col-lg-6" key={incident.reportReference}>
                    <article className="panel-card p-3 p-md-4 h-100 rounded-4">
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <h3 className="h6 fw-bold mb-0">{describeArea(incident)}</h3>
                        <div className="d-flex flex-wrap gap-1">
                          <StatusBadge map={OBSERVED_SEVERITY} value={incident.observedSeverity} />
                          <StatusBadge map={ROAD_CONDITION} value={incident.roadCondition} />
                        </div>
                      </div>
                      <p className="small text-secondary mb-2">{incident.locationDescription}</p>
                      <p className="mb-3 preserve-lines">{incident.incidentDescription}</p>
                      <p className="small text-secondary mb-0">
                        Observed {formatDateTime(incident.observedAt)} · {incident.reportReference}
                      </p>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default EvacuationAlertsPage;
