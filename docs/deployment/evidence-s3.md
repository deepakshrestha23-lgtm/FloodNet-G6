# Evidence S3 deployment checklist

The evidence bucket must remain private. Do not enable public read access and do not place the bucket URL directly in the frontend.

## Environment values

Express/Elastic Beanstalk for Task 1:

```text
AWS_REGION=your-region
EVIDENCE_BUCKET_NAME=your-private-evidence-bucket
EVIDENCE_STORAGE_MODE=s3
EVIDENCE_URL_EXPIRES_SECONDS=300
```

Task 2 Lambda uses the same `AWS_REGION`, `EVIDENCE_BUCKET_NAME` and `EVIDENCE_URL_EXPIRES_SECONDS` values. Its JWT secret is configured separately from the Elastic Beanstalk runtime as described in the Evidence Service README.

Frontend build for Task 1:

```text
VITE_EVIDENCE_ENABLED=true
VITE_TASK2_EVIDENCE_ENABLED=false
```

Frontend build when selecting the Task 2 evolution:

```text
VITE_EVIDENCE_API_URL=https://your-api-gateway-domain
```

The Vite configuration reads the root `.env` file and exposes only variables prefixed with `VITE_` to browser code.

## S3 CORS configuration

Use the exact frontend origins required by the environment. Do not use `*` for production.

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-floodnet-domain"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

## IAM boundaries

- Express/Beanstalk runtime: `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` only for the evidence prefix. The S3 `HeadObject` verification also uses the `s3:GetObject` permission.
- Evidence Lambda: `s3:PutObject` only for the evidence prefix in the current Task 2 upload flow.
- Browser: receives a short-lived presigned URL only; it never receives AWS credentials.
- S3 Block Public Access: enabled.

The Task 1 Express upload itself sends the image bytes to S3. The browser does not upload to an S3 URL in Task 1.
