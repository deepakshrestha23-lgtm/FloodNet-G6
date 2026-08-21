import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createUser,
  fetchUsers,
  updateUserJurisdiction,
  updateUserRole,
  updateUserStatus
} from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import FilterBar from '../../components/common/FilterBar';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { ROLE, USER_STATUS, toOptions } from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

const PAGE_SIZE = 20;

function JurisdictionEditor({ user, onSaved, onCancel }) {
  const [scopeLevel, setScopeLevel] = useState(user.jurisdiction?.scopeLevel || 'NATIONAL');
  const [geography, setGeography] = useState({
    ...EMPTY_GEOGRAPHY,
    provinceId: user.jurisdiction?.province?.id || '',
    districtId: user.jurisdiction?.district?.id || '',
    localLevelId: user.jurisdiction?.localLevel?.id || '',
    wardId: user.jurisdiction?.ward?.id || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    const field = { PROVINCE: 'provinceId', DISTRICT: 'districtId', LOCAL_LEVEL: 'localLevelId', WARD: 'wardId' }[scopeLevel];
    if (scopeLevel !== 'NATIONAL' && !geography[field]) {
      setError({ message: `Select the ${scopeLevel.toLowerCase().replace('_', ' ')} before saving.` });
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { scopeLevel };
    if (field) payload[field] = geography[field];
    try {
      await updateUserJurisdiction(user.id, payload);
      await onSaved();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel-card p-3 p-md-4 mb-3" onSubmit={save}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-3"><div><h2 className="h6 fw-semibold mb-1">Assign operational jurisdiction</h2><p className="small text-secondary mb-0">{user.firstName} {user.lastName} · {user.email}</p></div><button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Close</button></div>
      <div className="row g-3 align-items-end">
        <div className="col-12 col-md-4"><label className="form-label fw-semibold" htmlFor="jurisdiction-scope">Coverage level</label><select id="jurisdiction-scope" className="form-select" value={scopeLevel} onChange={(event) => { setScopeLevel(event.target.value); setGeography(EMPTY_GEOGRAPHY); }}><option value="NATIONAL">National</option><option value="PROVINCE">Province</option><option value="DISTRICT">District</option><option value="LOCAL_LEVEL">Local level</option><option value="WARD">Ward</option></select></div>
        <div className="col-12 col-md-8"><p className="small text-secondary mb-0">National officers can work across Nepal. Narrower assignments limit every operational query and write action on the server.</p></div>
      </div>
      {scopeLevel !== 'NATIONAL' && <div className="mt-3"><GeographySelector value={geography} onChange={setGeography} required={false} /></div>}
      {error && <ErrorState message={error.message} details={error.details} />}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save jurisdiction'}</button>
    </form>
  );
}

function CreateUserForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    roleCode: 'FLOOD_MONITORING_OFFICER',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      roleCode: form.roleCode,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim()
    };

    if (form.phone.trim()) payload.phone = form.phone.trim();

    try {
      await createUser(payload);
      await onCreated();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel-card p-3 p-md-4 rounded-4 mb-3" onSubmit={handleSubmit} noValidate>
      <h2 className="h6 fw-semibold mb-3">Create an authorised account</h2>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-first-name">First name</label>
          <input
            id="new-first-name"
            className="form-control"
            required
            maxLength={100}
            value={form.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-last-name">Last name</label>
          <input
            id="new-last-name"
            className="form-control"
            required
            maxLength={100}
            value={form.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-email">Email address</label>
          <input
            id="new-email"
            type="email"
            className="form-control"
            required
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-phone">Phone (optional)</label>
          <input
            id="new-phone"
            className="form-control"
            maxLength={40}
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-role">Role</label>
          <select
            id="new-role"
            className="form-select"
            value={form.roleCode}
            onChange={(event) => updateField('roleCode', event.target.value)}
          >
            {toOptions(ROLE).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="new-password">Temporary password</label>
          <input
            id="new-password"
            type="password"
            className="form-control"
            required
            minLength={8}
            maxLength={72}
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
          />
          <p className="form-text">At least 8 characters with upper case, lower case and a number.</p>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorState message={error.message} details={error.details} /></div>}

      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create account'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [jurisdictionTarget, setJurisdictionTarget] = useState(null);

  const filters = useMemo(() => ({
    search: searchParams.get('search') || '',
    role: searchParams.get('role') || '',
    status: searchParams.get('status') || ''
  }), [searchParams]);

  const offset = Number(searchParams.get('offset') || 0);

  const loader = useCallback(
    () => fetchUsers({ ...filters, limit: PAGE_SIZE, offset }),
    [filters, offset]
  );

  const { data, loading, error, reload } = useApiResource(loader);

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

  async function runAction() {
    if (!pendingAction) return;

    setBusy(true);
    setActionError(null);

    try {
      if (pendingAction.type === 'status') {
        await updateUserStatus(pendingAction.user.id, pendingAction.value);
      } else {
        await updateUserRole(pendingAction.user.id, pendingAction.value);
      }

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
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.firstName} {row.lastName}</span>
          <span className="small text-secondary text-break">{row.email}</span>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <StatusBadge map={ROLE} value={row.role.code} />
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge map={USER_STATUS} value={row.status} />
    },
    {
      key: 'jurisdiction',
      header: 'Operational coverage',
      render: (row) => <span className="small">{row.jurisdiction ? row.jurisdiction.scopeLevel.replaceAll('_', ' ') : 'Not assigned'}</span>
    },
    {
      key: 'lastLoginAt',
      header: 'Last sign-in',
      render: (row) => <span className="small">{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;

        return (
          <div className="d-flex flex-wrap gap-1 align-items-center">
            <select
              className="form-select form-select-sm w-auto"
              value={row.role.code}
              disabled={isSelf}
              aria-label={`Change role for ${row.firstName} ${row.lastName}`}
              onChange={(event) => setPendingAction({
                type: 'role',
                user: row,
                value: event.target.value
              })}
            >
              {toOptions(ROLE).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <button
              type="button"
              className={`btn btn-sm ${row.status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success'}`}
              disabled={isSelf && row.status === 'ACTIVE'}
              onClick={() => setPendingAction({
                type: 'status',
                user: row,
                value: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
              })}
            >
              {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
            {['FLOOD_MONITORING_OFFICER', 'EVACUATION_OFFICER'].includes(row.role.code) && (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setJurisdictionTarget(row)}>
                Jurisdiction
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const confirmationCopy = pendingAction?.type === 'status'
    ? {
        title: pendingAction.value === 'INACTIVE' ? 'Deactivate this account?' : 'Activate this account?',
        description: pendingAction.value === 'INACTIVE'
          ? 'The account can no longer sign in and all of its active sessions are ended immediately.'
          : 'The account can sign in again with its existing password.',
        confirmLabel: pendingAction.value === 'INACTIVE' ? 'Deactivate' : 'Activate',
        variant: pendingAction.value === 'INACTIVE' ? 'danger' : 'success'
      }
    : {
        title: 'Change this account role?',
        description:
          'Changing a role changes what the account can do across FloodNet. Active sessions are ended, so the user must sign in again.',
        confirmLabel: 'Change role',
        variant: 'primary'
      };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        icon="users"
        description="Manage accounts and role assignments for the platform."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((open) => !open)}>
            {showCreate ? 'Close form' : 'Create account'}
          </button>
        }
      />

      {showCreate && (
        <CreateUserForm
          onCancel={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await reload();
          }}
        />
      )}

      {jurisdictionTarget && (
        <JurisdictionEditor
          user={jurisdictionTarget}
          onCancel={() => setJurisdictionTarget(null)}
          onSaved={async () => { setJurisdictionTarget(null); await reload(); }}
        />
      )}

      <FilterBar
        filters={[
          { name: 'search', label: 'Search', placeholder: 'Name or email', columnClass: 'col-12 col-lg-4' },
          { name: 'role', label: 'Role', type: 'select', options: toOptions(ROLE) },
          { name: 'status', label: 'Status', type: 'select', options: toOptions(USER_STATUS) }
        ]}
        values={filters}
        onChange={updateFilter}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {loading && <LoadingState label="Loading users..." />}
      {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="panel-card p-0 rounded-4 overflow-hidden">
            <DataTable
              caption="FloodNet user accounts"
              columns={columns}
              rows={data.users}
              rowKey={(row) => row.id}
              emptyTitle="No accounts match these filters"
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
        title={confirmationCopy.title}
        description={confirmationCopy.description}
        confirmLabel={confirmationCopy.confirmLabel}
        confirmVariant={confirmationCopy.variant}
        busy={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={runAction}
      >
        {pendingAction && (
          <div className="alert alert-light border mb-0">
            <strong>{pendingAction.user.firstName} {pendingAction.user.lastName}</strong>
            <span className="d-block small text-secondary">{pendingAction.user.email}</span>
          </div>
        )}
        {actionError && (
          <div className="alert alert-danger mt-3 mb-0 py-2 small" role="alert">{actionError.message}</div>
        )}
      </ConfirmationModal>
    </>
  );
}

export default UserManagementPage;
