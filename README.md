# FloodNet

## Cloud-Based Flood Reporting, Early Warning and Evacuation Coordination System

FloodNet is a role-based emergency-information platform for communities affected by flooding. It connects resident observations, operational review, official alerts and evacuation-centre information in one coherent workflow.

```
Observe -> Report -> Review -> Verify -> Warn -> Coordinate -> Inform -> Monitor
```

The application is being developed in two evolutionary stages:

- **Task 1:** a complete server-based application using React, Express, PostgreSQL/RDS, private Amazon S3 evidence storage and Elastic Beanstalk.
- **Task 2:** an architectural evolution that moves selected responsibilities to API Gateway, Lambda, S3, SNS and CloudWatch without replacing the main FloodNet application.

## Current status

The Task 1 application functionality is implemented across all four roles and has been tested against a real PostgreSQL database. The application is prepared for cloud deployment, but the final Elastic Beanstalk/RDS deployment walkthrough is still a separate step.

| Area | Status |
|---|---|
| React/Vite frontend and responsive UI | Implemented |
| Express REST API and health checks | Implemented |
| Authentication and refresh-session handling | Implemented |
| Server-side role-based access control | Implemented |
| Resident reporting and report lifecycle | Implemented |
| Flood Monitoring Officer review and alerting | Implemented |
| Evacuation Officer centre management | Implemented |
| System Administrator governance and audit | Implemented |
| Task 1 private S3 photo evidence | Implemented; live access requires an active AWS lab role |
| Elastic Beanstalk and RDS deployment | Prepared, not yet fully validated in AWS |
| Task 2 Evidence Service | Scaffolded, not yet deployed |
| Task 2 Notification Service with SNS | Not started |

Latest local verification recorded during this development cycle:

- `npm run build`: passed;
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities;
- `npm run db:migrate`: migration 006 applied successfully;
- `npm test`: 175 passed, 0 failures;
- `npm run aws:check`: application configuration passed, but the current AWS Academy role is explicitly denied S3 access until the lab credentials are refreshed.

## Product roles

| Role | Main responsibilities |
|---|---|
| **Resident** | Create and manage personal flood reports, select an official Nepal ward, attach optional evidence, view report history and read public flood and evacuation information. |
| **Flood Monitoring Officer** | Review reports within the assigned jurisdiction, inspect evidence, verify/reject/request information, publish alerts and monitor filtered situation dashboards. |
| **Evacuation Officer** | Manage geographically assigned evacuation centres, capacity, occupancy, operational status and facilities. |
| **System Administrator** | Manage users, staff roles, operational risk areas, officer jurisdictions, authoritative geography reference data, facility master data and audit records. Administrators do not make operational flood decisions. |

Public visitors can read safe public information through unauthenticated public endpoints. They never receive resident identity, private officer notes, evidence metadata or audit information.

The system deliberately distinguishes:

```
Community report != Verified incident != Published official alert
```

A resident report never automatically creates an emergency alert. Verification and alert publishing are separate authorized actions.

## Architecture

### Task 1: server-based application

During local development, Vite and Express run as separate processes. In the initial cloud deployment, the Vite production build and Express API are deployed together in one Elastic Beanstalk Node.js environment.

```
Browser
   |
   v
React/Vite production build
   |
   v
Node.js + Express on Elastic Beanstalk
   |                              \
   v                               v
Amazon RDS PostgreSQL       Private Amazon S3
structured data             evidence image files
                            |
                            v
                     RDS evidence metadata only
```

The frontend and backend remain logically separated in the repository. Express serves the built frontend and the `/api` REST API in production.

### National administrative geography

FloodNet uses two deliberately separate location concepts:

- **Administrative geography:** Nepal's seven provinces, 77 districts, 753 local levels and 6,743 wards. These normalized reference tables are the official reporting, routing and dashboard filter hierarchy.
- **Operational risk areas:** optional application-managed river corridors, floodplains, urban drainage areas or flash-flood areas. A risk area can cover one or more wards and is never treated as an administrative boundary or authorization scope.

