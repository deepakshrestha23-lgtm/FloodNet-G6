# Workload ownership

Each of the four modules has one accountable owner. Shared infrastructure is
listed separately with its own implementation owner.

| Member | Primary role |
|---|---|
| Member 1 | Resident |
| Member 2 | Flood Monitoring Officer |
| Member 3 | Evacuation Officer |
| Member 4 | System Administrator |

## Member 1 — Resident

| Aspect | Files and components |
|---|---|
| Frontend | `client/src/pages/resident/` — `ResidentDashboardPage`, `ReportsPage`, `ReportFormPage`, `ReportDetailPage`, `ResidentAlertsPage`, `CentreDirectoryPage`, `PreparednessPage` |
| API services | `client/src/services/reportApi.js`, `publicApi.js` |
| Backend routes | `/api/reports/*` (`server/routes/report.routes.js`, `evidence.routes.js`) |
| Controllers / services | `report.controller.js`, `report.service.js`, `evidence.*` |
| Repositories | `report.repository.js`, `evidence.repository.js` |
| Database tables | `flood_reports`, `flood_report_status_history`, `flood_evidence_metadata`, `user_profiles`, `notification_preferences` |
| AWS components | Private S3 evidence bucket (Task 1 and Task 2 upload paths) |
| Key rules | Reports start `PENDING_REVIEW`; residents cannot verify their own reports; only reports in `MORE_INFORMATION_REQUIRED` are editable |

## Member 2 — Flood Monitoring Officer

| Aspect | Files and components |
|---|---|
| Frontend | `client/src/pages/officer/` — `OfficerDashboardPage`, `ReviewQueuePage`, `ReviewReportPage`, `AlertsPage`, `AlertFormPage` |
| API services | `client/src/services/officerApi.js` |
| Backend routes | `/api/officer/*` (`server/routes/officer.routes.js`) |
| Controllers / services | `officer.controller.js`, `officer.service.js` |
| Repositories | `review.repository.js`, `alert.repository.js`, `dashboard.repository.js` (officer half) |
| Validators | `officer.validators.js` |
| Database tables | `flood_reports`, `flood_report_reviews`, `flood_report_status_history`, `flood_alerts`, `alert_zones` |
| AWS components | SNS notification path on alert publish (Task 2) |
| Key rules | Verification and alert publishing are separate actions; notes mandatory on reject and request-info; no self-review; alerts need at least one zone before publishing |

## Member 3 — Evacuation Officer

| Aspect | Files and components |
|---|---|
| Frontend | `client/src/pages/evacuation/` — `EvacuationDashboardPage`, `CentreListPage`, `CentreFormPage`; `components/centre/CentreSummaryCard` |
| API services | `client/src/services/centreApi.js` |
| Backend routes | `/api/centres/*` (`server/routes/centre.routes.js`) |
| Controllers / services | `centre.controller.js`, `centre.service.js` |
| Repositories | `centre.repository.js`, `dashboard.repository.js` (evacuation half) |
| Validators | `centre.validators.js` |
| Database tables | `evacuation_centres`, `centre_facilities`, `centre_facility_types` |
| Key rules | `available_space` is a generated column; occupancy cannot be negative or exceed capacity; capacity cannot drop below occupancy; status follows occupancy unless the centre is closed |

## Member 4 — System Administrator

| Aspect | Files and components |
|---|---|
| Frontend | `client/src/pages/admin/` — `AdminOverviewPage`, `UserManagementPage`, `ZoneManagementPage`, `MasterDataPage`, `AuditLogPage` |
| API services | `client/src/services/adminApi.js` |
| Backend routes | `/api/admin/*` (`server/routes/admin.routes.js`) |
| Controllers / services | `admin.controller.js`, `admin.service.js` |
| Repositories | `admin.repository.js` |
| Validators | `admin.validators.js` |
| Database tables | `users`, `roles`, `user_profiles`, `flood_zones`, `centre_facility_types`, `audit_logs`, `auth_sessions` |
| Key rules | No self-deactivation or self-role-change; last active administrator protected; role or status change revokes sessions; zones with active centres cannot be deactivated; administrators cannot verify reports or publish alerts |

## Shared infrastructure

| Area | Files | Notes |
|---|---|---|
| Authentication | `server/services/auth.service.js`, `utils/jwt.js`, `utils/password.js` | bcrypt cost 12, 15-minute access token, rotating refresh token in an HttpOnly cookie |
| Authorization | `server/middleware/auth.middleware.js` | `authenticate` and `requireRoles` applied to every protected router |
| Validation | `server/utils/validation.js` and the per-module validators | Rejects unknown fields, enums, UUIDs, ranges and dates |
| Auditing | `server/utils/audit.js` | Audit rows are written inside the same transaction as the change |
| Error handling | `server/app.js`, `utils/http-error.js` | Single envelope, no stack traces or database errors leak to the browser |
| Frontend system | `client/src/components/`, `layouts/AppLayout.jsx`, `hooks/`, `utils/enums.js` | Reusable components, role-aware navigation, responsive tables |
| Deployment | `Procfile`, `.ebignore`, `package.json` scripts | One Elastic Beanstalk environment, RDS managed independently |

## Evidence to collect per member

For the individual videos and the workload matrix, each member should capture:
the frontend screens they built, the backend routes and services, the database
tables touched, the AWS components involved, and the tests or manual checks that
demonstrate their business rules being enforced.
