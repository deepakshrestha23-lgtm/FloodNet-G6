import Icon from './Icon';
import { formatNumber } from '../../utils/formatters';

/**
 * A single dashboard figure. Every value shown here originates from a database
 * aggregation returned by the API; the icon and accent are presentation only.
 */
function DashboardStatCard({ label, value, hint, tone = 'default', isPercent = false, icon }) {
  return (
    <div className={`stat-card stat-card-${tone} h-100 p-3 p-md-4`}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <p className="stat-card-label mb-0">{label}</p>
        {icon && (
          <span className="stat-card-icon">
            <Icon name={icon} size={17} strokeWidth={1.9} />
          </span>
        )}
      </div>

      <p className="stat-card-value mb-0">
        {isPercent ? `${value}%` : formatNumber(value)}
      </p>

      {hint && <p className="stat-card-hint mb-0 mt-1">{hint}</p>}

      <div className="stat-card-spark" aria-hidden="true" />
    </div>
  );
}

export default DashboardStatCard;
