# Публикация MOTIVATOR Coffee (боевой режим)

> **Оплата картой РФ, без VPN:** используйте **[DEPLOY-TIMEWEB.md](./DEPLOY-TIMEWEB.md)** — Timeweb Cloud (~350–500 ₽/мес).
>
> Render (ниже) требует зарубежную карту через Stripe.

Пошаговая инструкция: сайт, заказы и админка работают постоянно, заказы не пропадают.

---

## Рекомендуем: Timeweb (Россия)

См. **[DEPLOY-TIMEWEB.md](./DEPLOY-TIMEWEB.md)** — полная инструкция для VPS с оплатой **Мир / Visa РФ**.

---

## Шаг 0. Что понадобится (Render — зарубежная карта)

- Аккаунт **GitHub** — [github.com/signup](https://github.com/signup)
- **Git** на компьютере — [git-scm.com/download/win](https://git-scm.com/download/win)
- Хостинг с Node.js (**Render**, ~$7/мес + диск для заказов, **иностранная карта**)

> Для оплаты картой РФ — **[DEPLOY-TIMEWEB.md](./DEPLOY-TIMEWEB.md)**.

---

## Шаг 1. Секретный токен админки

Придумайте длинный пароль для входа в `/admin`, например:

```
M0t1vator-Admin-2026-Xk9mP2
```

Сохраните его — понадобится на шаге 5. **Не публикуйте в чатах и не коммитьте в Git.**

---

## Шаг 2. Залить проект на GitHub

Откройте **PowerShell** в папке проекта:

```powershell
cd C:\Users\BOSS\Projects\motivator-coffee
git init
git add .
git commit -m "MOTIVATOR coffee shop — production ready"
```

На GitHub: **New repository** → имя `motivator-coffee` → **без** README → Create.

Подставьте свой логин:

```powershell
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/motivator-coffee.git
git push -u origin main
```

---

## Шаг 3. Регистрация на Render

1. [render.com](https://render.com) → Sign Up → **Continue with GitHub**
2. Разрешите доступ к репозиторию `motivator-coffee`

---

## Шаг 4. Создать Web Service

1. **Dashboard → New + → Blueprint**
2. Подключите репозиторий `motivator-coffee`
3. Render прочитает файл `render.yaml` и предложит создать сервис с **диском 1 GB** — это нужно для `data/orders.json`
4. Подтвердите создание (**Apply**)

Или вручную (**New → Web Service**):

| Поле | Значение |
|------|----------|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | **Starter** ($7/mo — сервер не «засыпает») |
| Health Check Path | `/api/health` |

**Disk (обязательно):**

| Поле | Значение |
|------|----------|
| Mount Path | `/var/data` |
| Size | 1 GB |

---

## Шаг 5. Переменные окружения

В Render: **Environment → Environment Variables**

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `ADMIN_TOKEN` | ваш токен из шага 1 |
| `DATA_DIR` | `/var/data` |

Нажмите **Save Changes** → сервис перезапустится.

---

## Шаг 6. Проверка

После деплоя Render даст URL, например:

```
https://motivator-coffee.onrender.com
```

Проверьте:

1. Открывается главная страница
2. **Собрать упаковку** → оформить тестовый заказ
3. `https://ваш-url.onrender.com/admin` → войти с `ADMIN_TOKEN`
4. Заказ виден в админке

Проверка API: `https://ваш-url.onrender.com/api/health` → `{"ok":true,...}`

---

## Шаг 7. Свой домен (необязательно)

1. Купите домен (REG.RU, Timeweb, Beget)
2. Render → **Settings → Custom Domains** → добавьте домен
3. В DNS регистратора укажите записи, которые покажет Render (CNAME)
4. HTTPS включится автоматически

---

## Вариант Б: VPS в России (Timeweb / Beget)

Подходит, если нужна оплата картой РФ и полный контроль.

### 1. Арендуйте VPS

- Ubuntu 22.04, минимум 1 GB RAM
- Timeweb Cloud, Beget VPS, Selectel

### 2. Подключитесь по SSH

```bash
ssh root@IP_ВАШЕГО_СЕРВЕРА
```

### 3. Установите Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git
```

### 4. Склонируйте проект

```bash
cd /var/www
git clone https://github.com/ВАШ_ЛОГИН/motivator-coffee.git
cd motivator-coffee
npm install
```

### 5. Создайте `.env`

```bash
nano .env
```

```
NODE_ENV=production
PORT=3000
ADMIN_TOKEN=ваш-секретный-токен
DATA_DIR=/var/www/motivator-coffee/data
```

### 6. Запуск через PM2 (автозапуск)

```bash
npm install -g pm2
pm2 start server/index.js --name motivator
pm2 save
pm2 startup
```

### 7. Nginx + HTTPS

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Файл `/etc/nginx/sites-available/motivator`:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/motivator /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d ваш-домен.ru
```

---

## Обновление сайта после правок

**Render:** push в GitHub → деплой автоматически.

```powershell
git add .
git commit -m "Обновление"
git push
```

**VPS:**

```bash
cd /var/www/motivator-coffee
git pull
pm2 restart motivator
```

---

## Безопасность

- Меняйте `ADMIN_TOKEN` на свой длинный пароль
- Не коммитьте `.env` и `data/orders.json`
- Делайте бэкап `data/orders.json` раз в неделю

---

## Проблемы

| Симптом | Решение |
|---------|---------|
| Сервис не стартует | Проверьте `ADMIN_TOKEN` в Environment |
| Заказы пропадают | Включите Persistent Disk / `DATA_DIR` |
| 502 на Render | Подождите 2–3 мин после деплоя, проверьте Logs |
