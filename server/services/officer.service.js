const crypto = require('crypto');
const { AppError } = require('../utils/http-error');
const reviewRepository = require('../repositories/review.repository');
const alertRepository = require('../repositories/alert.repository');
const dashboardRepository = require('../repositories/dashboard.repository');
const userRepository = require('../repositories/user.repository');
const jurisdictionService = require('./jurisdiction.service');
const jurisdictionRepository = require('../repositories/jurisdiction.repository');
const geographyRepository = require('../repositories/geography.repository');

/**
 * A review action maps to exactly one resulting report status, and each action
 * is only legal from a defined set of source states.
 */
const REVIEW_ACTIONS = {
  VERIFY: {
    newStatus: 'VERIFIED',
    allowedFrom: ['PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED'],
    notesRequired: false
  },
  REJECT: {
    newStatus: 'REJECTED',
    allowedFrom: ['PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED'],
    notesRequired: true
  },
  MORE_INFORMATION_REQUIRED: {
    newStatus: 'MORE_INFORMATION_REQUIRED',
    allowedFrom: ['PENDING_REVIEW'],
    notesRequired: true
  },
  CLOSE: {
    newStatus: 'CLOSED',
    allowedFrom: ['PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED', 'VERIFIED'],
    notesRequired: false
  }
};

