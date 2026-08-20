# FloodNet

FloodNet is a cloud-based flood reporting, early warning and evacuation coordination system.

The project is being developed in two evolutionary stages:

- **Task 1:** React, Express, PostgreSQL on Amazon RDS, private S3 evidence storage and AWS Elastic Beanstalk.
- **Task 2:** API Gateway, Lambda, private S3 evidence storage, SNS notifications and CloudWatch monitoring.



DEPLOYMENT ARCHITECTURE REQUIREMENT FOR FLOODNET

We are currently developing FloodNet using:

Frontend:
- React
- Vite
- Bootstrap

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL
- Amazon RDS for production

CURRENT TASK 1 DEPLOYMENT PLAN

For the initial AWS deployment, the React frontend and Express backend will be deployed together in ONE AWS Elastic Beanstalk application.

Local development should still remain separated:

React + Vite:
http://localhost:5173

Node.js + Express:
http://localhost:3000

PostgreSQL:
localhost:5432

For production:

1. Build the React application using Vite.
2. Generate the production frontend inside the Vite dist directory.
3. Configure Express to serve the built React static files.
4. Express must also expose all backend REST APIs under /api.
5. Deploy the resulting application as one Node.js Elastic Beanstalk application.
6. The Express backend must connect to Amazon RDS PostgreSQL using environment variables.

Conceptual initial production architecture:

User Browser
      ↓
AWS Elastic Beanstalk
      ↓
Node.js + Express
   /             \
React Build       REST API
                   ↓
              Amazon RDS


IMPORTANT: FUTURE DEPLOYMENT PORTABILITY

Although frontend and backend are initially deployed together, the system MUST be designed so they can later be deployed independently without major application rewriting.

For example, the future architecture may become:

Frontend Hosting
React + Vite
      ↓
HTTPS REST API
      ↓
Backend Hosting
Node.js + Express
      ↓
Amazon RDS

Therefore follow these rules from the beginning.


1. KEEP FRONTEND AND BACKEND PHYSICALLY SEPARATE

Use a structure similar to:

FloodNet/
├── client/
│   └── React + Vite frontend
│
├── server/
│   └── Node.js + Express backend
│
├── microservices/
│   └── Task 2 services later
│
├── docs/
├── .gitignore
└── README.md

Do not mix React source files with backend source files.


2. FRONTEND AND BACKEND MUST COMMUNICATE ONLY THROUGH REST APIs

All backend application endpoints must use /api.

Examples:

/api/auth/login
/api/auth/logout

/api/reports
/api/reports/:id
/api/reports/:id/review

/api/alerts
/api/centres
/api/zones

/api/admin/users
/api/admin/roles

The React frontend must never directly access:
- PostgreSQL
- backend database functions
- server files
- backend credentials


3. DO NOT HARD-CODE BACKEND URLS

Do NOT scatter URLs such as:

http://localhost:3000/api/reports

through React components.

Create a centralized frontend API configuration.

Use:

VITE_API_BASE_URL

Example development configuration:

VITE_API_BASE_URL=http://localhost:3000

If deployed together later, allow configuration such as:

VITE_API_BASE_URL=

so React can call:

/api/reports

If frontend and backend are separated later, we should only need to change:

VITE_API_BASE_URL=https://api.example.com

without rewriting React components.


4. CREATE A CENTRALIZED API SERVICE

Do not place raw fetch requests randomly throughout the application.

Use something similar to:

client/src/services/
├── apiClient.js
├── authApi.js
├── reportApi.js
├── alertApi.js
├── evacuationApi.js
└── adminApi.js

The base URL must come from configuration.

All React pages/components should use these API services.


5. KEEP EXPRESS INDEPENDENT OF REACT

The Express backend must be capable of running perfectly even if React is hosted somewhere else.

React static-file serving should be treated as a production deployment feature, NOT a core backend dependency.

For example:

Server responsibilities:
- authentication
- authorization
- REST APIs
- business logic
- database access
- AWS service integration
- validation
- auditing

Optional production responsibility:
- serve React dist files

If frontend hosting is separated later, disabling React static-file serving must not break the REST API.


6. EXPRESS STATIC SERVING FOR INITIAL DEPLOYMENT

