# Task 1 and Task 2 feature boundary

## Task 1

Task 1 uses:

- React/Vite
- Express
- Elastic Beanstalk
- PostgreSQL/RDS
- Private Amazon S3 evidence storage

Residents can optionally attach up to five JPEG, PNG or WebP flood evidence photographs when submitting a report. Express authenticates the resident, verifies report ownership and status, validates the files, uploads the image bytes to the private S3 bucket, and stores only evidence metadata plus the S3 object key in RDS.

The Task 1 upload path is:

```text
React/Vite -> Express Evidence functionality -> private S3
                                      \-> RDS evidence metadata
```

The browser never receives AWS credentials and no permanent `server/uploads` directory is used. Evidence access is authorized by Express and returned through a short-lived private S3 URL.

For Elastic Beanstalk, configure the Express runtime with an instance role that can access only the FloodNet evidence prefix. Set `EVIDENCE_STORAGE_MODE=s3` and provide `EVIDENCE_BUCKET_NAME`.

## Task 2

Task 2 keeps the same report and evidence records but switches the evidence upload responsibility to the existing serverless Evidence Service. Enable the Task 2 client path with:

```text
VITE_TASK2_EVIDENCE_ENABLED=true
VITE_EVIDENCE_API_URL=https://your-api-gateway-url
```

The Task 2 AWS services must also be configured: API Gateway, Lambda, private S3 and the required IAM permissions.

The Task 2 upload path is:

```text
React/Vite -> API Gateway -> Lambda Evidence Service -> private S3
FloodNet main application -> Express -> RDS report/evidence metadata
```

The Lambda authorizer and upload-url handler already present in `microservices/evidence-service` are retained as the Task 2 evolution. This is a server-based-to-serverless change; S3 is already the Task 1 storage boundary, so Task 2 does not introduce a second evidence data model or a public bucket.
