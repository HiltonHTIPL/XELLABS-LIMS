# ============================================================
# Xellabs LIMS — Django Startup Script (PowerShell)
# Run in IDE integrated terminal:
#   .\start-django.ps1
# ============================================================

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host " Xellabs Django Backend" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$BACKEND = "c:\Users\Hilton\xellabs-lims\xellabs-backend"
$ENV_FILE = "$BACKEND\.env"

# Check .env exists
if (-not (Test-Path $ENV_FILE)) {
    Write-Host ""
    Write-Host "ERROR: .env file not found at $ENV_FILE" -ForegroundColor Red
    Write-Host "Create it before starting Django." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[1/2] Activating venv..."
Set-Location $BACKEND
& ".\venv\Scripts\Activate.ps1"
Write-Host "  OK"

Write-Host ""
Write-Host "[2/2] Starting Django dev server..."
Write-Host "  API   → http://127.0.0.1:8000"
Write-Host "  Admin → http://127.0.0.1:8000/admin"
Write-Host ""
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

python manage.py runserver
