const crypto = require('crypto');
const { AppError } = require('../utils/http-error');
const reviewRepository = require('../repositories/review.repository');
const alertRepository = require('../repositories/alert.repository');
const dashboardRepository = require('../repositories/dashboard.repository');
const userRepository = require('../repositories/user.repository');

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

async function listReports(query) {
  return reviewRepository.listReports(query);
}

async function getReport(reportId) {
  const dossier = await reviewRepository.getReportDossier(reportId);

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

  const report = await reviewRepository.findReportById(reportId);

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

  return reviewRepository.getReportDossier(reportId);
}

async function assertZonesAreActive(zoneIds) {
  for (const zoneId of zoneIds) {
    const active = await userRepository.isActiveZone(zoneId);

    if (!active) {
      throw new AppError(400, 'INVALID_ZONE', 'One or more selected flood zones are invalid or inactive');
    }
  }
}

function assertValidityWindow(validFrom, expiresAt) {
  if (expiresAt.getTime() <= validFrom.getTime()) {
    throw new AppError(400, 'INVALID_ALERT_WINDOW', 'The alert expiry time must be later than its start time');
  }
}

async function listAlerts(query) {
  return alertRepository.listAlerts(query);
}

async function getAlert(alertId) {
  const alert = await alertRepository.findAlertById(alertId);

  if (!alert) {
    throw new AppError(404, 'ALERT_NOT_FOUND', 'The requested alert was not found');
  }

  return alert;
}

async function createAlert(officer, input) {
  assertValidityWindow(input.validFrom, input.expiresAt);
  await assertZonesAreActive(input.zoneIds);

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
        zoneIds: input.zoneIds
      });
    } catch (error) {
      if (error.code !== '23505' || attempt === 2) throw error;
    }
  }

  throw new AppError(500, 'ALERT_REFERENCE_ERROR', 'An alert reference could not be generated');
}

async function updateAlert(officer, alertId, input) {
  assertValidityWindow(input.validFrom, input.expiresAt);
  await assertZonesAreActive(input.zoneIds);

  const alert = await alertRepository.updateAlert({
    alertId,
    actorId: officer.id,
    title: input.title,
    severity: input.severity,
    warningDescription: input.warningDescription,
    recommendedActions: input.recommendedActions,
    validFrom: input.validFrom,
    expiresAt: input.expiresAt,
    zoneIds: input.zoneIds
  });

  if (!alert) {
    const existing = await alertRepository.findAlertById(alertId);

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
  const transition = ALERT_TRANSITIONS[transitionName];

  if (!transition) {
    throw new AppError(400, 'INVALID_ALERT_TRANSITION', 'The alert action is not recognised');
  }

  const result = await alertRepository.transitionAlert({
    alertId,
    actorId: officer.id,
    newStatus: transition.newStatus,
    allowedFromStatuses: transition.allowedFrom,
    auditAction: transition.auditAction
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, 'ALERT_NOT_FOUND', 'The requested alert was not found');
  }

  if (result.outcome === 'NO_ZONES') {
    throw new AppError(400, 'ALERT_ZONES_REQUIRED', 'An alert must affect at least one flood zone before it is published');
  }

  if (result.outcome === 'INVALID_TRANSITION') {
    throw new AppError(409, 'INVALID_ALERT_TRANSITION', transition.conflictMessage);
  }

  return alertRepository.findAlertById(alertId);
}

async function getDashboard() {
  return dashboardRepository.getOfficerDashboard();
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