Residents select Province → District → Local Level → Ward, then optionally add a locality, Tole, landmark and GPS coordinates. Reports and evacuation centres store the ward as their canonical location. Legacy zone-only records remain supported through the `flood_zone_wards` mapping table.

The checked-in reference snapshot is generated by `scripts/build-nepal-geography-data.js` and loaded by `server/db/seeds/001_nepal_geography.js`. It uses stable source IDs/codes so duplicate names do not create ambiguous routing. The dataset is cross-checked against the [National Statistics Office administrative-code reference](https://ec.nsonepal.gov.np/html/admin_code.html) and [NSO local-level dataset](https://data.nsonepal.gov.np/dataset/local-level).

Operational officers receive one server-enforced jurisdiction: national, province, district, local level or ward. Every report, alert, centre, evidence and dashboard query is scoped in Express/SQL; a React control is never relied upon for authorization.

### Task 1 photo evidence boundary

```
React/Vite -> Express Evidence functionality -> private S3
                                      \-> RDS evidence metadata
```

The browser never receives AWS credentials. Express authorizes access, validates the image and manages the private S3 object using the local AWS provider chain or the Elastic Beanstalk instance role.

### Task 2: serverless evolution

```
React -> API Gateway -> Lambda Evidence Service -> existing private S3

Main FloodNet application -> Express on Elastic Beanstalk -> RDS PostgreSQL
                                      |
                                      +-> API Gateway -> Notification Lambda -> SNS
                                                               |
                                                               +-> CloudWatch
```

Task 2 moves evidence-management responsibility from Express to an independent Evidence Service. It does not introduce S3 for the first time, replace the main application or create a second evidence data model. The main report workflow continues to use Express and RDS.

## Implemented functionality

### Resident module

- registration, login, logout and session refresh;
- profile viewing and editing;
- resident dashboard;
- flood report creation with required official Province/District/Local Level/Ward, optional locality/landmark/GPS and operational risk area, severity, road condition, description and observation time;
- generated report references;
- personal report list, filtering, details and status history;
- additional-information workflow when an officer requests more information;
- optional Task 1 photo evidence upload;
- active alerts, verified incidents, evacuation-centre directory and preparedness information.

Report states are:

```
PENDING_REVIEW
MORE_INFORMATION_REQUIRED
VERIFIED
REJECTED
CLOSED
```

Residents can never set their own report status or review their own report.

### Flood Monitoring Officer module

- live operational dashboard;
- cascading administrative filters from Province to Ward;
- report review queue with filtering, sorting and pagination;
- report details, review history and evidence inspection;
- verify, reject or request more information;
- mandatory review notes for rejection and information requests;
- reviewer and timestamp history;
- alert creation with operational-zone and precise administrative-ward targeting;
- draft, publish, edit, expire and cancel alert workflow;
- alert status and zone filtering;
- database-backed statistics and charts.

### Evacuation Officer module

- evacuation dashboard;
- cascading administrative dashboard filters;
- centre creation, editing and archiving;
- official administrative geography, optional operational risk area, locality, landmark and GPS information;
- read-only active alerts and verified incidents limited to the officer's assigned jurisdiction;
- maximum capacity and current occupancy;
- calculated available space;
- occupancy validation and threshold-based operational status;
- manual status changes and closed-centre safeguards;
- centre facilities and public availability data.

Supported centre statuses:

```
OPEN
NEAR_CAPACITY
FULL
CLOSED
```

The database prevents negative capacity, negative occupancy and occupancy greater than capacity.

### System Administrator module

- administrator overview dashboard;
- user search and filtering;
- authorized staff account creation;
- account activation and deactivation;
- role assignment with privilege safeguards;
- national, province, district, local-level and ward jurisdiction assignment for operational officers;
- flood-zone creation and update;
- facility master-data management;
- audit-log filtering and action lookup;
- protection against deactivating the last active administrator;
- protection against self-deactivation and self-role changes.

## Task 1 photo evidence

Residents may optionally attach flood evidence photographs when submitting a report. The implementation keeps evidence responsibility modular so it can move to Task 2 later.

### Rules and limits

- accepted types: JPEG, PNG and WebP;
- maximum five images per report;
- maximum 5 MB per image;
- MIME type and image-signature validation;
- SHA-256 checksum recorded as metadata;
- safe random report-scoped S3 object keys;
- upload allowed only while a report is awaiting review;
- resident access limited to the resident's own report;
- Flood Monitoring Officers access evidence through an officer-only route;
- public endpoints never expose evidence;
- access is returned through a short-lived presigned URL.

### Storage boundary

- `multer.memoryStorage()` handles the request without writing to disk;
- image bytes are stored only in the private S3 bucket;
- PostgreSQL stores the report reference, uploader, object key, filename, type, size, checksum and upload status;
- no `server/uploads` directory is used;
- PostgreSQL does not contain a binary image column;
- if the metadata transaction fails after an upload, the service removes the uploaded objects to prevent storage drift.

Object keys use this pattern:

```
reports/{residentId}/{reportId}/{uuid}.{extension}
```

The original filename is metadata only and is never used to construct the key.

Detailed evidence documentation is available in [docs/deployment/evidence-s3.md](docs/deployment/evidence-s3.md) and [docs/architecture/evidence-upload.md](docs/architecture/evidence-upload.md).

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Bootstrap 5, custom CSS and React Router |
| Charts | Chart.js |
| Backend | Node.js 20+ and Express.js |
| Database | PostgreSQL locally and Amazon RDS for production |
| Database access | `pg` with parameterized SQL |
| Task 1 compute | AWS Elastic Beanstalk Node.js platform |
| Task 1 object storage | Private Amazon S3 |
| Task 2 services | API Gateway, AWS Lambda and Amazon SNS |
| Observability | CloudWatch for Task 2 logs and metrics |

FloodNet does not require an external flood-data API to function. Additional AWS services must have a clear business and architectural justification before they are added.

## Repository structure

```
FloodNet/
├── client/
│   ├── src/
│   │   ├── components/       # reusable UI components
│   │   ├── context/          # authentication state
│   │   ├── hooks/            # reusable React hooks
│   │   ├── layouts/          # authenticated application layout
│   │   ├── pages/            # public and role-specific pages
│   │   ├── routes/           # role-based route boundaries
│   │   ├── services/         # API clients and evidence paths
│   │   └── utils/            # enums and formatting helpers
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── config/               # environment and evidence configuration
│   ├── controllers/          # HTTP handlers
│   ├── db/                   # pool, migrations, seeds and AWS preflight
│   ├── middleware/           # authentication and upload handling
│   ├── repositories/         # PostgreSQL access
│   ├── routes/               # Express route modules
│   ├── services/             # business logic and S3 integration
│   ├── utils/                # errors, audit and shared validation
│   └── validators/           # server-side request validation
├── scripts/
│   └── build-nepal-geography-data.js  # refreshes checked-in reference data
├── microservices/
│   └── evidence-service/     # Task 2 Lambda authorizer and handler
├── tests/                    # Node test suite and isolated test harness
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── database/
│   ├── deployment/
│   └── workload/
├── .ebignore
├── .env.example
├── Procfile
├── package.json
└── README.md
```

## Database design

The database is normalized PostgreSQL accessed through `pg`. Migrations are applied in filename order:

```
001_initial_schema.sql
002_auth_session_indexes.sql
003_module_indexes.sql
004_refresh_token_rotation_grace.sql
005_national_geography_and_jurisdiction.sql
```

Important table groups:

| Group | Tables |
|---|---|
| Identity | `roles`, `users`, `user_profiles`, `auth_sessions` |
| Administrative geography | `geo_provinces`, `geo_districts`, `geo_local_levels`, `geo_wards` |
| Operational geography | `flood_zones`, `flood_zone_wards`, `user_jurisdictions` |
| Reporting | `flood_reports`, `flood_report_reviews`, `flood_report_status_history` |
| Alerts | `flood_alerts`, `alert_zones`, `alert_wards` |
| Evacuation | `evacuation_centres`, `centre_facility_types`, `centre_facilities` |
| Notifications | `notification_preferences`, `notification_logs` |
| Evidence | `flood_evidence_metadata` |
| Governance | `audit_logs` |

Important database rules include:

- new reports start as `PENDING_REVIEW`;
- every new report and centre must reference an active official ward; an operational risk area is optional;
- official ward IDs, not free-text names, drive routing and jurisdiction checks;
- operational risk areas remain separate from administrative geography and staff authorization;
- operational accounts must have a valid server-side jurisdiction assignment;
- review notes are required for rejection and information requests;
- alert expiry must be later than its start time;
- occupancy cannot exceed capacity;
- available space is generated from capacity and occupancy;
- lower-case email values are unique;
- important state changes are auditable.

## API overview

All API responses use a consistent envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Readable result message"
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable error message"
  }
}
```

### Public and platform endpoints

```
GET  /api/health
GET  /api/health/db

POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/me

GET  /api/public/zones
GET  /api/public/alerts
GET  /api/public/incidents
GET  /api/public/centres
GET  /api/geography/provinces
GET  /api/geography/districts?provinceId={id}
GET  /api/geography/local-levels?districtId={id}
GET  /api/geography/wards?localLevelId={id}
```

### Resident report and evidence endpoints

```
POST  /api/reports
GET   /api/reports/mine
GET   /api/reports/:id
GET   /api/reports/:id/history
PATCH /api/reports/:id

POST /api/reports/:id/evidence
POST /api/reports/:id/evidence/session
POST /api/reports/:id/evidence/complete
GET  /api/reports/:id/evidence
GET  /api/reports/:id/evidence/:evidenceId/url
```

### Flood Monitoring Officer endpoints

```
GET   /api/officer/dashboard?provinceId=&districtId=&localLevelId=&wardId=
GET   /api/officer/reports?provinceId=&districtId=&localLevelId=&wardId=
GET   /api/officer/reports/:id
POST  /api/officer/reports/:id/review
GET   /api/officer/reports/:id/evidence/:evidenceId/url

GET   /api/officer/alerts?provinceId=&districtId=&localLevelId=&wardId=
POST  /api/officer/alerts
GET   /api/officer/alerts/:id
PATCH /api/officer/alerts/:id
POST  /api/officer/alerts/:id/publish
POST  /api/officer/alerts/:id/expire
POST  /api/officer/alerts/:id/cancel
```

### Evacuation Officer and centre endpoints

```
GET   /api/centres
GET   /api/centres/:id
GET   /api/centres/dashboard
GET   /api/centres/facility-types
POST  /api/centres
PATCH /api/centres/:id
POST  /api/centres/:id/occupancy
POST  /api/centres/:id/status
POST  /api/centres/:id/archive
```

### Administrator endpoints

```
GET   /api/admin/overview
GET   /api/admin/users
POST  /api/admin/users
GET   /api/admin/users/:id
PATCH /api/admin/users/:id/status
PATCH /api/admin/users/:id/role
PATCH /api/admin/users/:id/jurisdiction
GET   /api/admin/roles
GET   /api/admin/zones
POST  /api/admin/zones
PATCH /api/admin/zones/:id
GET   /api/admin/facility-types
POST  /api/admin/facility-types
GET   /api/admin/audit
GET   /api/admin/audit/actions
```

Protected routes enforce authorization in Express. React route protection is a user-experience boundary, not the security boundary.

Detailed request and response contracts are in [docs/api/README.md](docs/api/README.md), [docs/api/authentication.md](docs/api/authentication.md) and [docs/api/resident-reports.md](docs/api/resident-reports.md).

## Security model

- Passwords are hashed with bcrypt.
- Access and refresh tokens are validated server-side.
- Refresh sessions can be revoked and role changes revoke affected sessions.
- Every protected route authenticates the caller and applies role checks where required.
- Residents can access only their own reports and evidence.
- Officers cannot review their own submitted report.
- Administrators cannot use governance routes to review reports or publish alerts.
- PostgreSQL queries are parameterized.
- Helmet, Content Security Policy, CORS, rate limiting and centralized error handling are enabled.
- Client-side validation is supplemented by server-side validation.
- Public responses exclude private operational information.
- S3 Block Public Access must remain enabled.
- AWS credentials are never placed in React or any `VITE_` variable.
- Local secrets stay in `.env`; production secrets belong in Elastic Beanstalk environment configuration or managed AWS secret mechanisms.

## Local development

### Prerequisites

- Node.js 20 or newer;
- npm;
- PostgreSQL 15 or newer;
- Git;
- AWS CLI when testing the real S3 integration locally.

### Install

```powershell
git clone https://github.com/deepakshrestha23-lgtm/FloodNet-G6.git
Set-Location FloodNet-G6
npm install
Copy-Item .env.example .env
```

Create a local PostgreSQL database named `floodnet`, then edit `.env` with:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=floodnet
DB_USER=postgres
DB_PASSWORD=your-private-password
DB_SSL=false
JWT_ACCESS_SECRET=long-random-local-secret
JWT_REFRESH_SECRET=another-long-random-secret
```

