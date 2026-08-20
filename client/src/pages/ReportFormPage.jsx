import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  MAX_EVIDENCE_FILES,
  isEvidenceServiceConfigured,
  uploadEvidenceFiles,
  validateEvidenceFiles
} from '../services/evidence';

const initialForm = {
  zoneId: '',
  locationDescription: '',
  observedSeverity: 'MODERATE',
  roadCondition: 'UNKNOWN',
  incidentDescription: '',
  observedAt: ''
};

function toLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function ReportFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ ...initialForm, observedAt: toLocalDateTime(new Date()) });
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [savedReportId, setSavedReportId] = useState(null);

  useEffect(() => {
    let active = true;
    const requests = [apiRequest('/api/public/zones', {}, false)];
    if (editing) requests.push(apiRequest(`/api/reports/${id}`, {}, false));

    Promise.all(requests)
      .then(([zonesPayload, reportPayload]) => {
        if (!active) return;
        setZones(zonesPayload.data.zones);
        if (reportPayload) {
          const report = reportPayload.data.report;
          setForm({
            zoneId: report.zone.id,
            locationDescription: report.locationDescription,
            observedSeverity: report.observedSeverity,
            roadCondition: report.roadCondition,
            incidentDescription: report.incidentDescription,
            observedAt: toLocalDateTime(report.observedAt)
          });
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editing, id]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
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
    setError('');
    setSavedReportId(null);

    if (selectedFiles.length > 0 && !isEvidenceServiceConfigured()) {
      setError('Evidence uploads are not enabled for this environment. Remove the selected images or contact the administrator.');
      setSubmitting(false);
      return;
    }

    const body = {
      ...form,
      observedAt: new Date(form.observedAt).toISOString()
    };
    if (editing) delete body.zoneId;

    try {
      const payload = await apiRequest(editing ? `/api/reports/${id}` : '/api/reports', {
        method: editing ? 'PATCH' : 'POST',
        body
      });
      const savedId = payload.data.report.id;
      setSavedReportId(savedId);

      if (selectedFiles.length > 0) {
        setUploadProgress({ completed: 0, total: selectedFiles.length });
        await uploadEvidenceFiles(savedId, selectedFiles, (completed, total) => {
          setUploadProgress({ completed, total });
        });
      }

      navigate(`/reports/${payload.data.report.id}`, { replace: true });
    } catch (requestError) {
      setError(requestError.details?.join('. ') || requestError.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (loading) return <main className="container py-5">Loading report...</main>;

  return (
    <main className="container py-5 page-narrow-wide">
      <div className="mb-4">
        <Link to={editing ? `/reports/${id}` : '/reports'} className="text-decoration-none">← Back to reports</Link>
        <span className="eyebrow d-block mt-4">Resident module</span>
        <h1 className="h2 mt-2">{editing ? 'Provide additional information' : 'Submit a flood report'}</h1>
        <p className="text-secondary">Share clear observations so an authorized Flood Monitoring Officer can review them.</p>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <form className="card border-0 shadow-sm p-4" onSubmit={handleSubmit} noValidate>
        <label className="form-label" htmlFor="report-zone">Flood zone</label>
        <select id="report-zone" className="form-select" required disabled={editing} value={form.zoneId} onChange={(event) => updateField('zoneId', event.target.value)}>
          <option value="">Select a zone</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}{zone.locality ? ` — ${zone.locality}` : ''}</option>)}
        </select>

        <label className="form-label mt-3" htmlFor="report-location">Specific location</label>
        <input id="report-location" className="form-control" maxLength="500" required value={form.locationDescription} onChange={(event) => updateField('locationDescription', event.target.value)} placeholder="Road, landmark or community location" />

        <div className="row g-3 mt-0">
          <div className="col-md-6">
            <label className="form-label mt-3" htmlFor="report-severity">Observed severity</label>
            <select id="report-severity" className="form-select" value={form.observedSeverity} onChange={(event) => updateField('observedSeverity', event.target.value)}>
              <option value="LOW">Low</option>
              <option value="MODERATE">Moderate</option>
              <option value="HIGH">High</option>
              <option value="SEVERE">Severe</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label mt-3" htmlFor="report-road">Road/access condition</label>
            <select id="report-road" className="form-select" value={form.roadCondition} onChange={(event) => updateField('roadCondition', event.target.value)}>
              <option value="CLEAR">Clear</option>
              <option value="RESTRICTED">Restricted</option>
              <option value="BLOCKED">Blocked</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
        </div>

        <label className="form-label mt-3" htmlFor="report-observed-at">Observation date and time</label>
        <input id="report-observed-at" className="form-control" type="datetime-local" required max={toLocalDateTime(new Date())} value={form.observedAt} onChange={(event) => updateField('observedAt', event.target.value)} />

        <label className="form-label mt-3" htmlFor="report-description">Incident description</label>
        <textarea id="report-description" className="form-control" rows="5" maxLength="2000" required value={form.incidentDescription} onChange={(event) => updateField('incidentDescription', event.target.value)} placeholder="Describe what you observed, including access or safety concerns." />

        {isEvidenceServiceConfigured() && (
          <div className="border-top mt-4 pt-4">
            <h2 className="h6">Evidence photos (optional)</h2>
            <p className="text-secondary small mb-2">Attach up to {MAX_EVIDENCE_FILES} JPEG, PNG or WebP images. Each image must be smaller than {MAX_EVIDENCE_FILE_SIZE_BYTES / (1024 * 1024)} MB.</p>
            <input id="report-evidence" className="form-control" type="file" accept={Array.from(ALLOWED_EVIDENCE_TYPES).join(',')} multiple onChange={handleFileSelection} />
            {fileError && <div className="text-danger small mt-2" role="alert">{fileError}</div>}
            {selectedFiles.length > 0 && (
              <ul className="small text-secondary mt-2 mb-0">
                {selectedFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
              </ul>
            )}
            {uploadProgress && <div className="small text-secondary mt-2">Uploading evidence {uploadProgress.completed} of {uploadProgress.total}...</div>}
          </div>
        )}

        <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
          <Link className="btn btn-outline-secondary" to={editing ? `/reports/${id}` : '/reports'}>Cancel</Link>
          <button className="btn btn-primary" type="submit" disabled={submitting || !form.zoneId || !form.observedAt || Boolean(fileError)}>
            {uploadProgress ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}...` : submitting ? 'Submitting...' : editing ? 'Submit additional information' : 'Submit report'}
          </button>
        </div>
        {savedReportId && error && <Link className="d-block text-danger small mt-3" to={`/reports/${savedReportId}`}>View the saved report</Link>}
      </form>
    </main>
  );
}

export default ReportFormPage;
