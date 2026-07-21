const DEFAULT_RECIPIENT = 'Магомедов Халил Умарасхабович';
const SBER_BANK_ID = '100000000111';

const BANK_META = {
  '100000000111': {
    name: 'Сбербанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000111.png',
    schema: 'bank100000000111',
    packageName: 'ru.sberbankmobile',
  },
  '100000000004': {
    name: 'Т-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000004.png',
    schema: 'bank100000000004',
    packageName: 'com.idamob.tinkoff.android',
    webUrl: () => 'https://www.tbank.ru/auth/login/?redirect=%2Fpayments%2Ftransfer%2Fphone%2F',
  },
  '110000000005': {
    name: 'Банк ВТБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000005.png',
    schema: 'bank110000000005',
    packageName: 'ru.vtb24.mobilebanking.android',
    webUrl: (p) => `https://online.vtb.ru/i/paymentSbp?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000008': {
    name: 'Альфа-Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000008.png',
    schema: 'bank100000000008',
    packageName: 'ru.alfabank.mobile.android',
    webUrl: (p) => `https://web.alfabank.ru/payments/phone-transfer?${new URLSearchParams({
      phoneNumber: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000007': {
    name: 'Райффайзен Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000007.png',
    schema: 'bank100000000007',
    packageName: 'ru.raiffeisennews',
    webUrl: (p) => `https://online.raiffeisen.ru/payments/phone?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000001': {
    name: 'Газпромбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000001.png',
    schema: 'bank100000000001',
    packageName: 'ru.gazprombank.android.mobilebank.app',
    webUrl: (p) => `https://sbpgpb.ru/c2bpayments?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000010': {
    name: 'Банк ПСБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000010.png',
    schema: 'bank100000000010',
    packageName: 'logo.com.mbanking',
    webUrl: (p) => `https://ib.psbank.ru/sbp/payment?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000013': {
    name: 'Совкомбанк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000013.png',
    schema: 'bank100000000013',
    packageName: 'ru.sovcomcard.halva.v1',
    webUrl: (p) => `https://halvacard.ru/lk/qr?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000017': {
    name: 'МТС Банк',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000017.png',
    schema: 'bank100000000017',
    packageName: 'ru.mts.money',
    webUrl: (p) => `https://mdeng.ru/paymentsC2BBank?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
  },
  '100000000020': {
    name: 'РСХБ',
    logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000020.png',
    schema: 'bank100000000020',
    packageName: 'ru.rshb.dbo',
    webUrl: (p) => `https://online.rshb.ru/?${new URLSearchParams({
      phone: p.phone,
      amount: p.amount,
    }).toString()}`,
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

function resolveBankMeta(bankId, bankFromApi) {
  const known = BANK_META[bankId] || {};
  return {
    name: known.name || bankFromApi?.name || 'Ваш банк',
    logo: known.logo || bankFromApi?.logo || '',
    schema: known.schema || bankFromApi?.schema || null,
    packageName: known.packageName || bankFromApi?.packageName || null,
    webUrl: known.webUrl || ((payload) => {
      if (!bankFromApi?.webClientUrl) return null;
      const params = new URLSearchParams({ phone: payload.phone, amount: payload.amount });
      const joiner = bankFromApi.webClientUrl.includes('?') ? '&' : '?';
      return `${bankFromApi.webClientUrl}${joiner}${params.toString()}`;
    }),
  };
}

function buildAppLink(meta) {
  if (!meta.schema) return null;

  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && meta.packageName) {
    return `intent://#Intent;scheme=${meta.schema};package=${meta.packageName};end`;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    return `${meta.schema}://`;
  }

  return null;
}

function openBank(meta, payload) {
  const webUrl = meta.webUrl?.(payload);
  const appUrl = buildAppLink(meta);

  if (appUrl) {
    window.location.href = appUrl;
    if (webUrl) {
      window.setTimeout(() => {
        window.location.href = webUrl;
      }, 1500);
    }
    return;
  }

  if (webUrl) {
    window.location.href = webUrl;
  }
}

async function copyText(text, button, successLabel = 'Скопировано') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const prev = button.textContent;
      button.textContent = successLabel;
      window.setTimeout(() => { button.textContent = prev; }, 1800);
    }
  } catch {
    window.prompt('Скопируйте:', text);
  }
}

async function initPayPage() {
  const params = readParams();
  if (!params.bank || !params.phone || !params.amount) {
    document.getElementById('payStatusText').textContent = 'Не хватает данных для оплаты.';
    return;
  }

  let bankFromApi = null;
  try {
    const res = await fetch('/api/payment/banks');
    const data = await res.json();
    bankFromApi = (data.banks || []).find((bank) => bank.id === params.bank);
  } catch {
    bankFromApi = null;
  }

  const meta = resolveBankMeta(params.bank, bankFromApi);
  const payload = { phone: params.phone, amount: params.amount };
  const isSber = params.bank === SBER_BANK_ID;

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
  const statusText = document.getElementById('payStatusText');
  const openAppBtn = document.getElementById('payOpenApp');
  const openWebBtn = document.getElementById('payOpenWeb');

  bankName.textContent = meta.name;
  if (meta.logo && bankLogo) {
    bankLogo.src = meta.logo;
    bankLogo.alt = meta.name;
    bankLogo.hidden = false;
  }

  document.getElementById('payRecipient').textContent = recipientName;
  document.getElementById('payPhone').textContent = formatPhoneDisplay(params.phone);
  document.getElementById('payAmount').textContent = formatAmount(params.amountNumber);
  document.getElementById('payComment').textContent = params.comment || '—';

  if (isSber) {
    if (hint) {
      hint.textContent = 'Сейчас откроется Сбербанк Онлайн с подставленными телефоном и суммой. Комментарий уже скопирован — вставьте его в поле «Сообщение».';
    }
    if (openAppBtn) openAppBtn.hidden = true;
    if (openWebBtn) openWebBtn.textContent = 'Открыть Сбербанк Онлайн';
    if (statusText) statusText.textContent = 'Открываем Сбербанк Онлайн…';

    const sberUrl = buildSberPbpnUrl(params.phone, params.amount);
    openWebBtn?.addEventListener('click', () => { window.location.href = sberUrl; });
    if (params.comment) await copyText(params.comment);
    window.setTimeout(() => { window.location.href = sberUrl; }, 900);
    return;
  }

  if (hint) {
    hint.textContent = 'Нажмите «Открыть приложение» или «Открыть сайт банка». Телефон, сумма и комментарий уже на экране — вставьте их в перевод по СБП, если банк не подставил автоматически.';
  }
  if (statusText) statusText.textContent = 'Готово к оплате — выберите способ ниже';
  if (openAppBtn) {
    openAppBtn.textContent = `Открыть приложение ${meta.name}`;
    openAppBtn.addEventListener('click', () => openBank(meta, payload));
  }
  if (openWebBtn) {
    openWebBtn.textContent = `Открыть сайт ${meta.name}`;
    openWebBtn.addEventListener('click', () => {
      const webUrl = meta.webUrl?.(payload);
      if (webUrl) window.location.href = webUrl;
    });
  }

  document.getElementById('payCopyComment')?.addEventListener('click', (e) => {
    copyText(params.comment, e.currentTarget, 'Комментарий скопирован');
  });
  document.getElementById('payCopyPhone')?.addEventListener('click', (e) => {
    copyText(params.phone, e.currentTarget);
  });
  document.getElementById('payCopyAmount')?.addEventListener('click', (e) => {
    copyText(params.amount, e.currentTarget);
  });

  if (params.comment) {
    await copyText(params.comment);
  }
}

initPayPage();
