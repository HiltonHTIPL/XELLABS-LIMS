# ============================================================
# Xellabs LIMS — Single-Command Startup
# Run from project root in PowerShell:
#   .\start.ps1
#
# Prerequisites (one-time setup):
#   In WSL terminal: bash /mnt/c/Users/Hilton/xellabs-lims/setup-sudoers.sh
# ============================================================

$PROJECT   = "c:\Users\Hilton\xellabs-lims"
$BACKEND   = "$PROJECT\xellabs-backend"
$REBRAND   = "/mnt/c/Users/Hilton/xellabs-lims/senaite-rebrand"
$CONTAINER = "senaite"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    ERR $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  Xellabs LIMS — Starting all services" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

# ── 1. PostgreSQL ─────────────────────────────────────────
Write-Step 1 "PostgreSQL (WSL)"
$pg = wsl -d Ubuntu-22.04 -- sudo -n service postgresql start 2>&1
if ($LASTEXITCODE -eq 0) { Write-Ok "PostgreSQL started" }
else { Write-Fail "Could not start PostgreSQL: $pg"; Write-Host "    Run setup-sudoers.sh once in WSL terminal first." -ForegroundColor Yellow }

# ── 2. Redis ──────────────────────────────────────────────
Write-Step 2 "Redis (WSL)"
$rd = wsl -d Ubuntu-22.04 -- sudo -n service redis-server start 2>&1
if ($LASTEXITCODE -eq 0) { Write-Ok "Redis started" }
else { Write-Fail "Could not start Redis: $rd" }

# ── 3. SENAITE Docker container ───────────────────────────
Write-Step 3 "SENAITE container (Docker in WSL)"

$containerExists = wsl -d Ubuntu-22.04 -- docker ps -a --format "{{.Names}}" 2>&1 | Select-String "^senaite$"
$containerRunning = wsl -d Ubuntu-22.04 -- docker ps --format "{{.Names}}" 2>&1 | Select-String "^senaite$"

if ($containerRunning) {
    Write-Ok "SENAITE already running → http://localhost:8080/senaite"
}
elseif ($containerExists) {
    wsl -d Ubuntu-22.04 -- docker start $CONTAINER | Out-Null
    Write-Ok "SENAITE started (white-label preserved) → http://localhost:8080/senaite"
    Write-Host "    Zope needs ~90s to boot. Watch: docker logs -f senaite" -ForegroundColor Yellow
}
else {
    Write-Host "    Container not found — creating from cached image..." -ForegroundColor Yellow
    wsl -d Ubuntu-22.04 -- docker run -d --name $CONTAINER -p 8080:8080 `
        -e SITE=senaite -e ADMIN_USER=admin -e ADMIN_PASSWORD=admin `
        senaite/senaite:v2.6.0 | Out-Null

    Write-Host "    Waiting for Zope to start (~90s)..." -ForegroundColor Yellow
    $ready = $false
    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Seconds 8
        $log = wsl -d Ubuntu-22.04 -- docker logs $CONTAINER 2>&1
        if ($log -match "Zope Ready to handle requests") { $ready = $true; break }
        Write-Host "    ." -NoNewline
    }
    Write-Host ""

    if ($ready) {
        Write-Host "    Applying XelLabs white-label..." -ForegroundColor Yellow
        $files = @("logo.pt","toolbar.pt","footer.pt","colophon.pt","frontpage.pt","xellabs_overrides.css","apply_rebrand.sh","apply_templates.sh","fix_title_full2.py")
        foreach ($f in $files) {
            wsl -d Ubuntu-22.04 -- docker cp "$REBRAND/$f" "${CONTAINER}:/tmp/" | Out-Null
        }
        wsl -d Ubuntu-22.04 -- docker exec --user root $CONTAINER bash /tmp/apply_rebrand.sh | Out-Null
        wsl -d Ubuntu-22.04 -- docker exec --user root $CONTAINER bash /tmp/apply_templates.sh | Out-Null
        wsl -d Ubuntu-22.04 -- docker exec $CONTAINER python2.7 /tmp/fix_title_full2.py | Out-Null
        wsl -d Ubuntu-22.04 -- docker restart $CONTAINER | Out-Null
        Write-Ok "SENAITE created + white-labeled → http://localhost:8080/senaite"
        Write-Host "    Zope restarting (~90s). Watch: docker logs -f senaite" -ForegroundColor Yellow
    }
    else {
        Write-Fail "Zope did not start in time. Check: docker logs senaite"
    }
}

# ── 4. Django ─────────────────────────────────────────────
Write-Step 4 "Django dev server"
Write-Host "    API   → http://127.0.0.1:8000" -ForegroundColor White
Write-Host "    Admin → http://127.0.0.1:8000/admin" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  All services started. Django starting now." -ForegroundColor Magenta
Write-Host "  Press Ctrl+C to stop Django." -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

Set-Location $BACKEND
& ".\venv\Scripts\Activate.ps1"
python manage.py runserver
