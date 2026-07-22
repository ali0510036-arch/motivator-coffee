#!/bin/bash
# Подключение motivator-coffee.ru к VPS (после A-записи на IP сервера)
# Запуск на сервере: bash deploy/setup-domain.sh

set -e

DOMAIN="motivator-coffee.ru"
APP_DIR="/var/www/motivator-coffee"

echo "=== Nginx: ${DOMAIN} ==="
cat > /etc/nginx/sites-available/motivator <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 512k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Authorization \$http_authorization;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/motivator /etc/nginx/sites-enabled/motivator
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Проверка HTTP ==="
curl -sI "http://${DOMAIN}/api/health" | head -5 || true

echo ""
echo "=== HTTPS (Let's Encrypt) ==="
if ! command -v certbot &>/dev/null; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email || \
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}"

echo ""
echo "=== ГОТОВО ==="
echo "  Магазин:  https://${DOMAIN}"
echo "  Админка:  https://${DOMAIN}/admin"
echo "  Health:   https://${DOMAIN}/api/health"
echo ""
echo "Если certbot запросил email — запустите вручную:"
echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
