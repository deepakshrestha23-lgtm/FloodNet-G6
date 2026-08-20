import StatusBadge from '../common/StatusBadge';
import { ALERT_SEVERITY } from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';

/**
 * Displays a published FloodNet alert. The severity drives a left border and a
 * badge carrying its written label, so urgency is never signalled by colour
 * alone.
 */
function AlertCard({ alert }) {
  return (
    <article className={`alert-card alert-card-${alert.severity.toLowerCase()} p-3 p-md-4 rounded-4 h-100`}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <StatusBadge map={ALERT_SEVERITY} value={alert.severity} />
        <span className="small text-secondary">{alert.alertReference}</span>
      </div>

      <h3 className="h5 fw-bold mb-2">{alert.title}</h3>

      <p className="small text-secondary mb-3">
        Affects: {alert.zones.map((zone) => zone.name).join(', ') || 'No zones listed'}
      </p>

      <h4 className="text-uppercase small fw-semibold text-secondary mb-1">What is happening</h4>
      <p className="preserve-lines mb-3">{alert.warningDescription}</p>

      <h4 className="text-uppercase small fw-semibold text-secondary mb-1">What you should do</h4>
      <p className="preserve-lines mb-3">{alert.recommendedActions}</p>

      <p className="small text-secondary mb-0">
        In effect from {formatDateTime(alert.validFrom)} until {formatDateTime(alert.expiresAt)}.
      </p>
    </article>
  );
}

export default AlertCard;
