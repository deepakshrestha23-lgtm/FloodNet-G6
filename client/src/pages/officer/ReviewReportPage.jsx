import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchEvidenceUrl, fetchReportDossier, submitReview } from '../../services/officerApi';
import { useApiResource } from '../../hooks/useApiResource';
import { useFeedback } from '../../context/FeedbackContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import FloodMap from '../../components/map/FloodMap';
import { hasValidCoordinates, openStreetMapUrl } from '../../config/map';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import {
  REPORT_STATUS,
  OBSERVED_SEVERITY,
  ROAD_CONDITION,
  REVIEW_ACTION,
  FLOOD_TYPE,
  describe
} from '../../utils/enums';
import { describeArea, formatDateTime, formatRelative, fullName } from '../../utils/formatters';

/**
 * The decisions an officer can take. Notes are mandatory where the resident
 * needs to understand why their report was not accepted as verified.
 */
const DECISIONS = [
  {
    action: 'VERIFY',
    label: 'Verify report',
    variant: 'success',
    notesRequired: false,
    confirmTitle: 'Verify this report?',
    confirmDescription:
      'Verifying records that an authorised officer has assessed this community report as sufficiently supported for inclusion in FloodNet verified incident information. It does not publish an alert.'
  },
  {
    action: 'MORE_INFORMATION_REQUIRED',
    label: 'Request more information',
    variant: 'info',
    notesRequired: true,
    confirmTitle: 'Request more information?',
    confirmDescription:
      'The report returns to the resident, who can update it and resubmit for review. Your notes are shown to them.'
  },
  {
    action: 'REJECT',
    label: 'Reject report',
    variant: 'danger',
    notesRequired: true,
    confirmTitle: 'Reject this report?',
    confirmDescription: 'Rejecting removes this report from the verified incident information. Your notes are shown to the resident.'
  },
  {
    action: 'CLOSE',
    label: 'Close report',
    variant: 'secondary',
    notesRequired: false,
    confirmTitle: 'Close this report?',
    confirmDescription: 'Closing marks the incident as no longer active. Verified reports remain in the incident history.'
  }
];

function DetailRow({ label, children }) {
  return (
    <div className="col-12 col-md-6">
      <dt className="small text-secondary fw-semibold">{label}</dt>
      <dd className="mb-3">{children}</dd>
    </div>
  );
}

function ReviewReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();

  const loader = useCallback(() => fetchReportDossier(id), [id]);
  const { data, loading, error, reload } = useApiResource(loader);

  const [activeDecision, setActiveDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [previewUrls, setPreviewUrls] = useState({});
  const [evidenceLoadingId, setEvidenceLoadingId] = useState(null);
  const [evidenceErrors, setEvidenceErrors] = useState({});

  /**
   * Requests a short-lived access link for one evidence photograph. The link is
   * held in component state only, so it is never persisted anywhere.
   */
  async function loadEvidence(evidenceId) {
    if (previewUrls[evidenceId]) {
      setPreviewUrls((current) => {
        const next = { ...current };
        delete next[evidenceId];
        return next;
      });
      return;
    }

    setEvidenceLoadingId(evidenceId);
    setEvidenceErrors((current) => ({ ...current, [evidenceId]: null }));

    try {
      const payload = await fetchEvidenceUrl(id, evidenceId);
      setPreviewUrls((current) => ({ ...current, [evidenceId]: payload.data.downloadUrl }));
    } catch (caughtError) {
      setEvidenceErrors((current) => ({
        ...current,
        [evidenceId]: caughtError.message || 'The evidence photograph could not be opened.'
      }));
    } finally {
      setEvidenceLoadingId(null);
    }
  }

  function openDecision(decision) {
    setActiveDecision(decision);
    setNotes('');
  }

  async function confirmDecision() {
    if (!activeDecision) return;

    if (activeDecision.notesRequired && notes.trim().length < 3) {
      notify({ tone: 'warning', title: 'Review notes required', message: 'Add at least three characters before confirming this decision.', icon: 'warning' });
      return;
    }

    setSubmitting(true);
    const decisionLabel = activeDecision.label;

    try {
      await submitReview(id, {
        action: activeDecision.action,
        ...(notes.trim() ? { notes: notes.trim() } : {})
      });

      setActiveDecision(null);
      await reload();
      notify({
        tone: 'success',
        title: decisionLabel,
        message: 'The report status and review history have been updated.',
        icon: 'check',
        duration: 6000
      });
    } catch (caughtError) {
      notify({
        tone: 'danger',
        title: 'Review not saved',
        message: caughtError.message || 'We could not save this review decision.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading report..." />;
  if (error) return <ErrorState message={error.message} details={error.details} onRetry={reload} />;

  const { report, statusHistory, reviews, evidence } = data;
  const isReviewable = ['PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED', 'VERIFIED'].includes(report.status);
  const hasReportCoordinates = hasValidCoordinates(report.latitude, report.longitude);

  return (
    <>
      <PageHeader
        eyebrow="Report review"
        title={report.reportReference}
        icon="inbox"
        description={`Submitted ${formatRelative(report.createdAt)} for ${describeArea(report)}.`}
        actions={
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            Back to queue
          </button>
        }
      />

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <section className="panel-card p-3 p-md-4 rounded-4 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <h2 className="h6 fw-semibold mb-0">Reported incident</h2>
              <StatusBadge map={REPORT_STATUS} value={report.status} />
            </div>

            <dl className="row g-0 mb-0">
              <DetailRow label="Administrative location">{describeArea(report)}</DetailRow>
              <DetailRow label="Operational risk area">
                {report.zone
                  ? <>{report.zone.name} {report.zone.code && <span className="text-secondary">({report.zone.code})</span>}</>
                  : <span className="text-secondary">None selected</span>}
              </DetailRow>
              <DetailRow label="Observed at">{formatDateTime(report.observedAt)}</DetailRow>
              <DetailRow label="Resident-observed severity">
                <StatusBadge map={OBSERVED_SEVERITY} value={report.observedSeverity} />
              </DetailRow>
              <DetailRow label="Road condition">
                <StatusBadge map={ROAD_CONDITION} value={report.roadCondition} />
              </DetailRow>
              <DetailRow label="Flood type">{describe(FLOOD_TYPE, report.floodType).label}</DetailRow>
              {/* Triage depends on this figure, so a non-zero count is emphasised
                  rather than left to blend into the surrounding detail rows. */}
              <DetailRow label="People at immediate risk">
                {report.peopleAtRisk > 0
                  ? <strong className="text-danger">{report.peopleAtRisk.toLocaleString()}</strong>
                  : <span className="text-secondary">None reported</span>}
              </DetailRow>
              <DetailRow label="Locality / Tole">
                {report.locality || <span className="text-secondary">Not provided</span>}
              </DetailRow>
              <DetailRow label="Nearest landmark">
                {report.nearestLandmark || <span className="text-secondary">Not provided</span>}
              </DetailRow>
              <DetailRow label="Reported coordinates">
                {hasReportCoordinates
                  ? (
                    <a
                      href={openStreetMapUrl(report.latitude, report.longitude)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}
                    </a>
                  )
                  : <span className="text-secondary">Not captured</span>}
              </DetailRow>
              <div className="col-12">
                <dt className="small text-secondary fw-semibold">Location description</dt>
                <dd className="mb-3">{report.locationDescription}</dd>
              </div>
              <div className="col-12">
                <dt className="small text-secondary fw-semibold">Incident description</dt>
                <dd className="mb-0 preserve-lines">{report.incidentDescription}</dd>
              </div>
            </dl>

            {hasReportCoordinates && (
              <div className="mt-4">
                <h3 className="h6 fw-semibold mb-1">Incident map</h3>
                <p className="small text-secondary mb-2">
                  Use this point alongside the official ward, resident description and evidence during review.
                </p>
                <FloodMap
                  ariaLabel={`Officer map for report ${report.reportReference}`}
                  height="22rem"
                  markers={[{
                    id: report.id,
                    latitude: report.latitude,
                    longitude: report.longitude,
                    title: report.reportReference,
                    description: report.locationDescription,
                    detail: describeArea(report),
                    tone: report.peopleAtRisk > 0 ? 'danger' : 'warning'
                  }]}
                />
              </div>
            )}
          </section>

          <section className="panel-card p-3 p-md-4 rounded-4 mb-3">
            <h2 className="h6 fw-semibold mb-1">Evidence</h2>
            <p className="small text-secondary mb-3">
              Photographs are held in private storage. Opening one generates a short-lived
              access link for you only.
            </p>

            {evidence.length === 0 ? (
              <p className="text-secondary mb-0">No evidence files were attached to this report.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {evidence.map((file) => (
                  <li key={file.id} className="border-bottom py-2">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <span className="text-break">{file.originalFilename}</span>
                      <span className="d-flex align-items-center gap-2">
                        <span className="small text-secondary">
                          {(file.sizeBytes / 1024).toFixed(0)} KB · {formatDateTime(file.createdAt)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => loadEvidence(file.id)}
                          disabled={evidenceLoadingId === file.id}
                        >
                          {evidenceLoadingId === file.id
                            ? 'Opening...'
                            : previewUrls[file.id] ? 'Hide' : 'View photo'}
                        </button>
                      </span>
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

          <section className="panel-card p-3 p-md-4 rounded-4">
            <h2 className="h6 fw-semibold mb-3">Review and status history</h2>

            {reviews.length === 0 && statusHistory.length === 0 && (
              <p className="text-secondary mb-0">No history recorded yet.</p>
            )}

            {reviews.length > 0 && (
              <div className="mb-4">
                <h3 className="small text-secondary fw-semibold text-uppercase mb-2">Officer decisions</h3>
                {reviews.map((review, index) => (
                  <div className="timeline-item" key={`${review.createdAt}-${index}`}>
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <StatusBadge map={REVIEW_ACTION} value={review.action} />
                      <span className="small text-secondary">{formatDateTime(review.createdAt)}</span>
                    </div>
                    {review.notes && <p className="mb-0 mt-2 preserve-lines">{review.notes}</p>}
                    {review.reviewerName && (
                      <p className="small text-secondary mb-0 mt-1">Reviewed by {review.reviewerName}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {statusHistory.length > 0 && (
              <div>
                <h3 className="small text-secondary fw-semibold text-uppercase mb-2">Status changes</h3>
                {statusHistory.map((entry, index) => (
                  <div className="timeline-item" key={`${entry.createdAt}-${index}`}>
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <span className="small">
                        {entry.oldStatus ? `${describe(REPORT_STATUS, entry.oldStatus).label} → ` : ''}
                        <strong>{describe(REPORT_STATUS, entry.newStatus).label}</strong>
                      </span>
                      <span className="small text-secondary">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    {entry.reason && <p className="small mb-0 mt-1 text-secondary">{entry.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="panel-card p-3 p-md-4 rounded-4 mb-3">
            <h2 className="h6 fw-semibold mb-3">Reporter</h2>
            <dl className="mb-0">
              <dt className="small text-secondary fw-semibold">Name</dt>
              <dd className="mb-2">{fullName(report.reporter)}</dd>
              <dt className="small text-secondary fw-semibold">Email</dt>
              <dd className="mb-2 text-break">{report.reporter.email}</dd>
              <dt className="small text-secondary fw-semibold">Phone</dt>
              <dd className="mb-0">{report.reporter.phone || 'Not provided'}</dd>
            </dl>
          </section>

          <section className="panel-card p-3 p-md-4 rounded-4">
            <h2 className="h6 fw-semibold mb-1">Review decision</h2>
            <p className="small text-secondary">
              Verification does not publish an alert. Alerts are created separately from the
              {' '}
              <Link to="/officer/alerts/new">alert composer</Link>.
            </p>

            {!isReviewable ? (
              <p className="mb-0 text-secondary">
                This report is {describe(REPORT_STATUS, report.status).label.toLowerCase()} and cannot be reviewed further.
              </p>
            ) : (
              <div className="d-grid gap-2">
                {DECISIONS.filter((decision) => {
                  if (report.status === 'VERIFIED') return decision.action === 'CLOSE';
                  if (report.status === 'MORE_INFORMATION_REQUIRED') {
                    return decision.action !== 'MORE_INFORMATION_REQUIRED';
                  }
                  return true;
                }).map((decision) => (
                  <button
                    key={decision.action}
                    type="button"
                    className={`btn btn-${decision.variant}`}
                    onClick={() => openDecision(decision)}
                  >
                    {decision.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmationModal
        open={Boolean(activeDecision)}
        title={activeDecision?.confirmTitle || ''}
        description={activeDecision?.confirmDescription}
        confirmLabel={activeDecision?.label || 'Confirm'}
        confirmVariant={activeDecision?.variant || 'primary'}
        busy={submitting}
        onCancel={() => setActiveDecision(null)}
        onConfirm={confirmDecision}
      >
        <div>
          <label className="form-label fw-semibold" htmlFor="review-notes">
            Review notes {activeDecision?.notesRequired ? '(required)' : '(optional)'}
          </label>
          <textarea
            id="review-notes"
            className="form-control"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Explain the decision for the resident and the audit record."
          />
        </div>
      </ConfirmationModal>
    </>
  );
}

export default ReviewReportPage;
