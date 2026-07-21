const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ordersFile = path.join(dataDir, 'orders.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, '[]', 'utf8');

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
}

function createOrder(data) {
  const orders = readOrders();
  const order = {
    id: orders.length ? Math.max(...orders.map((o) => o.id)) + 1 : 1,
    orderNumber: data.orderNumber,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail || '',
    customerAddress: data.customerAddress,
    customerComment: data.customerComment || '',
    items: data.items,
    total: data.total,
    status: data.status || 'new',
    paymentStatus: data.paymentStatus || 'none',
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  writeOrders(orders);
  return order;
}

function getOrderById(id) {
  return readOrders().find((o) => o.id === id) || null;
}

function getAllOrders() {
  return readOrders();
}

function updateOrderStatus(id, status) {
  const orders = readOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) return null;
  orders[index].status = status;
  writeOrders(orders);
  return orders[index];
}

function markOrderPaidByNumber(orderNumber) {
  const orders = readOrders();
  const index = orders.findIndex((o) => o.orderNumber === orderNumber);
  if (index === -1) return null;
  orders[index].paymentStatus = 'paid';
  if (orders[index].status === 'awaiting_payment') {
    orders[index].status = 'new';
  }
  writeOrders(orders);
  return orders[index];
}

function updateOrderPaymentStatus(id, paymentStatus) {
  const orders = readOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) return null;
  orders[index].paymentStatus = paymentStatus;
  if (paymentStatus === 'paid' && orders[index].status === 'awaiting_payment') {
    orders[index].status = 'new';
  }
  writeOrders(orders);
  return orders[index];
}

function generateOrderNumber() {
  const prefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = readOrders().filter((o) => o.orderNumber.startsWith(prefix)).length;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

module.exports = {
  createOrder,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  updateOrderPaymentStatus,
  markOrderPaidByNumber,
  generateOrderNumber,
};
