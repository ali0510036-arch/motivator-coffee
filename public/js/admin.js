const TOKEN_KEY = 'motivator_admin_token';

let orders = [];
let currentFilter = 'all';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STATUS_LABELS = {
  awaiting_payment: 'Ждёт оплаты',
  new: 'Новый',
  processing: 'В обработке',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const PAYMENT_LABELS = {
  pending: 'Не оплачен',
  paid: 'Оплачен',
  none: '—',
};

function formatPrice(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function formatDate(iso) {
  return new Date(iso + 'Z').toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function showPanel() {
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  login.hidden = true;
  login.classList.add('is-hidden');
  panel.hidden = false;
  panel.classList.remove('is-hidden');
  const err = $('#loginError');
  if (err) err.hidden = true;
  loadOrders();
}

function showLogin(message = '') {
  localStorage.removeItem(TOKEN_KEY);
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  login.hidden = false;
  login.classList.remove('is-hidden');
  panel.hidden = true;
  panel.classList.add('is-hidden');
  const err = $('#loginError');
  if (err) {
    if (message) {
      err.textContent = message;
      err.hidden = false;
    } else {
      err.hidden = true;
      err.textContent = '';
    }
  }
}

async function verifyToken(token) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return res.ok;
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401) {
    showLogin('Неверный токен. Проверьте ADMIN_TOKEN на сервере.');
    throw new Error('Неверный токен');
  }
  return res;
}

async function loadOrders() {
  try {
    const res = await apiFetch('/api/orders');
    orders = await res.json();
    renderStats();
    renderOrders();
  } catch (err) {
    if (err.message !== 'Неверный токен') {
      $('#ordersList').innerHTML = '<p class="admin-empty">Ошибка загрузки заказов</p>';
    }
  }
}

function renderStats() {
  const stats = {
    total: orders.length,
    new: orders.filter((o) => o.status === 'new').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    revenue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
  };

  $('#adminStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-card__value">${stats.total}</div>
      <div class="stat-card__label">Всего заказов</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${stats.new}</div>
      <div class="stat-card__label">Новые</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${stats.processing}</div>
      <div class="stat-card__label">В обработке</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatPrice(stats.revenue)}</div>
      <div class="stat-card__label">Выручка</div>
    </div>
  `;
}

function renderOrders() {
  const filtered = currentFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === currentFilter);

  if (!filtered.length) {
    $('#ordersList').innerHTML = '<p class="admin-empty">Заказов пока нет</p>';
    return;
  }

  $('#ordersList').innerHTML = filtered.map((o) => `
    <div class="order-card">
      <div class="order-card__header">
        <div>
          <span class="order-card__number">#${o.orderNumber}</span>
          <span class="order-card__date">${formatDate(o.createdAt)}</span>
        </div>
        <span class="order-card__status status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
        ${o.paymentStatus && o.paymentStatus !== 'none' ? `<span class="order-card__payment status-payment-${o.paymentStatus}">${PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus}</span>` : ''}
      </div>
      <div class="order-card__customer">
        <div class="order-card__field">
          <label>Имя</label>
          <p>${o.customerName}</p>
        </div>
        <div class="order-card__field">
          <label>Телефон</label>
          <p><a href="tel:${o.customerPhone}">${o.customerPhone}</a></p>
        </div>
        <div class="order-card__field">
          <label>Email</label>
          <p>${o.customerEmail || '—'}</p>
        </div>
        <div class="order-card__field">
          <label>Адрес</label>
          <p>${o.customerAddress}</p>
        </div>
      </div>
      ${o.customerComment ? `<div class="order-card__field" style="margin-bottom:12px"><label>Комментарий</label><p>${o.customerComment}</p></div>` : ''}
      <div class="order-card__items">
        ${o.items.map((i) => `
          <div class="order-card__item order-card__item--box">
            <div>
              <strong>${i.name} × ${i.quantity}</strong>
              ${i.flavors ? `<div class="order-card__flavors">${i.flavors.map((f) => `${f.name} × ${f.quantity}`).join(', ')}</div>` : ''}
            </div>
            <span>${formatPrice(i.price * i.quantity)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-card__total">Итого: ${formatPrice(o.total)}</div>
      <div class="order-card__actions">
        ${o.paymentStatus === 'pending' ? `<button type="button" class="btn btn--ghost btn--sm mark-paid-btn" data-id="${o.id}">Отметить оплаченным</button>` : ''}
        <select data-id="${o.id}" class="status-select">
          ${Object.entries(STATUS_LABELS).map(([val, label]) =>
            `<option value="${val}" ${o.status === val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <button type="button" class="btn btn--ghost btn--sm btn--danger-ghost delete-order-btn" data-id="${o.id}" data-number="${o.orderNumber}">Удалить</button>
      </div>
    </div>
  `).join('');
}

async function markOrderPaid(orderId) {
  try {
    await apiFetch(`/api/orders/${orderId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus: 'paid' }),
    });
    await loadOrders();
  } catch {
    alert('Ошибка обновления оплаты');
  }
}

async function updateStatus(orderId, status) {
  try {
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadOrders();
  } catch {
    alert('Ошибка обновления статуса');
  }
}

async function deleteOrder(orderId, orderNumber) {
  const label = orderNumber ? `#${orderNumber}` : `ID ${orderId}`;
  if (!confirm(`Удалить заказ ${label}? Это действие необратимо.`)) return;

  try {
    const res = await apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Ошибка удаления');
    }
    await loadOrders();
  } catch (err) {
    alert(err.message || 'Ошибка удаления заказа');
  }
}

async function clearAllOrders() {
  if (!orders.length) {
    alert('Список заказов уже пуст');
    return;
  }
  if (!confirm(`Удалить все ${orders.length} заказов? Это необратимо.`)) return;
  if (prompt('Введите УДАЛИТЬ для подтверждения') !== 'УДАЛИТЬ') return;

  try {
    const res = await apiFetch('/api/orders', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE_ALL' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Ошибка очистки');
    }
    await loadOrders();
  } catch (err) {
    alert(err.message || 'Ошибка очистки заказов');
  }
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('#adminToken').value.trim();
    if (!token) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const err = $('#loginError');
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Проверка…';

    try {
      const ok = await verifyToken(token);
      if (!ok) {
        showLogin('Неверный токен. На сервере: grep ADMIN_TOKEN /var/www/motivator-coffee/.env');
        return;
      }
      localStorage.setItem(TOKEN_KEY, token);
      showPanel();
    } catch {
      showLogin('Не удалось подключиться к серверу. Обновите страницу.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });

  $('#logoutBtn').addEventListener('click', showLogin);
  $('#refreshBtn').addEventListener('click', loadOrders);
  $('#clearAllBtn').addEventListener('click', clearAllOrders);

  $$('.admin-filters .filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.admin-filters .filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      renderOrders();
    });
  });

  $('#ordersList').addEventListener('click', (e) => {
    if (e.target.classList.contains('mark-paid-btn')) {
      markOrderPaid(Number(e.target.dataset.id));
      return;
    }
    if (e.target.classList.contains('delete-order-btn')) {
      deleteOrder(Number(e.target.dataset.id), e.target.dataset.number);
    }
  });

  $('#ordersList').addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
      updateStatus(e.target.dataset.id, e.target.value);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  const saved = getToken();
  if (saved) {
    try {
      if (await verifyToken(saved)) showPanel();
      else showLogin('Сессия истекла. Введите токен снова.');
    } catch {
      showLogin();
    }
  }
});
