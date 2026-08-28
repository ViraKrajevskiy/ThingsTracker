# ThingTracker - release a new version (build all OSes + publish to GitHub Releases,
# so installed apps auto-update). Run: powershell -ExecutionPolicy Bypass -File release.ps1
$ErrorActionPreference = "Stop"

if (-not (git remote | Select-String origin)) {
  Write-Host "No 'origin' remote. Run: git remote add origin https://github.com/USER/REPO.git" -ForegroundColor Yellow
  exit 1
}

# commit any pending changes
git add -A
git commit -m "changes before release" 2>$null | Out-Null
git branch -M main 2>$null
git push -u origin main

# bump patch version, create tag vX.Y.Z, commit
npm version patch -m "release %s"

# push branch + the new tag -> triggers the workflow to build & publish a Release
git push
git push --tags

Write-Host ""
Write-Host "Release started. GitHub is building all OSes and publishing to Releases." -ForegroundColor Green
Write-Host "Installed apps will auto-update to the new version." -ForegroundColor Green
