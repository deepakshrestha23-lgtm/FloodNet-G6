import { formatNumber } from '../../utils/formatters';

/**
 * A single dashboard figure. Every value shown here originates from a database
 * aggregation returned by the API.
 */
function DashboardStatCard({ label, value, hint, tone = 'default', isPercent = false }) {
  return (
    <div className={`stat-card stat-card-${tone} h-100 p-3 rounded-4`}>
      <p className="stat-card-label mb-1">{label}</p>
      <p className="stat-card-value mb-0">
        {isPercent ? `${value}%` : formatNumber(value)}
      </p>
      {hint && <p className="stat-card-hint mb-0 mt-1">{hint}</p>}
    </div>
  );
}

export default DashboardStatCard;
