import { describe } from '../../utils/enums';

/**
 * Renders a coded value as a badge carrying a symbol and a written label, so
 * the meaning survives for users who cannot distinguish the colours.
 */
function StatusBadge({ map, value, className = '' }) {
  const meta = describe(map, value);

  return (
    <span className={`badge status-badge text-bg-${meta.variant} ${className}`}>
      <span aria-hidden="true" className="status-badge-symbol">{meta.symbol}</span>
      <span>{meta.label}</span>
    </span>
  );
}

export default StatusBadge;
