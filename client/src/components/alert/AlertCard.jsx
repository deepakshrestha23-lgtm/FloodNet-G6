import StatusBadge from '../common/StatusBadge';
import Icon from '../common/Icon';
import { ALERT_SEVERITY } from '../../utils/enums';
import { formatDateTime } from '../../utils/formatters';

/**
 * Displays a published FloodNet alert. The severity drives the accent, an icon
 * and a badge carrying its written label, so urgency is never signalled by
 * colour alone.
 */
function AlertCard({ alert }) {
  const severity = alert.severity.toLowerCase();
  const severityIcon = severity === 'emergency' || severity === 'warning' ? 'warning' : 'megaphone';

  return (
    <article className={`alert-card alert-card-${severity} p-3 p-md-4 h-100`}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <Icon name={severityIcon} size={18} strokeWidth={2} />
          <StatusBadge map={ALERT_SEVERITY} value={alert.severity} />
        </div>
        <span className="alert-card-ref">{alert.alertReference}</span>
      </div>

      <h3 className="h5 fw-bold mb-2">{alert.title}</h3>

      <div className="d-flex flex-wrap gap-1 mb-3">
        {([...((alert.zones || []).map((zone) => ({ key: zone.id || zone.name, label: zone.name }))), ...((alert.wards || []).map((ward) => ({ key: ward.id || ward.name, label: `${ward.name}, ${ward.localLevel}` })))]).length > 0 ? (
          [...((alert.zones || []).map((zone) => ({ key: zone.id || zone.name, label: zone.name }))), ...((alert.wards || []).map((ward) => ({ key: ward.id || ward.name, label: `${ward.name}, ${ward.localLevel}` })))].map((target) => (
            <span className="fn-zone-chip" key={target.key}>
              <Icon name="pin" size={12} strokeWidth={2} />
              {target.label}
            </span>
          ))
        ) : (
          <span className="small text-secondary">No geographic targets listed</span>
        )}
      </div>

      <h4 className="alert-card-heading mb-1">
        <Icon name="eye" size={13} strokeWidth={2} />
        What is happening
      </h4>
      <p className="preserve-lines mb-3">{alert.warningDescription}</p>

      <h4 className="alert-card-heading mb-1">
        <Icon name="shield" size={13} strokeWidth={2} />
        What you should do
      </h4>
      <p className="preserve-lines mb-3">{alert.recommendedActions}</p>

      <p className="small text-secondary mb-0 d-flex align-items-center gap-2">
        <Icon name="clock" size={14} />
        In effect from {formatDateTime(alert.validFrom)} until {formatDateTime(alert.expiresAt)}.
      </p>
    </article>
  );
}

export default AlertCard;
