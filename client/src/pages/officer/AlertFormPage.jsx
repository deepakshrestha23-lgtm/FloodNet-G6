import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createAlert, fetchAlert, updateAlert } from '../../services/officerApi';
import { fetchZones } from '../../services/publicApi';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { ALERT_SEVERITY } from '../../utils/enums';
import { toDateTimeLocalValue } from '../../utils/formatters';

function defaultValidityWindow() {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    validFrom: toDateTimeLocalValue(now),
    expiresAt: toDateTimeLocalValue(expires)
  };
}

const SEVERITY_GUIDANCE = {
  ADVISORY: 'General awareness information. No immediate action expected.',
  WATCH: 'Conditions could lead to flooding. Residents should stay informed.',
  WARNING: 'Flooding is occurring or expected. Residents should prepare to act.',
  EMERGENCY: 'Severe flooding presenting danger to life. Immediate action required.'
};

function AlertFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [form, setForm] = useState(() => ({
    title: '',
    severity: 'WATCH',
    warningDescription: '',
    recommendedActions: '',
    zoneIds: [],
    ...defaultValidityWindow()
  }));

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const zonePayload = await fetchZones();
        if (!active) return;
        setZones(zonePayload.data.zones);

        if (isEditing) {
          const alertPayload = await fetchAlert(id);
          if (!active) return;

          const alert = alertPayload.data.alert;
          setForm({
            title: alert.title,
            severity: alert.severity,
            warningDescription: alert.warningDescription,
            recommendedActions: alert.recommendedActions,
            zoneIds: alert.zones.map((zone) => zone.id),
            validFrom: toDateTimeLocalValue(alert.validFrom),
            expiresAt: toDateTimeLocalValue(alert.expiresAt)
          });
        }
      } catch (caughtError) {
        if (active) setLoadError(caughtError);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [id, isEditing]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleZone(zoneId) {
    setForm((current) => ({
      ...current,
      zoneIds: current.zoneIds.includes(zoneId)
        ? current.zoneIds.filter((value) => value !== zoneId)
        : [...current.zoneIds, zoneId]
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      title: form.title.trim(),
      severity: form.severity,
      warningDescription: form.warningDescription.trim(),
      recommendedActions: form.recommendedActions.trim(),
      validFrom: new Date(form.validFrom).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      zoneIds: form.zoneIds
    };

    try {
      if (isEditing) {
        await updateAlert(id, payload);
      } else {
        await createAlert(payload);
      }

      navigate('/officer/alerts');
    } catch (caughtError) {
      setSubmitError(caughtError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading alert composer..." />;
  if (loadError) return <ErrorState message={loadError.message} details={loadError.details} />;

  return (
    <div className="page-narrow-wide mx-auto">
      <PageHeader
        eyebrow="Flood monitoring"
        title={isEditing ? 'Edit alert' : 'Create alert'}
        icon="megaphone"
        description="Alerts are saved as drafts. Publishing is a separate, confirmed action."
      />

      <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="alert-title">Alert title</label>
          <input
            id="alert-title"
            className="form-control"
            required
            minLength={5}
            maxLength={180}
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="Short, specific headline residents will see first"
          />
        </div>

        <fieldset className="mb-3">
          <legend className="form-label fw-semibold">Severity</legend>
          <div className="row g-2">
            {Object.entries(ALERT_SEVERITY).map(([value, meta]) => (
              <div className="col-12 col-md-6" key={value}>
                <label
                  className={`severity-option d-flex gap-2 p-2 rounded-3 h-100 ${form.severity === value ? 'severity-option-selected' : ''}`}
                  htmlFor={`severity-${value}`}
                >
                  <input
                    id={`severity-${value}`}
                    type="radio"
                    name="severity"
                    className="form-check-input mt-1 flex-shrink-0"
                    value={value}
                    checked={form.severity === value}
                    onChange={(event) => updateField('severity', event.target.value)}
                  />
                  <span>
                    <span className={`badge text-bg-${meta.variant} mb-1`}>
                      <span aria-hidden="true">{meta.symbol}</span> {meta.label}
                    </span>
                    <span className="d-block small text-secondary">{SEVERITY_GUIDANCE[value]}</span>
                  </span>
                </label>
              </div>
            ))}
          </div>
          <p className="form-text">
            These are FloodNet application classifications used to communicate urgency. They are not
            official scientific or legal flood thresholds.
          </p>
        </fieldset>

        <fieldset className="mb-3">
          <legend className="form-label fw-semibold">Affected flood zones</legend>
          {zones.length === 0 ? (
            <p className="text-secondary mb-0">No active flood zones are available.</p>
          ) : (
            <div className="row g-2">
              {zones.map((zone) => (
                <div className="col-12 col-md-6" key={zone.id}>
                  <div className="form-check">
                    <input
                      id={`zone-${zone.id}`}
                      className="form-check-input"
                      type="checkbox"
                      checked={form.zoneIds.includes(zone.id)}
                      onChange={() => toggleZone(zone.id)}
                    />
                    <label className="form-check-label" htmlFor={`zone-${zone.id}`}>
                      {zone.name} <span className="text-secondary small">({zone.code})</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="form-text">An alert must target at least one zone before it can be published.</p>
        </fieldset>

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="alert-description">Warning description</label>
          <textarea
            id="alert-description"
            className="form-control"
            rows={4}
            required
            minLength={10}
            maxLength={4000}
            value={form.warningDescription}
            onChange={(event) => updateField('warningDescription', event.target.value)}
            placeholder="What is happening, where, and what is expected to happen next."
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="alert-actions">Recommended actions</label>
          <textarea
            id="alert-actions"
            className="form-control"
            rows={4}
            required
            minLength={10}
            maxLength={4000}
            value={form.recommendedActions}
            onChange={(event) => updateField('recommendedActions', event.target.value)}
            placeholder="Clear, ordered steps a resident should take."
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="alert-valid-from">Valid from</label>
            <input
              id="alert-valid-from"
              type="datetime-local"
              className="form-control"
              required
              value={form.validFrom}
              onChange={(event) => updateField('validFrom', event.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="alert-expires-at">Expires at</label>
            <input
              id="alert-expires-at"
              type="datetime-local"
              className="form-control"
              required
              value={form.expiresAt}
              onChange={(event) => updateField('expiresAt', event.target.value)}
            />
          </div>
        </div>

        {submitError && (
          <ErrorState message={submitError.message} details={submitError.details} />
        )}

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Save as draft'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate('/officer/alerts')}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AlertFormPage;
