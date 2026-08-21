import PageHeader from '../../components/common/PageHeader';
import Icon from '../../components/common/Icon';

/** Nepal's national emergency numbers, shown so residents don't have to look them up mid-flood. */
const EMERGENCY_NUMBERS = [
  { label: 'Nepal Police', number: '100' },
  { label: 'Ambulance', number: '102' },
  { label: 'Fire Brigade', number: '101' },
  { label: 'National Emergency Operation Centre', number: '1155' },
  { label: 'Nepal Red Cross Society', number: '1130' }
];

/**
 * Static preparedness guidance. It is deliberately short and scannable because
 * it may be read on a phone under stress.
 */
const GUIDANCE = [
  {
    id: 'before',
    title: 'Before a flood',
    tone: 'info',
    icon: 'shield',
    items: [
      'Know your ward and local level, and check FloodNet alerts for your area regularly.',
      'Agree a meeting point with your household in case you are separated.',
      'Keep an emergency bag ready: water, medication, torch, power bank, copies of identity documents.',
      'Store important documents and valuables above expected water levels.',
      'Identify the nearest evacuation centre and more than one route to reach it.'
    ]
  },
  {
    id: 'during',
    title: 'During a flood',
    tone: 'danger',
    icon: 'warning',
    items: [
      'Do not walk or drive through floodwater. Shallow moving water can knock you off your feet.',
      'Move to the highest safe level of your building if you cannot leave.',
      'Turn off electricity at the mains only if it is safe and dry to do so.',
      'Follow instructions from evacuation officers and emergency services.',
      'Report what you can see safely through FloodNet so officers can build an accurate picture.'
    ]
  },
  {
    id: 'after',
    title: 'After a flood',
    tone: 'success',
    icon: 'check',
    items: [
      'Return home only when officers or emergency services confirm it is safe.',
      'Assume floodwater is contaminated. Wash thoroughly after any contact.',
      'Do not use electrical appliances that have been in contact with water until checked.',
      'Photograph damage before cleaning up, for insurance purposes.',
      'Check on neighbours who may need assistance, particularly older or disabled residents.'
    ]
  }
];

function PreparednessPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resident"
        title="Flood preparedness"
        description="Practical guidance for before, during and after a flood."
        icon="shield"
      />

      <div className="alert alert-danger d-flex flex-wrap gap-2 align-items-center" role="alert">
        <Icon name="warning" size={20} strokeWidth={2.2} />
        <strong>In immediate danger? Call Nepal Police on 100.</strong>
        <span>
          FloodNet is an information and coordination platform, not an emergency call service.
        </span>
      </div>

      <div className="row g-3">
        {GUIDANCE.map((section) => (
          <div className="col-12 col-lg-4" key={section.id}>
            <section className={`panel-card guidance-card guidance-card-${section.tone} p-3 p-md-4 h-100`}>
              <span className="guidance-icon">
                <Icon name={section.icon} size={22} strokeWidth={1.9} />
              </span>
              <h2 className="h5 fw-bold mb-3">{section.title}</h2>
              <ul className="guidance-list mb-0">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </div>
        ))}
      </div>

      <section className="panel-card p-3 p-md-4 mt-4">
        <h2 className="h5 fw-bold fn-section-title mb-3">
          <Icon name="phone" size={18} />
          Nepal emergency contacts
        </h2>

        <div className="row g-2 mb-4">
          {EMERGENCY_NUMBERS.map((contact) => (
            <div className="col-12 col-sm-6 col-lg" key={contact.label}>
              <a
                className="fn-facility-chip text-decoration-none w-100 justify-content-between"
                href={`tel:${contact.number}`}
              >
                <span>{contact.label}</span>
                <strong>{contact.number}</strong>
              </a>
            </div>
          ))}
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <h3 className="h6 fw-semibold mb-1">Evacuation centres</h3>
            <p className="small text-secondary mb-0">
              Contact details for each centre are shown on the evacuation centres page.
            </p>
          </div>
          <div className="col-12 col-md-4">
            <h3 className="h6 fw-semibold mb-1">FloodNet reports</h3>
            <p className="small text-secondary mb-0">
              Submit what you observe through FloodNet. Reports are reviewed by flood monitoring officers.
            </p>
          </div>
          <div className="col-12 col-md-4">
            <h3 className="h6 fw-semibold mb-1">Provincial disaster offices</h3>
            <p className="small text-secondary mb-0">
              Your district emergency operation centre (DEOC) can coordinate rescue and relief locally.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default PreparednessPage;
