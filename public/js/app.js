const CART_KEY = 'motivator_cart';

let flavors = [];
let boxSize = 12;
let boxPrice = 2200;
let selection = {};
let boxMode = 'assortment';
let singleFlavorId = null;
let phoneVerificationToken = null;
let phoneVerified = false;
let smsVerificationEnabled = false;
const PAYMENT_DEFAULTS = {
  phone: '79894840069',
  phoneDisplay: '+7 (989) 484-00-69',
  recipientName: 'Магомедов Халил Умарасхабович',
};

let paymentConfig = { ...PAYMENT_DEFAULTS };
let currentPaymentInfo = null;
let paymentBanks = [];
let smsCooldownTimer = null;
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

function getPhoneDigits() {
  const el = $('#phone');
  if (!el) return '';
  return el.value.replace(/\D/g, '').slice(0, 10);
}

function formatPhoneLocal(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (!d.length) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 8) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

function getFullPhone() {
  const digits = getPhoneDigits();
  return digits.length === 10 ? `+7${digits}` : '';
}

function bindPhoneInput() {
  const input = $('#phone');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';

  input.addEventListener('input', () => {
    const formatted = formatPhoneLocal(input.value);
    if (input.value !== formatted) input.value = formatted;

    if (smsVerificationEnabled && (phoneVerified || phoneVerificationToken)) {
      phoneVerified = false;
      phoneVerificationToken = null;
      input.readOnly = false;
    }
    updateSubmitButtonState();
  });
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
  bindPhoneInput();
  loadSmsStatus();
  loadPaymentStatus();
}

async function loadPaymentStatus() {
  try {
    const res = await fetch('/api/payment/status');
    const data = await res.json();
    paymentConfig = {
      phone: data.phone || PAYMENT_DEFAULTS.phone,
      phoneDisplay: data.phoneDisplay || PAYMENT_DEFAULTS.phoneDisplay,
      recipientName: data.recipientName || PAYMENT_DEFAULTS.recipientName,
    };
  } catch {
    paymentConfig = { ...PAYMENT_DEFAULTS };
  }
}

function buildLocalPaymentDetails(order) {
  const phone = paymentConfig.phone || PAYMENT_DEFAULTS.phone;
  const recipientName = paymentConfig.recipientName || PAYMENT_DEFAULTS.recipientName;
  const phoneDisplay = paymentConfig.phoneDisplay || PAYMENT_DEFAULTS.phoneDisplay;
  const amount = Number(order.total);
  const comment = `Заказ MOTIVATOR ${order.orderNumber}`;

  return {
    recipientName,
    phone,
    phoneDisplay,
    amount,
    amountFormatted: `${amount.toLocaleString('ru-RU')} ₽`,
    comment,
    sbpLink: buildBankTransferLink('100000000111', phone, amount),
    transferLinks: null,
    instruction: 'Выберите свой банк для перевода через СБП.',
  };
}

function buildBankTransferLink(bankId, phone, amount) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  const amountStr = Number(amount).toFixed(2);
  const normalizedId = bankId === '100000000005' ? '110000000005' : bankId;

  if (normalizedId === '100000000111') {
    return `https://www.sberbank.com/sms/pbpn?${new URLSearchParams({
      requisiteNumber: digits,
      amount: amountStr,
    }).toString()}`;
  }

  return `https://t.tb.ru/c2c-qr-choose-bank?${new URLSearchParams({
    requisiteNumber: `+${digits}`,
    bankCode: normalizedId,
    amount: amountStr,
  }).toString()}`;
}

function normalizeBankList(banks) {
  const list = Array.isArray(banks) ? [...banks] : [];
  const hasVtb = list.some((bank) => bank.id === '110000000005' || bank.schema === 'bank110000000005');
  if (hasVtb) return list;

  const vtb = FALLBACK_PAYMENT_BANKS.find((bank) => bank.id === '110000000005');
  if (!vtb) return list;

  const tbankIndex = list.findIndex((bank) => bank.id === '100000000004');
  list.splice(tbankIndex >= 0 ? tbankIndex + 1 : 2, 0, vtb);
  return list;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const prev = button.textContent;
      button.textContent = 'Скопировано';
      window.setTimeout(() => { button.textContent = prev; }, 1500);
    }
    return true;
  } catch {
    window.prompt('Скопируйте:', text);
    return false;
  }
}

function showPayCopyStatus(message) {
  let status = $('#payCopyStatus');
  if (!status) {
    status = document.createElement('p');
    status.id = 'payCopyStatus';
    status.className = 'payment-details__status';
    status.setAttribute('role', 'status');
    const bankBtn = $('#payChooseBank');
    if (bankBtn?.parentElement) {
      bankBtn.parentElement.insertBefore(status, bankBtn);
    }
  }
  status.textContent = message;
  status.removeAttribute('hidden');
}

