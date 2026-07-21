#!/bin/bash
# MOTIVATOR — установка на Timeweb VPS (Ubuntu)
# Запуск на сервере после: ssh root@217.149.19.170

set -e

APP_DIR="/var/www/motivator-coffee"
REPO="https://github.com/ali0510036-arch/motivator-coffee.git"

echo "=== 1/6 Node.js 20 ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "=== 2/6 Git, Nginx, Certbot ==="
apt-get update
apt-get install -y git nginx certbot python3-certbot-nginx

echo "=== 3/6 Клонирование ==="
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
npm install --omit=dev

echo "=== 4/6 .env ==="
if [ ! -f "$APP_DIR/.env" ]; then
  TOKEN=$(openssl rand -hex 24)
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
ADMIN_TOKEN=${TOKEN}
DATA_DIR=/var/www/motivator-coffee/data
EOF
  echo ""
  echo "=========================================="
  echo "  СОХРАНИТЕ ТОКЕН АДМИНКИ:"
  echo "  ${TOKEN}"
  echo "  /admin"
  echo "=========================================="
  echo ""
else
  echo ".env уже есть — не перезаписываем"
fi

echo "=== 5/6 PM2 ==="
npm install -g pm2
pm2 delete motivator 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "=== 6/6 Nginx ==="
cat > /etc/nginx/sites-available/motivator <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 512k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/motivator /etc/nginx/sites-enabled/motivator
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== ГОТОВО ==="
echo "Сайт:    http://217.149.19.170"
echo "Админка: http://217.149.19.170/admin"
echo "Health:  http://217.149.19.170/api/health"
echo ""
echo "Домен + HTTPS (когда DNS укажет на этот IP):"
echo "  certbot --nginx -d ваш-домен.ru"
