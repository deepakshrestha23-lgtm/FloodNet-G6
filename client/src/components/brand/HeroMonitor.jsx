import Icon from '../common/Icon';

/**
 * A decorative "live monitoring" panel for the landing hero. It illustrates the
 * flow of the platform (reports arriving across zones, a rising water gauge and
 * verification progress) rather than showing any real record.
 */
function HeroMonitor() {
  return (
    <div className="hero-visual hero-visual-float">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="hero-visual-caption">Monitoring overview</span>
        <span className="fn-live-pill">
          <span className="fn-live-dot" />
          Live
        </span>
      </div>

      <svg viewBox="0 0 340 180" className="w-100" role="img" aria-label="Illustration of flood monitoring across zones">
        <defs>
          <linearGradient id="hm-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="hm-bar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>

        {/* Radar panel: sensing zones for new reports */}
        <g transform="translate(4 6)">
          <rect width="150" height="168" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
          <g transform="translate(75 84)">
            <circle r="58" fill="none" stroke="rgba(125,211,252,0.22)" />
            <circle r="38" fill="none" stroke="rgba(125,211,252,0.28)" />
            <circle r="18" fill="none" stroke="rgba(125,211,252,0.35)" />
            <path d="M0 0 L58 0 A58 58 0 0 1 30 49 Z" fill="rgba(103,232,249,0.18)" className="hero-radar-sweep" />
            <circle className="hero-ping" cx="-26" cy="-20" r="6" fill="#67e8f9" />
            <circle className="hero-ping hero-ping-2" cx="30" cy="24" r="6" fill="#a5b4fc" />
            <circle className="hero-ping hero-ping-3" cx="12" cy="-38" r="6" fill="#fbbf24" />
            <circle cx="-26" cy="-20" r="2.6" fill="#e0f2fe" />
            <circle cx="30" cy="24" r="2.6" fill="#e0f2fe" />
            <circle cx="12" cy="-38" r="2.6" fill="#e0f2fe" />
          </g>
        </g>

        {/* Water gauge + verification bars */}
        <g transform="translate(164 6)">
          <rect width="172" height="80" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
          <text x="14" y="24" fill="#a9cde0" fontSize="9" fontWeight="700" letterSpacing="1.4">WATER LEVEL</text>
          <path
            d="M14 62c14-9 28-9 42 0s28 9 42 0 28-9 42 0v18H14z"
            fill="url(#hm-water)"
            className="fn-wave-1"
          />
          <path d="M14 46h144" stroke="rgba(251,191,36,0.85)" strokeWidth="1.6" strokeDasharray="5 4" />
          <text x="120" y="42" fill="#fbbf24" fontSize="8" fontWeight="700">ALERT</text>
        </g>

        <g transform="translate(164 94)">
          <rect width="172" height="80" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
          <text x="14" y="22" fill="#a9cde0" fontSize="9" fontWeight="700" letterSpacing="1.4">REPORTS VERIFIED</text>
          {[
            { x: 14, h: 22 },
            { x: 40, h: 34 },
            { x: 66, h: 18 },
            { x: 92, h: 42 },
            { x: 118, h: 30 },
            { x: 144, h: 46 }
          ].map((bar) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={66 - bar.h}
              width="14"
              height={bar.h}
              rx="4"
              fill="url(#hm-bar)"
            />
          ))}
        </g>
      </svg>

      <div className="d-flex flex-wrap gap-3 mt-3 small" style={{ color: '#a9cde0' }}>
        <span className="d-inline-flex align-items-center gap-2">
          <Icon name="people" size={14} /> Community reports
        </span>
        <span className="d-inline-flex align-items-center gap-2">
          <Icon name="check" size={14} /> Officer verified
        </span>
        <span className="d-inline-flex align-items-center gap-2">
          <Icon name="megaphone" size={14} /> Official alerts
        </span>
      </div>
    </div>
  );
}

export default HeroMonitor;
