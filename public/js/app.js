const CART_KEY = 'motivator_cart';

let flavors = [];
let boxSize = 12;
let boxPrice = 2200;
let selection = {};
let cart = loadCart();

const $ = (sel) => document.querySelector(sel);

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

function formatPrice(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function getSelectedTotal() {
  return Object.values(selection).reduce((sum, qty) => sum + qty, 0);
}

function resetSelection() {
  selection = {};
  flavors.forEach((f) => { selection[f.id] = 0; });
}

async function init() {
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    flavors = data.flavors;
    boxSize = data.boxSize;
    boxPrice = data.boxPrice;
  } catch {
    flavors = [];
  }

  resetSelection();
  renderFlavorsPreview();
  renderPresetTabs();
  renderBoxBuilder();
  updatePackBox();
  updateCartUI();
  bindEvents();
}

function renderFlavorsPreview() {
  const grid = document.getElementById('flavorsPreview');
  if (!grid) return;

  grid.innerHTML = flavors.map((f) => `
    <button type="button" class="flavor-pill" data-flavor-id="${f.id}" style="--dot-color: ${f.color}" aria-label="Перейти к вкусу ${f.name} в упаковке">
      <span class="flavor-pill__photo">
        <img src="${f.image}" alt="" loading="lazy" onerror="this.closest('.flavor-pill__photo').classList.add('flavor-pill__photo--fallback')" style="--dot-color:${f.color}">
      </span>
      <span class="flavor-pill__name">${f.name}</span>
      <span class="flavor-pill__tag">250 ml</span>
    </button>
  `).join('');
}

function renderBoxBuilder() {
  $('#boxPrice').textContent = formatPrice(boxPrice);
  $('#boxSize').textContent = boxSize;

  $('#flavorGrid').innerHTML = flavors.map((f) => `
    <article class="flavor-card ${selection[f.id] > 0 ? 'is-selected' : ''}" data-flavor-id="${f.id}" style="--flavor-color: ${f.color}">
      <div class="flavor-card__photo-wrap" data-action="add" title="Добавить бутылку">
        <img src="${f.image}" alt="${f.name}" class="flavor-card__photo" loading="lazy" onerror="this.closest('.flavor-card__photo-wrap').classList.add('flavor-card__photo-wrap--fallback')" style="--flavor-color:${f.color}">
        ${selection[f.id] > 0 ? `<span class="flavor-card__badge">${selection[f.id]}</span>` : ''}
      </div>
      <div class="flavor-card__top">
        <h3>${f.name}</h3>
      </div>
      <div class="flavor-card__body">
        <p>${f.description}</p>
        <div class="flavor-card__controls">
          <button class="flavor-card__btn" data-action="minus" data-id="${f.id}" ${selection[f.id] === 0 ? 'disabled' : ''}>−</button>
          <span class="flavor-card__qty" id="qty-${f.id}">${selection[f.id] || 0}</span>
          <button class="flavor-card__btn" data-action="plus" data-id="${f.id}" ${getSelectedTotal() >= boxSize ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </article>
  `).join('');

  updateProgress();
}

function getSlotFlavors() {
  const slots = [];
  flavors.forEach((f) => {
    for (let i = 0; i < (selection[f.id] || 0); i++) {
      slots.push(f);
    }
  });
  while (slots.length < boxSize) slots.push(null);
  return slots.slice(0, boxSize);
}

function renderSlotBottle(flavor) {
  return `
    <div class="pack-slot__bottle-wrap">
      <img class="pack-slot__bottle" src="${flavor.image}" alt="${flavor.name}" loading="lazy">
    </div>
  `;
}

function updatePackBox() {
  const slots = getSlotFlavors();
  const total = getSelectedTotal();

  document.querySelectorAll('#packBox .pack-slot').forEach((el, i) => {
    const flavor = slots[i];
    const wasFilled = el.classList.contains('filled');
    el.classList.toggle('filled', !!flavor);
    if (flavor) {
      el.style.setProperty('--slot-color', flavor.color);
      el.innerHTML = renderSlotBottle(flavor);
    } else {
      el.style.removeProperty('--slot-color');
      el.innerHTML = '';
    }
    if (flavor && !wasFilled) {
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = '';
    }
  });

  const hint = document.getElementById('packHint');
  if (hint) {
    hint.textContent = total === boxSize
      ? 'Упаковка собрана — можно добавить в корзину'
      : `Выберите ещё ${boxSize - total} бутылок`;
    hint.classList.toggle('complete', total === boxSize);
  }

  document.getElementById('packBox')?.classList.toggle('pack-box--complete', total === boxSize);
}

