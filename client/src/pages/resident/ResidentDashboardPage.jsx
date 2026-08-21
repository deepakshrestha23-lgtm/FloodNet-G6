import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchMyReports } from '../../services/reportApi';
import { fetchActiveAlerts, fetchPublicCentres } from '../../services/publicApi';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import AlertCard from '../../components/alert/AlertCard';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import Icon from '../../components/common/Icon';
import { REPORT_STATUS } from '../../utils/enums';
import { describeArea, formatRelative, formatNumber } from '../../utils/formatters';

function ResidentDashboardPage() {
  const { user } = useAuth();
  const homeZoneId = user?.profile?.homeZoneId;

  const [state, setState] = useState({ loading: true, error: null, reports: null, alerts: [], centres: [] });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // Alerts are scoped to the resident's home zone when they have set one,
        // so the first thing they see is what affects where they live.
        const [reportPayload, alertPayload, centrePayload] = await Promise.all([
          fetchMyReports({ limit: 5 }),
          fetchActiveAlerts(homeZoneId || undefined),
          fetchPublicCentres(homeZoneId || undefined)
        ]);

        if (!active) return;

        setState({
          loading: false,
          error: null,
          reports: reportPayload.data,
          alerts: alertPayload.data.alerts,
          centres: centrePayload.data.centres
        });
      } catch (error) {
        if (active) setState({ loading: false, error, reports: null, alerts: [], centres: [] });
      }
    }

    load();
    return () => { active = false; };
  }, [homeZoneId]);

  if (state.loading) return <LoadingState label="Loading your dashboard..." />;
  if (state.error) return <ErrorState message={state.error.message} details={state.error.details} />;

  const { reports, alerts, centres } = state;
  const availableSpaces = centres.reduce((total, centre) => total + centre.availableSpace, 0);
  const openCentres = centres.filter((centre) => centre.operationalStatus !== 'CLOSED').length;
  const awaitingAction = reports.reports.filter(
    (report) => report.status === 'MORE_INFORMATION_REQUIRED'
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Resident"
        title={`Welcome back, ${user?.profile?.firstName || 'resident'}`}
        description="Your reports, the alerts affecting your area, and where shelter is available."
        icon="dashboard"
        actions={(
          <Link className="btn btn-primary" to="/resident/reports/new">
            <Icon name="plus" size={16} strokeWidth={2.2} />
            Report flooding
          </Link>
        )}
      />

      {awaitingAction > 0 && (
        <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2" role="alert">
          <span>
            <strong>{awaitingAction}</strong> of your reports {awaitingAction === 1 ? 'needs' : 'need'} more information
            before an officer can complete the review.
          </span>
          <Link className="btn btn-sm btn-info" to="/resident/reports?status=MORE_INFORMATION_REQUIRED">
            Review them
          </Link>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Your reports" value={reports.pagination.total} icon="report" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Active alerts"
            value={alerts.length}
            hint={homeZoneId ? 'In your home zone' : 'Across all zones'}
            tone={alerts.length > 0 ? 'danger' : 'default'}
            icon="bell"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Centres available" value={openCentres} hint={`${centres.length} nearby`} icon="shelter" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Spaces available"
            value={availableSpaces}
            tone={availableSpaces === 0 ? 'danger' : 'success'}
            icon="people"
          />
        </div>
      </div>

      <section className="mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="h5 fw-bold mb-0 fn-section-title">
            <Icon name="bell" size={18} />
            Active alerts {homeZoneId ? 'for your area' : ''}
          </h2>
          <Link className="btn btn-sm btn-outline-primary" to="/resident/alerts">View all alerts</Link>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            title="No active alerts"
            description="There are no published FloodNet alerts in effect for your area right now."
          />
        ) : (
          <div className="row g-3">
            {alerts.slice(0, 2).map((alert) => (
              <div className="col-12 col-xl-6" key={alert.id}>
                <AlertCard alert={alert} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="h5 fw-bold mb-0 fn-section-title"><Icon name="report" size={18} />Your recent reports</h2>
          <Link className="btn btn-sm btn-outline-primary" to="/resident/reports">View all reports</Link>
        </div>

        {reports.reports.length === 0 ? (
          <EmptyState
            title="You have not submitted any reports"
            description="Reporting what you can see helps officers build an accurate picture of the flooding."
            action={<Link className="btn btn-primary" to="/resident/reports/new">Report flooding</Link>}
          />
        ) : (
          <div className="panel-card p-0 overflow-hidden">
            <ul className="list-group list-group-flush">
              {reports.reports.map((report) => (
                <li className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2" key={report.id}>
                  <div>
                    <Link className="fw-semibold text-decoration-none" to={`/resident/reports/${report.id}`}>
                      {report.reportReference}
                    </Link>
                    <span className="d-block small text-secondary">
                      {describeArea(report)} · {formatRelative(report.createdAt)}
                    </span>
                  </div>
                  <StatusBadge map={REPORT_STATUS} value={report.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="small text-secondary mt-4 mb-0">
        Community reports are observations submitted by residents. Verified incidents have been assessed by a
        Flood Monitoring Officer. Alerts are official FloodNet warnings. Currently showing
        {' '}{formatNumber(centres.length)} evacuation centre(s) for your area.
      </p>
    </>
  );
}

export default ResidentDashboardPage;
