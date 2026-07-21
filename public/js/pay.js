const DEFAULT_RECIPIENT = 'Магомедов Халил Умарасхабович';

const BANK_PAY = {
  '100000000111': {
    name: 'Сбербанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000111.png',
    direct: true,
    webUrl: (p) => `https://www.sberbank.com/sms/pbpn?${new URLSearchParams({
      requisiteNumber: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000004': {
    name: 'Т-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000004.png',
    webUrl: (p) => `https://l.tbank.ru/c2c-qr-choose-bank?${new URLSearchParams({
      requisiteNumber: `+${p.phone}`,
      bankCode: '100000000004',
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000004',
    packageName: 'com.idamob.tinkoff.android',
  },
  '110000000005': {
    name: 'Банк ВТБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000005.png',
    webUrl: (p) => `https://online.vtb.ru/i/paymentSbp?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank110000000005',
    packageName: 'ru.vtb24.mobilebanking.android',
  },
  '100000000008': {
    name: 'Альфа-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000008.png',
    webUrl: (p) => `https://web.alfabank.ru/payments/phone-transfer?${new URLSearchParams({
      phoneNumber: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000008',
    packageName: 'ru.alfabank.mobile.android',
  },
  '100000000007': {
    name: 'Райффайзен Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000007.png',
    webUrl: (p) => `https://online.raiffeisen.ru/payments/phone?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000007',
    packageName: 'ru.raiffeisennews',
  },
  '100000000001': {
    name: 'Газпромбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000001.png',
    webUrl: (p) => `https://sbpgpb.ru/c2bpayments?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000001',
    packageName: 'ru.gazprombank.android.mobilebank.app',
  },
  '100000000010': {
    name: 'Банк ПСБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000010.png',
    webUrl: (p) => `https://ib.psbank.ru/sbp/payment?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000010',
    packageName: 'logo.com.mbanking',
  },
  '100000000013': {
    name: 'Совкомбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000013.png',
    webUrl: (p) => `https://l.tbank.ru/c2c-qr-choose-bank?${new URLSearchParams({
      requisiteNumber: `+${p.phone}`,
      bankCode: '100000000013',
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000013',
    packageName: 'ru.sovcomcard.halva.v1',
  },
  '100000000017': {
    name: 'МТС Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000017.png',
    webUrl: (p) => `https://mdeng.ru/paymentsC2BBank?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000017',
    packageName: 'ru.mts.money',
  },
  '100000000020': {
    name: 'РСХБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000020.png',
    webUrl: (p) => `https://l.tbank.ru/c2c-qr-choose-bank?${new URLSearchParams({
      requisiteNumber: `+${p.phone}`,
      bankCode: '100000000020',
      amount: p.amount,
    }).toString()}`,
    schema: 'bank100000000020',
    packageName: 'ru.rshb.dbo',
  },
};

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
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
    bank: bank === '100000000005' ? '110000000005' : bank,
    phone,
    amount: Number.isFinite(amount) ? amount.toFixed(2) : '',
    amountNumber: Number.isFinite(amount) ? amount : 0,
    comment,
  };
}

function getBankConfig(bankId, bankMeta) {
  const known = BANK_PAY[bankId];
  if (known) return known;

  if (!bankMeta) return null;

  return {
    name: bankMeta.name || 'Ваш банк',
    logo: bankMeta.logo || '',
    webUrl: (p) => {
      if (bankMeta.webClientUrl) {
        const params = new URLSearchParams({ phone: p.phone, amount: p.amount });
        const joiner = bankMeta.webClientUrl.includes('?') ? '&' : '?';
        return `${bankMeta.webClientUrl}${joiner}${params.toString()}`;
      }
      return `https://l.tbank.ru/c2c-qr-choose-bank?${new URLSearchParams({
        requisiteNumber: `+${p.phone}`,
        bankCode: bankId,
        amount: p.amount,
      }).toString()}`;
    },
    schema: bankMeta.schema || null,
    packageName: bankMeta.packageName || null,
  };
}

function buildAppLink(config) {
  if (!config.schema) return null;

  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && config.packageName) {
    return `intent://#Intent;scheme=${config.schema};package=${config.packageName};end`;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    return `${config.schema}://`;
  }

  return null;
}

function openPayment(config, payload, { auto = false } = {}) {
  const webUrl = config.webUrl(payload);
  const statusText = document.getElementById('payStatusText');
  if (statusText) {
    statusText.textContent = auto
      ? 'Открываем сайт банка…'
      : 'Переход на сайт банка…';
  }

  if (config.direct) {
    window.location.href = webUrl;
    return;
  }

  const appLink = buildAppLink(config);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && appLink) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appLink;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      window.location.href = webUrl;
    }, 1500);
    return;
  }

  window.location.href = webUrl;
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
  if (!config) {
    document.getElementById('payStatusText').textContent = 'Банк не найден. Вернитесь и выберите банк снова.';
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

  const payload = { phone: params.phone, amount: params.amount };
  const bankLogo = document.getElementById('payBankLogo');
  const bankName = document.getElementById('payBankName');

  bankName.textContent = config.name;
  if (config.logo && bankLogo) {
    bankLogo.src = config.logo;
    bankLogo.alt = config.name;
    bankLogo.hidden = false;
  }

  document.getElementById('payRecipient').textContent = recipientName;
  document.getElementById('payPhone').textContent = formatPhoneDisplay(params.phone);
  document.getElementById('payAmount').textContent = formatAmount(params.amountNumber);
  document.getElementById('payComment').textContent = params.comment || '—';

  document.getElementById('payOpenWeb').addEventListener('click', () => {
    openPayment(config, payload, { auto: false });
  });

  document.getElementById('payCopyComment').addEventListener('click', () => {
    if (params.comment) copyComment(params.comment);
  });

  if (params.comment) {
    copyComment(params.comment);
  }

  window.setTimeout(() => {
    openPayment(config, payload, { auto: true });
  }, 900);
}

initPayPage();
