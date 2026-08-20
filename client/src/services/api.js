let accessToken = null;

/*
 * Refresh tokens are rotated on every use, so two refreshes racing each other
 * would leave the loser holding a token that no longer matches and log the user
 * out. Pages legitimately fire several requests at once, so concurrent callers
 * share a single in-flight refresh instead of each starting their own.
 */
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function getAccessToken() {
  return accessToken;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'The request failed');
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload;
}

/**
 * Performs a refresh, or joins the one already running. Resolves to the new
 * access token, or null when the session could not be renewed.
 */
export function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  })
    .then(async (response) => {
      if (!response.ok) return null;

      const payload = await response.json().catch(() => null);
      const token = payload?.data?.accessToken || null;

      if (token) setAccessToken(token);
      return token ? payload.data : null;
    })
    .catch(() => null)
    .finally(() => {
      // Cleared on the microtask after settling so every caller that joined
      // this attempt receives the same result before a new one can start.
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function apiRequest(path, options = {}, allowRefresh = true) {
  const headers = new Headers(options.headers || {});
  const requestOptions = {
    ...options,
    credentials: 'include',
    headers
  };

  if (
    requestOptions.body &&
    typeof requestOptions.body !== 'string' &&
    !(typeof FormData !== 'undefined' && requestOptions.body instanceof FormData)
  ) {
    requestOptions.body = JSON.stringify(requestOptions.body);
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(path, requestOptions);

  if (response.status === 401 && allowRefresh && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();

    if (refreshed) {
      return apiRequest(path, options, false);
    }
  }

  return parseResponse(response);
}
