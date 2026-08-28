# ThingTracker — запуск сборки под ВСЕ ОС (Windows/Mac/Linux) через GitHub Actions.
# Одна команда: powershell -ExecutionPolicy Bypass -File release.ps1
# Требуется: git, и репозиторий с настроенным remote 'origin' на GitHub.
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  Write-Host "Инициализирую git-репозиторий..." -ForegroundColor Cyan
  git init | Out-Null
  git add -A; git commit -m "ThingTracker" | Out-Null
}
$hasRemote = (git remote 2>$null) -contains "origin"
if (-not $hasRemote) {
  Write-Host "Нет удалённого репозитория. Создай пустой репозиторий на github.com и выполни:" -ForegroundColor Yellow
  Write-Host '  git remote add origin https://github.com/USER/REPO.git' -ForegroundColor Yellow
  Write-Host "Потом запусти release.ps1 снова." -ForegroundColor Yellow
  exit 1
}

Write-Host "Коммичу изменения..." -ForegroundColor Cyan
git add -A
git commit -m "release build" 2>$null | Out-Null
git branch -M main 2>$null
git push -u origin main

# Пытаемся запустить workflow напрямую через gh, иначе — тегом
$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  Write-Host "Запускаю сборку через gh..." -ForegroundColor Cyan
  gh workflow run "Build ThingTracker"
  Write-Host "Готово. Смотри вкладку Actions на GitHub — там появятся файлы для Win/Mac/Linux." -ForegroundColor Green
} else {
  $tag = "v0.0." + (Get-Date -UFormat %s)
  Write-Host "gh не найден — запускаю сборку тегом $tag..." -ForegroundColor Cyan
  git tag $tag
  git push origin $tag
  Write-Host "Готово. Открой вкладку Actions на GitHub — сборка под все ОС уже идёт." -ForegroundColor Green
}
