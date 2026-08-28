#!/usr/bin/env bash
# ThingTracker — локальная сборка (macOS / Linux). Запуск: bash build.sh
set -e
echo "== 1/4 Frontend =="
( cd frontend && npm install && npm run build )
echo "== 2/4 Backend (PyInstaller) =="
( cd backend && pip install -r requirements.txt pyinstaller && pyinstaller --noconfirm --clean thingtracker.spec )
echo "== 3/4 Electron deps =="
npm install
echo "== 4/4 Package =="
npx electron-builder --publish never
echo "Готово — смотри папку dist/"
