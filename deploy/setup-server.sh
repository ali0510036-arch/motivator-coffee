#!/bin/bash
# Запуск на Ubuntu 22.04+ (Timeweb / Beget VPS)
# Использование: bash setup-server.sh

set -e

APP_DIR="/var/www/motivator-coffee"
REPO="https://github.com/ali0510036-arch/motivator-coffee.git"

echo "==> Node.js 20"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Git, Nginx, Certbot"
apt-get update
apt-get install -y git nginx certbot python3-certbot-nginx

echo "==> Клонирование проекта"
mkdir -p /var/www
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
else
  cd "$APP_DIR" && git pull
fi

cd "$APP_DIR"
npm install --omit=dev

if [ ! -f "$APP_DIR/.env" ]; then
  echo "==> Создайте файл .env (см. .env.example)"
  cp .env.example .env
  echo "Отредактируйте: nano $APP_DIR/.env"
fi

echo "==> PM2"
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "Готово. Дальше:"
echo "1. nano $APP_DIR/.env  — задайте ADMIN_TOKEN"
echo "2. pm2 restart motivator"
echo "3. Настройте Nginx: deploy/nginx-motivator.conf"
echo "4. certbot --nginx -d ваш-домен.ru"
