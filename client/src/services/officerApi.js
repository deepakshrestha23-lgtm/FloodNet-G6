import { apiRequest } from './api';
import { buildQuery } from './query';

export function fetchDashboard(params = {}) {
  return apiRequest(`/api/officer/dashboard${buildQuery(params)}`);
}

export function fetchReviewQueue(params = {}) {
  return apiRequest(`/api/officer/reports${buildQuery(params)}`);
}

export function fetchReportDossier(reportId) {
  return apiRequest(`/api/officer/reports/${reportId}`);
}

export function submitReview(reportId, decision) {
  return apiRequest(`/api/officer/reports/${reportId}/review`, {
    method: 'POST',
    body: decision
  });
}

export function fetchAlerts(params = {}) {
  return apiRequest(`/api/officer/alerts${buildQuery(params)}`);
}

export function fetchAlert(alertId) {
  return apiRequest(`/api/officer/alerts/${alertId}`);
}

export function createAlert(alert) {
  return apiRequest('/api/officer/alerts', { method: 'POST', body: alert });
}

export function updateAlert(alertId, alert) {
  return apiRequest(`/api/officer/alerts/${alertId}`, { method: 'PATCH', body: alert });
}

export function publishAlert(alertId) {
  return apiRequest(`/api/officer/alerts/${alertId}/publish`, { method: 'POST' });
}

export function expireAlert(alertId) {
  return apiRequest(`/api/officer/alerts/${alertId}/expire`, { method: 'POST' });
}

export function cancelAlert(alertId) {
  return apiRequest(`/api/officer/alerts/${alertId}/cancel`, { method: 'POST' });
}

export function fetchEvidenceUrl(reportId, evidenceId) {
  return apiRequest(`/api/officer/reports/${reportId}/evidence/${evidenceId}/url`);
}
