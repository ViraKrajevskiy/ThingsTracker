# ThingTracker - build Windows app (portable .exe + installer).
# Run: powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$py = Join-Path $root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "== 1/4 Frontend ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
npm install
npm run build
Pop-Location

Write-Host "== 2/4 Backend (PyInstaller) ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
& $py -m pip install --quiet -r requirements.txt pyinstaller
& $py -m PyInstaller --noconfirm --clean thingtracker.spec
if (-not (Test-Path (Join-Path $root "backend\dist\thingtracker-backend.exe"))) { throw "Backend build failed" }
Pop-Location

Write-Host "== 3/4 Electron deps ==" -ForegroundColor Cyan
Push-Location $root
npm install

Write-Host "== 4/4 Packaging ==" -ForegroundColor Cyan
npx electron-builder --win --publish never
Pop-Location

Write-Host ""
Write-Host "DONE. Files in dist folder:" -ForegroundColor Green
Get-ChildItem (Join-Path $root "dist\*.exe") | ForEach-Object { Write-Host ("  " + $_.Name) -ForegroundColor Green }
