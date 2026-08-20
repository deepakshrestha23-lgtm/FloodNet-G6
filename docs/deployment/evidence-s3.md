# Task 1 photo evidence and Amazon S3

## Implemented architecture

```text
React (browser)
   |  multipart/form-data over HTTPS, session-authenticated
   v
Express  ── validates type, size, magic bytes, ownership, report state
   |
   ├──> Amazon S3 (private bucket)        the image bytes
   └──> PostgreSQL / Amazon RDS           metadata and the object key only
```

The browser never receives AWS credentials. Express holds them through the
instance role (or the local AWS profile in development) and is the only component
that talks to S3.

## Guarantees

| Requirement | How it is met |
|---|---|
| Bucket is private | No public ACL or policy is used; `npm run aws:check` asserts the public access block and that an unsigned GET is refused |
| No permanent local storage | `multer.memoryStorage()` is used; there is no `uploads/` directory anywhere in the project |
| No binaries in PostgreSQL | `flood_evidence_metadata` has no `bytea` column; the schema contains no binary columns at all |
| No credentials in the browser | React only ever calls `/api/...`; the AWS SDK is server-side only |
| Access is authorised | Residents may reach only their own evidence; reviewing officers reach evidence through an officer-only route; every access returns a short-lived presigned URL rather than the bytes |
| Modular for Task 2 | All S3 calls live in `server/services/evidence-storage.service.js`; the business rules live in `server/services/evidence.service.js` |

## Validation applied before anything is stored

- content type must be `image/jpeg`, `image/png` or `image/webp`
- the file signature (magic bytes) must match the declared content type, so a
  renamed file cannot be smuggled through
- maximum five files per report, maximum 5 MB each
- the report must belong to the resident and still be awaiting review
- a SHA-256 checksum is recorded for each stored object

## Object key format

```text
reports/{residentId}/{reportId}/{uuid}.{extension}
```

The original filename is never used in the key, so keys are not guessable and a
resident cannot address another resident's objects.

If the metadata write fails after objects were uploaded, the uploaded objects are
deleted again so storage does not drift from the database.

## Content Security Policy

Evidence is delivered from presigned S3 URLs, which are a different origin from
the application. `server/app.js` therefore extends the Helmet policy with the
configured bucket origin for `img-src` and `connect-src`. Without this the API
returns a valid URL but the browser blocks the image. Only the configured bucket
is allowed.

## Required configuration

```env
AWS_REGION=us-east-1
EVIDENCE_BUCKET_NAME=your-private-bucket
EVIDENCE_STORAGE_MODE=s3
EVIDENCE_URL_EXPIRES_SECONDS=300
```

`AWS_REGION` must be the region the bucket actually lives in. A mismatch produces
an HTTP 301 from S3, which `npm run aws:check` reports explicitly.

`EVIDENCE_STORAGE_MODE=mock` exists for local development and automated tests. It
keeps all validation and metadata behaviour but does not call AWS.
`server/config/env.js` refuses to start in production unless the mode is `s3`.

## IAM permissions for the Elastic Beanstalk instance role

Grant only what the application uses, scoped to the evidence prefix:

- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:HeadObject` (via `s3:GetObject`)

on `arn:aws:s3:::your-private-bucket/reports/*`.

## Preflight

```powershell
npm run aws:check
```

Checks credentials, region, reachability, that public access is blocked, that an
object can be written, that a presigned URL works, and that the same object is
refused without a signature. Run it before the first deployment and whenever
temporary credentials are refreshed.
