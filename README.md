# FloodNet

## Cloud-Based Flood Reporting, Early Warning and Evacuation Coordination System

FloodNet is a cloud-based emergency-information platform for communities affected by flooding. It connects resident observations, authorized operational review, official alerts and evacuation-centre information in one coordinated workflow.

The product is being developed as an evolutionary cloud application:

- **Task 1** is a complete server-based application using React, Express, PostgreSQL/RDS, private S3 evidence storage and Elastic Beanstalk.
- **Task 2** evolves selected responsibilities into independently deployable serverless services using API Gateway, Lambda, S3, SNS and CloudWatch.

> This README is the project implementation guide and status record. It distinguishes functionality that exists in the repository from functionality planned for the next development phases.

## 1. Project purpose

FloodNet addresses practical flood-response problems:

- residents may not know where to report local flooding;
- important observations can be fragmented across informal communication channels;
- operational officers need a reviewable queue rather than unstructured messages;
- public alerts must be separated from unverified community observations;
- residents need current evacuation-centre availability and safety information.

The intended operational flow is:

```text
Observe -> Report -> Review -> Verify -> Assess -> Warn -> Coordinate -> Inform -> Monitor
```

FloodNet community reports are observations submitted by residents. Verification means that an authorized Flood Monitoring Officer has reviewed a report for inclusion in FloodNet information; it does not claim scientific, legal or sensor-based proof.

## 2. Current implementation status

| Area | Status | Notes |
|---|---|---|
| React/Vite application shell | Implemented | Vite development server, production build and responsive Bootstrap-based styling are present. |
| Express API and health checks | Implemented | `/api/health` and `/api/health/db` provide application and database checks. |
| Authentication foundation | Implemented | Registration, login, logout, refresh, current-user and profile update flows are present. |
| Resident report workflow | Implemented | Residents can create, view, edit when more information is requested, list and inspect report history. |
| Task 1 photo evidence | Implemented | Express validates and uploads JPEG, PNG and WebP images to private S3; RDS stores metadata only. |
| Public information API | Implemented | Public zones, active alerts, verified incidents and evacuation-centre data are available through read endpoints. |
| Flood Monitoring Officer workflow | Next module | Review queue, review decisions, alert management and live situation dashboard are being built next. |
| Evacuation Officer workflow | Planned | Centre operations, capacity and facility management are represented in the database foundation but not yet exposed as staff screens/API workflows. |
| Administrator workflow | Planned | User, role, zone, master-data and audit management are planned. |
| Task 1 Elastic Beanstalk/RDS deployment | Pending | Local application and S3 integration are being completed before the full deployment validation. |
| Task 2 Evidence Service | Scaffolded | The Lambda authorizer and upload-url handler are retained as the serverless evolution; AWS deployment and end-to-end validation remain later work. |
| Task 2 Notification Service | Planned | API Gateway, Lambda, SNS and CloudWatch notification flow will be added after the core Task 1 workflow is complete. |

