import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { useFeedback } from '../../context/FeedbackContext';
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  MAX_EVIDENCE_FILES,
  isEvidenceServiceConfigured,
  uploadEvidenceFiles,
  validateEvidenceFiles
} from '../../services/evidence';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import CoordinateField from '../../components/common/CoordinateField';
import { FLOOD_TYPE, OBSERVED_SEVERITY, ROAD_CONDITION, toOptions } from '../../utils/enums';
import { toDateTimeLocalValue } from '../../utils/formatters';

const initialForm = {
  ...EMPTY_GEOGRAPHY,
  zoneId: '',
  locality: '',
  nearestLandmark: '',
  latitude: '',
  longitude: '',
  floodType: 'UNKNOWN',
  peopleAtRisk: 0,
  locationDescription: '',
  observedSeverity: 'MODERATE',
  roadCondition: 'UNKNOWN',
  incidentDescription: '',
  observedAt: ''
};

function ReportFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const editing = Boolean(id);
  const [form, setForm] = useState({ ...initialForm, observedAt: toDateTimeLocalValue(new Date()) });
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    let active = true;
    const requests = [apiRequest('/api/public/zones')];
    if (editing) requests.push(apiRequest(`/api/reports/${id}`));

    Promise.all(requests)
      .then(([zonesPayload, reportPayload]) => {
        if (!active) return;
        setZones(zonesPayload.data.zones);
        if (reportPayload) {
          const report = reportPayload.data.report;
          const geography = report.geography || EMPTY_GEOGRAPHY;
          setForm({
            ...initialForm,
            provinceId: geography.province?.id || '',
            districtId: geography.district?.id || '',
            localLevelId: geography.localLevel?.id || '',
            wardId: geography.ward?.id || '',
            zoneId: report.zone?.id || '',
            locality: report.locality || '',
            nearestLandmark: report.nearestLandmark || '',
            latitude: report.latitude ?? '',
            longitude: report.longitude ?? '',
            floodType: report.floodType || 'UNKNOWN',
            peopleAtRisk: report.peopleAtRisk || 0,
            locationDescription: report.locationDescription,
            observedSeverity: report.observedSeverity,
            roadCondition: report.roadCondition,
            incidentDescription: report.incidentDescription,
            observedAt: toDateTimeLocalValue(report.observedAt)
          });
        }
      })
      .catch((requestError) => { if (active) setError(requestError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, id]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGeography(value) {
    setForm((current) => ({ ...current, ...value }));
  }

  function handleFileSelection(event) {
    const files = Array.from(event.target.files || []);
    const validationError = validateEvidenceFiles(files);
    setFileError(validationError);
    setSelectedFiles(validationError ? [] : files);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    if (selectedFiles.length > 0 && !isEvidenceServiceConfigured()) {
      notify({ tone: 'warning', title: 'Photograph upload unavailable', message: 'Remove the selected images or configure the evidence service before submitting.', icon: 'warning', duration: 6000 });
      setSubmitting(false);
      return;
    }

    const body = {
      ...form,
      locality: form.locality.trim(),
      nearestLandmark: form.nearestLandmark.trim(),
      locationDescription: form.locationDescription.trim(),
      incidentDescription: form.incidentDescription.trim(),
      peopleAtRisk: Number(form.peopleAtRisk || 0),
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      observedAt: new Date(form.observedAt).toISOString()
    };

    delete body.provinceId;
    delete body.districtId;
    delete body.localLevelId;

    if (editing) {
      delete body.zoneId;
      delete body.wardId;
    }

    try {
      const payload = await apiRequest(editing ? `/api/reports/${id}` : '/api/reports', {
        method: editing ? 'PATCH' : 'POST',
        body
      });
      const savedId = payload.data.report.id;

      if (selectedFiles.length > 0) {
        setUploadProgress({ completed: 0, total: selectedFiles.length });
        await uploadEvidenceFiles(savedId, selectedFiles, (completed, total) => setUploadProgress({ completed, total }));
      }
      notify({
        tone: 'success',
        title: editing ? 'Report resubmitted' : 'Report submitted',
        message: selectedFiles.length > 0 ? 'Your report and photographs are ready for review.' : 'Your report is ready for review.',
        icon: 'check',
        duration: 6000
      });
      navigate(`/resident/reports/${savedId}`, { replace: true });
    } catch (requestError) {
      notify({
        tone: 'danger',
        title: editing ? 'Report not resubmitted' : 'Report not submitted',
        message: requestError.message || 'We could not submit this report.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (loading) return <LoadingState label="Loading the report form..." />;

  const maxObservedAt = toDateTimeLocalValue(new Date());
  const evidenceLimitMb = MAX_EVIDENCE_FILE_SIZE_BYTES / (1024 * 1024);
  const canSubmit = editing ? Boolean(form.observedAt) : Boolean(form.wardId && form.observedAt);

  return (
    <div className="page-narrow-wide mx-auto">
      <PageHeader
        eyebrow="Resident"
        title={editing ? 'Provide additional information' : 'Report flooding'}
        icon="report"
        description={editing ? 'Update the detail the officer requested and resubmit it for review.' : 'Describe what you can see safely. Your official location helps the right team act quickly.'}
        actions={<Link className="btn btn-outline-secondary" to={editing ? `/resident/reports/${id}` : '/resident/reports'}>Cancel</Link>}
      />

      {error && <ErrorState message={error.message} details={error.details} />}
      <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
        <GeographySelector
          value={form}
          onChange={updateGeography}
          disabled={editing}
          required={!editing}
        />
        {editing && <p className="form-text mt-n2">The official administrative location cannot be changed after submission.</p>}

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="report-zone">Operational risk area <span className="text-secondary fw-normal">(optional)</span></label>
          <select id="report-zone" className="form-select" disabled={editing} value={form.zoneId} onChange={(event) => updateField('zoneId', event.target.value)}>
            <option value="">No operational risk area selected</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
          <p className="form-text">Your ward is the official report location. Risk areas are optional analysis groupings such as river corridors or floodplains.</p>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="report-locality">Locality / Tole</label>
            <input id="report-locality" className="form-control" maxLength={160} value={form.locality} onChange={(event) => updateField('locality', event.target.value)} placeholder="Locality, Tole or neighbourhood" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="report-landmark">Nearest landmark</label>
            <input id="report-landmark" className="form-control" maxLength={240} value={form.nearestLandmark} onChange={(event) => updateField('nearestLandmark', event.target.value)} placeholder="Bridge, school, temple or road junction" />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="report-location">Specific location</label>
          <input id="report-location" className="form-control" maxLength={500} required value={form.locationDescription} onChange={(event) => updateField('locationDescription', event.target.value)} placeholder="Road, landmark or community location" />
        </div>

        <CoordinateField
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(value) => setForm((current) => ({ ...current, ...value }))}
          disabled={editing}
          helpText="Pinpoints what you saw. Never put yourself at risk to capture it. You can leave this empty."
        />

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="report-flood-type">Flood type</label><select id="report-flood-type" className="form-select" value={form.floodType} onChange={(event) => updateField('floodType', event.target.value)}>{toOptions(FLOOD_TYPE).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="report-risk">People immediately at risk</label><input id="report-risk" className="form-control" type="number" min="0" max="1000000" value={form.peopleAtRisk} onChange={(event) => updateField('peopleAtRisk', event.target.value)} /></div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="report-severity">Observed severity</label><select id="report-severity" className="form-select" value={form.observedSeverity} onChange={(event) => updateField('observedSeverity', event.target.value)}>{toOptions(OBSERVED_SEVERITY).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="form-text">Describe what you can see. Officers assess it during review.</p></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="report-road">Road or access condition</label><select id="report-road" className="form-select" value={form.roadCondition} onChange={(event) => updateField('roadCondition', event.target.value)}>{toOptions(ROAD_CONDITION).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        </div>

        <div className="mb-3"><label className="form-label fw-semibold" htmlFor="report-observed-at">Observation date and time</label><input id="report-observed-at" className="form-control" type="datetime-local" required max={maxObservedAt} value={form.observedAt} onChange={(event) => updateField('observedAt', event.target.value)} /><p className="form-text">When you saw it. This cannot be in the future.</p></div>
        <div className="mb-3"><label className="form-label fw-semibold" htmlFor="report-description">What did you see?</label><textarea id="report-description" className="form-control" rows={5} maxLength={2000} required value={form.incidentDescription} onChange={(event) => updateField('incidentDescription', event.target.value)} placeholder="Describe the flooding, how deep it looks, and any access or safety concerns." /><p className="form-text">{form.incidentDescription.length} of 2000 characters.</p></div>

        {isEvidenceServiceConfigured() && <fieldset className="border-top pt-3 mb-3"><legend className="form-label fw-semibold">Photographs (optional)</legend><label className="form-label small" htmlFor="report-evidence">Choose up to {MAX_EVIDENCE_FILES} images</label><input id="report-evidence" className="form-control" type="file" accept={Array.from(ALLOWED_EVIDENCE_TYPES).join(',')} multiple onChange={handleFileSelection} /><p className="form-text">JPEG, PNG or WebP, each smaller than {evidenceLimitMb} MB. Only you and the reviewing officer can see them. Never put yourself at risk to take a photograph.</p>{fileError && <div className="alert alert-danger py-2 small mb-2" role="alert">{fileError}</div>}{selectedFiles.length > 0 && <ul className="small text-secondary mb-0">{selectedFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</li>)}</ul>}{uploadProgress && <p className="small text-secondary mb-0 mt-2" role="status">Uploading photograph {uploadProgress.completed} of {uploadProgress.total}...</p>}</fieldset>}

        <div className="d-flex flex-column flex-sm-row gap-2"><button className="btn btn-primary" type="submit" disabled={submitting || !canSubmit || Boolean(fileError)}>{uploadProgress ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}...` : submitting ? 'Submitting...' : editing ? 'Resubmit for review' : 'Submit report'}</button><Link className="btn btn-outline-secondary" to={editing ? `/resident/reports/${id}` : '/resident/reports'}>Cancel</Link></div>
      </form>
    </div>
  );
}

export default ReportFormPage;
