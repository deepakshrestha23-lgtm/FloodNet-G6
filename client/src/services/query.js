/**
 * Builds a query string from a filter object, dropping empty values so the API
 * only receives filters the user actually set.
 */
export function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, value instanceof Date ? value.toISOString() : String(value));
  });

  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}