const FALLBACK_PAYMENT_BANKS = [
  { id: '100000000111', name: 'Сбербанк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000111.png', schema: 'bank100000000111', packageName: 'ru.sberbankmobile' },
  { id: '100000000004', name: 'Т-Банк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000004.png', schema: 'bank100000000004', packageName: 'com.idamob.tinkoff.android' },
  { id: '110000000005', name: 'Банк ВТБ', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000005.png', schema: 'bank110000000005', packageName: 'ru.vtb24.mobilebanking.android', webClientUrl: 'https://online.vtb.ru/i/paymentSbp' },
  { id: '100000000008', name: 'АЛЬФА-БАНК', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000008.png', schema: 'bank100000000008', packageName: 'ru.alfabank.mobile.android' },
];

async function ensurePaymentBanks() {
  if (paymentBanks.length) return paymentBanks;
  try {
    const res = await fetch('/api/payment/banks');
    const data = await res.json();
    paymentBanks = normalizeBankList(data.banks?.length ? data.banks : FALLBACK_PAYMENT_BANKS);
  } catch {
    paymentBanks = normalizeBankList(FALLBACK_PAYMENT_BANKS);
  }
  return paymentBanks;
}

function closeBankPicker() {
  const modal = $('#bankPickerModal');
  if (modal) modal.classList.remove('active');
  const search = $('#bankSearch');
  if (search) search.value = '';
}

function renderBankPickerList(banks, query = '') {
  const list = $('#bankPickerList');
  if (!list) return;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? banks.filter((bank) => bank.name.toLowerCase().includes(q))
    : banks;

  if (!filtered.length) {
    list.innerHTML = '<p class="bank-picker__empty">Банк не найден</p>';
    return;
  }

  list.innerHTML = filtered.map((bank) => `
    <button type="button" class="bank-picker__item" data-bank-id="${bank.id}">
      <img class="bank-picker__logo" src="${bank.logo || ''}" alt="" loading="lazy" onerror="this.hidden=true">
      <span class="bank-picker__name">${bank.name}</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-bank-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bank = banks.find((item) => item.id === btn.dataset.bankId);
      if (bank && currentPaymentInfo) selectPaymentBank(bank, currentPaymentInfo);
    });
  });
}

async function openBankPicker(payment) {
  currentPaymentInfo = payment;
  const banks = await ensurePaymentBanks();
  renderBankPickerList(banks);
  $('#bankPickerModal')?.classList.add('active');
  $('#bankSearch')?.focus();
}

function resolveBankTransferLink(bank, payment) {
  const bankId = bank.id === '100000000005' ? '110000000005' : bank.id;
  const fromOrder = payment.transferLinks?.[bankId] || payment.transferLinks?.[bank.id];
  if (fromOrder) return fromOrder;

  if (bankId === '100000000111' && payment.sbpLink) return payment.sbpLink;

  return buildBankTransferLink(bankId, payment.phone, payment.amount);
}

function openTransferLink(url) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function selectPaymentBank(bank, payment) {
  await copyText(payment.comment);
  closeBankPicker();

  const transferLink = resolveBankTransferLink(bank, payment);
  if (transferLink) {
    showPayCopyStatus('Комментарий скопирован — вставьте его в поле «Сообщение» или «Назначение»');
    openTransferLink(transferLink);
    return;
  }

  showPayCopyStatus(
    `Комментарий скопирован. В ${bank.name}: Платежи → Перевод по телефону → ${payment.phoneDisplay}, сумма ${payment.amountFormatted}`,
  );

  const schema = bank.schema;
  if (!schema) return;

  const isAndroid = /Android/i.test(navigator.userAgent);
  const url = isAndroid && bank.packageName
    ? `intent://#Intent;scheme=${schema};package=${bank.packageName};end`
    : `${schema}://`;

  window.setTimeout(() => {
    window.location.href = url;
  }, 350);
}

function bindPaymentActions(payment) {
  currentPaymentInfo = payment;

  const commentCopy = $('#payCommentCopy');
  if (commentCopy) {
    commentCopy.onclick = () => copyText(payment.comment, commentCopy);
  }

  const phoneCopy = $('#payPhoneCopy');
  if (phoneCopy) {
    phoneCopy.onclick = () => copyText(payment.phone, phoneCopy);
  }

  const amountCopy = $('#payAmountCopy');
  if (amountCopy) {
    amountCopy.onclick = () => copyText(String(payment.amount), amountCopy);
  }

  const bankBtn = $('#payChooseBank');
  if (bankBtn) {
    bankBtn.onclick = (e) => {
      e.preventDefault();
      openBankPicker(payment);
    };
  }
}

function ensurePaymentDetailsBlock() {
  let details = $('#paymentDetails');
  if (details) return details;

  const modal = $('#successModal')?.querySelector('.modal__content');
  if (!modal) return null;

  details = document.createElement('div');
  details.className = 'payment-details';
  details.id = 'paymentDetails';
  details.innerHTML = `
    <p class="payment-details__title">Реквизиты для оплаты</p>
    <dl class="payment-details__list">
      <div class="payment-details__row">
        <dt>Получатель</dt>
        <dd id="payRecipient"></dd>
      </div>
      <div class="payment-details__row">
        <dt>Телефон</dt>
        <dd>
          <span id="payPhone"></span>
          <button type="button" class="payment-details__copy" id="payPhoneCopy">Копировать</button>
        </dd>
      </div>
      <div class="payment-details__row">
        <dt>Сумма</dt>
        <dd>
          <span id="payAmount"></span>
          <button type="button" class="payment-details__copy" id="payAmountCopy">Копировать</button>
        </dd>
      </div>
      <div class="payment-details__row">
        <dt>Комментарий</dt>
        <dd>
          <span id="payComment"></span>
          <button type="button" class="payment-details__copy" id="payCommentCopy">Копировать</button>
        </dd>
      </div>
    </dl>
    <p class="payment-details__status" id="payCopyStatus" hidden></p>
    <button type="button" class="btn btn--primary btn--full" id="payChooseBank">Выбрать банк для перевода</button>
    <p class="payment-details__hint">Выберите свой банк — откроется приложение для перевода по СБП.</p>
  `;

  const closeBtn = $('#successClose');
  if (closeBtn) modal.insertBefore(details, closeBtn);
  else modal.appendChild(details);

  return details;
}

function showPaymentInstructions(payment, orderNumber) {
  $('#orderNumber').textContent = orderNumber;
  $('#successNote').textContent = payment.instruction;

  const details = ensurePaymentDetailsBlock();
  if (details) {
    $('#payRecipient').textContent = payment.recipientName;
    $('#payPhone').textContent = payment.phoneDisplay;
    $('#payAmount').textContent = payment.amountFormatted;
    $('#payComment').textContent = payment.comment;

    bindPaymentActions(payment);
    details.removeAttribute('hidden');

    const status = $('#payCopyStatus');
    if (status) {
      status.textContent = '';
      status.setAttribute('hidden', '');
    }
  }

  $('#successModal').classList.add('active');
}

function hidePaymentInstructions() {
  const details = $('#paymentDetails');
  if (details) details.setAttribute('hidden', '');
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

function resetPhoneVerification() {
  phoneVerificationToken = null;
  phoneVerified = false;
  const codeRow = $('#phoneCodeRow');
  const codeInput = $('#phoneCode');
  const status = $('#phoneVerifyStatus');
  const sendBtn = $('#sendSmsBtn');
  const submitBtn = $('#submitOrderBtn');
  if (codeRow) codeRow.hidden = true;
  if (codeInput) codeInput.value = '';
  if (status) {
    status.textContent = '';
    status.className = 'phone-verify__status';
  }
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Получить код';
  }
  if (submitBtn) submitBtn.disabled = !phoneVerified;
  if (smsCooldownTimer) {
    clearInterval(smsCooldownTimer);
    smsCooldownTimer = null;
  }
}

function setPhoneVerifyStatus(message, type = '') {
  const status = $('#phoneVerifyStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `phone-verify__status${type ? ` phone-verify__status--${type}` : ''}`;
}

function updateSubmitButtonState() {
  const submitBtn = $('#submitOrderBtn');
  if (!submitBtn) return;
  const ready = smsVerificationEnabled ? phoneVerified : getPhoneDigits().length === 10;
  submitBtn.disabled = !ready;
  submitBtn.textContent = ready
    ? 'Подтвердить заказ'
    : (smsVerificationEnabled ? 'Подтвердите телефон по SMS' : 'Введите номер телефона');
}

async function loadSmsStatus() {
  try {
    const res = await fetch('/api/sms/status');
    const data = await res.json();
    smsVerificationEnabled = Boolean(data.enabled);
  } catch {
    smsVerificationEnabled = false;
  }

  const group = $('#phoneVerifyGroup');
  if (group) {
    group.classList.toggle('is-sms-off', !smsVerificationEnabled);
  }
  if (!smsVerificationEnabled) {
    phoneVerified = true;
    phoneVerificationToken = null;
  }
  updateSubmitButtonState();
}

function startSmsCooldown(seconds) {
  const sendBtn = $('#sendSmsBtn');
  if (!sendBtn) return;

  let left = seconds;
  sendBtn.disabled = true;
  sendBtn.textContent = `Повтор через ${left}с`;

  if (smsCooldownTimer) clearInterval(smsCooldownTimer);
  smsCooldownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(smsCooldownTimer);
      smsCooldownTimer = null;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Получить код';
      return;
    }
    sendBtn.textContent = `Повтор через ${left}с`;
  }, 1000);
}

async function sendPhoneCode() {
  const fullPhone = getFullPhone();
  if (!fullPhone) {
    setPhoneVerifyStatus('Введите 10 цифр номера после +7', 'error');
    return;
  }

  resetPhoneVerification();
  $('#phone').value = formatPhoneLocal(getPhoneDigits());

  const sendBtn = $('#sendSmsBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Отправка…';
  }

  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка отправки');

    $('#phoneCodeRow').hidden = false;
    $('#phoneCode')?.focus();
    setPhoneVerifyStatus(`Код отправлен на ${data.displayPhone}`, 'success');
    startSmsCooldown(data.retryAfter || 60);
  } catch (err) {
    setPhoneVerifyStatus(err.message || 'Не удалось отправить SMS', 'error');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Получить код';
    }
  }
}

