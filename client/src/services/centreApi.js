import { apiRequest } from './api';
import { buildQuery } from './query';

export function fetchCentres(params = {}) {
  return apiRequest(`/api/centres${buildQuery(params)}`);
}

export function fetchCentre(centreId) {
  return apiRequest(`/api/centres/${centreId}`);
}

export function fetchCentreDashboard(params = {}) {
  return apiRequest(`/api/centres/dashboard${buildQuery(params)}`);
}

export function fetchFacilityTypes() {
  return apiRequest('/api/centres/facility-types');
}

export function createCentre(centre) {
  return apiRequest('/api/centres', { method: 'POST', body: centre });
}

export function updateCentre(centreId, centre) {
  return apiRequest(`/api/centres/${centreId}`, { method: 'PATCH', body: centre });
}

export function updateOccupancy(centreId, currentOccupancy) {
  return apiRequest(`/api/centres/${centreId}/occupancy`, {
    method: 'POST',
    body: { currentOccupancy }
  });
}

export function updateCentreStatus(centreId, operationalStatus) {
  return apiRequest(`/api/centres/${centreId}/status`, {
    method: 'POST',
    body: { operationalStatus }
  });
}

export function archiveCentre(centreId) {
  return apiRequest(`/api/centres/${centreId}/archive`, { method: 'POST' });
}
