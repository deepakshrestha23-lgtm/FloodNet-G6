import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createAlert, fetchAlert, updateAlert } from '../../services/officerApi';
import { fetchZones } from '../../services/publicApi';
import { useFeedback } from '../../context/FeedbackContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { ALERT_SEVERITY } from '../../utils/enums';
import { toDateTimeLocalValue } from '../../utils/formatters';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

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
  const { notify } = useFeedback();

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGeography, setSelectedGeography] = useState(EMPTY_GEOGRAPHY);

  const [form, setForm] = useState(() => ({
    title: '',
    severity: 'WATCH',
    warningDescription: '',
    recommendedActions: '',
    zoneIds: [],
    wardIds: [],
    ...defaultValidityWindow()
  }));

  /*
   * Areas an officer has chosen, at whatever level they chose them. Kept as
   * labelled entries so the form can show "Gorkha district" rather than a list
   * of ninety-four ward chips. The server expands them to wards when saving.
   */
  const [areaTargets, setAreaTargets] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState({});

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
            wardIds: (alert.wards || []).map((ward) => ward.id),
            validFrom: toDateTimeLocalValue(alert.validFrom),
            expiresAt: toDateTimeLocalValue(alert.expiresAt)
          });

          // An alert stores the wards it resolved to, not the level it was
          // created from, so they are reloaded as individual ward targets.
          // Without this an edit would submit no areas and silently strip
          // every ward the alert was published against.
          setAreaTargets((alert.wards || []).map((ward) => ({
            id: ward.id,
            level: 'ward',
            field: 'wardIds',
            label: [ward.name, ward.localLevel].filter(Boolean).join(', ')
          })));
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

  /**
   * Adds the narrowest level the officer has actually selected.
   *
   * Stopping at a district warns the whole district, which is the common case
   * during a river flood. Drilling to a ward warns only that ward. Nobody has
   * to enumerate wards to cover an area.
   */
  function addAreaTarget() {
    const levels = [
      {
        key: 'wardId',
        level: 'ward',
        field: 'wardIds',
        label: [selectedLabels.wardLabel, selectedLabels.localLevelLabel].filter(Boolean).join(', ')
      },
      {
        key: 'localLevelId',
        level: 'municipality',
        field: 'localLevelIds',
        label: [selectedLabels.localLevelLabel, selectedLabels.districtLabel].filter(Boolean).join(', ')
      },
      {
        key: 'districtId',
        level: 'district',
        field: 'districtIds',
        label: selectedLabels.districtLabel
      },
      {
        key: 'provinceId',
        level: 'province',
        field: 'provinceIds',
        label: selectedLabels.provinceLabel
      }
    ];

    const chosen = levels.find((entry) => selectedGeography[entry.key]);
    if (!chosen) return;

    const id = selectedGeography[chosen.key];
    setAreaTargets((current) => (
      current.some((target) => target.id === id)
        ? current
        : [...current, { id, level: chosen.level, field: chosen.field, label: chosen.label || chosen.level }]
    ));
    setSelectedGeography(EMPTY_GEOGRAPHY);
    setSelectedLabels({});
  }

  function removeAreaTarget(id) {
    setAreaTargets((current) => current.filter((target) => target.id !== id));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      severity: form.severity,
      warningDescription: form.warningDescription.trim(),
      recommendedActions: form.recommendedActions.trim(),
      validFrom: new Date(form.validFrom).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      zoneIds: form.zoneIds,
      // Grouped by level for the server, which resolves each to its wards.
      wardIds: areaTargets.filter((t) => t.field === 'wardIds').map((t) => t.id),
      localLevelIds: areaTargets.filter((t) => t.field === 'localLevelIds').map((t) => t.id),
      districtIds: areaTargets.filter((t) => t.field === 'districtIds').map((t) => t.id),
      provinceIds: areaTargets.filter((t) => t.field === 'provinceIds').map((t) => t.id)
    };

    try {
      if (isEditing) {
        await updateAlert(id, payload);
      } else {
        await createAlert(payload);
      }

      notify({
        tone: 'success',
        title: isEditing ? 'Alert draft updated' : 'Alert draft saved',
        message: 'Review the draft before publishing it to residents.',
        icon: 'check'
      });
      navigate('/officer/alerts');
    } catch (caughtError) {
      notify({
        tone: 'danger',
        title: 'Alert not saved',
        message: caughtError.message || 'We could not save this alert draft.',
        icon: 'warning',
        duration: 6000
      });
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
          <legend className="form-label fw-semibold">Affected areas</legend>
          {zones.length === 0 ? (
            <p className="text-secondary mb-0">No active operational risk areas are available.</p>
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
          <p className="form-text">Risk areas are optional operational groupings. Official Nepal locations below are the primary warning targets.</p>

          <div className="border-top pt-3 mt-3">
            <GeographySelector
              value={selectedGeography}
              onChange={setSelectedGeography}
              onLabelsChange={setSelectedLabels}
              required={false}
            />
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addAreaTarget}
                disabled={!selectedGeography.provinceId}
              >
                Add this area
              </button>
              <span className="form-text mb-0">
                Stop at a district to warn the whole district. Continue to a ward to warn only that ward.
              </span>
            </div>

            {areaTargets.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mt-3">
                {areaTargets.map((target) => (
                  <span className="badge text-bg-light border d-inline-flex align-items-center gap-2" key={target.id}>
                    <span className="text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.06em' }}>
                      {target.level}
                    </span>
                    {target.label}
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      style={{ fontSize: '0.55rem' }}
                      onClick={() => removeAreaTarget(target.id)}
                      aria-label={`Remove ${target.label}`}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
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

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={submitting || (form.zoneIds.length === 0 && form.wardIds.length === 0)}>
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
