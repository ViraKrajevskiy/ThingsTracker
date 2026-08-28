# ThingTracker — сборка Windows-приложения (portable .exe + установщик).
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File build.ps1
# Требуется: Node.js и Python (у тебя уже есть).
$ErrorActionPreference = "Stop"

# выбираем python из venv, если он есть (там уже все зависимости)
$py = ".\backend\venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "== 1/4 Фронтенд ==" -ForegroundColor Cyan
Push-Location frontend
npm install
npm run build
Pop-Location

Write-Host "== 2/4 Бэкенд (PyInstaller) ==" -ForegroundColor Cyan
Push-Location backend
& $py -m pip install --quiet -r requirements.txt pyinstaller
& $py -m PyInstaller --noconfirm --clean thingtracker.spec
if (-not (Test-Path "dist\thingtracker-backend.exe")) { throw "Бэкенд не собрался (нет dist\thingtracker-backend.exe)" }
Pop-Location

Write-Host "== 3/4 Зависимости Electron ==" -ForegroundColor Cyan
npm install

Write-Host "== 4/4 Упаковка приложения ==" -ForegroundColor Cyan
npx electron-builder --win --publish never

Write-Host ""
Write-Host "ГОТОВО. Файлы в папке dist\ :" -ForegroundColor Green
Get-ChildItem dist\*.exe | ForEach-Object { Write-Host ("  " + $_.Name) -ForegroundColor Green }
