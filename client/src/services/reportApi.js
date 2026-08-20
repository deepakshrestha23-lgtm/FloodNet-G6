import { apiRequest } from './api';
import { buildQuery } from './query';

export function submitReport(report) {
  return apiRequest('/api/reports', { method: 'POST', body: report });
}

export function fetchMyReports(params = {}) {
  return apiRequest(`/api/reports/mine${buildQuery(params)}`);
}

export function fetchMyReport(reportId) {
  return apiRequest(`/api/reports/${reportId}`);
}

export function fetchMyReportHistory(reportId) {
  return apiRequest(`/api/reports/${reportId}/history`);
}

export function updateMyReport(reportId, report) {
  return apiRequest(`/api/reports/${reportId}`, { method: 'PATCH', body: report });
}
