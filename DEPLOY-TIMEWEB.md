# Деплой на Timeweb — оплата картой РФ, без VPN

Render требует зарубежную карту (Stripe). **Timeweb Cloud** принимает **Мир, Visa, Mastercard** российских банков — подписка списывается в рублях.

Репозиторий уже на GitHub: `ali0510036-arch/motivator-coffee`

---

## Шаг 1. Регистрация Timeweb

1. Откройте [timeweb.cloud](https://timeweb.cloud)
2. **Регистрация** → подтвердите email/телефон
3. **Пополнить баланс** — карта РФ, от ~300 ₽

---

## Шаг 2. Создать VPS

1. **Облако → Серверы → Создать**
2. Параметры:
   - **ОС:** Ubuntu 22.04
   - **RAM:** 1 GB (минимум) или 2 GB (комфортнее)
   - **Регион:** Москва / Санкт-Петербург
3. Создайте сервер, запишите **IP-адрес** и **пароль root**

**Стоимость:** примерно **350–500 ₽/мес** (списание с баланса Timeweb).

---

## Шаг 3. Привязать домен (можно сразу или позже)

**В Timeweb:** Купить домен `.ru` / `.shop` или перенести свой.

**DNS для домена** (если сервер уже есть):

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP вашего VPS |
| A | `www` | IP вашего VPS |

---

## Шаг 4. Подключиться к серверу

**Windows:** PowerShell или [PuTTY](https://www.putty.org/)

```powershell
ssh root@ВАШ_IP
```

Пример: `ssh root@185.123.45.67`

---

## Шаг 5. Установка сайта (одной командой)

На сервере:

```bash
curl -fsSL https://raw.githubusercontent.com/ali0510036-arch/motivator-coffee/main/deploy/setup-server.sh | bash
```

Если скрипт ещё не в GitHub — вручную:

```bash
apt update && apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx

cd /var/www
git clone https://github.com/ali0510036-arch/motivator-coffee.git
cd motivator-coffee
npm install
```

---

## Шаг 6. Настройка `.env`

```bash
nano /var/www/motivator-coffee/.env
```

Вставьте (замените токен):

```
NODE_ENV=production
PORT=3000
ADMIN_TOKEN=ваш-длинный-секретный-токен
DATA_DIR=/var/www/motivator-coffee/data
```

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`

---

## Шаг 7. Запуск через PM2

```bash
cd /var/www/motivator-coffee
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Проверка: `curl http://127.0.0.1:3000/api/health`

---

## Шаг 8. Nginx + HTTPS

```bash
nano /etc/nginx/sites-available/motivator
```

Скопируйте содержимое из `deploy/nginx-motivator.conf`, замените `YOUR_DOMAIN.ru` на ваш домен.

```bash
ln -s /etc/nginx/sites-available/motivator /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru
```

---

## Шаг 9. Проверка

| Что | URL |
|-----|-----|
| Магазин | `https://ваш-домен.ru` |
| Админка | `https://ваш-домен.ru/admin` |
| API | `https://ваш-домен.ru/api/health` |

1. Оформите тестовый заказ на сайте
2. Войдите в админку с `ADMIN_TOKEN`
3. Убедитесь, что заказ сохранился

---

## Оплата хостинга дальше

- Пополняйте **баланс Timeweb** картой РФ в личном кабинете
- Включите **автоплатёж** — списание раз в месяц без ручного продления
- Заказы хранятся в `/var/www/motivator-coffee/data/orders.json`

---

## Обновление сайта после правок

На вашем ПК:

```powershell
cd C:\Users\BOSS\Projects\motivator-coffee
git add .
git commit -m "Обновление"
git push
```

На сервере:

```bash
cd /var/www/motivator-coffee
git pull
npm install
pm2 restart motivator
```

---

## Альтернативы Timeweb (тоже карта РФ)

| Хостинг | Сайт |
|---------|------|
| Beget VPS | beget.com |
| REG.RU Cloud | reg.ru |
| Selectel | selectel.ru |

---

## Оплата заказов клиентами на сайте (следующий шаг)

Сейчас клиент оформляет заказ **без онлайн-оплаты** (оплата при получении).

Когда понадобится приём **картой / СБП на сайте**, подключим **ЮKassa** или **Tinkoff Acquiring** — обе работают в РФ без VPN. Напишите, когда будете готовы.
