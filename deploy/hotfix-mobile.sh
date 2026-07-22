#!/bin/bash
# Быстрое обновление фронта на сервере (если git pull не помог)
set -e
APP_DIR="/var/www/motivator-coffee"
cd "$APP_DIR"
git pull origin main
pm2 restart motivator
echo "OK: $(grep 'style.css?v=' public/index.html | head -1)"
