# Prompts for AWS Academy Learner Lab credentials and writes them to the default
# AWS profile.
#
# The lab issues temporary credentials that expire when the session ends, so this
# has to be repeated at the start of each working session. `aws configure` is not
# sufficient on its own because it does not prompt for the session token.
#
# Usage:  npm run aws:login       (or)   powershell -File scripts/set-aws-credentials.ps1

$ErrorActionPreference = 'Stop'

function ConvertFrom-SecureText {
    param([System.Security.SecureString] $Secure)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

Write-Host ""
Write-Host "AWS Academy Learner Lab credentials" -ForegroundColor Cyan
Write-Host "Open the lab, click 'AWS Details', then 'AWS CLI' -> Show."
Write-Host "Copy each value below. Input is hidden for the secret and the token."
Write-Host ""

$accessKeyId = Read-Host 'aws_access_key_id'
if ([string]::IsNullOrWhiteSpace($accessKeyId)) {
    throw 'No access key id entered.'
}

$secretSecure = Read-Host 'aws_secret_access_key' -AsSecureString
$tokenSecure = Read-Host 'aws_session_token' -AsSecureString

$secretAccessKey = ConvertFrom-SecureText $secretSecure
$sessionToken = ConvertFrom-SecureText $tokenSecure

if ([string]::IsNullOrWhiteSpace($secretAccessKey)) { throw 'No secret access key entered.' }
if ([string]::IsNullOrWhiteSpace($sessionToken)) { throw 'No session token entered.' }

$accessKeyId = $accessKeyId.Trim()
$secretAccessKey = $secretAccessKey.Trim()
$sessionToken = $sessionToken.Trim()

$awsDirectory = Join-Path $env:USERPROFILE '.aws'
if (-not (Test-Path $awsDirectory)) {
    New-Item -ItemType Directory -Path $awsDirectory | Out-Null
}

$credentialsPath = Join-Path $awsDirectory 'credentials'
$configPath = Join-Path $awsDirectory 'config'

$credentials = @"
[default]
aws_access_key_id=$accessKeyId
aws_secret_access_key=$secretAccessKey
aws_session_token=$sessionToken
"@

Set-Content -Path $credentialsPath -Value $credentials -Encoding ascii

if (-not (Test-Path $configPath)) {
    Set-Content -Path $configPath -Value "[default]`nregion=us-east-1`noutput=json" -Encoding ascii
}

# Lengths only, so a truncated paste is obvious without revealing any secret.
Write-Host ""
Write-Host "Written to $credentialsPath" -ForegroundColor Green
Write-Host ("  access key id      : {0} characters (expected around 20)" -f $accessKeyId.Length)
Write-Host ("  secret access key  : {0} characters (expected around 40)" -f $secretAccessKey.Length)
Write-Host ("  session token      : {0} characters (expected several hundred)" -f $sessionToken.Length)

if ($sessionToken.Length -lt 100) {
    Write-Host "  The session token looks too short - the paste may have been truncated." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Now verify with:  npm run aws:check" -ForegroundColor Cyan
Write-Host ""
