import { apiRequest } from './api';

export function fetchProvinces() {
  return apiRequest('/api/geography/provinces');
}

export function fetchDistricts(provinceId) {
  return apiRequest(`/api/geography/districts?provinceId=${encodeURIComponent(provinceId)}`);
}

export function fetchLocalLevels(districtId) {
  return apiRequest(`/api/geography/local-levels?districtId=${encodeURIComponent(districtId)}`);
}

export function fetchWards(localLevelId) {
  return apiRequest(`/api/geography/wards?localLevelId=${encodeURIComponent(localLevelId)}`);
}
