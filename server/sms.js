const crypto = require('crypto');

const CODE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const pendingCodes = new Map();
const verifiedTokens = new Map();
const sendLog = new Map();

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return null;
}

function formatPhoneDisplay(phone) {
  return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`;
}

function cleanupMaps() {
  const now = Date.now();
  for (const [key, value] of pendingCodes) {
    if (value.expiresAt <= now) pendingCodes.delete(key);
  }
  for (const [key, value] of verifiedTokens) {
    if (value.expiresAt <= now) verifiedTokens.delete(key);
  }
  for (const [key, value] of sendLog) {
    if (value.windowStart <= now - SEND_WINDOW_MS) sendLog.delete(key);
  }
}

function canSend(phone) {
  cleanupMaps();
  const now = Date.now();
  const entry = sendLog.get(phone);
  if (!entry) return { ok: true, retryAfter: 0 };

  if (entry.lastSentAt && now - entry.lastSentAt < SEND_COOLDOWN_MS) {
    return { ok: false, retryAfter: Math.ceil((SEND_COOLDOWN_MS - (now - entry.lastSentAt)) / 1000) };
  }

  if (entry.windowStart <= now - SEND_WINDOW_MS) {
    sendLog.set(phone, { count: 0, windowStart: now, lastSentAt: entry.lastSentAt });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= MAX_SENDS_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((SEND_WINDOW_MS - (now - entry.windowStart)) / 1000) };
  }

  return { ok: true, retryAfter: 0 };
}

function registerSend(phone) {
  const now = Date.now();
  const entry = sendLog.get(phone) || { count: 0, windowStart: now, lastSentAt: 0 };
  if (entry.windowStart <= now - SEND_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  entry.lastSentAt = now;
  sendLog.set(phone, entry);
}

function generateCode() {
  return String(crypto.randomInt(1000, 10000));
}

function parseSmsRuSendResponse(data, phone) {
  if (!data || data.status !== 'OK') {
    throw new Error(data?.status_text || 'Ошибка авторизации SMS.ru');
  }

  const entry = data.sms?.[phone];
  if (!entry) {
    throw new Error('SMS.ru не вернул статус отправки');
  }

  if (entry.status !== 'OK' || entry.status_code !== 100) {
    throw new Error(entry.status_text || `SMS не отправлено (код ${entry.status_code})`);
  }

  return data;
}

async function sendSmsRu(phone, message, clientIp) {
  const apiId = process.env.SMSRU_API_ID;
  if (!apiId) {
    throw new Error('SMS не настроен на сервере (SMSRU_API_ID)');
  }

  const body = new URLSearchParams({
    api_id: apiId,
    to: phone,
    msg: message,
    json: '1',
  });

  const from = process.env.SMSRU_FROM?.trim();
  if (from) body.set('from', from);

  if (clientIp) {
    const ip = String(clientIp).replace('::ffff:', '');
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      body.set('ip', ip);
    }
  }

  const res = await fetch('https://sms.ru/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Некорректный ответ SMS.ru');
  }

  parseSmsRuSendResponse(data, phone);
  return data;
}

async function sendVerificationCode(rawPhone, clientIp) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: 'Введите номер из 10 цифр после +7' };
  }

  const gate = canSend(phone);
  if (!gate.ok) {
    return { ok: false, error: `Подождите ${gate.retryAfter} сек. перед повторной отправкой` };
  }

  const code = generateCode();
  const message = `MOTIVATOR: код ${code}. Никому не сообщайте.`;

  if (process.env.NODE_ENV === 'development' && !process.env.SMSRU_API_ID) {
    console.log(`[SMS dev] ${formatPhoneDisplay(phone)} -> ${code}`);
  } else {
    try {
      await sendSmsRu(phone, message, clientIp);
    } catch (err) {
      console.error('[SMS.ru]', phone, err.message);
      return { ok: false, error: err.message };
    }
  }

  registerSend(phone);
  pendingCodes.set(phone, {
    code,
    attempts: 0,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  return {
    ok: true,
    phone,
    displayPhone: formatPhoneDisplay(phone),
    retryAfter: Math.ceil(SEND_COOLDOWN_MS / 1000),
  };
}

function verifyCode(rawPhone, code) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: 'Некорректный номер телефона' };
  }

  const input = String(code || '').trim();
  if (!/^\d{4}$/.test(input)) {
    return { ok: false, error: 'Введите 4-значный код из SMS' };
  }

  cleanupMaps();
  const pending = pendingCodes.get(phone);
  if (!pending) {
    return { ok: false, error: 'Сначала запросите код по SMS' };
  }

  if (pending.expiresAt <= Date.now()) {
    pendingCodes.delete(phone);
    return { ok: false, error: 'Код истёк. Запросите новый' };
  }

  pending.attempts += 1;
  if (pending.attempts > MAX_VERIFY_ATTEMPTS) {
    pendingCodes.delete(phone);
    return { ok: false, error: 'Слишком много попыток. Запросите новый код' };
  }

  if (pending.code !== input) {
    return { ok: false, error: 'Неверный код' };
  }

  pendingCodes.delete(phone);
  const token = crypto.randomBytes(24).toString('hex');
  verifiedTokens.set(token, {
    phone,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false,
  });

  return {
    ok: true,
    phone,
    displayPhone: formatPhoneDisplay(phone),
    verificationToken: token,
  };
}

function consumeVerification(token, rawPhone) {
  cleanupMaps();
  if (!token) return false;

  const entry = verifiedTokens.get(token);
  if (!entry || entry.used || entry.expiresAt <= Date.now()) {
    return false;
  }

  const phone = normalizePhone(rawPhone);
  if (!phone || phone !== entry.phone) {
    return false;
  }

  entry.used = true;
  verifiedTokens.delete(token);
  return true;
}

function isVerificationEnabled() {
  return Boolean(process.env.SMSRU_API_ID?.trim() && process.env.SMSRU_FROM?.trim());
}

module.exports = {
  normalizePhone,
  formatPhoneDisplay,
  sendVerificationCode,
  verifyCode,
  consumeVerification,
  isVerificationEnabled,
};
