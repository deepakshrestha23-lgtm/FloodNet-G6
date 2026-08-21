import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchCentreDashboard } from '../../services/centreApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import Icon from '../../components/common/Icon';
import ChartCard from '../../components/chart/ChartCard';
import DataTable from '../../components/common/DataTable';
import { formatNumber, formatPercent } from '../../utils/formatters';

function EvacuationDashboardPage() {
  const loader = useCallback(() => fetchCentreDashboard(), []);
  const { data, loading, error, reload } = useApiResource(loader);

  const capacityChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.byZone.map((row) => row.zoneName),
      datasets: [
        {
          label: 'Occupied',
          data: data.byZone.map((row) => row.occupancy),
          backgroundColor: '#dc2743'
        },
        {
          label: 'Available',
          data: data.byZone.map((row) => row.available),
          backgroundColor: '#0f9d6f'
        }
      ]
    };
  }, [data]);

  const statusChart = useMemo(() => {
    if (!data) return null;
    const { summary } = data;

    return {
      labels: ['Open', 'Near capacity', 'Full', 'Closed'],
      datasets: [
        {
          data: [
            summary.openCentres,
            summary.nearCapacityCentres,
            summary.fullCentres,
            summary.closedCentres
          ],
          backgroundColor: ['#0f9d6f', '#e8820c', '#dc2743', '#64748b']
        }
      ]
    };
  }, [data]);

  const stackedOptions = useMemo(() => ({
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: { legend: { position: 'bottom' } }
  }), []);

  const doughnutOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } }
  }), []);

  if (loading) return <LoadingState label="Loading evacuation dashboard..." />;
  if (error) return <ErrorState message={error.message} details={error.details} onRetry={reload} />;

  const { summary } = data;

  const zoneColumns = [
    { key: 'zoneName', header: 'Zone', render: (row) => <span className="fw-semibold">{row.zoneName}</span> },
    { key: 'centres', header: 'Centres', render: (row) => formatNumber(row.centres) },
    { key: 'capacity', header: 'Capacity', render: (row) => formatNumber(row.capacity) },
    { key: 'occupancy', header: 'Occupied', render: (row) => formatNumber(row.occupancy) },
    {
      key: 'available',
      header: 'Available spaces',
      render: (row) => (
        <span className={row.available === 0 && row.capacity > 0 ? 'text-danger fw-semibold' : ''}>
          {formatNumber(row.available)}
        </span>
      )
    },
    {
      key: 'rate',
      header: 'Occupancy',
      render: (row) => (row.capacity > 0 ? formatPercent((row.occupancy / row.capacity) * 100) : 'N/A')
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Evacuation coordination"
        title="Centre capacity dashboard"
        description="Live capacity and occupancy aggregated across all active evacuation centres."
        icon="shelter"
        actions={
          <>
            <Link className="btn btn-outline-primary" to="/evacuation/centres">
              <Icon name="shelter" size={16} />
              Manage centres
            </Link>
            <Link className="btn btn-primary" to="/evacuation/centres/new">
              <Icon name="plus" size={16} strokeWidth={2.2} />
              Add centre
            </Link>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Active centres" value={summary.totalCentres} hint={`${summary.openCentres} currently open`} icon="shelter" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Total capacity" value={summary.totalCapacity} hint="Across all active centres" icon="people" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Available spaces"
            value={summary.totalAvailable}
            hint={`${formatNumber(summary.totalOccupancy)} people accommodated`}
            tone={summary.totalAvailable === 0 ? 'danger' : 'success'}
            icon="check"
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Overall occupancy"
            value={summary.occupancyRate}
            isPercent
            hint={`${summary.nearCapacityCentres} near capacity, ${summary.fullCentres} full`}
            tone={summary.occupancyRate >= 85 ? 'warning' : 'default'}
            icon="chart"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <ChartCard
            title="Capacity by flood zone"
            description="Occupied versus available spaces in each zone."
            type="bar"
            icon="map"
            data={capacityChart}
            options={stackedOptions}
            isEmpty={data.byZone.every((row) => row.capacity === 0)}
          />
        </div>
        <div className="col-12 col-xl-4">
          <ChartCard
            title="Centres by operational status"
            type="doughnut"
            icon="shelter"
            data={statusChart}
            options={doughnutOptions}
            isEmpty={summary.totalCentres === 0}
          />
        </div>
      </div>

      <section className="panel-card p-0 overflow-hidden">
        <h2 className="h6 fw-bold fn-section-title p-3 p-md-4 mb-0">
          <Icon name="map" size={18} />
          Zone breakdown
        </h2>
        <DataTable
          caption="Evacuation capacity by flood zone"
          columns={zoneColumns}
          rows={data.byZone}
          rowKey={(row) => row.zoneCode}
          emptyTitle="No zone data available"
        />
      </section>
    </>
  );
}

export default EvacuationDashboardPage;
