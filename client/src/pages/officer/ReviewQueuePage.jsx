import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchReviewQueue } from '../../services/officerApi';
import { fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import FilterBar from '../../components/common/FilterBar';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { REPORT_STATUS, OBSERVED_SEVERITY, toOptions } from '../../utils/enums';
import { formatDateTime, formatRelative } from '../../utils/formatters';

const PAGE_SIZE = 20;

function ReviewQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);

  const filters = useMemo(() => ({
    status: searchParams.get('status') || '',
    zoneId: searchParams.get('zoneId') || '',
    severity: searchParams.get('severity') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    sort: searchParams.get('sort') || 'newest'
  }), [searchParams]);

  const offset = Number(searchParams.get('offset') || 0);

  const loader = useCallback(
    () => fetchReviewQueue({ ...filters, limit: PAGE_SIZE, offset }),
    [filters, offset]
  );

  const { data, loading, error, reload } = useApiResource(loader);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }

    // Any filter change returns to the first page so the offset stays valid.
    next.delete('offset');
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  function changePage(nextOffset) {
    const next = new URLSearchParams(searchParams);
    next.set('offset', String(nextOffset));
    setSearchParams(next);
  }

  const filterDefinitions = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: toOptions(REPORT_STATUS)
    },
    {
      name: 'zoneId',
      label: 'Flood zone',
      type: 'select',
      options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
    },
    {
      name: 'severity',
      label: 'Observed severity',
      type: 'select',
      options: toOptions(OBSERVED_SEVERITY)
    },
    {
      name: 'sort',
      label: 'Sort',
      type: 'select',
      placeholder: 'Newest first',
      options: [
        { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' }
      ]
    },
    { name: 'from', label: 'Observed from', type: 'date', columnClass: 'col-6 col-lg-2' },
    { name: 'to', label: 'Observed to', type: 'date', columnClass: 'col-6 col-lg-2' }
  ];

  const columns = [
    {
      key: 'reportReference',
      header: 'Reference',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.reportReference}</span>
          <span className="small text-secondary">{formatRelative(row.createdAt)}</span>
        </div>
      )
    },
    {
      key: 'zone',
      header: 'Zone',
      render: (row) => (
        <div>
          <span className="d-block">{row.zone.name}</span>
          <span className="small text-secondary">{row.zone.locality || row.zone.code}</span>
        </div>
      )
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => <span className="text-truncate-2">{row.locationDescription}</span>
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <StatusBadge map={OBSERVED_SEVERITY} value={row.observedSeverity} />
    },
    {
      key: 'observedAt',
      header: 'Observed',
      render: (row) => <span className="small">{formatDateTime(row.observedAt)}</span>
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: (row) => (
        <span className="small">
          {row.evidenceCount > 0 ? `${row.evidenceCount} file(s)` : 'None'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge map={REPORT_STATUS} value={row.status} />
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/officer/reports/${row.id}`);
          }}
        >
          Review
        </button>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Flood monitoring"
        title="Report review queue"
        description="Community reports awaiting assessment by an authorised Flood Monitoring Officer."
      />

      <FilterBar
        filters={filterDefinitions}
        values={filters}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      {loading && <LoadingState label="Loading reports..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="panel-card p-0 rounded-4 overflow-hidden">
            <DataTable
              caption="Community flood reports awaiting review"
              columns={columns}
              rows={data.reports}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/officer/reports/${row.id}`)}
              emptyTitle="No reports match these filters"
              emptyDescription="Adjust or clear the filters to see more reports."
            />
          </div>
          <Pagination
            total={data.pagination.total}
            limit={data.pagination.limit}
            offset={data.pagination.offset}
            onChange={changePage}
          />
        </>
      )}
    </>
  );
}

export default ReviewQueuePage;
