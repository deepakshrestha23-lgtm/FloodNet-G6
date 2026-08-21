import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../../services/officerApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import RiverWatchPanel from '../../components/conditions/RiverWatchPanel';
import Icon from '../../components/common/Icon';
import ChartCard from '../../components/chart/ChartCard';
import { REPORT_STATUS, OBSERVED_SEVERITY, describe } from '../../utils/enums';
import { formatDate } from '../../utils/formatters';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

const CHART_COLOURS = ['#0891b2', '#0f9d6f', '#e8820c', '#dc2743', '#7c5cf0', '#64748b'];

function OfficerDashboardPage() {
  const [geography, setGeography] = useState(EMPTY_GEOGRAPHY);
  const loader = useCallback(() => fetchDashboard(geography), [geography]);
  const { data, loading, error, reload } = useApiResource(loader);

  const trendChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.trend.map((point) => formatDate(point.day)),
      datasets: [
        {
          label: 'Reports submitted',
          data: data.trend.map((point) => point.submitted),
          borderColor: '#0891b2',
          backgroundColor: 'rgba(8, 145, 178, 0.16)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Verified',
          data: data.trend.map((point) => point.verified),
          borderColor: '#0f9d6f',
          backgroundColor: 'rgba(15, 157, 111, 0.16)',
          fill: true,
          tension: 0.3
        }
      ]
    };
  }, [data]);

  const zoneChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.reportsByZone.map((row) => row.zoneName),
      datasets: [
        {
          label: 'Pending',
          data: data.reportsByZone.map((row) => row.pending),
          backgroundColor: '#e8820c'
        },
        {
          label: 'Verified',
          data: data.reportsByZone.map((row) => row.verified),
          backgroundColor: '#0f9d6f'
        }
      ]
    };
  }, [data]);

  const statusChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.reportsByStatus.map((row) => describe(REPORT_STATUS, row.status).label),
      datasets: [
        {
          data: data.reportsByStatus.map((row) => row.total),
          backgroundColor: CHART_COLOURS
        }
      ]
    };
  }, [data]);

  const severityChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.reportsBySeverity.map((row) => describe(OBSERVED_SEVERITY, row.severity).label),
      datasets: [
        {
          label: 'Reports',
          data: data.reportsBySeverity.map((row) => row.total),
          backgroundColor: '#0891b2'
        }
      ]
    };
  }, [data]);

  const barOptions = useMemo(() => ({
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: { legend: { position: 'bottom' } }
  }), []);

  const lineOptions = useMemo(() => ({
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { position: 'bottom' } }
  }), []);

  const singleBarOptions = useMemo(() => ({
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { display: false } }
  }), []);

  const doughnutOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } }
  }), []);

  if (loading) return <LoadingState label="Loading the situation dashboard..." />;
  if (error) return <ErrorState message={error.message} details={error.details} onRetry={reload} />;

  const { summary } = data;

  return (
    <>
      <PageHeader
        eyebrow="Flood monitoring"
        title="Situation dashboard"
        description="Live figures aggregated from community reports and published alerts."
        icon="radar"
        actions={
          <>
            <Link className="btn btn-outline-primary" to="/officer/reports?status=PENDING_REVIEW">
              <Icon name="inbox" size={16} />
              Open review queue
            </Link>
            <Link className="btn btn-primary" to="/officer/alerts/new">
              <Icon name="megaphone" size={16} />
              Create alert
            </Link>
          </>
        }
      />

      <section className="panel-card p-3 p-md-4 rounded-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h2 className="h6 fw-semibold mb-1">Dashboard geography</h2>
            <p className="small text-secondary mb-0">Filter the live figures from province down to ward. Results remain limited to your assigned jurisdiction.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setGeography(EMPTY_GEOGRAPHY)}>Clear filter</button>
        </div>
        <div className="mt-3 mb-0"><GeographySelector value={geography} onChange={setGeography} required={false} /></div>
      </section>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Pending review"
            value={summary.pendingReports}
            hint="Awaiting an officer decision"
            tone={summary.pendingReports > 0 ? 'warning' : 'default'}
            icon="clock"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Awaiting information"
            value={summary.awaitingInformation}
            hint="Returned to the resident"
            icon="inbox"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Verified today"
            value={summary.verifiedToday}
            hint={`${summary.verifiedReports} verified in total`}
            tone="success"
            icon="check"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Active alerts"
            value={summary.activeAlerts}
            hint="Published and within their validity window"
            tone={summary.activeAlerts > 0 ? 'danger' : 'default'}
            icon="megaphone"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12">
          <RiverWatchPanel />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <ChartCard
            title="Reports over the last 14 days"
            description="Submitted community reports compared with those verified."
            type="line"
            data={trendChart}
            options={lineOptions}
            isEmpty={summary.totalReports === 0}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <ChartCard
            title="Report status distribution"
            description="Where reports currently sit in the review workflow."
            type="doughnut"
            icon="radar"
            data={statusChart}
            options={doughnutOptions}
            isEmpty={data.reportsByStatus.length === 0}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-6">
          <ChartCard
            title="Reports by flood zone"
            description="Pending and verified reports for each active zone."
            type="bar"
            icon="map"
            data={zoneChart}
            options={barOptions}
            isEmpty={data.reportsByZone.length === 0}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-6">
          <ChartCard
            title="Resident-observed severity"
            description="Severity as described by residents, before officer assessment."
            type="bar"
            icon="warning"
            data={severityChart}
            options={singleBarOptions}
            isEmpty={data.reportsBySeverity.length === 0}
          />
        </div>
      </div>
    </>
  );
}

export default OfficerDashboardPage;
