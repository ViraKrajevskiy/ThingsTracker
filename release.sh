#!/usr/bin/env bash
# ThingTracker — запуск сборки под ВСЕ ОС через GitHub Actions. Запуск: bash release.sh
set -e
if [ ! -d .git ]; then
  echo "Инициализирую git..."; git init -q; git add -A; git commit -qm "ThingTracker"
fi
if ! git remote | grep -q origin; then
  echo "Нет remote 'origin'. Создай репозиторий на github.com и выполни:"
  echo "  git remote add origin https://github.com/USER/REPO.git"
  echo "Потом запусти release.sh снова."; exit 1
fi
git add -A; git commit -qm "release build" || true
git branch -M main 2>/dev/null || true
git push -u origin main
if command -v gh >/dev/null 2>&1; then
  gh workflow run "Build ThingTracker"
  echo "Готово — смотри Actions на GitHub (файлы для Win/Mac/Linux)."
else
  tag="v0.0.$(date +%s)"
  git tag "$tag"; git push origin "$tag"
  echo "Готово — сборка под все ОС запущена тегом $tag (вкладка Actions)."
fi