function updateProgress() {
  const total = getSelectedTotal();
  const remaining = boxSize - total;

  $('#selectedCount').textContent = total;
  $('#progressFill').style.width = `${(total / boxSize) * 100}%`;
  $('#progressFill').classList.toggle('complete', total === boxSize);

  const addBtn = $('#addBoxBtn');
  addBtn.disabled = total !== boxSize;
  addBtn.textContent = total === boxSize
    ? `Добавить упаковку в корзину — ${formatPrice(boxPrice)}`
    : `Осталось выбрать: ${remaining} шт`;

  flavors.forEach((f) => {
    const minusBtn = document.querySelector(`[data-action="minus"][data-id="${f.id}"]`);
    const plusBtn = document.querySelector(`[data-action="plus"][data-id="${f.id}"]`);
    const qtyEl = document.getElementById(`qty-${f.id}`);
    const flavorCard = qtyEl?.closest('.flavor-card');

    if (qtyEl) qtyEl.textContent = selection[f.id] || 0;
    if (minusBtn) minusBtn.disabled = !selection[f.id];
    if (plusBtn) plusBtn.disabled = total >= boxSize;
    if (flavorCard) {
      flavorCard.classList.toggle('is-selected', selection[f.id] > 0);
      const badge = flavorCard.querySelector('.flavor-card__badge');
      if (selection[f.id] > 0) {
        if (badge) badge.textContent = selection[f.id];
        else {
          const wrap = flavorCard.querySelector('.flavor-card__photo-wrap');
          if (wrap) wrap.insertAdjacentHTML('beforeend', `<span class="flavor-card__badge">${selection[f.id]}</span>`);
        }
      } else if (badge) {
        badge.remove();
      }
    }
  });

  updatePackBox();
  renderPresetTabs();
}

function renderPresetTabs() {
  const wrap = document.getElementById('boxPresets');
  if (!wrap) return;

  const active = detectActivePreset();

  wrap.innerHTML = `
    <button type="button" class="box-preset-btn${active === 'assortment' ? ' is-active' : ''}" data-preset="assortment">
      Ассорти · по 2
    </button>
    ${flavors.map((f) => `
      <button
        type="button"
        class="box-preset-btn${active === f.id ? ' is-active' : ''}"
        data-preset="${f.id}"
        style="--preset-color: ${f.color}"
      >${f.name} · 12</button>
    `).join('')}
  `;
}

function detectActivePreset() {
  const total = getSelectedTotal();
  if (total !== boxSize) return null;

  const filled = flavors.filter((f) => selection[f.id] > 0);
  if (filled.length === 1 && selection[filled[0].id] === boxSize) {
    return filled[0].id;
  }
  if (filled.length === flavors.length && flavors.every((f) => selection[f.id] === 2)) {
    return 'assortment';
  }
  return null;
}

function changeFlavor(id, delta) {
  const total = getSelectedTotal();
  if (delta > 0 && total >= boxSize) return;
  if (delta < 0 && !selection[id]) return;

  selection[id] = Math.max(0, (selection[id] || 0) + delta);
  updateProgress();
}

