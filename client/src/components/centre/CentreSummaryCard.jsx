import StatusBadge from '../common/StatusBadge';
import { CENTRE_STATUS } from '../../utils/enums';
import { formatNumber } from '../../utils/formatters';

/**
 * Read-only view of an evacuation centre for residents and public visitors.
 * It shows capacity and facilities but no operational or personal details.
 */
function CentreSummaryCard({ centre }) {
  const occupancyRate = centre.maximumCapacity > 0
    ? Math.round((centre.currentOccupancy / centre.maximumCapacity) * 100)
    : 0;

  const isFull = centre.operationalStatus === 'FULL' || centre.availableSpace === 0;

  return (
    <article className="panel-card p-3 p-md-4 rounded-4 h-100 d-flex flex-column">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 className="h6 fw-semibold mb-1">{centre.name}</h3>
          <p className="small text-secondary mb-0">{centre.zone.name}</p>
        </div>
        <StatusBadge map={CENTRE_STATUS} value={centre.operationalStatus} />
      </div>

      <p className="small mb-3">{centre.locationDescription}</p>

      <div className="capacity-meter mb-1" role="img" aria-label={`${occupancyRate}% occupied`}>
        <div
          className={`capacity-meter-fill capacity-${centre.operationalStatus.toLowerCase()}`}
          style={{ width: `${Math.min(occupancyRate, 100)}%` }}
        />
      </div>

      <p className="small mb-3">
        <strong className={isFull ? 'text-danger' : 'text-success'}>
          {isFull ? 'No spaces available' : `${formatNumber(centre.availableSpace)} spaces available`}
        </strong>
        <span className="text-secondary">
          {' '}· {formatNumber(centre.currentOccupancy)} of {formatNumber(centre.maximumCapacity)} occupied
        </span>
      </p>

      {centre.facilities.length > 0 && (
        <>
          <h4 className="text-uppercase small fw-semibold text-secondary mb-1">Facilities</h4>
          <ul className="list-unstyled d-flex flex-wrap gap-1 mb-3">
            {centre.facilities.map((facility) => (
              <li key={facility.code || facility.id} className="badge text-bg-light border">
                {facility.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {centre.contactPhone && (
        <p className="small mb-0 mt-auto">
          Contact: <a href={`tel:${centre.contactPhone}`}>{centre.contactPhone}</a>
        </p>
      )}
    </article>
  );
}

export default CentreSummaryCard;
