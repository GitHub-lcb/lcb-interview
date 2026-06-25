param(
  [string]$RepoPath = "E:/develop-lcb/workspace-tools/lcb-interview",
  [string]$ServerHost = "106.12.166.113",
  [string]$ServerUser = "root",
  [string]$AppDir = "/opt/lcb-interview",
  [string]$AdminToken = "",
  [switch]$SkipTests,
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-LfFile {
  param(
    [string]$Path,
    [string]$Content
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Content -replace "`r`n", "`n"), $utf8NoBom)
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "RepoPath not found: $RepoPath"
}

$repo = (Resolve-Path -LiteralPath $RepoPath).Path
$archive = Join-Path $env:TEMP "lcb-interview-deploy.tar.gz"
$migration = Join-Path $env:TEMP "lcb-ai-config-migration.sql"
$remoteScript = Join-Path $env:TEMP "lcb-interview-remote-deploy.sh"

Write-Step "Repository status"
git -C $repo status --short

if (-not $SkipTests) {
  Write-Step "Run backend tests"
  Push-Location (Join-Path $repo "backend")
  mvn test
  Pop-Location
}

Write-Step "Package backend jar"
Push-Location (Join-Path $repo "backend")
mvn -q -DskipTests package
Pop-Location

Write-Step "Build frontend"
Push-Location (Join-Path $repo "frontend")
npm run build
Pop-Location

Write-Step "Create deploy archive"
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
Push-Location $repo
tar `
  --exclude='./.git' `
  --exclude='./.idea' `
  --exclude='./.gstack' `
  --exclude='./.superpowers' `
  --exclude='./backend/target/test-classes' `
  --exclude='./backend/target/maven-status' `
  --exclude='./backend/target/surefire-reports' `
  --exclude='./backend/app.log' `
  --exclude='./frontend/node_modules' `
  --exclude='./frontend/.vite' `
  -czf $archive .
Pop-Location
Get-Item -LiteralPath $archive | Select-Object FullName, Length

Write-Step "Create idempotent migration files"
Write-LfFile $migration @"
CREATE TABLE IF NOT EXISTS ai_config (
    id                BIGINT       PRIMARY KEY,
    api_key           VARCHAR(500) DEFAULT NULL,
    model             VARCHAR(100) DEFAULT NULL,
    api_url           VARCHAR(500) DEFAULT NULL,
    interview_enabled TINYINT      DEFAULT NULL,
    create_time       DATETIME     NOT NULL,
    update_time       DATETIME     NOT NULL,
    is_deleted        TINYINT      DEFAULT 0
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
"@

Write-LfFile $remoteScript @"
set -euo pipefail
APP_DIR='$AppDir'
mkdir -p "`$APP_DIR"
tar -xzf /tmp/lcb-interview-deploy.tar.gz -C "`$APP_DIR"
cd "`$APP_DIR"
docker compose -f docker-compose.runtime.yml up -d
for i in `$(seq 1 60); do
  status=`$(docker inspect -f '{{.State.Health.Status}}' lcb-mysql 2>/dev/null || true)
  if [ "`$status" = "healthy" ]; then
    break
  fi
  sleep 2
done
docker cp /tmp/lcb-ai-config-migration.sql lcb-mysql:/tmp/lcb-ai-config-migration.sql
docker exec lcb-mysql sh -c 'mysql -u"`$MYSQL_USER" -p"`$MYSQL_PASSWORD" "`$MYSQL_DATABASE" < /tmp/lcb-ai-config-migration.sql'
docker compose -f docker-compose.runtime.yml restart backend frontend
docker compose -f docker-compose.runtime.yml ps
"@

if ($BuildOnly) {
  Write-Step "BuildOnly complete"
  return
}

$remote = "$ServerUser@$ServerHost"
Write-Step "Upload archive and deploy scripts to $remote"
scp $archive $migration $remoteScript "${remote}:/tmp/"

Write-Step "Run remote deployment"
ssh $remote "bash /tmp/lcb-interview-remote-deploy.sh"

Write-Step "Smoke check public API"
$categories = Invoke-RestMethod -Uri "http://$ServerHost/api/categories" -Method Get
if ($categories.code -ne 200) {
  throw "Category smoke check failed: $($categories | ConvertTo-Json -Compress)"
}
Write-Host "Categories OK: $($categories.data.Count)"

if ($AdminToken.Trim()) {
  Write-Step "Smoke check admin AI config"
  $config = Invoke-RestMethod `
    -Uri "http://$ServerHost/api/admin/ai/config" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $AdminToken" }
  if ($config.code -ne 200) {
    throw "Admin AI config smoke check failed: $($config | ConvertTo-Json -Compress)"
  }
  Write-Host "Admin AI config OK: available=$($config.data.available)"
}

Write-Step "Deployment complete"
