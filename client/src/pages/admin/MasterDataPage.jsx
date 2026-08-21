import { useCallback, useState } from 'react';
import { fetchFacilityTypes, saveFacilityType } from '../../services/adminApi';
import { useApiResource } from '../../hooks/useApiResource';
import { useFeedback } from '../../context/FeedbackContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import DataTable from '../../components/common/DataTable';

const EMPTY_FORM = { code: '', displayName: '' };

/**
 * Controlled master data. Facility types are a fixed vocabulary so every centre
 * describes the same facility with the same wording.
 */
function MasterDataPage() {
  const loader = useCallback(() => fetchFacilityTypes(), []);
  const { data, loading, error, reload } = useApiResource(loader);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { notify } = useFeedback();

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await saveFacilityType({
        code: form.code.trim().toUpperCase(),
        displayName: form.displayName.trim(),
        isActive: true
      });

      setForm(EMPTY_FORM);
      await reload();
      notify({ tone: 'success', title: 'Facility type added', message: 'The new facility type is available for evacuation centres.', icon: 'check' });
    } catch (caughtError) {
      notify({ tone: 'danger', title: 'Facility type not added', message: caughtError.message || 'We could not add this facility type.', icon: 'warning', duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(facilityType) {
    setBusyId(facilityType.id);

    try {
      await saveFacilityType({
        facilityTypeId: facilityType.id,
        displayName: facilityType.name,
        isActive: !facilityType.isActive
      });

      await reload();
      notify({
        tone: 'success',
        title: facilityType.isActive ? 'Facility type retired' : 'Facility type restored',
        message: `${facilityType.name} is now ${facilityType.isActive ? 'unavailable for new centres' : 'available again'}.`,
        icon: 'check'
      });
    } catch (caughtError) {
      notify({ tone: 'danger', title: 'Facility type not updated', message: caughtError.message || 'We could not update this facility type.', icon: 'warning', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Facility',
      render: (row) => (
        <div>
          <span className="fw-semibold d-block">{row.name}</span>
          <span className="small text-secondary">{row.code}</span>
        </div>
      )
    },
    {
      key: 'isActive',
      header: 'State',
      render: (row) => (
        <span className={`badge text-bg-${row.isActive ? 'success' : 'secondary'}`}>
          <span aria-hidden="true">{row.isActive ? '✓' : '□'}</span> {row.isActive ? 'Available' : 'Retired'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          type="button"
          className={`btn btn-sm ${row.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
          onClick={() => toggleActive(row)}
          disabled={busyId === row.id}
        >
          {busyId === row.id ? 'Saving...' : row.isActive ? 'Retire' : 'Restore'}
        </button>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Master data"
        icon="database"
        description="Controlled values used across FloodNet so records stay consistent."
      />

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleCreate} noValidate>
            <h2 className="h6 fw-semibold mb-1">Add an evacuation facility type</h2>
            <p className="small text-secondary mb-3">
              Retiring a type keeps it on centres that already record it, but stops it being selected again.
            </p>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="facility-code">Code</label>
              <input
                id="facility-code"
                className="form-control"
                required
                maxLength={50}
                value={form.code}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
                }))}
                placeholder="BABY_SUPPLIES"
              />
              <p className="form-text">Uppercase letters, numbers and underscores. Permanent once created.</p>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="facility-name">Display name</label>
              <input
                id="facility-name"
                className="form-control"
                required
                minLength={2}
                maxLength={100}
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Baby and infant supplies"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add facility type'}
            </button>
          </form>
        </div>

        <div className="col-12 col-xl-7">
          {loading && <LoadingState label="Loading master data..." />}
          {error && <ErrorState message={error.message} details={error.details} onRetry={reload} />}
          {!loading && !error && data && (
            <div className="panel-card p-0 rounded-4 overflow-hidden">
              <DataTable
                caption="Evacuation centre facility types"
                columns={columns}
                rows={data.facilityTypes}
                rowKey={(row) => row.id}
                emptyTitle="No facility types defined"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MasterDataPage;
