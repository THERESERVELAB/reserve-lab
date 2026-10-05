param(
  [string]$Focus = "Phase 3 product modules"
)

$ErrorActionPreference = "Stop"

Write-Host "FINAL BOSS ATHLETE handoff" -ForegroundColor Yellow
Write-Host "Repo: C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean" -ForegroundColor Gray
Write-Host "Focus: $Focus"
Write-Host ""
Write-Host "Compliance: tracking, education, health awareness, trend observation, clinician review." -ForegroundColor Cyan
Write-Host "Never generate protocols, dosages, cycles, or medical advice." -ForegroundColor Red
Write-Host ""

if (Test-Path "TASKS.md") {
  Write-Host "Open tasks:" -ForegroundColor Cyan
  Get-Content "TASKS.md"
}
