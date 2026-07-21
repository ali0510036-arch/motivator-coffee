const DEFAULT_RECIPIENT = 'Магомедов Халил Умарасхабович';
const SBER_BANK_ID = '100000000111';

const BANK_META = {
  '100000000111': {
    name: 'Сбербанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000111.png',
  },
  '100000000004': {
    name: 'Т-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000004.png',
  },
  '110000000005': {
    name: 'Банк ВТБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000005.png',
  },
  '100000000008': {
    name: 'Альфа-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000008.png',
  },
  '100000000007': {
    name: 'Райффайзен Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000007.png',
  },
  '100000000001': {
    name: 'Газпромбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000001.png',
  },
  '100000000010': {
    name: 'Банк ПСБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000010.png',
  },
  '100000000013': {
    name: 'Совкомбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000013.png',
  },
  '100000000017': {
    name: 'МТС Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000017.png',
  },
  '100000000020': {
    name: 'РСХБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000020.png',
  },
};

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

function normalizeBankId(bankId) {
  return bankId === '100000000005' ? '110000000005' : bankId;
}

function buildSberPbpnUrl(phone, amount) {
  return `https://www.sberbank.com/sms/pbpn?${new URLSearchParams({
    requisiteNumber: phone,
    amount: Number(amount).toFixed(2),
  }).toString()}`;
}

function buildChoiseBankUrl(bankCode, phone, amount) {
  return `https://www.sberbank.com/ru/choise_bank?${new URLSearchParams({
    requisiteNumber: `+${phone}`,
    bankCode,
    amount: Number(amount).toFixed(2),
  }).toString()}`;
}

function buildPaymentUrl(bankId, phone, amount) {
  const normalizedId = normalizeBankId(bankId);
  const digits = normalizePhone(phone);
  const amountStr = Number(amount).toFixed(2);
  if (!digits || !Number.isFinite(Number(amount))) return null;

  if (normalizedId === SBER_BANK_ID) {
    return buildSberPbpnUrl(digits, amountStr);
  }

  return buildChoiseBankUrl(normalizedId, digits, amountStr);
}

function formatPhoneDisplay(phone) {
  const digits = normalizePhone(phone);
  if (digits.length !== 11 || !digits.startsWith('7')) return phone;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function formatAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function readParams() {
  const query = new URLSearchParams(window.location.search);
  const bank = query.get('bank') || '';
  const phone = normalizePhone(query.get('phone'));
  const amount = Number(query.get('amount'));
  const comment = (query.get('comment') || '').trim();

  return {
    bank: normalizeBankId(bank),
    phone,
    amount: Number.isFinite(amount) ? amount.toFixed(2) : '',
    amountNumber: Number.isFinite(amount) ? amount : 0,
    comment,
  };
}

function getBankConfig(bankId, bankMeta) {
  const meta = BANK_META[bankId] || {};

  return {
    name: meta.name || bankMeta?.name || 'Ваш банк',
    logo: meta.logo || bankMeta?.logo || '',
    usesGateway: bankId !== SBER_BANK_ID,
  };
}

function openPayment(config, paymentUrl) {
  const statusText = document.getElementById('payStatusText');
  if (statusText) {
    statusText.textContent = config.usesGateway
      ? 'Открываем оплату через СБП…'
      : 'Открываем Сбербанк Онлайн…';
  }

  if (!paymentUrl) return;
  window.location.href = paymentUrl;
}

async function copyComment(text) {
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('payCopyComment');
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = 'Комментарий скопирован';
      window.setTimeout(() => { btn.textContent = prev; }, 1800);
    }
  } catch {
    window.prompt('Скопируйте комментарий:', text);
  }
}

async function initPayPage() {
  const params = readParams();
  if (!params.bank || !params.phone || !params.amount) {
    document.getElementById('payStatusText').textContent = 'Не хватает данных для оплаты.';
    return;
  }

  let bankMeta = null;
  try {
    const res = await fetch('/api/payment/banks');
    const data = await res.json();
    bankMeta = (data.banks || []).find((bank) => bank.id === params.bank);
  } catch {
    bankMeta = null;
  }

  const config = getBankConfig(params.bank, bankMeta);
  const paymentUrl = buildPaymentUrl(params.bank, params.phone, params.amount);

  if (!paymentUrl) {
    document.getElementById('payStatusText').textContent = 'Не удалось собрать ссылку для оплаты.';
    return;
  }

  let recipientName = DEFAULT_RECIPIENT;
  try {
    const res = await fetch('/api/payment/status');
    const data = await res.json();
    if (data.recipientName) recipientName = data.recipientName;
  } catch {
    // keep default
  }

  const bankLogo = document.getElementById('payBankLogo');
  const bankName = document.getElementById('payBankName');
  const hint = document.querySelector('.pay-page__hint');

  bankName.textContent = config.name;
  if (config.logo && bankLogo) {
    bankLogo.src = config.logo;
    bankLogo.alt = config.name;
    bankLogo.hidden = false;
  }

  if (hint && config.usesGateway) {
    hint.textContent = 'Сейчас откроется страница СБП: телефон и сумма уже будут подставлены, затем — сайт или приложение вашего банка. Комментарий к заказу скопируйте в поле «Сообщение».';
  }

  document.getElementById('payRecipient').textContent = recipientName;
  document.getElementById('payPhone').textContent = formatPhoneDisplay(params.phone);
  document.getElementById('payAmount').textContent = formatAmount(params.amountNumber);
  document.getElementById('payComment').textContent = params.comment || '—';

  document.getElementById('payOpenWeb').addEventListener('click', () => {
    openPayment(config, paymentUrl);
  });

  document.getElementById('payCopyComment').addEventListener('click', () => {
    if (params.comment) copyComment(params.comment);
  });

  if (params.comment) {
    copyComment(params.comment);
  }

  window.setTimeout(() => {
    openPayment(config, paymentUrl);
  }, 900);
}

initPayPage();
