import Icon from './Icon';

const SCOPE_LABELS = {
  NATIONAL: 'National coverage',
  PROVINCE: 'Province coverage',
  DISTRICT: 'District coverage',
  LOCAL_LEVEL: 'Local-level coverage',
  WARD: 'Ward coverage'
};

function wardLabel(ward) {
  if (!ward) return '';
  const number = ward.number ? `Ward ${ward.number}` : '';
  const name = ward.name && ward.name.toLowerCase() !== number.toLowerCase() ? ward.name : '';
  return [number, name].filter(Boolean).join(' · ');
}

function describeJurisdiction(jurisdiction) {
  if (!jurisdiction) {
    return {
      scope: 'No area assigned',
      title: 'Your jurisdiction has not been assigned yet',
      detail: 'Ask an administrator to assign your operational coverage before you begin work.'
    };
  }

  if (jurisdiction.scopeLevel === 'NATIONAL') {
    return {
      scope: SCOPE_LABELS.NATIONAL,
      title: 'All Nepal',
      detail: 'You can work across the national FloodNet geography.'
    };
  }

  const orderedPlaces = [
    jurisdiction.ward ? wardLabel(jurisdiction.ward) : '',
    jurisdiction.localLevel?.name,
    jurisdiction.district?.name,
    jurisdiction.province?.name
  ].filter(Boolean);

  return {
    scope: SCOPE_LABELS[jurisdiction.scopeLevel] || 'Assigned coverage',
    title: orderedPlaces[0] || 'Assigned area',
    detail: orderedPlaces.slice(1).join(' · ') || 'The administrator has assigned this operational area.'
  };
}

function AssignedJurisdictionCard({ jurisdiction }) {
  const description = describeJurisdiction(jurisdiction);
  const unassigned = !jurisdiction;

  return (
    <section className={`panel-card p-3 p-md-4 rounded-4 mb-4 ${unassigned ? 'border-warning' : ''}`} aria-labelledby="assigned-jurisdiction-title">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div className="d-flex align-items-start gap-3">
          <span className={`rounded-3 p-2 ${unassigned ? 'bg-warning-subtle text-warning-emphasis' : 'bg-info-subtle text-info-emphasis'}`}>
            <Icon name="map" size={22} />
          </span>
          <div>
            <p className="small text-secondary fw-semibold text-uppercase mb-1">Your assigned area</p>
            <h2 id="assigned-jurisdiction-title" className="h5 mb-1">{description.title}</h2>
            <p className="small text-secondary mb-0">{description.detail}</p>
          </div>
        </div>
        <span className={`badge rounded-pill ${unassigned ? 'text-bg-warning' : 'text-bg-info'}`}>
          {description.scope}
        </span>
      </div>

      <div className="mt-3 pt-3 border-top small text-secondary">
        {unassigned
          ? 'Your operational screens will remain unavailable until an administrator assigns a jurisdiction.'
          : 'This is the coverage assigned by an administrator. Dashboard figures, queues and operational actions remain limited to this area.'}
      </div>
    </section>
  );
}

export default AssignedJurisdictionCard;
