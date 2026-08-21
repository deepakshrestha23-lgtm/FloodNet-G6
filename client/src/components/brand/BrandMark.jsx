/**
 * The FloodNet logo: a rising water level inside a monitoring ring, with the
 * connected "net" of community reports drawn across it.
 */
function BrandMark({ size = 34, className = '', animated = true }) {
  return (
    <span className={`fn-brandmark ${animated ? 'fn-brandmark-animated' : ''} ${className}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <defs>
          <linearGradient id="fn-mark-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="fn-mark-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <clipPath id="fn-mark-clip">
            <circle cx="24" cy="24" r="15" />
          </clipPath>
        </defs>

        <circle cx="24" cy="24" r="20" stroke="url(#fn-mark-ring)" strokeWidth="2.5" opacity="0.35" />
        <circle cx="24" cy="24" r="15.5" fill="rgba(56,189,248,0.12)" />

        <g clipPath="url(#fn-mark-clip)">
          <path className="fn-brandmark-wave" d="M-24 27c8-5 16-5 24 0s16 5 24 0 16-5 24 0v22h-72z" fill="url(#fn-mark-water)" opacity="0.9" />
          <path className="fn-brandmark-wave fn-brandmark-wave-2" d="M-24 31c8-5 16-5 24 0s16 5 24 0 16-5 24 0v18h-72z" fill="#0ea5e9" opacity="0.55" />
        </g>

        <circle cx="24" cy="24" r="15.5" stroke="url(#fn-mark-ring)" strokeWidth="2" fill="none" />
        <g stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" opacity="0.95">
          <path d="M17 17.5 24 21l7-3.5" />
        </g>
        <g fill="#f0f9ff">
          <circle cx="17" cy="17.5" r="2" />
          <circle cx="31" cy="17.5" r="2" />
          <circle cx="24" cy="21" r="2.4" />
        </g>
      </svg>
    </span>
  );
}

export default BrandMark;
