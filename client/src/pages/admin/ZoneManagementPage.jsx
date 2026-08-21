import { useCallback, useState } from 'react';
import { createZone, fetchZones, updateZone } from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DataTable from '../../components/common/DataTable';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { formatNumber } from '../../utils/formatters';

const EMPTY_FORM = { code: '', name: '', locality: '', description: '' };

function ZoneManagementPage() {
  const loader = useCallback(() => fetchZones(true), []);
  const { data, loading, error, reload } = useApiResource(loader);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingZone, setEditingZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [pendingToggle, setPendingToggle] = useState(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState(null);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(zone) {
    setEditingZone(zone);
    setForm({
      code: zone.code,
      name: zone.name,
      locality: zone.locality || '',
      description: zone.description || ''
    });
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingZone(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: form.name.trim(),
      ...(form.locality.trim() ? { locality: form.locality.trim() } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {})
    };

    try {
      if (editingZone) {
        await updateZone(editingZone.id, { ...payload, isActive: editingZone.isActive });
      } else {
        await createZone({ ...payload, code: form.code.trim().toUpperCase() });
      }

      cancelEdit();
      await reload();
    } catch (caughtError) {
      setSubmitError(caughtError);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;

    setToggleBusy(true);
    setToggleError(null);

    try {
      await updateZone(pendingToggle.id, {
        name: pendingToggle.name,
        ...(pendingToggle.locality ? { locality: pendingToggle.locality } : {}),
        ...(pendingToggle.description ? { description: pendingToggle.description } : {}),
        isActive: !pendingToggle.isActive
      });

      setPendingToggle(null);
      await reload();
    } catch (caughtError) {
      setToggleError(caughtError);
    } finally {
      setToggleBusy(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Zone',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.name}</span>
          <span className="small text-secondary">{row.code}</span>
        </div>
      )
    },
    { key: 'locality', header: 'Locality', render: (row) => row.locality || 'Not set' },
    {
      key: 'usage',
      header: 'In use',
      render: (row) => (
        <span className="small">
          {formatNumber(row.reportCount)} reports<br />
          <span className="text-secondary">{formatNumber(row.centreCount)} active centres</span>
        </span>
      )
    },
    {
      key: 'isActive',
      header: 'State',
      render: (row) => (
        <span className={`badge text-bg-${row.isActive ? 'success' : 'secondary'}`}>
          <span aria-hidden="true">{row.isActive ? '✓' : '□'}</span> {row.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="d-flex flex-wrap gap-1">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => startEdit(row)}>
            Edit
          </button>
          <button
            type="button"
            className={`btn btn-sm ${row.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
            onClick={() => setPendingToggle(row)}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Flood zone management"
        icon="map"
        description="Zones are the shared reference used by reports, alerts and evacuation centres."
      />

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
            <h2 className="h6 fw-semibold mb-3">
              {editingZone ? `Edit ${editingZone.code}` : 'Create a flood zone'}
            </h2>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-code">Zone code</label>
              <input
                id="zone-code"
                className="form-control"
                required={!editingZone}
                disabled={Boolean(editingZone)}
                maxLength={40}
                value={form.code}
                onChange={(event) => updateField('code', event.target.value.toUpperCase())}
                placeholder="ZONE-D"
              />
              <p className="form-text">
                Permanent identifier. It cannot be changed once records reference the zone.
              </p>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-name">Zone name</label>
              <input
                id="zone-name"
                className="form-control"
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-locality">Locality</label>
              <input
                id="zone-locality"
                className="form-control"
                maxLength={120}
                value={form.locality}
                onChange={(event) => updateField('locality', event.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-description">Description</label>
              <textarea
                id="zone-description"
                className="form-control"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>

            {submitError && <ErrorState message={submitError.message} details={submitError.details} />}

            <div className="d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingZone ? 'Save changes' : 'Create zone'}
              </button>
              {editingZone && (
                <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit} disabled={submitting}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="col-12 col-xl-7">
          {loading && <LoadingState label="Loading zones..." />}
          {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}
          {!loading && !error && data && (
            <div className="panel-card p-0 rounded-4 overflow-hidden">
              <DataTable
                caption="FloodNet flood zones"
                columns={columns}
                rows={data.zones}
                rowKey={(row) => row.id}
                emptyTitle="No flood zones defined"
                emptyDescription="Create the first zone so residents can submit reports."
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={Boolean(pendingToggle)}
        title={pendingToggle?.isActive ? 'Deactivate this zone?' : 'Activate this zone?'}
        description={
          pendingToggle?.isActive
            ? 'A deactivated zone can no longer be selected for new reports, alerts or centres. Existing records keep their zone.'
            : 'The zone becomes selectable again for new reports, alerts and centres.'
        }
        confirmLabel={pendingToggle?.isActive ? 'Deactivate zone' : 'Activate zone'}
        confirmVariant={pendingToggle?.isActive ? 'danger' : 'success'}
        busy={toggleBusy}
        onCancel={() => setPendingToggle(null)}
        onConfirm={confirmToggle}
      >
        {pendingToggle && (
          <div className="alert alert-light border mb-0">
            <strong>{pendingToggle.name}</strong>
            <span className="d-block small text-secondary">
              {formatNumber(pendingToggle.centreCount)} active evacuation centre(s) in this zone.
            </span>
          </div>
        )}
        {toggleError && (
          <div className="alert alert-danger mt-3 mb-0 py-2 small" role="alert">{toggleError.message}</div>
        )}
      </ConfirmationModal>
    </>
  );
}

export default ZoneManagementPage;
