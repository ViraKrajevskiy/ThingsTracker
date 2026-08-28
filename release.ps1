# ThingTracker - trigger GitHub Actions build for ALL OSes (Win/Mac/Linux).
# Run: powershell -ExecutionPolicy Bypass -File release.ps1
# Requires git and a GitHub repo with remote 'origin'.
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  Write-Host "Init git repo..." -ForegroundColor Cyan
  git init | Out-Null
  git add -A; git commit -m "ThingTracker" | Out-Null
}
$hasRemote = (git remote 2>$null) -contains "origin"
if (-not $hasRemote) {
  Write-Host "No 'origin' remote. Create an empty repo on github.com and run:" -ForegroundColor Yellow
  Write-Host "  git remote add origin https://github.com/USER/REPO.git" -ForegroundColor Yellow
  Write-Host "Then run release.ps1 again." -ForegroundColor Yellow
  exit 1
}

Write-Host "Commit + push..." -ForegroundColor Cyan
git add -A
git commit -m "release build" 2>$null | Out-Null
git branch -M main 2>$null
git push -u origin main

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  gh workflow run "Build ThingTracker"
  Write-Host "Started. Check the Actions tab on GitHub (Win/Mac/Linux files)." -ForegroundColor Green
} else {
  $tag = "v0.0." + [int](Get-Date -UFormat %s)
  git tag $tag
  git push origin $tag
  Write-Host "Started via tag $tag. Check the Actions tab on GitHub." -ForegroundColor Green
}