For the initial combined Elastic Beanstalk deployment, Express should serve the Vite production build.

Conceptually:

if NODE_ENV === "production":

serve client/dist as static files

API routes must remain under:

/api/*

For non-API React routes such as:

/resident/dashboard
/officer/reports
/evacuation/centres
/admin/users

configure an SPA fallback so refreshing those pages does not produce a 404.

IMPORTANT:
The React SPA fallback must never intercept /api routes.


7. LOCAL DEVELOPMENT

Keep React and Express as separate development processes.

Terminal 1:

cd client
npm run dev

Terminal 2:

cd server
npm run dev

React:
localhost:5173

Express:
localhost:3000

Configure Vite proxying if appropriate so development API calls can remain simple.

Example:

/api/* → http://localhost:3000


8. ENVIRONMENT VARIABLES

Do not hard-code environment-specific values.

Frontend may contain NON-SECRET variables such as:

VITE_API_BASE_URL

Backend variables may include:

NODE_ENV
PORT

DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

JWT/session secrets

AWS region
S3 bucket names

Never expose:

DB_PASSWORD
AWS secret keys
authentication secrets

through VITE_* variables because Vite frontend variables are visible to the browser.


9. DATABASE INDEPENDENCE

The PostgreSQL database must only be accessed by the backend.

Local development:

Express
↓
Local PostgreSQL

Production:

Express / Elastic Beanstalk
↓
Amazon RDS PostgreSQL

Changing between local PostgreSQL and RDS should require only environment configuration changes, not application-code rewriting.


10. CORS MUST BE CONFIGURABLE

For the initial combined production deployment, frontend and backend will normally use the same origin.

Therefore CORS complexity should be minimal.

However, prepare Express so that if we later deploy frontend separately, the allowed frontend origin can be configured through an environment variable such as:

CLIENT_ORIGIN=https://frontend.example.com

Do not hard-code a permanent origin.

Only trusted configured origins should be allowed in production.


11. AUTHENTICATION MUST SUPPORT FUTURE SEPARATION

Design authentication carefully so it works with:

A. same-origin combined deployment

and later:

B. independently hosted frontend/backend

Do not rely on assumptions that permanently require React and Express to share the same host.

Keep authentication configuration environment-driven.

If secure HttpOnly cookies are used, make Secure, SameSite, CORS and credentials behaviour configurable appropriately for production.


12. FILE STORAGE

Do not store important persistent files permanently inside the Elastic Beanstalk application filesystem.

Flood evidence/photos should use Amazon S3.

Do not create architecture that permanently depends on:

server/uploads/

for production evidence storage.

This also ensures the backend can later move independently without losing uploaded evidence.


13. NO FRONTEND DEPENDENCY ON EXPRESS FILE PATHS

React must never reference paths such as:

../server/uploads/
../server/files/
C:\FloodNet\...

Files must be accessed through proper application/API mechanisms or authorized cloud URLs.


14. BUILD PROCESS

The React application must independently support:

cd client
npm run build

which should create:

client/dist/

The Express application must independently support:

cd server
npm start

or the appropriate production start command.

For initial deployment, provide a clear build/deployment process that:

1. installs frontend dependencies
2. builds React
3. installs backend dependencies
4. launches Express
5. Express serves client/dist
6. API routes remain available


15. ELASTIC BEANSTALK REQUIREMENTS

The final combined deployment must work with the AWS Elastic Beanstalk Node.js platform.

Express must use:

process.env.PORT || 3000

Do not permanently hard-code port 3000 for production.

The application must expose an endpoint such as:

GET /api/health

Example:

{
  "success": true,
  "message": "FloodNet API is running"
}

Also provide a database health endpoint for controlled development/deployment testing.


16. FUTURE SEPARATION MUST REQUIRE MINIMAL CHANGES

Later, if frontend and backend are deployed separately, the expected changes should mainly be:

- deploy React dist separately
- set VITE_API_BASE_URL to backend URL
- configure backend CORS
- adjust cookie/authentication production settings if needed
- configure frontend SPA routing
- stop Express serving client/dist

The following should NOT require rewriting:

- React pages
- React components
- business logic
- REST APIs
- Express controllers
- Express services
- repositories
- database queries
- PostgreSQL schema
- RDS
- role-based access control


17. DO NOT OVERENGINEER NOW

Do NOT create two Elastic Beanstalk environments now.

Do NOT introduce CloudFront solely for frontend hosting now.

Do NOT create additional servers merely to demonstrate separation.

Initial deployment remains:

React production build
+
Express API
↓
ONE Elastic Beanstalk environment
↓
Amazon RDS

But code architecture must remain deployment-independent.


18. DOCUMENT THE DECISION

Add a short architecture note to the project documentation explaining:

"FloodNet initially uses a combined Elastic Beanstalk deployment to reduce deployment complexity while retaining strict logical separation between the React frontend and Express REST backend. Environment-based API configuration and independent client/server code structures allow the frontend and backend to be deployed separately in the future without significant application restructuring."


IMPORTANT

Do not unnecessarily rewrite existing working functionality.

Review the current FloodNet project first.

If the project already follows some of these principles, preserve the existing implementation.

Only make architectural changes necessary to ensure:

1. current combined Elastic Beanstalk deployment works cleanly, and
2. future frontend/backend separation remains easy.

Before making major structural changes, explain:
- what currently exists
- what needs to change
- why the change is necessary
- whether it affects existing functionality.

## Current status

**Task 1 is feature-complete and verified against a real PostgreSQL database.**

All four role modules are implemented end to end: Resident reporting, Flood
Monitoring Officer review and alerting, Evacuation Officer centre management and
System Administrator governance. Photo evidence is stored in a private Amazon S3
bucket with only metadata in PostgreSQL.

Task 2 (API Gateway, Lambda, SNS, CloudWatch) has not been started.

## Local prerequisites

- Node.js 20 or newer
- PostgreSQL 15 or newer
- npm

## Setup

```powershell
Copy-Item .env.example .env
npm install
```

Set at least `DB_PASSWORD`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`.

## Database

Create a PostgreSQL database named `floodnet`, configure `.env`, then run:

```powershell
npm run db:migrate
npm run db:seed
```

`db:seed` loads reference data (roles, zones, facility types). It additionally
creates demonstration accounts and sample operational data when `DEMO_PASSWORD`
is set in `.env`; without it the demo seed is skipped. The seed refuses to run
against `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`.

Demonstration accounts, all using `DEMO_PASSWORD`:

| Email | Role |
|---|---|
| `resident@floodnet.local` | Resident |
| `officer@floodnet.local` | Flood Monitoring Officer |
| `evacuation@floodnet.local` | Evacuation Officer |
| `admin@floodnet.local` | System Administrator |

## Running locally

```powershell
npm run dev
```

The frontend runs on `http://localhost:5173` and the API on `http://localhost:5000`.
Vite proxies `/api` to the Express server, so the two processes stay separate in
development while sharing one origin in production.

## Tests

```powershell
npm test
```

The suite runs against a dedicated `floodnet_test` database, which is created
automatically, so development data is never touched. It covers authentication,
role-based access control, report and alert state transitions, evacuation
capacity rules, administrative safeguards, auditing and the evidence pipeline.

## Production build

```powershell
npm run build
```

This produces `client/dist`, which Express serves in production alongside `/api`.
The Elastic Beanstalk instance installs production dependencies only and cannot
run Vite, so the build must be produced before deploying and shipped in the
bundle. `.ebignore` is configured to include `client/dist` for this reason.

## Evidence storage check

```powershell
npm run aws:check
```

Verifies that AWS credentials are valid, the evidence bucket is reachable from
the configured region, the bucket is private, and that objects can be written and
read back through a presigned URL. Run this before the first AWS deployment.

## Documentation

- [Architecture](docs/architecture/README.md)
- [Database design](docs/database/README.md)
- [API contract](docs/api/README.md)
- [Workload ownership](docs/workload/README.md)
- [Local PostgreSQL setup](docs/deployment/local-postgresql.md)
- [Evidence S3 deployment](docs/deployment/evidence-s3.md)
- [AWS Academy Learner Lab deployment](docs/deployment/aws-learner-lab.md)
- [Task 1 and Task 2 feature boundary](docs/deployment/task1-task2-features.md)
