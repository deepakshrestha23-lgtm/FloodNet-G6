import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchActiveAlerts, fetchPublicCentres } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import AlertCard from '../../components/alert/AlertCard';
import CentreSummaryCard from '../../components/centre/CentreSummaryCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { formatNumber } from '../../utils/formatters';

/**
 * The public landing page. It shows only non-sensitive information: published
 * alerts and evacuation centre availability. No resident details, officer notes
 * or audit information are exposed here.
 */
function PublicHomePage() {
  const { isAuthenticated, user } = useAuth();

  const loader = useCallback(async () => {
    const [alertPayload, centrePayload] = await Promise.all([
      fetchActiveAlerts(),
      fetchPublicCentres()
    ]);

    return {
      data: {
        alerts: alertPayload.data.alerts,
        centres: centrePayload.data.centres
      }
    };
  }, []);

  const { data, loading, error, reload } = useApiResource(loader);

  const dashboardPath = {
    RESIDENT: '/resident',
    FLOOD_MONITORING_OFFICER: '/officer',
    EVACUATION_OFFICER: '/evacuation',
    ADMINISTRATOR: '/admin'
  }[user?.role?.code] || '/resident';

  const availableSpaces = data
    ? data.centres.reduce((total, centre) => total + centre.availableSpace, 0)
    : 0;

  return (
    <main className="public-shell">
      <header className="public-hero">
        <div className="container py-5">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <span className="eyebrow">FloodNet</span>
            <nav className="d-flex gap-2" aria-label="Account">
              {isAuthenticated ? (
                <Link className="btn btn-light btn-sm" to={dashboardPath}>Go to my dashboard</Link>
              ) : (
                <>
                  <Link className="btn btn-outline-light btn-sm" to="/register">Create account</Link>
                  <Link className="btn btn-light btn-sm" to="/login">Sign in</Link>
                </>
              )}
            </nav>
          </div>

          <h1 className="display-5 fw-bold mb-3">Flood information people can trust.</h1>
          <p className="lead mb-4 public-hero-lead">
            Community reports, officer-verified incidents, official alerts and live evacuation centre
            availability — in one coordinated platform.
          </p>

          <div className="d-flex flex-wrap gap-3">
            <div className="public-stat">
              <span className="public-stat-value">{data ? data.alerts.length : '—'}</span>
              <span className="public-stat-label">Active alerts</span>
            </div>
            <div className="public-stat">
              <span className="public-stat-value">{data ? formatNumber(availableSpaces) : '—'}</span>
              <span className="public-stat-label">Evacuation spaces available</span>
            </div>
            <div className="public-stat">
              <span className="public-stat-value">{data ? data.centres.length : '—'}</span>
              <span className="public-stat-label">Evacuation centres</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-5">
        {loading && <LoadingState label="Loading current flood information..." />}
        {error && <ErrorState message={error.message} onRetry={reload} />}

        {!loading && !error && data && (
          <>
            <section className="mb-5">
              <h2 className="h4 fw-bold mb-1">Current FloodNet alerts</h2>
              <p className="text-secondary mb-3">
                Published by authorised Flood Monitoring Officers and currently in effect.
              </p>

              {data.alerts.length === 0 ? (
                <EmptyState
                  title="No active alerts"
                  description="There are no published FloodNet alerts in effect at the moment."
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

            <section className="mb-5">
              <h2 className="h4 fw-bold mb-1">Evacuation centre availability</h2>
              <p className="text-secondary mb-3">
                Capacity information maintained by evacuation officers.
              </p>

              {data.centres.length === 0 ? (
                <EmptyState title="No evacuation centres are currently listed" />
              ) : (
                <div className="row g-3">
                  {data.centres.slice(0, 6).map((centre) => (
                    <div className="col-12 col-md-6 col-xl-4" key={centre.id}>
                      <CentreSummaryCard centre={centre} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel-card p-4 rounded-4">
              <h2 className="h5 fw-bold mb-2">Seen flooding in your area?</h2>
              <p className="text-secondary mb-3">
                Residents can create an account to report flooding. Reports are reviewed by flood monitoring
                officers before they appear as verified incidents.
              </p>
              {!isAuthenticated && (
                <Link className="btn btn-primary" to="/register">Create a resident account</Link>
              )}
            </section>
          </>
        )}
      </div>

      <footer className="app-footer py-4">
        <div className="container">
          <p className="small text-secondary mb-0">
            FloodNet distinguishes community reports, officer-verified incidents and official alerts.
            In a life-threatening emergency, contact your local emergency services.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default PublicHomePage;
