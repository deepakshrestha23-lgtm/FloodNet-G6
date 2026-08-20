# Deploying FloodNet from an AWS Academy Learner Lab

This project is deployed from an AWS Academy Learner Lab account. The lab differs
from a normal AWS account in ways that change how credentials and roles are
handled, so the differences are recorded here.

## What the lab constrains

| Constraint | Consequence for FloodNet |
|---|---|
| Credentials are temporary and expire when the lab session ends (roughly four hours) | Local credentials must be re-pasted at the start of each working session |
| IAM users and roles cannot be created | The preset `LabRole` must be used; Elastic Beanstalk must not be allowed to create its own roles |
| Region is normally restricted to `us-east-1` | Create the S3 bucket and every other resource in `us-east-1` and set `AWS_REGION=us-east-1` |
| The lab has a fixed budget and can be reset | Stop RDS and Elastic Beanstalk when not demonstrating, and collect report evidence as you go |

S3 buckets and RDS databases normally persist between lab sessions, but they are
removed when the course ends or the lab is reset. Nothing in FloodNet depends on
a specific bucket name, so a bucket can be recreated by changing one environment
variable.

## Each working session

1. Start the lab and open **AWS Details → AWS CLI**.
2. Copy the credential block into `~/.aws/credentials`, replacing what is there.
   It contains `aws_access_key_id`, `aws_secret_access_key` and
   `aws_session_token`. All three are required; the session token is what expires.
3. Confirm everything still works:

   ```powershell
   npm run aws:check
   ```

If that reports `temporary AWS credentials have expired`, the session has timed
out and the credentials need copying again. This is expected lab behaviour, not
an application fault.

## Creating the evidence bucket

Bucket names are globally unique across all AWS accounts, so a name already taken
by another account cannot be reused. Choose a new, unique name.

1. S3 → **Create bucket**, in `us-east-1`.
2. Name it something unique, for example `floodnet-evidence-<name>-<digits>`.
3. Leave **Block all public access** enabled. Do not add a bucket policy.
4. Set the values in `.env`:

   ```env
   AWS_REGION=us-east-1
   EVIDENCE_BUCKET_NAME=<your new bucket name>
   EVIDENCE_STORAGE_MODE=s3
   ```

5. Verify with `npm run aws:check`.

`AWS_REGION` must match the region the bucket actually lives in. A mismatch makes
S3 answer with an HTTP 301 redirect, which the preflight reports explicitly.

## Elastic Beanstalk

The application reads AWS credentials through the default AWS provider chain and
never holds them in code or configuration. On EC2 that means the instance profile
supplies them automatically.

When creating the environment, choose **existing** roles rather than letting
Elastic Beanstalk create new ones, because role creation is not permitted in the
lab:

- **Service role:** `LabRole`
- **EC2 instance profile:** `LabInstanceProfile` (this is the instance profile
  containing `LabRole`)

Role names can vary slightly between Learner Lab versions. Check IAM → Roles in
the lab account to confirm the exact names available; the roles can be listed and
selected even though new ones cannot be created.

> **Do not put the lab's temporary access keys into Elastic Beanstalk environment
> variables.** They expire after a few hours, and the deployed application would
> begin failing evidence uploads partway through a demonstration with no obvious
> cause. The instance profile is the only workable approach here.

## Environment variables to set on the environment

Set these in the Elastic Beanstalk environment configuration, not in the source:

```text
NODE_ENV=production
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL=true
JWT_ACCESS_SECRET       (fresh value, not the local one)
JWT_REFRESH_SECRET      (fresh value, not the local one)
AWS_REGION=us-east-1
EVIDENCE_BUCKET_NAME
EVIDENCE_STORAGE_MODE=s3
CLIENT_ORIGIN           (only if the frontend is later hosted separately)
```

`server/config/env.js` refuses to start in production unless
`EVIDENCE_STORAGE_MODE=s3` and `EVIDENCE_BUCKET_NAME` are both set, so the bucket
must exist before the first deployment.

Do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` on the environment.

## Before deploying

The EC2 instance installs production dependencies only and cannot run Vite, so
the React build has to be produced locally and shipped in the bundle:

```powershell
npm run build
```

`.ebignore` is configured to include `client/dist` for exactly this reason.

## Create the first production administrator

Do not set `DEMO_PASSWORD` or `ALLOW_DEMO_SEED=true` in the deployed
environment. Demo accounts are only for local development and walkthroughs.

After the production database has been migrated and the reference seed has
created the roles, run this command once from a trusted environment with access
to the RDS database:

```powershell
npm run db:bootstrap-admin
```

The command prompts for the real administrator details and hides the password.
It refuses to create a second administrator, serializes competing bootstrap
attempts and writes an `ADMIN_BOOTSTRAPPED` audit event. After the first
administrator signs in, create the Flood Monitoring Officer and Evacuation
Officer accounts from the Administrator panel. Do not place these passwords in
the React build, Git, or a public document.

## Collect evidence while the lab is running

Because the lab can be reset, capture screenshots of the working deployment,
the S3 configuration and the RDS settings during a session rather than leaving it
until the end.
