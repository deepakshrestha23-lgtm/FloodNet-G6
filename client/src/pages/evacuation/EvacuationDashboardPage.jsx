import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCentreDashboard } from '../../services/centreApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DashboardStatCard from '../../components/common/DashboardStatCard';
import ChartCard from '../../components/chart/ChartCard';
import DataTable from '../../components/common/DataTable';
import { formatNumber, formatPercent } from '../../utils/formatters';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

function EvacuationDashboardPage() {
  const [geography, setGeography] = useState(EMPTY_GEOGRAPHY);
  const loader = useCallback(() => fetchCentreDashboard(geography), [geography]);
  const { data, loading, error, reload } = useApiResource(loader);

  const capacityChart = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.byZone.map((row) => row.zoneName),
      datasets: [
        {
          label: 'Occupied',
          data: data.byZone.map((row) => row.occupancy),
          backgroundColor: '#dc3545'
        },
        {
          label: 'Available',
          data: data.byZone.map((row) => row.available),
          backgroundColor: '#20c997'
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
          backgroundColor: ['#20c997', '#fd7e14', '#dc3545', '#6c757d']
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
      render: (row) => (row.capacity > 0 ? formatPercent((row.occupancy / row.capacity) * 100) : '—')
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Evacuation coordination"
        title="Centre capacity dashboard"
        description="Live capacity and occupancy aggregated across all active evacuation centres."
        actions={
          <>
            <Link className="btn btn-outline-primary" to="/evacuation/centres">Manage centres</Link>
            <Link className="btn btn-primary" to="/evacuation/centres/new">Add centre</Link>
          </>
        }
      />

      <section className="panel-card p-3 p-md-4 rounded-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h2 className="h6 fw-semibold mb-1">Dashboard geography</h2>
            <p className="small text-secondary mb-0">Filter capacity figures from province down to ward within your assigned coverage.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setGeography(EMPTY_GEOGRAPHY)}>Clear filter</button>
        </div>
        <div className="mt-3 mb-0"><GeographySelector value={geography} onChange={setGeography} required={false} /></div>
      </section>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Active centres" value={summary.totalCentres} hint={`${summary.openCentres} currently open`} />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard label="Total capacity" value={summary.totalCapacity} hint="Across all active centres" />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Available spaces"
            value={summary.totalAvailable}
            hint={`${formatNumber(summary.totalOccupancy)} people accommodated`}
            tone={summary.totalAvailable === 0 ? 'danger' : 'success'}
          />
        </div>
        <div className="col-6 col-lg-3">
          <DashboardStatCard
            label="Overall occupancy"
            value={summary.occupancyRate}
            isPercent
            hint={`${summary.nearCapacityCentres} near capacity, ${summary.fullCentres} full`}
            tone={summary.occupancyRate >= 85 ? 'warning' : 'default'}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <ChartCard
            title="Capacity by flood zone"
            description="Occupied versus available spaces in each zone."
            type="bar"
            data={capacityChart}
            options={stackedOptions}
            isEmpty={data.byZone.every((row) => row.capacity === 0)}
          />
        </div>
        <div className="col-12 col-xl-4">
          <ChartCard
            title="Centres by operational status"
            type="doughnut"
            data={statusChart}
            options={doughnutOptions}
            isEmpty={summary.totalCentres === 0}
          />
        </div>
      </div>

      <section className="panel-card p-0 rounded-4 overflow-hidden">
        <h2 className="h6 fw-semibold p-3 p-md-4 mb-0">Zone breakdown</h2>
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
