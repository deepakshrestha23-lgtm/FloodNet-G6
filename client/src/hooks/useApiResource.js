import { useCallback, useEffect, useState } from 'react';

/**
 * Loads an API resource and exposes loading, error and reload state.
 *
 * `loader` must be a stable callback (wrap it in useCallback) because it is the
 * effect dependency that decides when the resource is fetched again.
 */
export function useApiResource(loader, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await loader();
      setData(payload.data);
      return payload.data;
    } catch (caughtError) {
      setError(caughtError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    if (!immediate) return undefined;

    let active = true;

    setLoading(true);
    setError(null);

    loader()
      .then((payload) => {
        if (active) setData(payload.data);
      })
      .catch((caughtError) => {
        if (active) setError(caughtError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Prevents a slow response from a previous filter overwriting newer data.
    return () => {
      active = false;
    };
  }, [loader, immediate]);

  return { data, loading, error, reload, setData };
}
