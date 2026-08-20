# Local PostgreSQL setup

PostgreSQL is expected to run on `localhost:5432` during local development.

## 1. Create the database

Using pgAdmin, connect to the local PostgreSQL server and create a database named:

```text
floodnet
```

The existing PostgreSQL administrator user can be used for development. Do not commit its password to the repository.

## 2. Configure the local environment

From the project root:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set the local database password privately:

```text
DB_HOST=localhost
DB_PORT=5432
DB_NAME=floodnet
DB_USER=postgres
DB_PASSWORD=yourdbpassword
DB_SSL=false
```

Replace the JWT placeholder values with long random local-development values.

## 3. Run the schema and seed data

```powershell
npm run db:migrate
npm run db:seed
```

## 4. Verify the application-to-database path

Start the API:

```powershell
npm run dev:server
```

Then open:

```text
http://localhost:5000/api/health
http://localhost:5000/api/health/db
```

The database endpoint should return HTTP 200 and report `connected: true`.