async function verifyPhoneCode() {
  const fullPhone = getFullPhone();
  const code = $('#phoneCode')?.value?.trim();

  if (!fullPhone || !code) {
    setPhoneVerifyStatus('Введите номер и код из SMS', 'error');
    return;
  }

  const verifyBtn = $('#verifySmsBtn');
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Проверка…';
  }

  try {
    const res = await fetch('/api/sms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Неверный код');

    phoneVerificationToken = data.verificationToken;
    phoneVerified = true;
    $('#phone').readOnly = true;
    setPhoneVerifyStatus(`Номер ${data.displayPhone} подтверждён`, 'success');
    updateSubmitButtonState();
  } catch (err) {
    setPhoneVerifyStatus(err.message || 'Неверный код', 'error');
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Подтвердить';
    }
  }
}

function openCheckout() {
  if (!cart.length) return;
  closeCart();
  resetPhoneVerification();

  const phoneInput = $('#phone');
  if (phoneInput) phoneInput.readOnly = false;

  loadSmsStatus();

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

  updateSubmitButtonState();
  $('#checkoutModal').classList.add('active');
}

function closeCheckout() {
  $('#checkoutModal').classList.remove('active');
}

async function submitOrder(e) {
  e.preventDefault();
  if (smsVerificationEnabled && (!phoneVerified || !phoneVerificationToken)) {
    setPhoneVerifyStatus('Подтвердите телефон кодом из SMS', 'error');
    return;
  }
  if (getPhoneDigits().length !== 10) {
    setPhoneVerifyStatus('Введите 10 цифр номера после +7', 'error');
    return;
  }

  const btn = $('#submitOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  const data = {
    customerName: $('#name').value,
    customerPhone: getFullPhone(),
    customerEmail: $('#email').value,
    customerAddress: $('#address').value,
    customerComment: $('#comment').value,
    phoneVerificationToken,
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
    resetPhoneVerification();
    $('#checkoutForm').reset();
    cart = [];
    saveCart();

    const paymentInfo = result.payment || buildLocalPaymentDetails(result.order);
    showPaymentInstructions(paymentInfo, result.order.orderNumber);
  } catch (err) {
    alert(err.message || 'Ошибка при оформлении заказа');
  } finally {
    btn.disabled = !phoneVerified;
    updateSubmitButtonState();
  }
}

function bindEvents() {
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);
  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#checkoutClose').addEventListener('click', closeCheckout);
  $('#checkoutForm').addEventListener('submit', submitOrder);
  $('#sendSmsBtn').addEventListener('click', sendPhoneCode);
  $('#verifySmsBtn').addEventListener('click', verifyPhoneCode);
  bindPhoneInput();
  $('#phoneCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (e.target.value.length === 4) verifyPhoneCode();
  });
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
    hidePaymentInstructions();
    closeBankPicker();
  });

  $('#bankPickerClose')?.addEventListener('click', closeBankPicker);
  $('#bankSearch')?.addEventListener('input', async (e) => {
    const banks = await ensurePaymentBanks();
    renderBankPickerList(banks, e.target.value);
  });
  $('#bankPickerModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bankPickerModal') closeBankPicker();
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