const ALERT_SEVERITIES = new Set(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY']);

function createAlertReference() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ALT-${datePart}-${randomPart}`;
}

async function listReports(officer, query) {
  await jurisdictionService.requireAssignment(officer.id);
  return reviewRepository.listReports({ ...query, officerId: officer.id });
}

async function getReport(officer, reportId) {
  await jurisdictionService.requireAssignment(officer.id);
  const dossier = await reviewRepository.getReportDossier(reportId, officer.id);

  if (!dossier) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  return dossier;
}

/**
 * Verification means an authorized officer accepted the community report as
 * sufficiently supported for inclusion in FloodNet verified incident
 * information. It never publishes an alert on its own.
 */
async function reviewReport(reviewer, reportId, { action, notes }) {
  const rule = REVIEW_ACTIONS[action];

  if (!rule) {
    throw new AppError(400, 'INVALID_REVIEW_ACTION', 'The review action is not recognised');
  }

  const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';

  if (rule.notesRequired && trimmedNotes.length < 3) {
    throw new AppError(
      400,
      'REVIEW_NOTES_REQUIRED',
      'Review notes are required when rejecting a report or requesting more information'
    );
  }

  await jurisdictionService.requireAssignment(reviewer.id);
  const report = await reviewRepository.findReportById(reportId, reviewer.id);

  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  // An officer may also be a resident reporter; nobody reviews their own report.
  if (report.reporter.id === reviewer.id) {
    throw new AppError(403, 'SELF_REVIEW_FORBIDDEN', 'You cannot review a report that you submitted');
  }

  const result = await reviewRepository.applyReview({
    reportId,
    reviewerId: reviewer.id,
    action,
    newStatus: rule.newStatus,
    notes: trimmedNotes || null,
    allowedFromStatuses: rule.allowedFrom
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  if (result.outcome === 'INVALID_TRANSITION') {
    throw new AppError(
      409,
      'INVALID_REPORT_TRANSITION',
      `A report with status ${result.oldStatus} cannot receive this review action`
    );
  }

  return reviewRepository.getReportDossier(reportId, reviewer.id);
}

async function assertZonesAreActive(zoneIds) {
  for (const zoneId of zoneIds) {
    const active = await userRepository.isActiveZone(zoneId);

    if (!active) {
      throw new AppError(400, 'INVALID_ZONE', 'One or more selected operational risk areas are invalid or inactive');
    }
  }
}

function assertValidityWindow(validFrom, expiresAt) {
  if (expiresAt.getTime() <= validFrom.getTime()) {
    throw new AppError(400, 'INVALID_ALERT_WINDOW', 'The alert expiry time must be later than its start time');
  }
}

async function listAlerts(officer, query) {
  await jurisdictionService.requireAssignment(officer.id);
  return alertRepository.listAlerts({ ...query, officerId: officer.id });
}

/**
 * Turns what an officer selected into the definite set of wards to store.
 *
 * Coarse selections are expanded here, at save time, rather than being resolved
 * on every read. The set an alert was published against is then fixed and
 * auditable, and cannot drift later if the geography tables change.
 *
 * Everything is validated against the resolved set, not the selections, so
 * choosing a district an officer only partly covers is refused rather than
 * quietly warning the part they are allowed to.
 */
async function resolveAlertTargets(officerId, input) {
  const expanded = await geographyRepository.expandAreasToWardIds({
    provinceIds: input.provinceIds || [],
    districtIds: input.districtIds || [],
    localLevelIds: input.localLevelIds || []
  });

  const wardIds = [...new Set([...(input.wardIds || []), ...expanded])];
  const zoneIds = input.zoneIds || [];

  if (wardIds.length === 0 && zoneIds.length === 0) {
    throw new AppError(
      400,
      'ALERT_TARGETS_EMPTY',
      'The selected areas contain no active wards, so this alert would reach nobody'
    );
  }

  const unusable = await geographyRepository.findUnusableWardIds(wardIds);
  if (unusable.length) {
    throw new AppError(400, 'INVALID_WARD', 'One or more selected wards are unknown or inactive');
  }

  const outside = await jurisdictionRepository.findWardsOutsideJurisdiction(officerId, wardIds);
  if (outside.length) {
    throw new AppError(
      403,
      'JURISDICTION_FORBIDDEN',
      'One or more selected areas fall outside your assigned jurisdiction'
    );
  }

  for (const zoneId of zoneIds) {
    if (!(await jurisdictionRepository.canAccessZone(officerId, zoneId))) {
      throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'One or more alert risk areas are outside your assigned jurisdiction');
    }
  }

  return { zoneIds, wardIds };
}

async function getAlert(officer, alertId) {
  await jurisdictionService.requireAssignment(officer.id);
  const alert = await alertRepository.findAlertById(alertId, officer.id);

  if (!alert) {
    throw new AppError(404, 'ALERT_NOT_FOUND', 'The requested alert was not found');
  }

  return alert;
}

async function createAlert(officer, input) {
  await jurisdictionService.requireAssignment(officer.id);
  assertValidityWindow(input.validFrom, input.expiresAt);
  await assertZonesAreActive(input.zoneIds);
  const targets = await resolveAlertTargets(officer.id, input);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await alertRepository.createAlert({
        alertReference: createAlertReference(),
        createdBy: officer.id,
        title: input.title,
        severity: input.severity,
        warningDescription: input.warningDescription,
        recommendedActions: input.recommendedActions,
        validFrom: input.validFrom,
        expiresAt: input.expiresAt,
        zoneIds: targets.zoneIds,
        wardIds: targets.wardIds,
        officerId: officer.id
      });
    } catch (error) {
      if (error.code !== '23505' || attempt === 2) throw error;
    }
  }

  throw new AppError(500, 'ALERT_REFERENCE_ERROR', 'An alert reference could not be generated');
}

async function updateAlert(officer, alertId, input) {
  await jurisdictionService.requireAssignment(officer.id);
  assertValidityWindow(input.validFrom, input.expiresAt);
  await assertZonesAreActive(input.zoneIds);
  const updatedTargets = await resolveAlertTargets(officer.id, input);

  const alert = await alertRepository.updateAlert({
    alertId,
    actorId: officer.id,
    title: input.title,
    severity: input.severity,
    warningDescription: input.warningDescription,
    recommendedActions: input.recommendedActions,
    validFrom: input.validFrom,
    expiresAt: input.expiresAt,
    zoneIds: updatedTargets.zoneIds,
    wardIds: updatedTargets.wardIds,
    officerId: officer.id
  });

  if (!alert) {
    const existing = await alertRepository.findAlertById(alertId, officer.id);

    if (!existing) {
      throw new AppError(404, 'ALERT_NOT_FOUND', 'The requested alert was not found');
    }

    throw new AppError(409, 'ALERT_NOT_EDITABLE', 'Cancelled and expired alerts cannot be edited');
  }

  return alert;
}

const ALERT_TRANSITIONS = {
  publish: {
    newStatus: 'PUBLISHED',
    allowedFrom: ['DRAFT'],
    auditAction: 'ALERT_PUBLISHED',
    conflictMessage: 'Only a draft alert can be published'
  },
  expire: {
    newStatus: 'EXPIRED',
    allowedFrom: ['PUBLISHED'],
    auditAction: 'ALERT_EXPIRED',
    conflictMessage: 'Only a published alert can be expired'
  },
  cancel: {
    newStatus: 'CANCELLED',
    allowedFrom: ['DRAFT', 'PUBLISHED'],
    auditAction: 'ALERT_CANCELLED',
    conflictMessage: 'Only a draft or published alert can be cancelled'
  }
};

async function transitionAlert(officer, alertId, transitionName) {
  await jurisdictionService.requireAssignment(officer.id);
  const transition = ALERT_TRANSITIONS[transitionName];

  if (!transition) {
    throw new AppError(400, 'INVALID_ALERT_TRANSITION', 'The alert action is not recognised');
  }

  const result = await alertRepository.transitionAlert({
    alertId,
    actorId: officer.id,
    newStatus: transition.newStatus,
    allowedFromStatuses: transition.allowedFrom,
    auditAction: transition.auditAction,
    officerId: officer.id
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, 'ALERT_NOT_FOUND', 'The requested alert was not found');
  }

  if (result.outcome === 'NO_TARGETS') {
    throw new AppError(400, 'ALERT_TARGETS_REQUIRED', 'An alert must affect at least one administrative area or operational risk area before it is published');
  }

  if (result.outcome === 'INVALID_TRANSITION') {
    throw new AppError(409, 'INVALID_ALERT_TRANSITION', transition.conflictMessage);
  }

  return alertRepository.findAlertById(alertId, officer.id);
}

async function getDashboard(officer, geographyQuery) {
  await jurisdictionService.requireAssignment(officer.id);
  return dashboardRepository.getOfficerDashboard(officer.id, geographyQuery);
}

module.exports = {
  REVIEW_ACTIONS,
  ALERT_SEVERITIES,
  listReports,
  getReport,
  reviewReport,
  listAlerts,
  getAlert,
  createAlert,
  updateAlert,
  transitionAlert,
  getDashboard
};
