import { apiRequest } from './api';
import { buildQuery } from './query';

export function fetchZones() {
  return apiRequest('/api/public/zones');
}

export function fetchActiveAlerts(params = {}) {
  const filters = typeof params === 'string' ? { zoneId: params } : params;
  return apiRequest(`/api/public/alerts${buildQuery(filters)}`);
}

export function fetchVerifiedIncidents(params = {}) {
  return apiRequest(`/api/public/incidents${buildQuery(params)}`);
}

export function fetchPublicCentres(params = {}) {
  const filters = typeof params === 'string' ? { zoneId: params } : params;
  return apiRequest(`/api/public/centres${buildQuery(filters)}`);
}
