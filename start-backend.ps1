# start-backend.ps1
# AlertMe Backend Launcher — auto-kills port 8080 before starting

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AlertMe Backend Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Resolve the script's own directory reliably regardless of how it was invoked
$ScriptDir = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Path)
$BackendDir = Join-Path $ScriptDir "backend"

# Step 0: Sanity-check the backend directory exists
if (-not (Test-Path (Join-Path $BackendDir "pom.xml"))) {
    Write-Host "  ERROR: Could not find backend/pom.xml. Are you in the right project folder?" -ForegroundColor Red
    exit 1
}

# Step 1: Kill anything on port 8080
Write-Host "[1/3] Checking port 8080..." -ForegroundColor Yellow
$connections = netstat -ano 2>$null | Select-String ":8080\s"
if ($connections) {
    foreach ($line in $connections) {
        $pid8080 = ($line.ToString().Trim() -split '\s+')[-1]
        if ($pid8080 -match '^\d+$') {
            Write-Host "      Killing process on port 8080 (PID: $pid8080)" -ForegroundColor Red
            taskkill /PID $pid8080 /F 2>$null | Out-Null
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "      Port 8080 is free." -ForegroundColor Green
}

# Step 2: Kill any stale java processes just in case
Write-Host "[2/3] Clearing stale Java processes..." -ForegroundColor Yellow
Stop-Process -Name java -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "      Done." -ForegroundColor Green

# Step 3: Start the backend from the correct directory
Write-Host "[3/3] Starting Spring Boot backend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Backend will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C then type 'q' + Enter to stop." -ForegroundColor Gray
Write-Host ""

Set-Location $BackendDir
.\mvnw spring-boot:run
