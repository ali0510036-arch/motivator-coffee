#!/bin/bash
# Одной командой на сервере:
# curl -fsSL https://raw.githubusercontent.com/ali0510036-arch/motivator-coffee/main/deploy/update.sh | bash

set -e
APP="/var/www/motivator-coffee"
cd "$APP"

echo "=== Текущая версия ==="
grep -E "admin-version|admin.js\?v=" public/admin.html || true
git log -1 --oneline || true

echo "=== git pull ==="
git fetch origin main
git reset --hard origin/main

echo "=== restart ==="
pm2 restart motivator

echo "=== Новая версия ==="
grep -E "admin-version|admin.js\?v=" public/admin.html || true
echo "Готово. Откройте /admin и нажмите Ctrl+F5"
