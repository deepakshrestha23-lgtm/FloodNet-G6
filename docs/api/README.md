# FloodNet API contract

The REST API is served by Express under `/api`. Every protected endpoint enforces
authentication **and** role authorization on the server. Hiding a control in the
React interface is presentation only and is never the access control.

## Response envelope

Successful response:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A readable error message",
    "details": ["Optional list of field-level problems"]
  }
}
```

## Roles

| Code | Role |
|---|---|
| `RESIDENT` | Resident |
| `FLOOD_MONITORING_OFFICER` | Flood Monitoring Officer |
| `EVACUATION_OFFICER` | Evacuation Officer |
| `ADMINISTRATOR` | System Administrator |

`Public` means no authentication is required. `Any` means any signed-in account.

## Health

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Application liveness check |
| GET | `/api/health/db` | Public | Database connectivity check |

## Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a resident account |
| POST | `/api/auth/login` | Public | Sign in, returns an access token and sets the refresh cookie |
| POST | `/api/auth/refresh` | Public | Rotate the refresh token and issue a new access token |
| POST | `/api/auth/logout` | Public | Revoke the current session |
| GET | `/api/auth/me` | Any | Current account and profile |
| PATCH | `/api/auth/me` | Any | Update own profile |

Details in [authentication.md](authentication.md).

## Public information

Only non-sensitive information is exposed here. Resident identity, officer review
notes and audit data are never returned.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/public/zones` | Public | Active flood zones |
| GET | `/api/public/alerts` | Public | Published alerts inside their validity window |
| GET | `/api/public/incidents` | Public | Verified incident summaries |
| GET | `/api/public/centres` | Public | Evacuation centre availability |

## Resident reports

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/reports` | Resident | Submit a flood report |
| GET | `/api/reports/mine` | Resident | List own reports, filterable by status |
| GET | `/api/reports/:id` | Resident | Own report detail |
| GET | `/api/reports/:id/history` | Resident | Status history and officer feedback |
| PATCH | `/api/reports/:id` | Resident | Update a report awaiting more information |
| POST | `/api/reports/:id/evidence` | Resident | Task 1 evidence upload through Express |
| POST | `/api/reports/:id/evidence/session` | Resident | Task 2 presigned upload session |
| POST | `/api/reports/:id/evidence/complete` | Resident | Record evidence metadata |
| GET | `/api/reports/:id/evidence` | Resident | List own evidence |
| GET | `/api/reports/:id/evidence/:evidenceId/url` | Resident | Short-lived private access URL |

Details in [resident-reports.md](resident-reports.md).

## Flood Monitoring Officer

Administrators are deliberately excluded from these routes. Verification and
alert publishing belong to the operational officer role only.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/officer/dashboard` | Flood Officer | Aggregated situation statistics |
| GET | `/api/officer/reports` | Flood Officer | Review queue: `status`, `zoneId`, `severity`, `from`, `to`, `sort`, `limit`, `offset` |
| GET | `/api/officer/reports/:id` | Flood Officer | Full dossier: report, reporter, evidence, review and status history |
| GET | `/api/officer/reports/:id/evidence/:evidenceId/url` | Flood Officer | Short-lived private access URL for one evidence photograph |
| POST | `/api/officer/reports/:id/review` | Flood Officer | Record a review decision |
| GET | `/api/officer/alerts` | Flood Officer | List alerts, filterable by status and zone |
| POST | `/api/officer/alerts` | Flood Officer | Create an alert **draft** |
| GET | `/api/officer/alerts/:id` | Flood Officer | Alert detail |
| PATCH | `/api/officer/alerts/:id` | Flood Officer | Edit a draft or published alert |
| POST | `/api/officer/alerts/:id/publish` | Flood Officer | Publish a draft |
| POST | `/api/officer/alerts/:id/expire` | Flood Officer | Expire a published alert |
| POST | `/api/officer/alerts/:id/cancel` | Flood Officer | Cancel a draft or published alert |

Review actions and their permitted source states:

| Action | Resulting status | Allowed from |
|---|---|---|
| `VERIFY` | `VERIFIED` | `PENDING_REVIEW`, `MORE_INFORMATION_REQUIRED` |
| `REJECT` | `REJECTED` | `PENDING_REVIEW`, `MORE_INFORMATION_REQUIRED` |
| `MORE_INFORMATION_REQUIRED` | `MORE_INFORMATION_REQUIRED` | `PENDING_REVIEW` |
| `CLOSE` | `CLOSED` | `PENDING_REVIEW`, `MORE_INFORMATION_REQUIRED`, `VERIFIED` |

`REJECT` and `MORE_INFORMATION_REQUIRED` require review notes. An officer cannot
review a report they submitted themselves.

## Evacuation centres

Reads are open to any signed-in account so residents and flood officers can see
where capacity exists. Writes are restricted to the Evacuation Officer.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/centres` | Any | List centres, filterable by zone and status |
| GET | `/api/centres/:id` | Any | Centre detail |
| GET | `/api/centres/dashboard` | Any | Aggregated capacity statistics |
| GET | `/api/centres/facility-types` | Any | Active facility vocabulary |
| POST | `/api/centres` | Evacuation Officer | Create a centre |
| PATCH | `/api/centres/:id` | Evacuation Officer | Edit centre details and facilities |
| POST | `/api/centres/:id/occupancy` | Evacuation Officer | Update current occupancy |
| POST | `/api/centres/:id/status` | Evacuation Officer | Set operational status manually |
| POST | `/api/centres/:id/archive` | Evacuation Officer | Archive a centre |

`available_space` is a generated database column and is never accepted from a
client. Occupancy may not exceed capacity, and capacity may not be reduced below
the recorded occupancy.

## Administration

System governance only. There is deliberately no administrator route for
reviewing reports or publishing alerts.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/admin/overview` | Administrator | Account and zone statistics |
| GET | `/api/admin/users` | Administrator | List users: `search`, `role`, `status`, `limit`, `offset` |
| POST | `/api/admin/users` | Administrator | Create an authorised staff account |
| GET | `/api/admin/users/:id` | Administrator | User detail |
| PATCH | `/api/admin/users/:id/status` | Administrator | Activate or deactivate an account |
| PATCH | `/api/admin/users/:id/role` | Administrator | Assign a role |
| GET | `/api/admin/roles` | Administrator | Available roles |
| GET | `/api/admin/zones` | Administrator | All zones including inactive |
| POST | `/api/admin/zones` | Administrator | Create a zone |
| PATCH | `/api/admin/zones/:id` | Administrator | Update or deactivate a zone |
| GET | `/api/admin/facility-types` | Administrator | Facility master data |
| POST | `/api/admin/facility-types` | Administrator | Create or update a facility type |
| GET | `/api/admin/audit` | Administrator | Audit trail: `actorId`, `action`, `entityType`, `from`, `to` |
| GET | `/api/admin/audit/actions` | Administrator | Distinct audit actions for filtering |

Administrative safeguards enforced server-side:

- an administrator cannot deactivate their own account or change their own role
- the last active administrator cannot be deactivated or moved to another role
- deactivating an account or changing its role revokes that account's sessions
- a zone with active evacuation centres cannot be deactivated