Do not commit `.env` or any real credentials. Windows PostgreSQL guidance is in [docs/deployment/local-postgresql.md](docs/deployment/local-postgresql.md).

### Configure Task 1 S3 locally

For the real evidence path, set the bucket region and private bucket in `.env`:

```env
AWS_REGION=us-east-1
EVIDENCE_BUCKET_NAME=floodnet-report-evidence-g6-2026
EVIDENCE_STORAGE_MODE=s3
EVIDENCE_URL_EXPIRES_SECONDS=300
VITE_EVIDENCE_ENABLED=true
VITE_TASK2_EVIDENCE_ENABLED=false
```

The bucket name is configuration, not an application secret. If the bucket is recreated, change only the private local environment value. `EVIDENCE_STORAGE_MODE=mock` is available for automated tests and does not call AWS; production must use `s3`.

### Migrate and seed

```powershell
npm run db:migrate
npm run db:seed
```

The SQL seed creates roles, clearly labelled fictional operational risk areas and facility types. The JavaScript geography seed then loads the normalized Nepal reference hierarchy and maps the three demo risk areas to sample wards. To create demonstration accounts and sample centres, reports and alerts, set a private local password first:

```env
DEMO_PASSWORD=private-local-demo-password
```

Then run `npm run db:seed` again. Demo accounts are:

