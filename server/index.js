const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { flavors, BOX_SIZE, BOX_PRICE } = require('./products');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'motivator-admin-2026';

if (NODE_ENV === 'production' && ADMIN_TOKEN === 'motivator-admin-2026') {
  console.error('\n  ОШИБКА: задайте свой ADMIN_TOKEN в переменных окружения сервера.\n');
  process.exit(1);
}

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Неверный токен доступа' });
  }
  next();
}

function validateBoxItem(item) {
  if (!item.flavors?.length) return 'Укажите состав упаковки';

  const total = item.flavors.reduce((sum, f) => sum + f.quantity, 0);
  if (total !== BOX_SIZE) {
    return `В упаковке должно быть ровно ${BOX_SIZE} бутылок (сейчас ${total})`;
  }

  const validIds = new Set(flavors.map((f) => f.id));
  for (const f of item.flavors) {
    if (!validIds.has(f.id)) return `Неизвестный вкус: ${f.id}`;
    if (!f.quantity || f.quantity < 0) return 'Некорректное количество';
  }

  if (item.price !== BOX_PRICE) return 'Неверная цена упаковки';
  return null;
}

app.get('/api/catalog', (_req, res) => {
  res.json({ flavors, boxSize: BOX_SIZE, boxPrice: BOX_PRICE });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'motivator-coffee' });
});

app.post('/api/admin/login', (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Неверный токен доступа' });
  }
  res.json({ ok: true });
});

app.post('/api/orders', (req, res) => {
  const { customerName, customerPhone, customerEmail, customerAddress, customerComment, items } = req.body;

  if (!customerName?.trim() || !customerPhone?.trim() || !customerAddress?.trim()) {
    return res.status(400).json({ error: 'Заполните имя, телефон и адрес доставки' });
  }
  if (!items?.length) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  for (const item of items) {
    const error = validateBoxItem(item);
    if (error) return res.status(400).json({ error });
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = db.createOrder({
    orderNumber: db.generateOrderNumber(),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: customerEmail?.trim() || '',
    customerAddress: customerAddress.trim(),
    customerComment: customerComment?.trim() || '',
    items,
    total,
  });

  res.status(201).json({ success: true, order });
});

app.get('/api/orders', requireAdmin, (_req, res) => {
  res.json(db.getAllOrders());
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['new', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }
  const order = db.updateOrderStatus(Number(req.params.id), status);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ☕ MOTIVATOR Coffee Shop`);
  console.log(`  Режим:    ${NODE_ENV}`);
  console.log(`  Магазин:  http://localhost:${PORT}`);
  console.log(`  Админка:  http://localhost:${PORT}/admin`);
  if (NODE_ENV !== 'production') {
    console.log(`  Токен:    ${ADMIN_TOKEN}`);
  } else {
    console.log(`  Токен:    (задан через ADMIN_TOKEN)`);
  }
  console.log('');
});
