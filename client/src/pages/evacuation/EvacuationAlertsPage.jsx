import { useCallback } from 'react';
import { fetchEvacuationAlerts } from '../../services/centreApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AlertCard from '../../components/alert/AlertCard';

/**
 * The warnings an evacuation officer is responding to.
 *
 * Opening a shelter is a response to a warning, so the officer who makes that
 * call needs to see the warning inside the application rather than hearing
 * about it some other way. The view is deliberately read only: publishing an
 * alert remains with the flood monitoring officer.
 */
function EvacuationAlertsPage() {
  const loader = useCallback(() => fetchEvacuationAlerts(), []);
  const { data, loading, error, reload } = useApiResource(loader);

  return (
    <>
      <PageHeader
        eyebrow="Evacuation"
        title="Active alerts"
        icon="bell"
        description="Published warnings in effect across your assigned jurisdiction, most severe first."
      />

      {loading && <LoadingState label="Loading active alerts..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        data.alerts.length === 0 ? (
          <EmptyState
            title="No active alerts in your jurisdiction"
            description="Nothing published is currently in effect for the area you cover. Centres can still be opened or updated at any time."
          />
        ) : (
          <>
            <p className="small text-secondary mb-3">
              Published by a Flood Monitoring Officer. You cannot edit or publish alerts, but these are
              the warnings your evacuation centres are supporting.
            </p>
            <div className="row g-3">
              {data.alerts.map((alert) => (
                <div className="col-12 col-xl-6" key={alert.id}>
                  <AlertCard alert={alert} />
                </div>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}

export default EvacuationAlertsPage;