| Email | Role |
|---|---|
| `resident@floodnet.local` | Resident |
| `officer@floodnet.local` | Flood Monitoring Officer |
| `evacuation@floodnet.local` | Evacuation Officer |
| `admin@floodnet.local` | System Administrator |

The demo seed skips itself when `DEMO_PASSWORD` is empty and refuses to run in production unless `ALLOW_DEMO_SEED=true` is explicitly set.

The checked-in geography data is reference data, not demo data. The demo accounts and `ZONE-A`/`ZONE-B`/`ZONE-C` records are deliberately labelled as demonstration content and must not be used as production geography or credentials.

### Production account provisioning

Production must not use the demo password, demo accounts or `ALLOW_DEMO_SEED=true`.
After the production database has been migrated and the reference data has been
seeded, run the following command from a trusted environment that can reach the
RDS database:

```powershell
npm run db:bootstrap-admin
```

The command asks for the first administrator's real email, name, optional phone
and password. The password is entered invisibly, is validated for minimum
strength and is never printed or stored in source code. A database lock prevents
two terminals from creating competing first administrators, and the command
refuses to run if an administrator already exists. It also records the
bootstrap event in the audit log.

After signing in with that administrator account, use the Administrator panel
to create the Flood Monitoring Officer and Evacuation Officer accounts. This
keeps production credentials separate from local demonstration data and makes
the normal account-governance workflow available from the first login.

### Start the application

Run both development processes with one command:

```powershell
npm run dev
```

The local URLs are:

- React/Vite: `http://localhost:5173`
- Express API: `http://localhost:5000`
- PostgreSQL: `localhost:5432`

Vite proxies `/api` requests to Express. If you prefer two terminals:

