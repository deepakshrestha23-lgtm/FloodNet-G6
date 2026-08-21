/**
 * Decorative animated water layers used at the foot of the hero sections. Three
 * offset wave paths drift at different speeds to suggest moving water without
 * costing a raster image download.
 */
const TONES = {
  // Waves that resolve into the white page below a dark hero.
  light: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.30)', '#ffffff'],
  // Waves drawn onto a light surface.
  dark: ['rgba(8,47,73,0.10)', 'rgba(8,47,73,0.16)', 'var(--fn-surface)'],
  // Waves that stay inside a dark panel, adding depth rather than a transition.
  deep: ['rgba(125,211,252,0.06)', 'rgba(125,211,252,0.10)', 'rgba(4,22,37,0.45)']
};

function WaveBackdrop({ className = '', tone = 'light' }) {
  const fills = TONES[tone] || TONES.light;

  return (
    <div className={`fn-waves ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1440 150" preserveAspectRatio="none">
        <path className="fn-wave fn-wave-1" fill={fills[0]} d="M0 60c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v90H0z" />
        <path className="fn-wave fn-wave-2" fill={fills[1]} d="M0 80c120-28 240-28 360 0s240 28 360 0 240-28 360 0 240 28 360 0v70H0z" />
        <path className="fn-wave fn-wave-3" fill={fills[2]} d="M0 104c120-24 240-24 360 0s240 24 360 0 240-24 360 0 240 24 360 0v46H0z" />
      </svg>
    </div>
  );
}

export default WaveBackdrop;
