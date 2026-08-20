import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { getEvidenceAccessUrl, isEvidenceServiceConfigured } from '../services/evidence';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function ReportDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrls, setPreviewUrls] = useState({});
  const [openingEvidenceId, setOpeningEvidenceId] = useState(null);

  useEffect(() => {
    Promise.all([
      apiRequest(`/api/reports/${id}/history`),
      apiRequest(`/api/reports/${id}/evidence`)
    ])
      .then(([historyPayload, evidencePayload]) => setData({ ...historyPayload.data, evidence: evidencePayload.data.evidence }))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="container py-5">Loading report...</main>;
  if (error) return <main className="container py-5"><div className="alert alert-danger" role="alert">{error}</div></main>;

  const { report, statusHistory, reviews, evidence } = data;
  const canEdit = report.status === 'MORE_INFORMATION_REQUIRED';

  async function openEvidence(file) {
    setOpeningEvidenceId(file.id);
    setError('');
    try {
      const access = await getEvidenceAccessUrl(report.id, file.id);
      setPreviewUrls((current) => ({ ...current, [file.id]: access.downloadUrl }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOpeningEvidenceId(null);
    }
  }

  return (
    <main className="container py-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
        <div>
          <Link to="/reports" className="text-decoration-none">← Back to reports</Link>
          <span className="eyebrow d-block mt-4">Report details</span>
          <h1 className="h2 mt-2 mb-1">{report.reportReference}</h1>
          <p className="text-secondary mb-0">{report.zone.name} · {report.locationDescription}</p>
        </div>
        {canEdit && <Link className="btn btn-warning" to={`/reports/${report.id}/edit`}>Provide additional information</Link>}
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <section className="card border-0 shadow-sm p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Current report</h2>
              <span className="badge text-bg-secondary">{report.status.replaceAll('_', ' ')}</span>
            </div>
            <dl className="row mb-0">
              <dt className="col-sm-5">Observed severity</dt><dd className="col-sm-7">{report.observedSeverity}</dd>
              <dt className="col-sm-5">Road condition</dt><dd className="col-sm-7">{report.roadCondition}</dd>
              <dt className="col-sm-5">Observed at</dt><dd className="col-sm-7">{formatDate(report.observedAt)}</dd>
              <dt className="col-sm-5">Submitted at</dt><dd className="col-sm-7">{formatDate(report.createdAt)}</dd>
            </dl>
            <hr />
            <h3 className="h6">Description</h3>
            <p className="mb-0">{report.incidentDescription}</p>
          </section>
        </div>

        <div className="col-lg-5">
          <section className="card border-0 shadow-sm p-4 h-100">
            <h2 className="h5 mb-3">Status history</h2>
            <div className="timeline-list">
              {statusHistory.map((entry, index) => (
                <div className="timeline-item" key={`${entry.createdAt}-${index}`}>
                  <div className="fw-semibold">{entry.newStatus.replaceAll('_', ' ')}</div>
                  <div className="text-secondary small">{formatDate(entry.createdAt)} · {entry.changedByRole.replaceAll('_', ' ')}</div>
                  {entry.reason && <div className="small mt-1">{entry.reason}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="card border-0 shadow-sm p-4 mt-4">
        <h2 className="h5">Officer feedback</h2>
        {reviews.length === 0 && <p className="text-secondary mb-0">No officer feedback has been recorded yet.</p>}
        {reviews.map((review, index) => (
          <div className="border-top pt-3 mt-3" key={`${review.createdAt}-${index}`}>
            <div className="fw-semibold">{review.action.replaceAll('_', ' ')}</div>
            <div className="text-secondary small">{formatDate(review.createdAt)}</div>
            {review.notes && <p className="mb-0 mt-2">{review.notes}</p>}
          </div>
        ))}
      </section>

      {isEvidenceServiceConfigured() && <section className="card border-0 shadow-sm p-4 mt-4">
        <h2 className="h5">Evidence files</h2>
        {evidence.length === 0 && <p className="text-secondary mb-0">No evidence files have been attached.</p>}
        {evidence.length > 0 && (
          <ul className="list-group list-group-flush">
            {evidence.map((file) => (
              <li className="list-group-item px-0" key={file.id}>
                <div className="d-flex justify-content-between align-items-center gap-3">
                  <span className="text-break">{file.originalFilename}</span>
                  <button className="btn btn-sm btn-outline-primary flex-shrink-0" type="button" onClick={() => openEvidence(file)} disabled={openingEvidenceId === file.id}>
                    {openingEvidenceId === file.id ? 'Opening...' : 'View photo'}
                  </button>
                </div>
                {previewUrls[file.id] && <img className="img-fluid rounded mt-3 evidence-preview" src={previewUrls[file.id]} alt={`Flood evidence: ${file.originalFilename}`} />}
              </li>
            ))}
          </ul>
        )}
      </section>}
    </main>
  );
}

export default ReportDetailPage;