```powershell
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Verify the health pipeline with:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/health/db
```

### Production-style local run

Elastic Beanstalk does not build the Vite frontend for this application. Build the client before starting Express:

```powershell
npm run build
npm start
```

The generated `client/dist` directory is served by Express alongside `/api`. `npm run build:deploy` is a convenience command that builds the client and confirms that the deployment bundle is ready.

## Environment variables

The complete template is [.env.example](.env.example).

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode; production requires S3 evidence storage and production secrets. |
| `PORT` | Express port; defaults to `5000`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` | PostgreSQL connection. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Server-only token signing secrets. |
| `CLIENT_ORIGIN` | Allowed browser origin for credentialed API requests. |
| `AWS_REGION` | Region containing the evidence bucket; the current Learner Lab configuration is `us-east-1`. |
| `EVIDENCE_BUCKET_NAME` | Private S3 bucket name. |
| `EVIDENCE_STORAGE_MODE` | `s3` for Task 1/production; `mock` only for local tests. |
| `EVIDENCE_URL_EXPIRES_SECONDS` | Presigned URL lifetime, constrained by the service. |
| `EVIDENCE_UPLOAD_SECRET` | Server-only signing secret for the Task 2 upload-session path. |
| `VITE_EVIDENCE_ENABLED` | Enables the Task 1 evidence UI; not a secret. |
| `VITE_TASK2_EVIDENCE_ENABLED` | Selects the Task 2 client path when the API Gateway URL exists. |
| `VITE_EVIDENCE_API_URL` | Task 2 API Gateway base URL. |
| `DEMO_PASSWORD` | Optional private password for local demonstration accounts. |

Only variables beginning with `VITE_` are exposed to browser code. Never put AWS credentials, database passwords or JWT secrets in a `VITE_` variable.

## AWS Academy Learner Lab

The current AWS environment is an AWS Academy Learner Lab, which changes the deployment procedure:

- credentials are temporary and expire when the lab session ends;
- the session token is required in addition to the access key and secret key;
- IAM user/role creation may be unavailable;
- the lab normally uses `us-east-1`;
- the lab has a fixed budget and can be reset.

At the start of a lab session, use the helper script:

```powershell
npm run aws:login
npm run aws:check
```

The helper prompts for the three temporary AWS CLI values and writes them to the default local AWS profile. Never commit them and never place temporary keys in Elastic Beanstalk environment variables.

The S3 preflight checks credentials, region, bucket reachability, Block Public Access, a write/read cycle through a presigned URL and rejection of an unsigned read:

```powershell
npm run aws:check
```

The evidence bucket must remain private. The current development bucket is `floodnet-report-evidence-g6-2026` in `us-east-1`.

## Task 1 deployment preparation

The intended production deployment is one Elastic Beanstalk Node.js environment:

```
React build + Express API
          -> Elastic Beanstalk
          -> Amazon RDS PostgreSQL
          -> private Amazon S3 evidence bucket
