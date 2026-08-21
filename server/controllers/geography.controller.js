const geographyService = require('../services/geography.service');

async function provinces(_request, response) {
  response.json({ success: true, data: { provinces: await geographyService.listProvinces() }, message: 'Provinces retrieved successfully' });
}

async function districts(request, response) {
  response.json({ success: true, data: { districts: await geographyService.listDistricts(request.query.provinceId) }, message: 'Districts retrieved successfully' });
}

async function localLevels(request, response) {
  response.json({ success: true, data: { localLevels: await geographyService.listLocalLevels(request.query.districtId) }, message: 'Local levels retrieved successfully' });
}

async function wards(request, response) {
  response.json({ success: true, data: { wards: await geographyService.listWards(request.query.localLevelId) }, message: 'Wards retrieved successfully' });
}

module.exports = { provinces, districts, localLevels, wards };
