import PageHeader from '../../components/common/PageHeader';

/**
 * Static preparedness guidance. It is deliberately short and scannable because
 * it may be read on a phone under stress.
 */
const GUIDANCE = [
  {
    id: 'before',
    title: 'Before a flood',
    tone: 'info',
    items: [
      'Know your flood zone and check FloodNet alerts for your area regularly.',
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
      />

      <div className="alert alert-danger d-flex flex-wrap gap-2 align-items-center" role="alert">
        <strong>In immediate danger?</strong>
        <span>
          Contact your local emergency services directly. FloodNet is an information and coordination
          platform and is not an emergency call service.
        </span>
      </div>

      <div className="row g-3">
        {GUIDANCE.map((section) => (
          <div className="col-12 col-lg-4" key={section.id}>
            <section className={`panel-card guidance-card guidance-card-${section.tone} p-3 p-md-4 rounded-4 h-100`}>
              <h2 className="h5 fw-bold mb-3">{section.title}</h2>
              <ul className="guidance-list mb-0">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </div>
        ))}
      </div>

      <section className="panel-card p-3 p-md-4 rounded-4 mt-4">
        <h2 className="h5 fw-bold mb-3">Emergency contacts</h2>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <h3 className="h6 fw-semibold mb-1">Emergency services</h3>
            <p className="small text-secondary mb-0">
              Use your national emergency number for immediate threats to life.
            </p>
          </div>
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
        </div>
      </section>
    </>
  );
}

export default PreparednessPage;
