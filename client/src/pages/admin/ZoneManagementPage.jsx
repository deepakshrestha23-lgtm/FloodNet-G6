import { useCallback, useState } from 'react';
import { createZone, fetchZones, updateZone } from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import { useFeedback } from '../../context/FeedbackContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DataTable from '../../components/common/DataTable';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatNumber } from '../../utils/formatters';
import { RISK_AREA_TYPE, toOptions } from '../../utils/enums';

const EMPTY_FORM = { code: '', name: '', locality: '', description: '', zoneType: 'OTHER' };

function ZoneManagementPage() {
  const loader = useCallback(() => fetchZones(true), []);
  const { data, loading, error, reload } = useApiResource(loader);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingZone, setEditingZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const { notify } = useFeedback();

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(zone) {
    setEditingZone(zone);
    setForm({
      code: zone.code,
      name: zone.name,
      locality: zone.locality || '',
      description: zone.description || '',
      zoneType: zone.zoneType || 'OTHER'
    });
  }

  function cancelEdit() {
    setEditingZone(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      zoneType: form.zoneType,
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
      notify({
        tone: 'success',
        title: editingZone ? 'Risk area updated' : 'Risk area created',
        message: `${payload.name} is available as an optional operational grouping.`,
        icon: 'check'
      });
    } catch (caughtError) {
      notify({ tone: 'danger', title: 'Risk area not saved', message: caughtError.message || 'We could not save this operational risk area.', icon: 'warning', duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;

    setToggleBusy(true);

    try {
      await updateZone(pendingToggle.id, {
        name: pendingToggle.name,
        zoneType: pendingToggle.zoneType,
        ...(pendingToggle.locality ? { locality: pendingToggle.locality } : {}),
        ...(pendingToggle.description ? { description: pendingToggle.description } : {}),
        isActive: !pendingToggle.isActive
      });

      setPendingToggle(null);
      await reload();
      notify({
        tone: 'success',
        title: pendingToggle.isActive ? 'Risk area deactivated' : 'Risk area activated',
        message: `${pendingToggle.name} is now ${pendingToggle.isActive ? 'inactive' : 'active'}.`,
        icon: 'check'
      });
    } catch (caughtError) {
      notify({ tone: 'danger', title: 'Risk-area status not changed', message: caughtError.message || 'We could not change this risk-area status.', icon: 'warning', duration: 6000 });
    } finally {
      setToggleBusy(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Risk area',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.name}</span>
          <span className="small text-secondary">{row.code}</span>
        </div>
      )
    },
    {
      key: 'zoneType',
      header: 'Type',
      render: (row) => <StatusBadge map={RISK_AREA_TYPE} value={row.zoneType} />
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
        title="Operational risk areas"
        icon="map"
        description="Optional river corridors, floodplains and other operational groupings. These never replace Nepal's administrative geography."
      />

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
            <h2 className="h6 fw-semibold mb-3">
              {editingZone ? `Edit ${editingZone.code}` : 'Create an operational risk area'}
            </h2>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-code">Risk-area code</label>
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
                Permanent identifier. It cannot be changed once records reference the risk area.
              </p>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="zone-name">Risk-area name</label>
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
              <label className="form-label fw-semibold" htmlFor="zone-type">Operational type</label>
              <select id="zone-type" className="form-select" value={form.zoneType} onChange={(event) => updateField('zoneType', event.target.value)}>
                {toOptions(RISK_AREA_TYPE).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
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

            <div className="d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingZone ? 'Save changes' : 'Create risk area'}
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
          {loading && <LoadingState label="Loading operational risk areas..." />}
          {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}
          {!loading && !error && data && (
            <div className="panel-card p-0 rounded-4 overflow-hidden">
              <DataTable
                caption="FloodNet operational risk areas"
                columns={columns}
                rows={data.zones}
                rowKey={(row) => row.id}
                emptyTitle="No operational risk areas defined"
                emptyDescription="Risk areas are optional. Reports and centres continue to use official administrative geography."
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={Boolean(pendingToggle)}
        title={pendingToggle?.isActive ? 'Deactivate this risk area?' : 'Activate this risk area?'}
        description={
          pendingToggle?.isActive
            ? 'A deactivated risk area can no longer be selected for new reports, alerts or centres. Existing records keep their reference.'
            : 'The risk area becomes selectable again for new reports, alerts and centres.'
        }
        confirmLabel={pendingToggle?.isActive ? 'Deactivate risk area' : 'Activate risk area'}
        confirmVariant={pendingToggle?.isActive ? 'danger' : 'success'}
        busy={toggleBusy}
        onCancel={() => setPendingToggle(null)}
        onConfirm={confirmToggle}
      >
        {pendingToggle && (
          <div className="alert alert-light border mb-0">
            <strong>{pendingToggle.name}</strong>
            <span className="d-block small text-secondary">
              {formatNumber(pendingToggle.centreCount)} active evacuation centre(s) use this optional risk area.
            </span>
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}

export default ZoneManagementPage;
