#!/bin/bash
# Обновление сайта на сервере — запускать на VPS
set -e
cd /var/www/motivator-coffee
echo "=== git pull ==="
git pull origin main
echo "=== restart ==="
pm2 restart motivator
echo "=== versions ==="
grep -E "admin\.(js|css)\?v=" public/admin.html || true
echo "=== OK ==="