```

Before deployment:

1. Create or select the RDS PostgreSQL database in `us-east-1`.
2. Restrict the RDS security group so only the approved Elastic Beanstalk runtime can connect.
3. Build the frontend with `npm run build`.
4. Deploy the bundle containing `client/dist`, server code and production dependencies.
5. Configure production environment values in Elastic Beanstalk, including database values, fresh JWT secrets, `AWS_REGION`, `EVIDENCE_BUCKET_NAME`, `EVIDENCE_STORAGE_MODE=s3` and `CLIENT_ORIGIN`.
6. Use the existing Learner Lab roles, normally `LabRole` and `LabInstanceProfile`, rather than asking Elastic Beanstalk to create roles.
7. Grant only the required S3 evidence-prefix permissions: `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` where deletion is implemented.
8. Run migrations against RDS through a controlled process.
9. Verify health, authentication, each role, report review, alerts, centre capacity and private evidence access.

The application reads AWS credentials through the default AWS provider chain. In Elastic Beanstalk, the instance profile supplies them. Do not use long-lived or temporary AWS access keys as application environment variables.

See [docs/deployment/aws-learner-lab.md](docs/deployment/aws-learner-lab.md) and [docs/deployment/evidence-s3.md](docs/deployment/evidence-s3.md) for the detailed checklist.

## Task 2 evolution

Task 2 preserves the working Task 1 application and changes service ownership:

| Capability | Task 1 | Task 2 |
|---|---|---|
| Main report workflow | Express on Elastic Beanstalk | Remains Express on Elastic Beanstalk |
| Structured data | RDS through Express | RDS through Express |
| Evidence upload responsibility | Express evidence modules | API Gateway and Lambda Evidence Service |
| Evidence files | Private S3 | Same private S3 bucket |
| Notifications | Application foundation only | Notification Lambda and SNS |
| Observability | Application logs | CloudWatch logs and metrics for serverless paths |

The `microservices/evidence-service` directory contains the Task 2 Lambda authorizer and presigned-upload handler. It is not yet a deployed API Gateway/Lambda service. The future Task 2 path is:

1. Express creates a short-lived report-specific upload session.
2. API Gateway and the Lambda authorizer validate the session.
3. Evidence Lambda validates the request and returns a presigned S3 PUT URL.
4. React uploads to the existing private bucket.
5. Express records compatible evidence metadata in RDS.

Notification Lambda, SNS integration, CloudWatch metrics and the final Task 2 deployment evidence remain future work. See [docs/deployment/task1-task2-features.md](docs/deployment/task1-task2-features.md) and [microservices/evidence-service/README.md](microservices/evidence-service/README.md).

## Testing and quality checks

Run from the repository root:

```powershell
npm test
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

The test suite uses a dedicated `floodnet_test` database so normal development data is not used. It covers:

- authentication and token handling;
- role-based access control;
- resident reports and state transitions;
- officer review and alert transitions;
- evacuation capacity rules;
- administrator safeguards and audit logs;
- evidence validation, authorization and private access.

Expected negative-test log lines such as `FORBIDDEN`, `VALIDATION_ERROR` and `NOT_FOUND` are intentional. They demonstrate rejected requests; they are not test failures by themselves.

The concurrent refresh-token test verifies that parallel browser refreshes are serialized safely and all in-flight requests remain usable.

The production build currently emits a bundle-size warning because the main JavaScript chunk is larger than 500 kB. This is not a build failure, but code-splitting is a sensible polish task after correctness is complete.

## Useful documentation

- [Architecture overview](docs/architecture/README.md)
- [Evidence architecture](docs/architecture/evidence-upload.md)
- [Database design](docs/database/README.md)
- [API contract](docs/api/README.md)
- [Authentication API](docs/api/authentication.md)
- [Resident reports API](docs/api/resident-reports.md)
- [Local PostgreSQL setup](docs/deployment/local-postgresql.md)
- [AWS Learner Lab deployment](docs/deployment/aws-learner-lab.md)
- [Private S3 checklist](docs/deployment/evidence-s3.md)
- [Task 1/Task 2 evidence boundary](docs/deployment/task1-task2-features.md)
- [Workload ownership](docs/workload/README.md)
- [Task 2 Evidence Service](microservices/evidence-service/README.md)

## Git workflow

Keep major changes on feature branches and keep commits focused:

```powershell
git switch -c feature/<module-name>
git status
git add <files>
git commit -m "feat: describe the completed change"
git push -u origin feature/<module-name>
```

For the current branch, push existing commits with:

```powershell
git push origin feature/officer-review
```

Never commit `.env`, AWS credentials, PostgreSQL passwords, generated private evidence files or other secrets.

## Engineering principles

- Keep verification separate from alert publishing.
- Treat resident reports as community observations, not scientific measurements.
- Keep public-safe data separate from private operational data.
- Enforce authorization on the server, not only in React.
- Use real database data for dashboards and statistics.
- Store files in private S3 and metadata in PostgreSQL.
- Do not depend on permanent local filesystem storage in the deployed application.
- Do not add AWS services without a demonstrable business purpose.
- Do not replace working functionality merely to change the architecture.
- Keep the code understandable enough for every team member to explain their contribution.
