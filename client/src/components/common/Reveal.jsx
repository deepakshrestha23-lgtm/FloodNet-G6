import { useEffect, useRef, useState } from 'react';

/**
 * Reveals its children the first time they scroll into view. Purely
 * presentational: the content is always in the DOM, so it stays available to
 * search engines and assistive technology whether or not the animation runs.
 */
function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const nodeRef = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    // Without IntersectionObserver support, show everything immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={nodeRef}
      className={`fn-reveal ${shown ? 'fn-reveal-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
