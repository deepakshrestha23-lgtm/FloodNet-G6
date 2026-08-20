/**
 * Deployment preflight for the private evidence bucket.
 *
 * Run with `npm run aws:check`. It answers the three questions that actually
 * break an S3 deployment: are credentials valid, is the bucket reachable from
 * the configured region, and is the bucket private. It writes and deletes one
 * small object so that a read-only permission problem is caught before a
 * resident ever tries to upload a photograph.
 */
require('dotenv').config();

const {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetPublicAccessBlockCommand,
  GetBucketPolicyStatusCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const region = process.env.AWS_REGION;
const bucket = process.env.EVIDENCE_BUCKET_NAME;

function report(label, ok, detail) {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ' :: ' + detail : ''}`);
  return ok;
}

function describeAwsError(error) {
  const status = error.$metadata ? error.$metadata.httpStatusCode : undefined;
  const name = error.name || error.Code;

  if (name === 'InvalidToken' || name === 'ExpiredToken' || name === 'ExpiredTokenException') {
    return 'temporary AWS credentials have expired - refresh them and retry';
  }

  if (status === 301 || name === 'PermanentRedirect') {
    return `bucket is not in ${region} - set AWS_REGION to the bucket region`;
  }

  if (status === 403 || name === 'AccessDenied') {
    return 'credentials are valid but lack permission on this bucket';
  }

  if (status === 404 || name === 'NotFound' || name === 'NoSuchBucket') {
    return 'bucket does not exist in this account';
  }

  return `${name}${status ? ' (http ' + status + ')' : ''}: ${error.message}`;
}

async function run() {
  console.log(`FloodNet evidence storage preflight\n  region: ${region}\n  bucket: ${bucket}\n`);

  let failures = 0;
  const fail = () => { failures += 1; };

  if (!bucket) {
    report('EVIDENCE_BUCKET_NAME configured', false, 'not set');
    process.exitCode = 1;
    return;
  }

  report('EVIDENCE_BUCKET_NAME configured', true);
  report('EVIDENCE_STORAGE_MODE is s3', process.env.EVIDENCE_STORAGE_MODE === 's3',
    `currently "${process.env.EVIDENCE_STORAGE_MODE}"`) || fail();

  const client = new S3Client({ region });

  try {
    const credentials = await client.config.credentials();
    report('AWS credentials resolved', true,
      credentials.sessionToken ? 'temporary credentials (session token present)' : 'long-lived credentials');
  } catch (error) {
    report('AWS credentials resolved', false, error.message);
    process.exitCode = 1;
    return;
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    report('bucket reachable from configured region', true);
  } catch (error) {
    // HeadBucket is a HEAD request, so S3 returns no body and the SDK cannot
    // read the real error code (it surfaces as "Unknown"). Repeat the check
    // with a GET-style call purely to obtain a diagnosable error.
    let diagnosis = describeAwsError(error);

    if (!error.name || error.name === 'Unknown') {
      try {
        await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
      } catch (detailedError) {
        diagnosis = describeAwsError(detailedError);
      }
    }

    report('bucket reachable from configured region', false, diagnosis);
    process.exitCode = 1;
    return;
  }

  try {
    const block = await client.send(new GetPublicAccessBlockCommand({ Bucket: bucket }));
    const config = block.PublicAccessBlockConfiguration || {};
    const fullyBlocked = config.BlockPublicAcls && config.IgnorePublicAcls
      && config.BlockPublicPolicy && config.RestrictPublicBuckets;
    report('public access is fully blocked', Boolean(fullyBlocked), JSON.stringify(config)) || fail();
  } catch (error) {
    report('public access block readable', false, describeAwsError(error));
    fail();
  }

  try {
    const status = await client.send(new GetBucketPolicyStatusCommand({ Bucket: bucket }));
    report('bucket policy does not make it public', status.PolicyStatus.IsPublic === false) || fail();
  } catch (error) {
    if (error.name === 'NoSuchBucketPolicy') {
      report('bucket policy does not make it public', true, 'no bucket policy');
    } else {
      report('bucket policy status readable', false, describeAwsError(error));
    }
  }

  const probeKey = `preflight/${Date.now()}-check.txt`;
  let wrote = false;

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: probeKey,
      Body: Buffer.from('floodnet preflight'),
      ContentType: 'text/plain'
    }));
    wrote = true;
    report('can write an object', true);
  } catch (error) {
    report('can write an object', false, describeAwsError(error));
    fail();
  }

  if (wrote) {
    try {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: probeKey }), { expiresIn: 60 });
      report('can generate a presigned URL', typeof url === 'string' && url.startsWith('https://')) || fail();

      const anonymous = await fetch(`https://${bucket}.s3.${region}.amazonaws.com/${probeKey}`);
      report('object is NOT publicly readable without a signature',
        anonymous.status === 403 || anonymous.status === 404, `anonymous GET returned ${anonymous.status}`) || fail();

      const signed = await fetch(url);
      report('presigned URL works', signed.status === 200, `signed GET returned ${signed.status}`) || fail();
    } catch (error) {
      report('presigned URL check', false, describeAwsError(error));
      fail();
    }

    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
      report('probe object cleaned up', true);
    } catch (error) {
      report('probe object cleaned up', false, describeAwsError(error));
    }
  }

  console.log(`\n${failures === 0 ? 'Evidence storage is ready.' : `${failures} check(s) failed.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

run().catch((error) => {
  console.error('Preflight error:', error.message);
  process.exitCode = 1;
});
