import { apiRequest } from './api';
import { buildQuery } from './query';

export function fetchZones() {
  return apiRequest('/api/public/zones');
}

export function fetchActiveAlerts(zoneId) {
  return apiRequest(`/api/public/alerts${buildQuery({ zoneId })}`);
}

export function fetchVerifiedIncidents(params = {}) {
  return apiRequest(`/api/public/incidents${buildQuery(params)}`);
}

export function fetchPublicCentres(zoneId) {
  return apiRequest(`/api/public/centres${buildQuery({ zoneId })}`);
}
