let accessToken = null;

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
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (refreshResponse.ok) {
      const refreshPayload = await refreshResponse.json();
      setAccessToken(refreshPayload.data.accessToken);
      return apiRequest(path, options, false);
    }
  }

  return parseResponse(response);
}
