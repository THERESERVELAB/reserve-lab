$ErrorActionPreference = "Stop"

Write-Host "Running FINAL BOSS ATHLETE Codex review checks..." -ForegroundColor Yellow
Write-Host "Repo: C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean" -ForegroundColor Gray
Write-Host ""
npm run lint
npm run build
Write-Host ""
Write-Host "Review checks complete." -ForegroundColor Green
