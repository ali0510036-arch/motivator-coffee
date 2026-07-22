const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { flavors, BOX_SIZE, BOX_PRICE } = require('./products');
const db = require('./db');
const sms = require('./sms');
const payment = require('./payment');
const sbpBanks = require('./sbp-banks');

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

app.get('/api/sms/status', (_req, res) => {
  res.json({ enabled: sms.isVerificationEnabled() });
});

app.post('/api/sms/send', async (req, res) => {
  if (!sms.isVerificationEnabled()) {
    return res.status(503).json({ error: 'Подтверждение по SMS временно недоступно' });
  }
  try {
    const result = await sms.sendVerificationCode(req.body?.phone, req.ip);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      ok: true,
      displayPhone: result.displayPhone,
      retryAfter: result.retryAfter,
    });
  } catch (err) {
    console.error('[SMS send]', err.message);
    res.status(502).json({ error: 'Не удалось отправить SMS. Попробуйте позже.' });
  }
});

app.post('/api/sms/verify', (req, res) => {
  const result = sms.verifyCode(req.body?.phone, req.body?.code);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json({
    ok: true,
    displayPhone: result.displayPhone,
    verificationToken: result.verificationToken,
  });
});

app.get('/api/payment/banks', async (_req, res) => {
  try {
    const banks = await sbpBanks.getPopularBanks();
    res.json({ banks });
  } catch {
    res.status(500).json({ error: 'Не удалось загрузить список банков' });
  }
});

app.get('/api/payment/status', (_req, res) => {
  const phone = payment.getPaymentPhone();
  res.json({
    enabled: payment.isPaymentEnabled(),
    provider: 'sbp_phone',
    phone,
    phoneDisplay: payment.formatPhoneDisplay(phone),
    recipientName: payment.getRecipientName(),
  });
});

app.patch('/api/orders/:id/payment', requireAdmin, (req, res) => {
  const { paymentStatus } = req.body;
  if (!['pending', 'paid', 'none'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Неверный статус оплаты' });
  }
  const order = db.updateOrderPaymentStatus(Number(req.params.id), paymentStatus);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerComment,
    phoneVerificationToken,
    items,
  } = req.body;

  if (!customerName?.trim() || !customerPhone?.trim() || !customerAddress?.trim()) {
    return res.status(400).json({ error: 'Заполните имя, телефон и адрес доставки' });
  }
  if (sms.isVerificationEnabled() && !sms.consumeVerification(phoneVerificationToken, customerPhone)) {
    return res.status(400).json({ error: 'Подтвердите номер телефона кодом из SMS' });
  }
  if (!items?.length) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  for (const item of items) {
    const error = validateBoxItem(item);
    if (error) return res.status(400).json({ error });
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const normalized = sms.normalizePhone(customerPhone.trim());
  const order = db.createOrder({
    orderNumber: db.generateOrderNumber(),
    customerName: customerName.trim(),
    customerPhone: normalized ? sms.formatPhoneDisplay(normalized) : customerPhone.trim(),
    customerEmail: customerEmail?.trim() || '',
    customerAddress: customerAddress.trim(),
    customerComment: customerComment?.trim() || '',
    items,
    total,
    status: 'awaiting_payment',
    paymentStatus: 'pending',
  });

  const paymentDetails = payment.buildPaymentDetails(order);

  res.status(201).json({
    success: true,
    order,
    payment: paymentDetails,
  });
});

app.get('/api/orders', requireAdmin, (_req, res) => {
  res.json(db.getAllOrders());
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['new', 'awaiting_payment', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }
  const order = db.updateOrderStatus(Number(req.params.id), status);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});

app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const order = db.deleteOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json({ ok: true, deleted: order });
});

app.delete('/api/orders', requireAdmin, (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'DELETE_ALL') {
    return res.status(400).json({ error: 'Для удаления всех заказов передайте confirm: "DELETE_ALL"' });
  }
  const deleted = db.deleteAllOrders();
  res.json({ ok: true, deleted });
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
