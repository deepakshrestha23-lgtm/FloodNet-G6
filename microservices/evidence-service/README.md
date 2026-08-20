# FloodNet Evidence Service

This is the Task 2 serverless evolution of the Task 1 Express Evidence functionality. It is exposed through API Gateway as a protected `POST /evidence/upload-url` route. Express first creates a five-minute, report-specific upload session for compatibility with the existing report owner/status rules; the API Gateway Lambda authorizer validates that session before the presigned URL Lambda runs.

## Flow

```text
Resident browser
  -> Express report-specific upload session
  -> API Gateway authorizer
  -> Evidence Lambda
  -> short-lived S3 presigned PUT URL
  -> private S3 bucket
  -> Express evidence completion endpoint
  -> RDS evidence metadata
```

## Required Lambda environment variables

```text
AWS_REGION
EVIDENCE_BUCKET_NAME
EVIDENCE_URL_EXPIRES_SECONDS=300
ALLOWED_ORIGIN=https://your-floodnet-domain
EVIDENCE_UPLOAD_JWT_SECRET=same-value-as-Express-EVIDENCE_UPLOAD_SECRET
```

The Lambda role needs only the minimum required S3 permission for `s3:PutObject` on the evidence bucket prefix. The bucket must remain private.

The API Gateway authorizer must validate the short-lived evidence token and provide these contexts:

- `requestContext.authorizer.lambda.userId`
- `requestContext.authorizer.lambda.reportId`
- `requestContext.authorizer.lambda.scope`
- `requestContext.authorizer.userId`
- `requestContext.authorizer.jwt.claims.sub`

The Lambda never accepts a resident ID from the request body. It also rejects a report ID that does not match the verified upload session. It generates the object key from the verified authorizer user ID and report ID.
