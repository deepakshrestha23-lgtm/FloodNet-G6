import { Link } from 'react-router-dom';
import BrandMark from '../components/brand/BrandMark';
import WaveBackdrop from '../components/brand/WaveBackdrop';
import Icon from '../components/common/Icon';

/**
 * Presentation shell shared by the sign-in, registration and access-denied
 * screens: a dark panel explaining what FloodNet is, beside the form itself.
 */

/**
 * Deterministic rain effect with three depth bands. Each drop has a fixed
 * position, animation speed and delay so the effect is stable across renders.
 */
const RAINDROPS = [
  // Near band (fast, long)
  { id: 'r0', band: 'near', left: 8, length: 18, duration: 0.6, delay: 0 },
  { id: 'r1', band: 'near', left: 22, length: 20, duration: 0.7, delay: 0.15 },
  { id: 'r2', band: 'near', left: 38, length: 16, duration: 0.65, delay: 0.3 },
  { id: 'r3', band: 'near', left: 55, length: 22, duration: 0.75, delay: 0.1 },
  { id: 'r4', band: 'near', left: 72, length: 18, duration: 0.68, delay: 0.4 },
  { id: 'r5', band: 'near', left: 88, length: 20, duration: 0.62, delay: 0.25 },

  // Mid band (medium speed, medium length)
  { id: 'r6', band: 'mid', left: 12, length: 12, duration: 0.9, delay: 0.05 },
  { id: 'r7', band: 'mid', left: 32, length: 14, duration: 1, delay: 0.35 },
  { id: 'r8', band: 'mid', left: 52, length: 11, duration: 0.85, delay: 0.2 },
  { id: 'r9', band: 'mid', left: 68, length: 13, duration: 0.95, delay: 0.45 },
  { id: 'r10', band: 'mid', left: 85, length: 12, duration: 0.88, delay: 0.1 },

  // Far band (slow, short)
  { id: 'r11', band: 'far', left: 5, length: 6, duration: 1.4, delay: 0.2 },
  { id: 'r12', band: 'far', left: 25, length: 8, duration: 1.5, delay: 0 },
  { id: 'r13', band: 'far', left: 45, length: 7, duration: 1.35, delay: 0.4 },
  { id: 'r14', band: 'far', left: 62, length: 6, duration: 1.45, delay: 0.15 },
  { id: 'r15', band: 'far', left: 78, length: 8, duration: 1.42, delay: 0.3 },
  { id: 'r16', band: 'far', left: 92, length: 7, duration: 1.38, delay: 0.25 }
];

const POINTS = [
  {
    icon: 'report',
    title: 'Report what you see',
    text: 'Depth, road conditions and photo evidence, straight from where you are.'
  },
  {
    icon: 'check',
    title: 'Reviewed by officers',
    text: 'Nothing becomes a verified incident until a monitoring officer has assessed it.'
  },
  {
    icon: 'shelter',
    title: 'Find shelter fast',
    text: 'Live evacuation centre capacity for your zone, kept current by evacuation officers.'
  }
];

function AuthLayout({ children, wide = false }) {
  return (
    <main className="auth-shell auth-split">
      <aside className="auth-aside">
        {/* Monsoon rain drifting behind the panel. Three depth bands give the
            fall a sense of distance without needing many elements. */}
        <span className="auth-rain" aria-hidden="true">
          {RAINDROPS.map((drop) => (
            <span
              key={drop.id}
              className={`auth-raindrop auth-raindrop-${drop.band}`}
              style={{
                left: `${drop.left}%`,
                height: `${drop.length}px`,
                animationDuration: `${drop.duration}s`,
                animationDelay: `${drop.delay}s`
              }}
            />
          ))}
        </span>

        {/* A distant monsoon storm: a slow sheet-lightning wash with one faint
            bolt. Decorative only, and switched off for reduced-motion users. */}
        <span className="auth-storm" aria-hidden="true">
          <span className="auth-storm-flash" />
          <svg className="auth-storm-bolt" viewBox="0 0 60 120" fill="none" aria-hidden="true">
            <path
              d="M34 4 14 62h16l-8 54 30-66H35l7-46z"
              fill="rgba(186,230,253,0.75)"
            />
          </svg>
        </span>

        <div>
          <Link className="fn-brand-link" to="/">
            <BrandMark size={38} />
            <span className="fn-wordmark text-white">Flood<span className="brand-accent">Net</span></span>
          </Link>

          <h2 className="h2 mt-5 mb-3">
            The flood picture,<br />assembled in one place.
          </h2>
          <p className="mb-0" style={{ color: '#a9cde0', maxWidth: '26rem' }}>
            Community reports, verified incidents, official alerts and evacuation capacity, kept
            separate so you always know what has been checked.
          </p>
        </div>

        <div className="mt-5">
          {POINTS.map((point) => (
            <div className="auth-aside-point" key={point.title}>
              <span className="auth-aside-point-icon">
                <Icon name={point.icon} size={17} strokeWidth={2} />
              </span>
              <span>
                <span className="d-block fw-semibold text-white small">{point.title}</span>
                <span className="d-block small" style={{ color: '#8fb1c5' }}>{point.text}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="small mb-0 mt-5" style={{ color: '#7796a9' }}>
          In a life-threatening emergency, call Nepal Police on 100 or Ambulance on 102.
        </p>

        <WaveBackdrop tone="deep" />
      </aside>

      <div className="auth-main">
        <div className={`auth-card ${wide ? 'auth-card-wide' : ''} panel-card p-4 p-md-5`}>
          {children}
        </div>
      </div>
    </main>
  );
}

export default AuthLayout;