The current development branch is `feature/officer-review`. The stable repository is available at [FloodNet-G6 on GitHub](https://github.com/deepakshrestha23-lgtm/FloodNet-G6).

## 3. User roles and product boundaries

FloodNet has four primary roles. Public visitors can read approved public information without being one of the four authenticated roles.

| Role | Responsibility |
|---|---|
| **Resident** | Submit and manage personal flood reports, optionally attach evidence, view status/history, and read public alerts, incidents and centre information. |
| **Flood Monitoring Officer** | Review community reports, make review decisions, publish official FloodNet alerts and monitor the situation dashboard. |
| **Evacuation Officer** | Manage evacuation centres, operational status, facilities and occupancy information. |
| **System Administrator** | Manage accounts, roles, zones, controlled master data and audit information; does not make operational flood decisions. |

The most important business separation is:

```text
Community report != Verified incident != Published official alert
```

A resident report must never automatically publish an emergency alert. Verification and alert publishing are separate authorized actions.

## 4. Architecture

### Task 1: server-based application

```text
                         +----------------------+
                         | Amazon RDS PostgreSQL |
                         | reports and metadata  |
                         +----------^-----------+
                                    |
Browser -> React/Vite -> Express on Elastic Beanstalk
                              |
                              +--> private Amazon S3
                                   actual evidence images
```

Task 1 uses one Elastic Beanstalk Node.js environment. Express serves the built Vite frontend and the `/api` REST API. The frontend and backend remain separate in the repository so they can be deployed independently later if needed.

For photo evidence specifically:

```text
React/Vite -> Express Evidence functionality -> private S3
                                      \-> RDS evidence metadata
```

The browser never receives AWS credentials. Express authorizes the report owner, validates the upload and uses its server-side AWS permissions to manage the private S3 object.

### Task 2: serverless evolution

```text
React/Vite -> API Gateway -> Lambda Evidence Service -> existing private S3

Main FloodNet application -> Express on Elastic Beanstalk -> RDS PostgreSQL
                                      |
                                      +-> API Gateway -> Notification Lambda -> SNS
                                                               |
                                                               +-> CloudWatch logs/metrics
```

Task 2 does not replace the main FloodNet application and does not introduce S3 for the first time. It moves evidence-management responsibility from Express into an independent serverless Evidence Service while preserving the existing report and evidence records. The main application continues to use RDS for structured data.

## 5. Task 1 and Task 2 evidence boundary

S3 is deliberately used from Task 1 because image files are object-storage data, not relational data. Task 2 demonstrates an architectural evolution in service ownership, not a late introduction of storage.

### Task 1 evidence lifecycle

1. A resident creates a flood report through Express.
2. React sends optional multipart evidence images to `POST /api/reports/:id/evidence`.
3. Express confirms that the authenticated resident owns the report and that its status allows evidence.
4. Express checks file count, file size, MIME type and image signature.
5. Express uploads image bytes to the private S3 bucket using server-side AWS permissions.
6. PostgreSQL stores only report ID, uploader, object key and evidence metadata.
7. Express generates a short-lived authorized download URL when the owner requests access.

### Task 2 evidence lifecycle

1. Express creates a short-lived, report-specific upload session.
2. React requests an upload URL through API Gateway.
3. The Lambda authorizer validates the signed evidence scope and report claims.
4. The Evidence Lambda validates the request and returns a short-lived presigned S3 PUT URL.
5. React uploads directly to the same private S3 bucket.
6. React calls the compatible Express completion endpoint so the existing RDS evidence metadata contract is preserved.

This is the required final distinction:

```text
TASK 1: React -> Express Evidence functionality -> private S3 -> RDS metadata
TASK 2: React -> API Gateway -> Lambda Evidence Service -> private S3
        Main FloodNet application -> Express -> RDS
```

## 6. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Bootstrap 5, custom CSS, React Router |
| Charts | Chart.js, where live database data benefits from visualization |
| Backend | Node.js 20+, Express.js REST API |
| Database | PostgreSQL locally; Amazon RDS for Task 1 production data |
| Database access | `pg` with parameterized SQL and SQL migrations |
| Task 1 compute | AWS Elastic Beanstalk Node.js platform |
| Task 1 object storage | Private Amazon S3 for flood evidence files |
| Task 2 services | API Gateway, AWS Lambda and Amazon SNS |
| Observability | CloudWatch for Task 2 logs and metrics; X-Ray only if justified |

The application does not require an external flood-data API to function. Optional external services must be introduced only when they have a clear business and architectural justification.

## 7. Repository structure

```text
FloodNet/
├── client/
│   ├── src/
│   │   ├── context/       # authentication state
│   │   ├── pages/         # public, auth and resident screens
│   │   ├── routes/        # protected route boundaries
│   │   ├── services/      # API and evidence service clients
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── config/             # environment and evidence configuration
│   ├── controllers/        # HTTP request/response handlers
│   ├── db/                 # pool, migrations and seeds
│   ├── middleware/         # authentication and upload handling
│   ├── repositories/       # PostgreSQL access
│   ├── routes/             # Express route modules
│   ├── services/           # business logic and S3 integration
│   ├── utils/              # errors, JWT and shared helpers
│   └── validators/         # server-side request validation
├── microservices/
│   └── evidence-service/   # Task 2 Lambda Evidence Service
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── database/
│   ├── deployment/
│   └── workload/
├── .env.example
├── Procfile
├── package.json
└── README.md
```

## 8. Prerequisites

Install or have access to:

- Node.js 20 or newer;
- npm;
- PostgreSQL 15+ for local development, or an accessible PostgreSQL instance;
- Git;
- AWS CLI only when testing the real private S3 integration locally;
- an AWS IAM role/profile with the minimum S3 permissions required for development.

Do not commit database passwords, JWT secrets, AWS access keys, session tokens or any other credentials.

## 9. Local development setup

### Clone and install

```powershell
git clone https://github.com/deepakshrestha23-lgtm/FloodNet-G6.git
Set-Location FloodNet-G6
npm install
```

### Create the environment file

```powershell
Copy-Item .env.example .env
```

Edit `.env` with the local PostgreSQL password and long random JWT values. The `.env` file is ignored by Git and must remain private.

Create a local database named `floodnet` using pgAdmin or PostgreSQL's `createdb`/`psql` tools. Detailed Windows PostgreSQL instructions are in [docs/deployment/local-postgresql.md](docs/deployment/local-postgresql.md).

### Run migrations and seed reference data

```powershell
npm run db:migrate
npm run db:seed
```

The seed script creates the four role records, demonstration flood zones and evacuation-centre facility types.

### Start the application

The recommended one-command development start is:

```powershell
npm run dev
```

This starts both processes:

- React/Vite: `http://localhost:5173`
- Node.js/Express: `http://localhost:5000`

The Vite development server proxies `/api` requests to Express, so the frontend can use relative API paths.

If separate terminals are preferred:

```powershell
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

For a production-style local check, build the frontend and start Express:

```powershell
npm run build
npm start
```

Express then serves the Vite build and API from port `5000`.

### Verify the application and database

With the server running, use PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/health/db
```

The database health response should report a successful connection. The browser home page also performs the application health check.

## 10. Environment variables

The complete template is in [.env.example](.env.example). The important values are:

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | Express | `development` locally and `production` on Elastic Beanstalk. |
| `PORT` | Express | Local/default server port; the project default is `5000`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Express | PostgreSQL connection settings. |
| `DB_SSL` | Express | Enable TLS for the production database connection when required by the environment. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Express | Long random server-only signing secrets. |
| `CLIENT_ORIGIN` | Express | Allowed browser origin for credentialed API requests. |
| `AWS_REGION` | Express/Lambda | Must match the S3 bucket region. The currently configured development bucket uses `us-east-1`; use the actual region of any replacement bucket. |
| `EVIDENCE_BUCKET_NAME` | Express/Lambda | Private S3 bucket containing evidence objects. |
| `EVIDENCE_STORAGE_MODE` | Express | `s3` for Task 1; production rejects any other value. |
| `EVIDENCE_URL_EXPIRES_SECONDS` | Express/Lambda | Short-lived private URL lifetime, constrained by the service to 60–900 seconds. |
| `EVIDENCE_UPLOAD_SECRET` | Express/Task 2 | Server-only signing secret used for short-lived Task 2 upload sessions; never expose it to React. |
| `AWS_PROFILE` | Local AWS SDK/CLI | Optional local profile selection, for example `floodnet`; never needed in Elastic Beanstalk when an IAM role is attached. |
| `VITE_EVIDENCE_ENABLED` | React build | Enables the Task 1 evidence UI. This is not a secret. |
| `VITE_TASK2_EVIDENCE_ENABLED` | React build | Selects the Task 2 Evidence Service path when the API Gateway URL is configured. |
| `VITE_EVIDENCE_API_URL` | React build | Task 2 API Gateway base URL. |

Only variables beginning with `VITE_` are exposed to browser code. Never put AWS credentials, database passwords or JWT secrets in a `VITE_` variable.

## 11. Database design

The initial SQL migration in `server/db/migrations/001_initial_schema.sql` establishes the normalized foundation. Important tables include:

| Group | Tables | Purpose |
|---|---|---|
| Identity | `roles`, `users`, `user_profiles`, `auth_sessions` | Accounts, roles, profiles and refresh-session rotation. |
| Geography | `flood_zones` | Active reporting and alert zones. |
| Reporting | `flood_reports`, `flood_report_reviews`, `flood_report_status_history` | Resident observations, review actions and lifecycle history. |
| Alerts | `flood_alerts`, `alert_zones` | Official FloodNet alerts and affected zones. |
| Evacuation | `evacuation_centres`, `centre_facility_types`, `centre_facilities` | Centre capacity, status and facilities. |
| Notifications | `notification_preferences`, `notification_logs` | Notification preferences and delivery records for the later notification service. |
| Evidence | `flood_evidence_metadata` | S3 object reference and file metadata; never the image bytes. |
| Governance | `audit_logs` | Important administrative and operational actions. |

The database enforces important constraints such as valid report/alert statuses, non-negative capacity and occupancy, unique report references, alert expiry ordering and foreign-key relationships.

Evidence metadata includes the report ID, uploader ID, generated S3 object key, original filename, content type, size, checksum and upload status. PostgreSQL does not store the actual image file.

## 12. Task 1 photo evidence

Residents can optionally attach evidence photographs when submitting a report. The current implementation is intentionally modular:

- `server/middleware/evidence-upload.middleware.js` handles in-memory multipart parsing and limits;
- `server/services/evidence.service.js` owns authorization and evidence workflow rules;
- `server/services/evidence-storage.service.js` owns the S3 storage boundary;
- `server/repositories/evidence.repository.js` owns evidence metadata queries;
- `client/src/services/evidence.js` selects the Task 1 or Task 2 client path.

Current limits and validation:

- maximum **5 images per report**;
- maximum **5 MB per image**;
- supported formats: **JPEG, PNG and WebP**;
- MIME type and file-signature validation are applied;
- generated report-scoped S3 keys are used instead of trusting filenames;
- no permanent `server/uploads` directory is used;
- no image bytes are stored in PostgreSQL;
- evidence is accepted only for reports in `PENDING_REVIEW` or `MORE_INFORMATION_REQUIRED`;
- only an authorized report owner can upload or access the current resident evidence flow;
- access uses a short-lived private S3 URL rather than a public object URL.

The bucket must remain private with S3 Block Public Access enabled, Bucket Owner Enforced ownership and server-side encryption. Task 1 Express/Elastic Beanstalk accesses it with an IAM role, not hardcoded keys. See [docs/deployment/evidence-s3.md](docs/deployment/evidence-s3.md) and [docs/architecture/evidence-upload.md](docs/architecture/evidence-upload.md).

## 13. Functional roadmap

The application is being completed in a controlled sequence so each module integrates with the existing workflow.

### Completed foundation and resident slice

- application and database health checks;
- PostgreSQL migrations and seed data;
- registration, login, logout, refresh and profile management;
- server-side password hashing and protected API access;
- resident dashboard;
- report creation with zone, location, severity, road condition, description and observation time;
- report reference IDs, status display and resident report history;
- additional information flow when requested;
- optional Task 1 S3 evidence upload and authorized access;
- database-backed public information API foundations.

### Next: Flood Monitoring Officer

- role-protected report review queue;
- filters by zone, date, severity and status;
- report details, evidence and history inspection;
- verify, reject or request more information with review notes;
- reviewer and timestamp audit trail;
- separate alert create, publish, edit, expire and cancel workflow;
- live database-backed situation statistics and charts.

### Then: Evacuation Officer

- centre create, edit and deactivate;
- zone and contact information;
- occupancy updates with database-safe capacity rules;
- `OPEN`, `NEAR_CAPACITY`, `FULL` and `CLOSED` states;
- facilities and centre dashboard;
- public centre availability view.

### Then: System Administrator

- user search and account activation/deactivation;
- authorized staff role assignment;
- flood-zone management;
- controlled facility/master-data management;
- audit log interface.

### Integration, polish and cloud validation

- connect the resident, officer and evacuation workflows end to end;
- expand public pages for alerts, verified incidents, centres and preparedness guidance;
- add responsive loading, empty, validation and error states;
- complete accessibility and security review;
- add integration and authorization tests;
- validate the complete Task 1 deployment on Elastic Beanstalk and RDS;
- collect demonstration screenshots, logs and architecture evidence.

### Task 2 evolution

- deploy the independent Evidence Service behind API Gateway and Lambda;
- add the Notification Service behind API Gateway, Lambda and SNS;
- add CloudWatch logs and metrics for serverless paths;
- compare Task 1 and Task 2 behavior and architecture with real evidence;
- add SQS, X-Ray, EventBridge, Location Service or other AWS services only if a tested business need justifies them.

## 14. API overview

The API uses a consistent response envelope:

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

### Implemented endpoint groups

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Application health. |
| `GET` | `/api/health/db` | Public | PostgreSQL connectivity health. |
| `POST` | `/api/auth/register` | Public | Create a resident account. |
| `POST` | `/api/auth/login` | Public | Authenticate a user. |
| `POST` | `/api/auth/refresh` | Session | Rotate an access token. |
| `POST` | `/api/auth/logout` | Session | Revoke the refresh session. |
| `GET` | `/api/auth/me` | Authenticated | Read the current user. |
| `PATCH` | `/api/auth/me` | Authenticated | Update the current profile. |
| `GET` | `/api/public/zones` | Public | List active flood zones. |
| `GET` | `/api/public/alerts` | Public | List current published alerts. |
| `GET` | `/api/public/incidents` | Public | List verified incident summaries. |
| `GET` | `/api/public/centres` | Public | List public evacuation-centre data. |
| `POST` | `/api/reports` | Resident | Submit a report. |
| `GET` | `/api/reports/mine` | Resident | List the resident's reports. |
| `GET` | `/api/reports/:id` | Report owner | Read a personal report. |
| `GET` | `/api/reports/:id/history` | Report owner | Read report status history. |
| `PATCH` | `/api/reports/:id` | Report owner | Submit allowed additional information. |
| `POST` | `/api/reports/:id/evidence` | Report owner | Upload Task 1 multipart evidence through Express. |
| `POST` | `/api/reports/:id/evidence/session` | Report owner | Create a Task 2 upload session. |
| `POST` | `/api/reports/:id/evidence/complete` | Report owner | Save compatible Task 2 evidence metadata. |
| `GET` | `/api/reports/:id/evidence` | Report owner | List evidence metadata. |
| `GET` | `/api/reports/:id/evidence/:evidenceId/url` | Authorized owner | Generate a short-lived private access URL. |

### Planned endpoint areas

These are documented targets, not claims that the corresponding staff workflows are already complete:

```text
/api/officer/reports
/api/officer/reports/:id/review
/api/officer/alerts
/api/officer/dashboard
/api/centres
/api/admin/users
/api/admin/roles
/api/admin/zones
/api/admin/audit
```

Detailed current contracts are maintained in [docs/api/README.md](docs/api/README.md), [authentication.md](docs/api/authentication.md) and [resident-reports.md](docs/api/resident-reports.md).

## 15. Security strategy

FloodNet applies security at the server boundary even when the browser has client-side validation.

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Access and refresh tokens are handled by the authentication layer, with refresh-session records and revocation support.
- Protected routes require a valid access token and active user account.
- Role checks belong in Express middleware and services, not only in React route visibility.
- PostgreSQL queries use parameterized values.
- Helmet, CORS configuration, authentication rate limiting and centralized error handling are enabled.
- Validation rejects invalid values server-side.
- Public responses exclude resident identity, private officer notes, credentials and sensitive audit data.
- S3 Block Public Access remains enabled.
- S3 object keys are generated by the service and are not based directly on untrusted filenames.
- Uploads are processed in memory and sent to S3; deployed applications do not depend on local file persistence.
- AWS permissions are attached to the server/Lambda execution role. AWS credentials are never shipped to React.
- Secrets are supplied through private environment configuration, Elastic Beanstalk environment variables, IAM roles or a managed secret store.

## 16. Testing and quality checks

Run these checks from the repository root:

```powershell
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

For local API/database verification:

```powershell
npm run db:migrate
npm run db:seed
npm run dev:server
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/health/db
```

The evidence smoke test should verify all of the following:

1. a valid image can be uploaded through Express;
2. the object exists in the private S3 bucket;
3. PostgreSQL contains metadata but not image bytes;
4. an authorized request receives a short-lived access URL;
5. an unauthorized user cannot access the evidence;
6. unsupported types, invalid signatures, oversized files and excessive file counts are rejected;
7. uploaded objects and test records are cleaned up after the test.

## 17. Task 1 AWS deployment preparation

The complete Task 1 deployment target is:

```text
React/Vite build + Express API
          -> one Elastic Beanstalk Node.js environment
          -> Amazon RDS for PostgreSQL
          -> private Amazon S3 evidence bucket
```

Before deployment:

1. Create or select an RDS PostgreSQL database in the same AWS region as the application where practical.
2. Configure RDS security groups so only the approved Elastic Beanstalk runtime can reach PostgreSQL.
3. Configure the Elastic Beanstalk Node.js environment with the production database, JWT, CORS and S3 settings.
4. Attach an instance profile/role with only the required evidence-prefix permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject` when deletion is implemented
5. Keep the S3 bucket private with Block Public Access, Bucket Owner Enforced ownership and encryption enabled.
6. Set `EVIDENCE_STORAGE_MODE=s3` in Elastic Beanstalk. Production rejects non-S3 evidence storage.
7. Run migrations against RDS through a controlled deployment process; do not expose PostgreSQL publicly.
8. Verify `/api/health`, `/api/health/db`, authentication, resident reporting, authorized evidence access and the production build.

The `Procfile` starts the application with `npm start`. The root `prestart` script builds the client before Express serves the production files. The detailed S3 checklist is in [docs/deployment/evidence-s3.md](docs/deployment/evidence-s3.md).

Local AWS CLI profiles are for development only. In Elastic Beanstalk, prefer the instance role rather than long-lived access keys. Temporary AWS Academy credentials can expire and should never be committed to this repository.

## 18. Task 2 deployment direction

Task 2 must prove a genuine change in responsibility:

| Capability | Task 1 | Task 2 |
|---|---|---|
| Main report workflow | Express on Elastic Beanstalk | Remains Express on Elastic Beanstalk |
| Structured application data | RDS through Express | RDS through Express |
| Evidence authorization/upload responsibility | Express evidence modules | API Gateway and Lambda Evidence Service |
| Evidence file storage | Private S3 | Same private S3 boundary |
| Alert notifications | Main application foundation | Notification Lambda and SNS |
| Serverless observability | Not required for the initial path | CloudWatch logs and metrics |

The existing [microservices/evidence-service](microservices/evidence-service) package contains the Task 2 authorizer and upload-url handler. Its deployment requires an API Gateway route, Lambda environment variables, an execution role scoped to the evidence prefix and a private S3 bucket. See [microservices/evidence-service/README.md](microservices/evidence-service/README.md).

## 19. Development phases

The work follows the approved sequence:

1. **Design and foundation:** architecture, schema, migrations, seeds, route boundaries, health checks and documentation.
2. **Authentication and resident module:** account security, resident reporting, report lifecycle and Task 1 evidence.
3. **Flood Monitoring Officer:** review, verification, alerts and situation dashboard.
4. **Evacuation Officer:** centres, facilities, capacity and public availability.
5. **System Administrator:** governance, roles, zones, master data and audit.
6. **Integration and polish:** end-to-end flow, responsive UI, validation, accessibility, security and tests.
7. **Task 1 cloud validation:** Elastic Beanstalk, RDS, private S3 and production verification.
8. **Task 2 evolution:** Evidence Service, Notification Service, CloudWatch and measured architecture comparison.
9. **Final evidence:** tests, screenshots, metrics, workload attribution and individual contribution documentation.

Deployment is intentionally validated after the core functionality is integrated, while local health and S3 checks continue to protect the architecture during development.

## 20. Workload ownership

The intended major-module ownership is:

| Team responsibility | Primary module |
|---|---|
| Member 1 | Resident reporting and resident experience |
| Member 2 | Flood Monitoring Officer review and alert operations |
| Member 3 | Evacuation Officer centre operations |
| Member 4 | System Administrator governance and audit |
| Shared infrastructure | Authentication, database conventions, reusable UI, deployment, testing and documentation |

The actual file-, route-, table- and AWS-component ownership is maintained in [docs/workload/README.md](docs/workload/README.md). Shared infrastructure should still have a named implementation owner for assessment evidence.

## 21. Engineering decisions and non-goals

FloodNet will:

- remain a coherent flood-response platform rather than a generic weather dashboard;
- keep the locked React/Vite, Express, PostgreSQL, RDS and Elastic Beanstalk stack for Task 1;
- keep verification separate from alert publishing;
- keep public-safe information separate from private operational data;
- use real database data for statistics and dashboards;
- make every major feature demonstrable and connected to the flood-response workflow;
- add AWS services only when their business and architectural purpose can be explained.

FloodNet will not:

- store evidence images in PostgreSQL;
- use a permanent local uploads directory in the deployed application;
- make the S3 bucket public;
- expose AWS credentials in React;
- automatically issue emergency alerts from one resident report;
- claim that a community observation is a scientific measurement;
- hardcode dashboard statistics;
- implement unrelated officer/admin functionality inside the evidence work;
- make an external flood API mandatory for core operation;
- add decorative or placeholder features that are not functional.

## 22. Documentation map

- [Architecture overview](docs/architecture/README.md)
- [Evidence upload architecture](docs/architecture/evidence-upload.md)
- [Database documentation](docs/database/README.md)
- [API contract](docs/api/README.md)
- [Authentication API](docs/api/authentication.md)
- [Resident reports API](docs/api/resident-reports.md)
- [Local PostgreSQL setup](docs/deployment/local-postgresql.md)
- [Private S3 checklist](docs/deployment/evidence-s3.md)
- [Task 1 and Task 2 evidence boundary](docs/deployment/task1-task2-features.md)
- [Workload ownership](docs/workload/README.md)
- [Task 2 Evidence Service](microservices/evidence-service/README.md)

## 23. Git workflow

Use a feature branch for each major module and keep commits focused:

```powershell
git switch -c feature/<module-name>
git status
git add <files>
git commit -m "feat: describe the completed change"
git push -u origin feature/<module-name>
```

Before opening or updating a pull request:

```powershell
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
git status
```

The `main` branch should remain a stable integration branch. Do not commit `.env`, AWS credentials, database passwords, generated build artifacts or private evidence files.
