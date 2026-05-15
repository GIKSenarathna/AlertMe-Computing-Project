# stop-backend.ps1
# Run this script to stop the Spring Boot backend and free port 8080

Write-Host "Stopping all Java processes..." -ForegroundColor Yellow

Stop-Process -Name java -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

$check = netstat -ano 2>$null | findstr ":8080"
if ($check) {
    # Find and kill by port if java process name didn't work
    $pid8080 = ($check.Trim() -split '\s+')[-1]
    taskkill /PID $pid8080 /F | Out-Null
    Write-Host "Killed process on port 8080 (PID: $pid8080)" -ForegroundColor Red
} else {
    Write-Host "Port 8080 is now FREE. Backend stopped successfully." -ForegroundColor Green
}
