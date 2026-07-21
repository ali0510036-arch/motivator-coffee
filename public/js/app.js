const CART_KEY = 'motivator_cart';

let flavors = [];
let boxSize = 12;
let boxPrice = 2200;
let selection = {};
let boxMode = 'assortment';
let singleFlavorId = null;
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
  setBoxMode('assortment');
  renderFlavorsPreview();
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
  const priceEl = $('#boxPrice');
  if (priceEl) priceEl.textContent = formatPrice(boxPrice);
  renderModePicker();
  renderBuilderSide();
}

function renderModePicker() {
  const wrap = document.getElementById('boxModePicker');
  if (!wrap) return;

  const assortmentVisual = flavors.map((f) => `
    <span class="box-mode-card__mini" style="--flavor-color:${f.color}" title="${f.name}">
      <img src="${f.image}" alt="">
      <span class="box-mode-card__mini-qty">×2</span>
    </span>
  `).join('');

  const singleVisual = singleFlavorId
    ? (() => {
        const f = flavors.find((fl) => fl.id === singleFlavorId);
        return f ? `<span class="box-mode-card__single-preview" style="--flavor-color:${f.color}"><img src="${f.image}" alt=""><span>×12</span></span>` : '<span class="box-mode-card__single-placeholder">6 вкусов</span>';
      })()
    : '<span class="box-mode-card__single-placeholder">6 вкусов</span>';

  wrap.innerHTML = `
    <button type="button" class="box-mode-card${boxMode === 'assortment' ? ' is-active' : ''}" data-mode="assortment">
      <span class="box-mode-card__eyebrow">Рекомендуем</span>
      <span class="box-mode-card__title">Ассорти</span>
      <span class="box-mode-card__desc">Все 6 вкусов · по 2 бутылки</span>
      <span class="box-mode-card__visual">${assortmentVisual}</span>
    </button>
    <button type="button" class="box-mode-card${boxMode === 'single' ? ' is-active' : ''}" data-mode="single">
      <span class="box-mode-card__eyebrow">Моновкус</span>
      <span class="box-mode-card__title">Один вкус</span>
      <span class="box-mode-card__desc">12 бутылок одного вкуса</span>
      <span class="box-mode-card__visual box-mode-card__visual--single">${singleVisual}</span>
    </button>
  `;
}

function renderBuilderSide() {
  const side = document.getElementById('boxBuilderSide');
  if (!side) return;

  if (boxMode === 'assortment') {
    side.innerHTML = `
      <div class="box-side-summary">
        <p class="box-side-summary__label">Состав ассорти</p>
        <ul class="box-side-summary__list">
          ${flavors.map((f) => `
            <li class="box-side-summary__item" style="--flavor-color:${f.color}">
              <img src="${f.image}" alt="">
              <span class="box-side-summary__name">${f.name}</span>
              <span class="box-side-summary__qty">×2</span>
            </li>
          `).join('')}
        </ul>
        <p class="box-side-summary__note">Идеально, чтобы попробовать всю линейку MOTIVATOR</p>
      </div>
    `;
    return;
  }

  side.innerHTML = `
    <div class="box-single-picker">
      <p class="box-single-picker__label">Выберите вкус · 12 бутылок</p>
      <div class="box-single-picker__grid">
        ${flavors.map((f) => `
          <button
            type="button"
            class="flavor-pick-card${singleFlavorId === f.id ? ' is-selected' : ''}"
            data-flavor-id="${f.id}"
            style="--flavor-color:${f.color}"
            aria-pressed="${singleFlavorId === f.id}"
          >
            <span class="flavor-pick-card__photo">
              <img src="${f.image}" alt="" loading="lazy">
            </span>
            <span class="flavor-pick-card__name">${f.name}</span>
            <span class="flavor-pick-card__qty">12 шт</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
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
    if (total === boxSize) {
      hint.textContent = boxMode === 'assortment'
        ? 'Ассорти собрано — можно добавить в корзину'
        : 'Упаковка собрана — можно добавить в корзину';
    } else if (boxMode === 'single') {
      hint.textContent = 'Выберите вкус справа';
    } else {
      hint.textContent = 'Выберите тип упаковки';
    }
    hint.classList.toggle('complete', total === boxSize);
  }

  document.getElementById('packBox')?.classList.toggle('pack-box--complete', total === boxSize);
}

function updateProgress() {
  const total = getSelectedTotal();
  const ready = total === boxSize;

  const addBtn = $('#addBoxBtn');
  if (addBtn) {
    addBtn.disabled = !ready;
    addBtn.textContent = ready
      ? `Добавить упаковку в корзину — ${formatPrice(boxPrice)}`
      : (boxMode === 'single' ? 'Выберите вкус для упаковки' : 'Соберите упаковку');
  }

  updatePackBox();
  renderModePicker();
  renderBuilderSide();
}

function setBoxMode(mode) {
  boxMode = mode;
  if (mode === 'assortment') {
    singleFlavorId = null;
    applyAssortmentPreset();
    return;
  }

  resetSelection();
  if (singleFlavorId) applyFlavorPreset(singleFlavorId);
  else updateProgress();
}

function selectSingleFlavor(id) {
  if (!flavors.some((f) => f.id === id)) return;
  boxMode = 'single';
  singleFlavorId = id;
  applyFlavorPreset(id);
}

function scrollToFlavorInBuilder(id) {
  setBoxMode('single');
  selectSingleFlavor(id);

  const catalog = document.getElementById('catalog');
  if (catalog) {
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.setTimeout(() => {
    const card = document.querySelector(`.flavor-pick-card[data-flavor-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-highlighted');
    window.setTimeout(() => card.classList.remove('is-highlighted'), 1400);
  }, 350);
}

function applyAssortmentPreset() {
  resetSelection();
  flavors.forEach((f) => { selection[f.id] = 2; });
  updateProgress();
}

function applyFlavorPreset(id) {
  if (!flavors.some((f) => f.id === id)) return;
  resetSelection();
  selection[id] = boxSize;
  updateProgress();
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
  setBoxMode('assortment');
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

  $('#boxModePicker').addEventListener('click', (e) => {
    const card = e.target.closest('.box-mode-card[data-mode]');
    if (!card) return;
    setBoxMode(card.dataset.mode);
  });

  $('#boxBuilderSide').addEventListener('click', (e) => {
    const pick = e.target.closest('.flavor-pick-card[data-flavor-id]');
    if (!pick) return;
    selectSingleFlavor(pick.dataset.flavorId);
  });

  $('#flavorsPreview').addEventListener('click', (e) => {
    const pill = e.target.closest('.flavor-pill[data-flavor-id]');
    if (!pill) return;
    scrollToFlavorInBuilder(pill.dataset.flavorId);
  });

  $('#successClose').addEventListener('click', () => {
    $('#successModal').classList.remove('active');
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
