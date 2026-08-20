import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  cancelAlert,
  expireAlert,
  fetchAlerts,
  publishAlert
} from '../../services/officerApi';
import { fetchZones } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import FilterBar from '../../components/common/FilterBar';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { ALERT_SEVERITY, ALERT_STATUS, toOptions } from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';

const PAGE_SIZE = 20;

const TRANSITIONS = {
  publish: {
    run: publishAlert,
    title: 'Publish this alert?',
    description:
      'Publishing makes the alert visible to residents and the public immediately, for every zone it targets. Check the wording, severity and validity window before continuing.',
    confirmLabel: 'Publish alert',
    variant: 'danger'
  },
  expire: {
    run: expireAlert,
    title: 'Expire this alert?',
    description: 'The alert stops appearing as active. It remains in the alert history.',
    confirmLabel: 'Expire alert',
    variant: 'warning'
  },
  cancel: {
    run: cancelAlert,
    title: 'Cancel this alert?',
    description: 'Cancelling withdraws the alert. Use this when an alert was issued in error.',
    confirmLabel: 'Cancel alert',
    variant: 'danger'
  }
};

function AlertsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const filters = useMemo(() => ({
    status: searchParams.get('status') || '',
    zoneId: searchParams.get('zoneId') || ''
  }), [searchParams]);

  const offset = Number(searchParams.get('offset') || 0);

  const loader = useCallback(
    () => fetchAlerts({ ...filters, limit: PAGE_SIZE, offset }),
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
    if (value) next.set(name, value); else next.delete(name);
    next.delete('offset');
    setSearchParams(next);
  }

  function changePage(nextOffset) {
    const next = new URLSearchParams(searchParams);
    next.set('offset', String(nextOffset));
    setSearchParams(next);
  }

  async function runTransition() {
    if (!pendingAction) return;

    setBusy(true);
    setActionError(null);

    try {
      await TRANSITIONS[pendingAction.type].run(pendingAction.alert.id);
      setPendingAction(null);
      await reload();
    } catch (caughtError) {
      setActionError(caughtError);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Alert',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.title}</span>
          <span className="small text-secondary">{row.alertReference}</span>
        </div>
      )
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <StatusBadge map={ALERT_SEVERITY} value={row.severity} />
    },
    {
      key: 'zones',
      header: 'Zones',
      render: (row) => (
        <span className="small">
          {row.zones.length ? row.zones.map((zone) => zone.code).join(', ') : 'None'}
        </span>
      )
    },
    {
      key: 'window',
      header: 'Validity',
      render: (row) => (
        <span className="small">
          {formatDateTime(row.validFrom)}<br />
          <span className="text-secondary">to {formatDateTime(row.expiresAt)}</span>
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="d-flex flex-column gap-1 align-items-start">
          <StatusBadge map={ALERT_STATUS} value={row.status} />
          {row.status === 'PUBLISHED' && !row.isActive && (
            <span className="small text-secondary">Outside validity window</span>
          )}
          {row.isActive && <span className="small text-success fw-semibold">Currently active</span>}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="d-flex flex-wrap gap-1">
          {['DRAFT', 'PUBLISHED'].includes(row.status) && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate(`/officer/alerts/${row.id}/edit`)}
            >
              Edit
            </button>
          )}
          {row.status === 'DRAFT' && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => setPendingAction({ type: 'publish', alert: row })}
            >
              Publish
            </button>
          )}
          {row.status === 'PUBLISHED' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setPendingAction({ type: 'expire', alert: row })}
            >
              Expire
            </button>
          )}
          {['DRAFT', 'PUBLISHED'].includes(row.status) && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setPendingAction({ type: 'cancel', alert: row })}
            >
              Cancel
            </button>
          )}
        </div>
      )
    }
  ];

  const transition = pendingAction ? TRANSITIONS[pendingAction.type] : null;

  return (
    <>
      <PageHeader
        eyebrow="Flood monitoring"
        title="FloodNet alerts"
        description="Alerts are authored as drafts and published separately, so verification never issues a warning on its own."
        actions={<Link className="btn btn-primary" to="/officer/alerts/new">Create alert</Link>}
      />

      <FilterBar
        filters={[
          { name: 'status', label: 'Status', type: 'select', options: toOptions(ALERT_STATUS) },
          {
            name: 'zoneId',
            label: 'Affected zone',
            type: 'select',
            options: zones.map((zone) => ({ value: zone.id, label: zone.name }))
          }
        ]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading alerts..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="panel-card p-0 rounded-4 overflow-hidden">
            <DataTable
              caption="FloodNet alerts"
              columns={columns}
              rows={data.alerts}
              rowKey={(row) => row.id}
              emptyTitle="No alerts found"
              emptyDescription="Create a draft alert to warn residents in an affected zone."
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

      <ConfirmationModal
        open={Boolean(pendingAction)}
        title={transition?.title || ''}
        description={transition?.description}
        confirmLabel={transition?.confirmLabel}
        confirmVariant={transition?.variant}
        busy={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={runTransition}
      >
        {pendingAction && (
          <div className="alert alert-light border mb-0">
            <strong className="d-block">{pendingAction.alert.title}</strong>
            <span className="small text-secondary">
              {pendingAction.alert.zones.map((zone) => zone.name).join(', ') || 'No zones selected'}
            </span>
          </div>
        )}
        {actionError && (
          <div className="alert alert-danger mt-3 mb-0 py-2 small" role="alert">
            {actionError.message}
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}

export default AlertsPage;
