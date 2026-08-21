import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchActiveAlerts, fetchPublicCentres } from '../../services/publicApi';
import { useApiResource } from '../../hooks/useApiResource';
import PublicLayout from '../../layouts/PublicLayout';
import AlertCard from '../../components/alert/AlertCard';
import CentreSummaryCard from '../../components/centre/CentreSummaryCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../components/common/Icon';
import Reveal from '../../components/common/Reveal';
import CountUp from '../../components/common/CountUp';
import WaveBackdrop from '../../components/brand/WaveBackdrop';
import HeroMonitor from '../../components/brand/HeroMonitor';
import { formatNumber } from '../../utils/formatters';

/**
 * How the platform works, shown as a three-step infographic. This mirrors the
 * real workflow: a resident reports, an officer verifies and publishes, and
 * evacuation officers keep centre capacity current.
 */
const FLOW_STEPS = [
  {
    icon: 'report',
    title: 'Residents report',
    text: 'Describe what you can see: depth, road conditions and location, plus a photo as evidence.'
  },
  {
    icon: 'check',
    title: 'Officers verify',
    text: 'Flood Monitoring Officers review every report and confirm the incidents that check out.'
  },
  {
    icon: 'megaphone',
    title: 'Alerts reach you',
    text: 'Official alerts go out to affected zones, with live evacuation centre capacity beside them.'
  }
];

const FEATURES = [
  {
    icon: 'radar',
    title: 'One coordinated picture',
    text: 'Reports, verified incidents, alerts and shelter capacity in one place instead of scattered across channels.'
  },
  {
    icon: 'shelter',
    title: 'Live evacuation capacity',
    text: 'Occupancy and free spaces are kept current by evacuation officers, so you know where there is room.'
  },
  {
    icon: 'map',
    title: 'Built around your zone',
    text: 'Set your home flood zone once and the alerts and centres for your area are always shown first.'
  }
];

const LEGEND = [
  { colour: '#38bdf8', title: 'Community report', text: 'An observation submitted by a resident, not yet assessed.' },
  { colour: '#0f9d6f', title: 'Verified incident', text: 'A report an officer has reviewed and confirmed.' },
  { colour: '#ff7a5c', title: 'Official alert', text: 'A published warning with recommended actions for a zone.' }
];

/**
 * The public landing page. It shows only non-sensitive information: published
 * alerts and evacuation centre availability. No resident details, officer notes
 * or audit information are exposed here.
 */
