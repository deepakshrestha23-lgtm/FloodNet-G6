const crypto = require('crypto');
const { AppError } = require('../utils/http-error');
const reportRepository = require('../repositories/report.repository');
const userRepository = require('../repositories/user.repository');

const allowedStatuses = new Set([
  'PENDING_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'CLOSED'
]);

function createReportReference() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FLD-${datePart}-${randomPart}`;
}

function validateStatusFilter(status) {
  if (status && !allowedStatuses.has(status)) {
    throw new AppError(400, 'INVALID_STATUS', 'The report status filter is invalid');
  }
}

async function submitReport(residentId, input) {
  const validZone = input.zoneId ? await userRepository.isActiveZone(input.zoneId) : true;
  const validWard = input.wardId ? await userRepository.isActiveWard(input.wardId) : true;

  if (!validZone) {
    throw new AppError(400, 'INVALID_ZONE', 'The selected flood zone is invalid or inactive');
  }

  if (!validWard) {
    throw new AppError(400, 'INVALID_WARD', 'The selected administrative ward is invalid or inactive');
  }

  if (!input.zoneId && !input.wardId) {
    throw new AppError(400, 'LOCATION_REQUIRED', 'A flood zone or administrative ward is required');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await reportRepository.createReport({
        reportReference: createReportReference(),
        residentId,
        zoneId: input.zoneId || null,
        wardId: input.wardId || null,
        locality: input.locality?.trim() || null,
        nearestLandmark: input.nearestLandmark?.trim() || null,
        latitude: input.latitude === '' || input.latitude === undefined ? null : input.latitude,
        longitude: input.longitude === '' || input.longitude === undefined ? null : input.longitude,
        floodType: input.floodType || 'UNKNOWN',
        peopleAtRisk: input.peopleAtRisk ?? 0,
        locationDescription: input.locationDescription.trim(),
        observedSeverity: input.observedSeverity,
        roadCondition: input.roadCondition,
        incidentDescription: input.incidentDescription.trim(),
        observedAt: input.observedAt
      });
    } catch (error) {
      if (error.code !== '23505' || attempt === 2) throw error;
    }
  }

  throw new AppError(500, 'REPORT_REFERENCE_ERROR', 'A report reference could not be generated');
}

async function listMine(residentId, { status, limit, offset }) {
  validateStatusFilter(status);
  return reportRepository.listReportsForResident(residentId, { status, limit, offset });
}

async function getMine(residentId, reportId) {
  const report = await reportRepository.findReportForResident(reportId, residentId);

  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  return report;
}

async function getHistory(residentId, reportId) {
  const history = await reportRepository.getReportHistory(reportId, residentId);

  if (!history) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  return history;
}

async function updateMoreInformation(residentId, reportId, input) {
  const report = await reportRepository.findReportForResident(reportId, residentId);

  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  if (report.status !== 'MORE_INFORMATION_REQUIRED') {
    throw new AppError(409, 'REPORT_NOT_EDITABLE', 'Only reports requesting more information can be updated');
  }

  const updatedReport = await reportRepository.updateReportForMoreInformation({
    reportId,
    residentId,
    locationDescription: input.locationDescription.trim(),
    locality: input.locality?.trim() || null,
    nearestLandmark: input.nearestLandmark?.trim() || null,
    latitude: input.latitude === '' || input.latitude === undefined ? null : input.latitude,
    longitude: input.longitude === '' || input.longitude === undefined ? null : input.longitude,
    floodType: input.floodType || 'UNKNOWN',
    peopleAtRisk: input.peopleAtRisk ?? 0,
    observedSeverity: input.observedSeverity,
    roadCondition: input.roadCondition,
    incidentDescription: input.incidentDescription.trim(),
    observedAt: input.observedAt
  });

  if (!updatedReport) {
    throw new AppError(409, 'REPORT_NOT_EDITABLE', 'The report changed before it could be updated');
  }

  return updatedReport;
}

module.exports = {
  submitReport,
  listMine,
  getMine,
  getHistory,
  updateMoreInformation
};
