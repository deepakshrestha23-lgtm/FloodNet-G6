import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMyReportHistory } from '../../services/reportApi';
import { apiRequest } from '../../services/api';
import { getEvidenceAccessUrl, isEvidenceServiceConfigured } from '../../services/evidence';
import { useApiResource } from '../../hooks/useApiResource';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import {
  REPORT_STATUS,
  OBSERVED_SEVERITY,
  ROAD_CONDITION,
  REVIEW_ACTION,
  describe
} from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';

function DetailRow({ label, children }) {
  return (
    <div className="col-12 col-sm-6">
      <dt className="small text-secondary fw-semibold">{label}</dt>
      <dd className="mb-3">{children}</dd>
    </div>
  );
}

function ReportDetailPage() {
  const { id } = useParams();

  const loader = useCallback(async () => {
    const [history, evidence] = await Promise.all([
      fetchMyReportHistory(id),
      apiRequest(`/api/reports/${id}/evidence`).catch(() => ({ data: { evidence: [] } }))
    ]);

    return { data: { ...history.data, evidence: evidence.data.evidence } };
  }, [id]);

  const { data, loading, error, reload } = useApiResource(loader);

  const [previewUrls, setPreviewUrls] = useState({});
  const [openingEvidenceId, setOpeningEvidenceId] = useState(null);
  const [evidenceErrors, setEvidenceErrors] = useState({});

  async function toggleEvidence(file) {
    if (previewUrls[file.id]) {
      setPreviewUrls((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });
      return;
    }

    setOpeningEvidenceId(file.id);
    setEvidenceErrors((current) => ({ ...current, [file.id]: null }));

    try {
      const access = await getEvidenceAccessUrl(id, file.id);
      setPreviewUrls((current) => ({ ...current, [file.id]: access.downloadUrl }));
    } catch (requestError) {
      setEvidenceErrors((current) => ({
        ...current,
        [file.id]: requestError.message || 'The photograph could not be opened.'
      }));
    } finally {
      setOpeningEvidenceId(null);
    }
  }

  if (loading) return <LoadingState label="Loading your report..." />;
  if (error) return <ErrorState message={error.message} details={error.details} onRetry={reload} />;

  const { report, statusHistory, reviews, evidence } = data;
  const canEdit = report.status === 'MORE_INFORMATION_REQUIRED';

  return (
    <>
      <PageHeader
        eyebrow="Resident"
        title={report.reportReference}
        icon="report"
        description={`${report.zone.name} · ${report.locationDescription}`}
        actions={
          <>
            <Link className="btn btn-outline-secondary" to="/resident/reports">Back to reports</Link>
            {canEdit && (
              <Link className="btn btn-warning" to={`/resident/reports/${report.id}/edit`}>
                Provide additional information
              </Link>
            )}
          </>
        }
      />

      {canEdit && (
        <div className="alert alert-info" role="alert">
          A flood monitoring officer has asked for more information before they can complete the
          review. Their notes are shown under officer feedback below.
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <section className="panel-card p-3 p-md-4 rounded-4 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <h2 className="h6 fw-semibold mb-0">Your report</h2>
              <StatusBadge map={REPORT_STATUS} value={report.status} />
            </div>

            <dl className="row g-0 mb-0">
              <DetailRow label="Observed severity">
                <StatusBadge map={OBSERVED_SEVERITY} value={report.observedSeverity} />
              </DetailRow>
              <DetailRow label="Road condition">
                <StatusBadge map={ROAD_CONDITION} value={report.roadCondition} />
              </DetailRow>
              <DetailRow label="Observed at">{formatDateTime(report.observedAt)}</DetailRow>
              <DetailRow label="Submitted at">{formatDateTime(report.createdAt)}</DetailRow>
              <div className="col-12">
                <dt className="small text-secondary fw-semibold">Location</dt>
                <dd className="mb-3">{report.locationDescription}</dd>
              </div>
              <div className="col-12">
                <dt className="small text-secondary fw-semibold">What you described</dt>
                <dd className="mb-0 preserve-lines">{report.incidentDescription}</dd>
              </div>
            </dl>
          </section>

          <section className="panel-card p-3 p-md-4 rounded-4">
            <h2 className="h6 fw-semibold mb-3">Officer feedback</h2>

            {reviews.length === 0 ? (
              <p className="text-secondary mb-0">
                No officer feedback has been recorded yet. Reports are reviewed by an authorised
                flood monitoring officer.
              </p>
            ) : (
              reviews.map((review, index) => (
                <div className="timeline-item" key={`${review.createdAt}-${index}`}>
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <StatusBadge map={REVIEW_ACTION} value={review.action} />
                    <span className="small text-secondary">{formatDateTime(review.createdAt)}</span>
                  </div>
                  {review.notes && <p className="mb-0 mt-2 preserve-lines">{review.notes}</p>}
                </div>
              ))
            )}
          </section>
        </div>

        <div className="col-12 col-xl-5">
          <section className="panel-card p-3 p-md-4 rounded-4 mb-3">
            <h2 className="h6 fw-semibold mb-3">Status history</h2>

            {statusHistory.length === 0 ? (
              <p className="text-secondary mb-0">No status changes recorded yet.</p>
            ) : (
              statusHistory.map((entry, index) => (
                <div className="timeline-item" key={`${entry.createdAt}-${index}`}>
                  <div className="fw-semibold small">
                    {entry.oldStatus ? `${describe(REPORT_STATUS, entry.oldStatus).label} → ` : ''}
                    {describe(REPORT_STATUS, entry.newStatus).label}
                  </div>
                  <div className="text-secondary small">{formatDateTime(entry.createdAt)}</div>
                  {entry.reason && <div className="small mt-1">{entry.reason}</div>}
                </div>
              ))
            )}
          </section>

          {isEvidenceServiceConfigured() && (
            <section className="panel-card p-3 p-md-4 rounded-4">
              <h2 className="h6 fw-semibold mb-1">Photographs</h2>
              <p className="small text-secondary mb-3">
                Your photographs are stored privately and are only visible to you and the reviewing officer.
              </p>

              {evidence.length === 0 ? (
                <p className="text-secondary mb-0">No photographs were attached to this report.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {evidence.map((file) => (
                    <li className="border-bottom py-2" key={file.id}>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <span className="text-break small">{file.originalFilename}</span>
                        <button
                          className="btn btn-sm btn-outline-primary flex-shrink-0"
                          type="button"
                          onClick={() => toggleEvidence(file)}
                          disabled={openingEvidenceId === file.id}
                        >
                          {openingEvidenceId === file.id
                            ? 'Opening...'
                            : previewUrls[file.id] ? 'Hide' : 'View photo'}
                        </button>
                      </div>

                      {evidenceErrors[file.id] && (
                        <div className="alert alert-warning py-2 small mt-2 mb-0" role="alert">
                          {evidenceErrors[file.id]}
                        </div>
                      )}

                      {previewUrls[file.id] && (
                        <img
                          className="img-fluid rounded mt-3 evidence-preview"
                          src={previewUrls[file.id]}
                          alt={`Flood evidence: ${file.originalFilename}`}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default ReportDetailPage;
