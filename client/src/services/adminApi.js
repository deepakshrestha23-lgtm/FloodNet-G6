import { apiRequest } from './api';
import { buildQuery } from './query';

export function fetchOverview() {
  return apiRequest('/api/admin/overview');
}

export function fetchUsers(params = {}) {
  return apiRequest(`/api/admin/users${buildQuery(params)}`);
}

export function fetchUser(userId) {
  return apiRequest(`/api/admin/users/${userId}`);
}

export function createUser(user) {
  return apiRequest('/api/admin/users', { method: 'POST', body: user });
}

export function updateUserStatus(userId, status) {
  return apiRequest(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { status }
  });
}

export function updateUserRole(userId, roleCode) {
  return apiRequest(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: { roleCode }
  });
}

export function fetchRoles() {
  return apiRequest('/api/admin/roles');
}

export function fetchZones(includeInactive = true) {
  return apiRequest(`/api/admin/zones${buildQuery({ includeInactive })}`);
}

export function createZone(zone) {
  return apiRequest('/api/admin/zones', { method: 'POST', body: zone });
}

export function updateZone(zoneId, zone) {
  return apiRequest(`/api/admin/zones/${zoneId}`, { method: 'PATCH', body: zone });
}

export function fetchFacilityTypes() {
  return apiRequest('/api/admin/facility-types');
}

export function saveFacilityType(facilityType) {
  return apiRequest('/api/admin/facility-types', { method: 'POST', body: facilityType });
}

export function fetchAuditLogs(params = {}) {
  return apiRequest(`/api/admin/audit${buildQuery(params)}`);
}

export function fetchAuditActions() {
  return apiRequest('/api/admin/audit/actions');
}
