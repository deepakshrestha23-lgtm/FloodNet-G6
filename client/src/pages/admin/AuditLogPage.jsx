import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAuditActions, fetchAuditLogs } from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import FilterBar from '../../components/common/FilterBar';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import { formatDateTime } from '../../utils/formatters';

const PAGE_SIZE = 25;

const ENTITY_TYPES = [
  { value: 'USER', label: 'User' },
  { value: 'FLOOD_REPORT', label: 'Flood report' },
  { value: 'FLOOD_ALERT', label: 'Flood alert' },
  { value: 'EVACUATION_CENTRE', label: 'Evacuation centre' },
  { value: 'FLOOD_ZONE', label: 'Operational risk area' },
  { value: 'CENTRE_FACILITY_TYPE', label: 'Facility type' },
  { value: 'FLOOD_EVIDENCE', label: 'Evidence' }
];

function humaniseAction(action) {
  return action
    .toLowerCase()
    .split('_')
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [actions, setActions] = useState([]);

  const filters = useMemo(() => ({
    action: searchParams.get('action') || '',
    entityType: searchParams.get('entityType') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || ''
  }), [searchParams]);

  const offset = Number(searchParams.get('offset') || 0);

  const loader = useCallback(
    () => fetchAuditLogs({ ...filters, limit: PAGE_SIZE, offset }),
    [filters, offset]
  );

  const { data, loading, error, reload } = useApiResource(loader);

  useEffect(() => {
    fetchAuditActions()
      .then((payload) => setActions(payload.data.actions))
      .catch(() => setActions([]));
  }, []);

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    next.delete('offset');
    setSearchParams(next);
  }

  function changePage(nextOffset) {
    const next = new URLSearchParams(searchParams);
    next.set('offset', String(nextOffset));
    setSearchParams(next);
  }

  const columns = [
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => <span className="small">{formatDateTime(row.createdAt)}</span>
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="fw-semibold">{humaniseAction(row.action)}</span>
    },
    {
      key: 'actor',
      header: 'Performed by',
      render: (row) => (
        row.actor ? (
          <div>
            <span className="d-block">{row.actor.name || row.actor.email}</span>
            <span className="small text-secondary">{row.actor.role}</span>
          </div>
        ) : (
          <span className="text-secondary">System</span>
        )
      )
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (row) => (
        <span className="small">
          {ENTITY_TYPES.find((entity) => entity.value === row.entityType)?.label || row.entityType}
        </span>
      )
    },
    {
      key: 'metadata',
      header: 'Details',
      render: (row) => {
        const entries = Object.entries(row.metadata || {});

        if (entries.length === 0) return <span className="text-secondary">None</span>;

        return (
          <ul className="list-unstyled small mb-0">
            {entries.map(([key, value]) => (
              <li key={key}>
                <span className="text-secondary">{key}:</span> {String(value)}
              </li>
            ))}
          </ul>
        );
      }
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        icon="history"
        description="Every state-changing action is recorded in the same transaction as the change itself."
      />

      <FilterBar
        filters={[
          {
            name: 'action',
            label: 'Action',
            type: 'select',
            options: actions.map((action) => ({ value: action, label: humaniseAction(action) }))
          },
          { name: 'entityType', label: 'Entity type', type: 'select', options: ENTITY_TYPES },
          { name: 'from', label: 'From', type: 'date' },
          { name: 'to', label: 'To', type: 'date' }
        ]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading audit entries..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="panel-card p-0 rounded-4 overflow-hidden">
            <DataTable
              caption="FloodNet audit trail"
              columns={columns}
              rows={data.entries}
              rowKey={(row) => row.id}
              emptyTitle="No audit entries match these filters"
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

export default AuditLogPage;