function scrollToFlavorInBuilder(id) {
  const catalog = document.getElementById('catalog');
  if (catalog) {
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.setTimeout(() => {
    const card = document.querySelector(`.flavor-card[data-flavor-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-highlighted');
    window.setTimeout(() => card.classList.remove('is-highlighted'), 1400);
  }, 350);
}

function applyAssortmentPreset() {
  resetSelection();
  flavors.forEach((f) => { selection[f.id] = 2; });
  renderBoxBuilder();
}

function applyFlavorPreset(id) {
  if (!flavors.some((f) => f.id === id)) return;
  resetSelection();
  selection[id] = boxSize;
  renderBoxBuilder();
}

function getCurrentBoxFlavors() {
  return flavors
    .filter((f) => selection[f.id] > 0)
    .map((f) => ({ id: f.id, name: f.name, emoji: f.emoji, quantity: selection[f.id] }));
}

function flavorsMatch(a, b) {
  if (a.length !== b.length) return false;
  const mapB = Object.fromEntries(b.map((f) => [f.id, f.quantity]));
  return a.every((f) => mapB[f.id] === f.quantity);
}

function formatFlavorsList(flavorsList) {
  return flavorsList.map((f) => `${f.name} × ${f.quantity}`).join(', ');
}

function addBoxToCart() {
  if (getSelectedTotal() !== boxSize) return;

  const boxFlavors = getCurrentBoxFlavors();
  const existing = cart.find((item) => flavorsMatch(item.flavors, boxFlavors));

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      cartId: `box-${Date.now()}`,
      type: 'box',
      name: 'Упаковка 12 шт',
      price: boxPrice,
      quantity: 1,
      flavors: boxFlavors,
    });
  }

  saveCart();
  resetSelection();
  renderBoxBuilder();
  if (window.pulseCartButton) window.pulseCartButton();
  openCart();
}

function updateCartQuantity(cartId, delta) {
  const item = cart.find((i) => i.cartId === cartId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((i) => i.cartId !== cartId);
  }
  saveCart();
}

function updateCartUI() {
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  $('#cartCount').textContent = count;
  $('#cartTotal').textContent = formatPrice(total);

  const container = $('#cartItems');
  if (!cart.length) {
    container.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
    return;
  }

  container.innerHTML = cart.map((item) => `
    <div class="cart-item cart-item--box">
      <div class="cart-item__icon">📦</div>
      <div class="cart-item__info">
        <div class="cart-item__name">${item.name}</div>
        <div class="cart-item__flavors">${formatFlavorsList(item.flavors)}</div>
        <div class="cart-item__price">${formatPrice(item.price)}</div>
      </div>
      <div class="cart-item__qty">
        <button data-action="minus" data-id="${item.cartId}">−</button>
        <span>${item.quantity}</span>
        <button data-action="plus" data-id="${item.cartId}">+</button>
      </div>
    </div>
  `).join('');
}

function openCart() {
  $('#cartSidebar').classList.add('active');
  $('#overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $('#cartSidebar').classList.remove('active');
  $('#overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function openCheckout() {
  if (!cart.length) return;
  closeCart();

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  $('#checkoutSummary').innerHTML = `
    ${cart.map((i) => `
      <div class="checkout-summary__row">
        <span>${i.name} × ${i.quantity}</span>
        <span>${formatPrice(i.price * i.quantity)}</span>
      </div>
      <div class="checkout-summary__flavors">${formatFlavorsList(i.flavors)}</div>
    `).join('')}
    <div class="checkout-summary__total">
      <span>Итого</span>
      <span>${formatPrice(total)}</span>
    </div>
  `;

  $('#checkoutModal').classList.add('active');
}

function closeCheckout() {
  $('#checkoutModal').classList.remove('active');
}

async function submitOrder(e) {
  e.preventDefault();
  const btn = $('#submitOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  const data = {
    customerName: $('#name').value,
    customerPhone: $('#phone').value,
    customerEmail: $('#email').value,
    customerAddress: $('#address').value,
    customerComment: $('#comment').value,
    items: cart,
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    closeCheckout();
    $('#orderNumber').textContent = result.order.orderNumber;
    $('#successModal').classList.add('active');
    $('#checkoutForm').reset();
    cart = [];
    saveCart();
  } catch (err) {
    alert(err.message || 'Ошибка при оформлении заказа');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Подтвердить заказ';
  }
}

function bindEvents() {
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);
  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#checkoutClose').addEventListener('click', closeCheckout);
  $('#checkoutForm').addEventListener('submit', submitOrder);
  $('#addBoxBtn').addEventListener('click', addBoxToCart);

  $('#boxPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('.box-preset-btn');
    if (!btn) return;
    if (btn.dataset.preset === 'assortment') applyAssortmentPreset();
    else applyFlavorPreset(btn.dataset.preset);
  });

  $('#flavorsPreview').addEventListener('click', (e) => {
    const pill = e.target.closest('.flavor-pill[data-flavor-id]');
    if (!pill) return;
    scrollToFlavorInBuilder(pill.dataset.flavorId);
  });

  $('#successClose').addEventListener('click', () => {
    $('#successModal').classList.remove('active');
  });

  $('#flavorGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.flavor-card__btn');
    if (btn) {
      changeFlavor(btn.dataset.id, btn.dataset.action === 'plus' ? 1 : -1);
      return;
    }

    const photoWrap = e.target.closest('.flavor-card__photo-wrap[data-action="add"]');
    if (photoWrap) {
      const card = photoWrap.closest('.flavor-card');
      if (card) changeFlavor(card.dataset.flavorId, 1);
    }
  });

  $('#cartItems').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    updateCartQuantity(btn.dataset.id, btn.dataset.action === 'plus' ? 1 : -1);
  });

  $('#burger').addEventListener('click', () => {
    $('.nav').classList.toggle('open');
  });

  document.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => $('.nav').classList.remove('open'));
  });
}

document.addEventListener('DOMContentLoaded', init);
