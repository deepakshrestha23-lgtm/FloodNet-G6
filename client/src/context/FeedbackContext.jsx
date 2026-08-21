import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const FeedbackContext = createContext(null);

const MAX_FEEDBACK_ITEMS = 4;
const DEFAULT_DURATION = 4500;
const TONES = new Set(['success', 'danger', 'warning', 'info']);

function createFeedbackId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function FeedbackProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((feedback) => {
    const next = typeof feedback === 'string' ? { message: feedback } : feedback;
    const duration = next?.duration === 0 ? 0 : Math.max(1200, next?.duration || DEFAULT_DURATION);
    const item = {
      id: createFeedbackId(),
      tone: TONES.has(next?.tone) ? next.tone : 'info',
      title: next?.title || '',
      message: next?.message || '',
      icon: next?.icon,
      duration,
      expiresAt: duration > 0 ? Date.now() + duration : null
    };

    if (!item.message && !item.title) return null;

    setItems((current) => [...current, item].slice(-MAX_FEEDBACK_ITEMS));
    return item.id;
  }, []);

  useEffect(() => {
    const timers = items
      .filter((item) => item.duration > 0)
      .map((item) => window.setTimeout(
        () => dismiss(item.id),
        Math.max(0, item.expiresAt - Date.now())
      ));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismiss, items]);

  const value = useMemo(() => ({ items, notify, dismiss }), [dismiss, items, notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used inside FeedbackProvider');
  }
  return context;
}

export { FeedbackProvider, useFeedback };
