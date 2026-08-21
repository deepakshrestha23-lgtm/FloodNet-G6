import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchOverview } from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import Icon from '../../components/common/Icon';
import ChartCard from '../../components/chart/ChartCard';

function AdminOverviewPage() {
  const loader = useCallback(() => fetchOverview(), []);
  const { data, loading, error, reload } = useApiResource(loader);

  const roleChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.usersByRole.map((row) => row.displayName),
      datasets: [
        {
          data: data.usersByRole.map((row) => row.total),
          backgroundColor: ['#0891b2', '#2563eb', '#e8820c', '#dc2743']
        }
      ]
    };
  }, [data]);

  const doughnutOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } }
  }), []);

  if (loading) return <LoadingState label="Loading administration overview..." />;
  if (error) return <ErrorState message={error.message} details={error.details} onRetry={reload} />;

  const { summary } = data;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="System governance. Report verification and alert publishing remain with the operational officer roles."
        icon="database"
        actions={
          <>
            <Link className="btn btn-outline-primary" to="/admin/users">
              <Icon name="users" size={16} />
              Manage users
            </Link>
            <Link className="btn btn-primary" to="/admin/audit">
              <Icon name="history" size={16} />
              View audit log
            </Link>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Total accounts"
            value={summary.totalUsers}
            hint={`${summary.activeUsers} active, ${summary.inactiveUsers} inactive`}
            icon="users"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Active accounts" value={summary.activeUsers} tone="success" icon="check" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Active risk areas"
            value={summary.activeZones}
            hint={`${summary.inactiveZones} inactive`}
            icon="map"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Audit entries (24h)"
            value={summary.auditEntriesToday}
            hint="Recorded state changes"
            icon="history"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <ChartCard
            title="Accounts by role"
            description="Distribution of accounts across the four FloodNet roles."
            type="doughnut"
            icon="users"
            data={roleChart}
            options={doughnutOptions}
            isEmpty={summary.totalUsers === 0}
          />
        </div>
        <div className="col-12 col-lg-7">
          <section className="panel-card h-100 p-3 p-md-4">
            <h2 className="h6 fw-bold fn-section-title mb-3">
              <Icon name="shield" size={18} />
              Role responsibilities
            </h2>
            <dl className="mb-0 small">
              <dt>Resident</dt>
              <dd className="text-secondary">Submits community flood reports and reads alerts and centre information.</dd>
              <dt>Flood Monitoring Officer</dt>
              <dd className="text-secondary">Reviews and verifies reports, and authors and publishes FloodNet alerts.</dd>
              <dt>Evacuation Officer</dt>
              <dd className="text-secondary">Maintains evacuation centres, capacity, occupancy and facilities.</dd>
              <dt>Administrator</dt>
              <dd className="text-secondary mb-0">
                Manages accounts, roles, jurisdictions, operational risk areas and master data, and reviews the audit trail.
                Administrators cannot verify reports or publish alerts.
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

export default AdminOverviewPage;
