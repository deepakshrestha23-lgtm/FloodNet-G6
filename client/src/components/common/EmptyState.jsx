/**
 * Shown wherever a list has no records. The small illustration keeps an empty
 * screen from reading as a failure; the written title carries the meaning.
 */
function EmptyState({ title = 'Nothing to show yet', description, action }) {
  return (
    <div className="empty-state text-center p-4 p-md-5">
      <svg
        className="empty-state-art"
        width="86"
        height="62"
        viewBox="0 0 86 62"
        fill="none"
        aria-hidden="true"
      >
        <g className="fn-empty-float">
          <rect x="24" y="6" width="38" height="30" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.55" />
          <path d="M32 17h22M32 25h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        </g>
        <path
          d="M2 46c6 0 6-4 12-4s6 4 12 4 6-4 12-4 6 4 12 4 6-4 12-4 6 4 12 4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M2 56c6 0 6-4 12-4s6 4 12 4 6-4 12-4 6 4 12 4 6-4 12-4 6 4 12 4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.28"
        />
      </svg>

      <h2 className="h6 fw-bold mb-2">{title}</h2>
      {description && <p className="text-secondary mb-3 mx-auto" style={{ maxWidth: '32rem' }}>{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
