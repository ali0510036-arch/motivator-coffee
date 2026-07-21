const TOKEN_KEY = 'motivator_admin_token';

let orders = [];
let currentFilter = 'all';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STATUS_LABELS = {
  new: 'Новый',
  processing: 'В обработке',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
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
  $('#loginScreen').hidden = true;
  $('#adminPanel').hidden = false;
  loadOrders();
}

function showLogin() {
  localStorage.removeItem(TOKEN_KEY);
  $('#loginScreen').hidden = false;
  $('#adminPanel').hidden = true;
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
    showLogin();
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
        <span class="order-card__status status-${o.status}">${STATUS_LABELS[o.status]}</span>
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
        <select data-id="${o.id}" class="status-select">
          ${Object.entries(STATUS_LABELS).map(([val, label]) =>
            `<option value="${val}" ${o.status === val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `).join('');
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

function bindEvents() {
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const token = $('#adminToken').value.trim();
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
    showPanel();
  });

  $('#logoutBtn').addEventListener('click', showLogin);
  $('#refreshBtn').addEventListener('click', loadOrders);

  $$('.admin-filters .filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.admin-filters .filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      renderOrders();
    });
  });

  $('#ordersList').addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
      updateStatus(e.target.dataset.id, e.target.value);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (getToken()) showPanel();
});
