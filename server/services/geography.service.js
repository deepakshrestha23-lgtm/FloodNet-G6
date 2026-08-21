const { AppError } = require('../utils/http-error');
const geographyRepository = require('../repositories/geography.repository');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value, label) {
  if (!UUID_PATTERN.test(value || '')) {
    throw new AppError(400, 'INVALID_GEOGRAPHY_ID', `${label} must be a valid UUID`);
  }
}

function mapProvince(row) {
  return { id: row.id, code: row.code, name: row.name, nameNe: row.name_ne, sortOrder: row.sort_order };
}

function mapDistrict(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameNe: row.name_ne,
    sortOrder: row.sort_order,
    province: { id: row.province_id, code: row.province_code, name: row.province_name }
  };
}

function mapLocalLevel(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameNe: row.name_ne,
    type: row.type,
    wardCount: row.ward_count,
    sortOrder: row.sort_order,
    district: { id: row.district_id, code: row.district_code, name: row.district_name },
    province: { id: row.province_id, code: row.province_code, name: row.province_name }
  };
}

function mapWard(row) {
  return {
    id: row.id,
    sourceKey: row.source_key,
    wardNumber: row.ward_number,
    name: row.name,
    nameNe: row.name_ne,
    localLevel: { id: row.local_level_id, code: row.local_level_code, name: row.local_level_name },
    district: { id: row.district_id, code: row.district_code, name: row.district_name },
    province: { id: row.province_id, code: row.province_code, name: row.province_name }
  };
}

async function listProvinces() {
  return (await geographyRepository.listProvinces()).map(mapProvince);
}

async function listDistricts(provinceId) {
  requireUuid(provinceId, 'Province ID');
  return (await geographyRepository.listDistricts(provinceId)).map(mapDistrict);
}

async function listLocalLevels(districtId) {
  requireUuid(districtId, 'District ID');
  return (await geographyRepository.listLocalLevels(districtId)).map(mapLocalLevel);
}

async function listWards(localLevelId) {
  requireUuid(localLevelId, 'Local level ID');
  return (await geographyRepository.listWards(localLevelId)).map(mapWard);
}

module.exports = { listProvinces, listDistricts, listLocalLevels, listWards, requireUuid };
