# Safe, one-command Prisma migration for SmartDirect on Windows PowerShell 5+.
# Reads DATABASE_URL locally; credentials are never printed or written to git.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $root
try {
  $branch = (& git branch --show-current 2>$null).Trim()
  if ($branch -notin @("meta-monitor-migration", "feature/admin-meta-change-monitor-20261026")) {
    throw "Wrong git branch. Switch to meta-monitor-migration before running this file."
  }
  if (-not (Test-Path ".\node_modules\.bin\prisma.cmd")) {
    throw "Prisma not installed locally. Run npm ci first, then rerun this script."
  }

  # dotenv.config loads .env.local before .env without overriding existing keys.
  $sourceValue = $null
  foreach ($path in @(".env.local", ".env")) {
    if (-not (Test-Path $path)) { continue }
    foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path $path).Path)) {
      if ($line -match '^\s*DATABASE_URL\s*=\s*(.*)\s*$') {
        $sourceValue = $Matches[1].Trim()
        break
      }
    }
    if ($sourceValue) { break }
  }
  if (-not $sourceValue) {
    throw "DATABASE_URL not found in .env.local or .env. Nothing changed."
  }
  if (($sourceValue.StartsWith('"') -and $sourceValue.EndsWith('"')) -or
      ($sourceValue.StartsWith("'") -and $sourceValue.EndsWith("'"))) {
    $sourceValue = $sourceValue.Substring(1, $sourceValue.Length - 2)
  }
  $pooled = "ep-still-star-au988t17-pooler.c-10.us-east-1.aws.neon.tech"
  $direct = "ep-still-star-au988t17.c-10.us-east-1.aws.neon.tech"
  try { $parsed = [System.Uri]::new($sourceValue) }
  catch { throw "Invalid DATABASE_URL format. Nothing changed." }
  if ($parsed.Host -notin @($pooled, $direct) -or $parsed.AbsolutePath -ne "/neondb") {
    throw "Database does not match verified SmartDirect Neon production host/database. Aborting."
  }
  $url = $sourceValue.Replace($pooled, $direct)
  if ($url -notmatch '(?:\?|&)sslmode=') {
    $url += $(if ($url.Contains("?")) { "&" } else { "?" }) + "sslmode=require"
  }
  if ($url -notmatch '(?:\?|&)connect_timeout=') {
    $url += $(if ($url.Contains("?")) { "&" } else { "?" }) + "connect_timeout=30"
  }
  # Override the process environment only. User .env files remain intact.
  $env:DATABASE_URL = $url
  $env:DIRECT_URL = $url

  $expected = @("20261026195000_meta_monitor")
  Write-Host "Checking verified production Neon migration status (credentials hidden)..."
  # Windows PowerShell 5 may treat Prisma stderr as a terminating error with Stop.
  $ErrorActionPreference = "Continue"
  try {
    $output = (& .\node_modules\.bin\prisma.cmd migrate status 2>&1 | Out-String)
    $statusCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = "Stop" }
  # Avoid accidentally echoing a URL or password from an unexpected error.
  if ($statusCode -eq 0 -and $output -match "up to date") {
    Write-Host "Database migrations already up to date." -ForegroundColor Green
    exit 0
  }
  $pending = @([regex]::Matches($output, '(?m)^\s*(20\d{12}_[A-Za-z0-9_]+)\s*$') |
    ForEach-Object { $_.Groups[1].Value })
  if ($statusCode -ne 1 -or $pending.Count -ne $expected.Count -or
      (@(Compare-Object $expected $pending).Count -ne 0)) {
    Write-Host "Migration status did not exactly match the reviewed Meta monitor migration. No changes made." -ForegroundColor Red
    Write-Host ("Detected pending migrations: " + ($pending -join ", "))
    exit 1
  }
  Write-Host "Meta monitor migration verified. Protected Neon backup branch exists."
  Write-Host "Applying Prisma migrations..."
  & .\node_modules\.bin\prisma.cmd migrate deploy
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration command failed. Database needs review before deployment." -ForegroundColor Red
    exit 1
  }
  $ErrorActionPreference = "Continue"
  try {
    $finalStatus = (& .\node_modules\.bin\prisma.cmd migrate status 2>&1 | Out-String)
    $finalCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = "Stop" }
  if ($finalCode -ne 0 -or $finalStatus -notmatch 'up to date') {
    Write-Host "Migration finished but post-check was inconclusive. Stop before merge." -ForegroundColor Red
    exit 1
  }
  Write-Host "SMARTDIRECT_META_MONITOR_MIGRATIONS_OK" -ForegroundColor Green
}
finally {
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\DIRECT_URL -ErrorAction SilentlyContinue
  Pop-Location
}
