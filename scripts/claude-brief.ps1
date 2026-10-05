$ErrorActionPreference = "Stop"

Write-Host "FINAL BOSS ATHLETE — Claude build brief" -ForegroundColor Yellow
Write-Host "Repo: C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean" -ForegroundColor Gray
Write-Host ""
Get-Content "docs\CLAUDE_BUILD_PROMPT.md"
Write-Host ""
Write-Host "Current source files:" -ForegroundColor Cyan
Get-ChildItem -Recurse -File src | Select-Object -ExpandProperty FullName