function PublicHomePage() {
  const { isAuthenticated, user } = useAuth();

  const loader = useCallback(async () => {
    const [alertPayload, centrePayload] = await Promise.all([
      fetchActiveAlerts(),
      fetchPublicCentres()
    ]);

    return {
      data: {
        alerts: alertPayload.data.alerts,
        centres: centrePayload.data.centres
      }
    };
  }, []);

  const { data, loading, error, reload } = useApiResource(loader);

  const dashboardPath = {
    RESIDENT: '/resident',
    FLOOD_MONITORING_OFFICER: '/officer',
    EVACUATION_OFFICER: '/evacuation',
    ADMINISTRATOR: '/admin'
  }[user?.role?.code] || '/resident';

  const availableSpaces = data
    ? data.centres.reduce((total, centre) => total + centre.availableSpace, 0)
    : 0;

  const stats = [
    { icon: 'megaphone', value: data ? data.alerts.length : null, label: 'Alerts in effect now' },
    { icon: 'people', value: data ? availableSpaces : null, label: 'Evacuation spaces available' },
    { icon: 'shelter', value: data ? data.centres.length : null, label: 'Centres listed' }
  ];

  return (
    <PublicLayout>
        {/* ------------------------------------------------------- hero */}
        <section className="public-hero">
          <span
            className="fn-aurora"
            style={{ width: 420, height: 420, top: '-8rem', left: '-6rem', background: 'rgba(34,211,238,0.45)' }}
          />
          <span
            className="fn-aurora"
            style={{ width: 340, height: 340, bottom: '4rem', right: '8%', background: 'rgba(37,99,235,0.4)', animationDelay: '4s' }}
          />

          <div className="container public-hero-inner pt-5 pb-4">
            <div className="row align-items-center g-5 py-lg-4">
              <div className="col-12 col-lg-6">
                <span className="public-hero-badge mb-4 fn-anim-up">
                  <span className="fn-live-dot" />
                  Live flood picture for your area
                </span>

                <h1 className="mb-4 fn-anim-up fn-delay-1">
                  Flood information<br />
                  people can <span className="public-hero-accent">trust</span>
                </h1>

                <p className="public-hero-lead mb-4 fn-anim-up fn-delay-2">
                  Community reports, officer-verified incidents, official alerts and live evacuation
                  capacity, brought together so the right information reaches you while it still matters.
                </p>

                <div className="d-flex flex-wrap gap-2 fn-anim-up fn-delay-3">
                  {isAuthenticated ? (
                    <Link className="btn btn-light btn-lg" to={dashboardPath}>
                      Open my dashboard
                      <Icon name="arrowRight" size={18} />
                    </Link>
                  ) : (
                    <>
                      <Link className="btn btn-light btn-lg" to="/register">
                        <Icon name="report" size={18} />
                        Report flooding
                      </Link>
                      <a className="btn btn-outline-light btn-lg" href="#live">
                        See live alerts
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <HeroMonitor />
              </div>
            </div>
          </div>

          <WaveBackdrop tone="light" />
        </section>

        {/* --------------------------------------- live figures overlay */}
        <div className="container">
          <div className="stat-band">
            <div className="row g-0">
              {stats.map((stat) => (
                <div className="col-12 col-md-4" key={stat.label}>
                  <div className="stat-band-item">
                    <span className="stat-band-icon">
                      <Icon name={stat.icon} size={22} strokeWidth={1.9} />
                    </span>
                    <span>
                      <span className="stat-band-value">
                        <CountUp value={stat.value} />
                      </span>
                      <span className="stat-band-label">{stat.label}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ how it works */}
        <section className="public-section">
          <div className="container">
            <Reveal className="text-center mb-5">
              <span className="eyebrow">
                <Icon name="spark" size={12} strokeWidth={2} />
                How it works
              </span>
              <h2 className="public-section-title mt-3 mb-3">
                From one observation to a coordinated response
              </h2>
              <p className="public-section-lead mx-auto mb-0">
                Every piece of information carries its provenance, so nobody has to guess whether
                what they are reading has been checked.
              </p>
            </Reveal>

            <div className="row g-4 flow-steps">
              <div className="flow-connector" aria-hidden="true" />
              {FLOW_STEPS.map((step, index) => (
                <Reveal className="col-12 col-lg-4" key={step.title} delay={index * 110}>
                  <article className={`flow-step flow-step-${index + 1}`}>
                    <span className="flow-step-index" aria-hidden="true">{index + 1}</span>
                    <span className="flow-step-icon">
                      <Icon name={step.icon} size={24} strokeWidth={2} />
                    </span>
                    <h3 className="h5 fw-bold mb-2">{step.title}</h3>
                    <p className="text-secondary mb-0">{step.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- live section */}
        <section className="public-section public-section-alt" id="live">
          <div className="container">
            {loading && <LoadingState label="Loading current flood information..." />}
            {error && <ErrorState message={error.message} onRetry={reload} />}

            {!loading && !error && data && (
              <>
                <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
                  <div>
                    <span className="eyebrow">
                      <Icon name="bell" size={12} strokeWidth={2} />
                      In effect now
                    </span>
                    <h2 className="public-section-title mt-3 mb-0">Current FloodNet alerts</h2>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fn-live-pill">
                      <span className="fn-live-dot" />
                      {data.alerts.length} active
                    </span>
                    <Link className="btn btn-outline-primary btn-sm" to="/alerts">
                      View all alerts
                      <Icon name="arrowRight" size={15} />
                    </Link>
                  </div>
                </div>

                {data.alerts.length === 0 ? (
                  <EmptyState
                    title="No active alerts"
                    description="There are no published FloodNet alerts in effect at the moment."
                  />
                ) : (
                  <>
                    <div className="row g-4">
                      {data.alerts.slice(0, 2).map((alert) => (
                        <div className="col-12 col-xl-6" key={alert.id}>
                          <AlertCard alert={alert} />
                        </div>
                      ))}
                    </div>
                    {data.alerts.length > 2 && (
                      <div className="text-center mt-4">
                        <Link className="btn btn-outline-primary" to="/alerts">
                          View the other {data.alerts.length - 2} active alert{data.alerts.length - 2 === 1 ? '' : 's'}
                          <Icon name="arrowRight" size={16} />
                        </Link>
                      </div>
                    )}
                  </>
                )}

                <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mt-5 pt-4 mb-4">
                  <div>
                    <span className="eyebrow">
                      <Icon name="shelter" size={12} strokeWidth={2} />
                      Shelter
                    </span>
                    <h2 className="public-section-title mt-3 mb-0">Where there is space right now</h2>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fn-live-pill">
                      <span className="fn-live-dot" />
                      {formatNumber(availableSpaces)} spaces free
                    </span>
                    <Link className="btn btn-outline-primary btn-sm" to="/centres">
                      View all centres
                      <Icon name="arrowRight" size={15} />
                    </Link>
                  </div>
                </div>

                {data.centres.length === 0 ? (
                  <EmptyState title="No evacuation centres are currently listed" />
                ) : (
                  <>
                    <div className="row g-4">
                      {data.centres.slice(0, 3).map((centre) => (
                        <div className="col-12 col-md-6 col-xl-4" key={centre.id}>
                          <CentreSummaryCard centre={centre} />
                        </div>
                      ))}
                    </div>
                    {data.centres.length > 3 && (
                      <div className="text-center mt-4">
                        <Link className="btn btn-outline-primary" to="/centres">
                          View all {data.centres.length} evacuation centres
                          <Icon name="arrowRight" size={16} />
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- features */}
        <section className="public-section">
          <div className="container">
            <div className="row g-5 align-items-center">
              <Reveal className="col-12 col-lg-4">
                <span className="eyebrow">
                  <Icon name="radar" size={12} strokeWidth={2} />
                  Why FloodNet
                </span>
                <h2 className="public-section-title mt-3 mb-3">
                  Built for the hours that matter
                </h2>
                <p className="public-section-lead mb-0">
                  Designed to stay readable on a phone, in the dark, under stress, with status never
                  carried by colour alone.
                </p>
              </Reveal>

              <div className="col-12 col-lg-8">
                <div className="row g-4">
                  {FEATURES.map((feature, index) => (
                    <Reveal className="col-12 col-md-4" key={feature.title} delay={index * 110}>
                      <article className="feature-card">
                        <span className="feature-icon">
                          <Icon name={feature.icon} size={22} strokeWidth={1.9} />
                        </span>
                        <h3 className="h6 fw-bold mb-2">{feature.title}</h3>
                        <p className="small text-secondary mb-0">{feature.text}</p>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- provenance */}
        <section className="public-section-tight">
          <div className="container">
            <div className="row g-3">
              {LEGEND.map((item, index) => (
                <Reveal className="col-12 col-md-4" key={item.title} delay={index * 90}>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: item.colour }} />
                    <span>
                      <span className="d-block fw-bold small">{item.title}</span>
                      <span className="d-block small text-secondary mt-1">{item.text}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA */}
        <section className="public-section-tight pb-5">
          <div className="container">
            <Reveal className="cta-panel">
              <div className="row align-items-center g-4">
                <div className="col-12 col-lg-8">
                  <span className="eyebrow" style={{ color: '#7dd3fc' }}>
                    <Icon name="drop" size={12} strokeWidth={2} />
                    Seen flooding in your area?
                  </span>
                  <h2 className="h2 fw-bold mt-3 mb-3">
                    Your report helps officers see the whole picture
                  </h2>
                  <p className="mb-0" style={{ color: '#b7d3e6', maxWidth: '40rem' }}>
                    Residents can create an account to report flooding. Reports are reviewed by flood
                    monitoring officers before they appear as verified incidents.
                  </p>
                </div>

                <div className="col-12 col-lg-4 text-lg-end">
                  {!isAuthenticated ? (
                    <Link className="btn btn-light btn-lg" to="/register">
                      Create a resident account
                      <Icon name="arrowRight" size={18} />
                    </Link>
                  ) : (
                    <Link className="btn btn-light btn-lg" to={dashboardPath}>
                      Go to my dashboard
                      <Icon name="arrowRight" size={18} />
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
    </PublicLayout>
  );
}

export default PublicHomePage;
