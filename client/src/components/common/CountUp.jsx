import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../utils/formatters';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Counts from zero up to a figure that has already been loaded from the API.
 * The final value is exactly what was passed in; the animation only affects
 * how it is revealed, and is skipped entirely for reduced-motion users.
 */
function CountUp({ value, duration = 1100, placeholder = 'N/A' }) {
  const [display, setDisplay] = useState(value ?? 0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;

    const prefersReduced = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION).matches;

    if (prefersReduced || value === 0) {
      setDisplay(value);
      return undefined;
    }

    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out so the count decelerates into its final value.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  if (typeof value !== 'number' || Number.isNaN(value)) return placeholder;

  return formatNumber(display);
}

export default CountUp;
