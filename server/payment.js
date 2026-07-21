const DEFAULT_PHONE = '79894840069';
const DEFAULT_RECIPIENT = 'Магомедов Халил Умарасхабович';

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

function getPaymentPhone() {
  return normalizePhone(process.env.PAYMENT_PHONE || DEFAULT_PHONE);
}

function formatPhoneDisplay(phone) {
  const digits = normalizePhone(phone);
  if (digits.length !== 11 || !digits.startsWith('7')) return phone;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function getRecipientName() {
  return (process.env.PAYMENT_RECIPIENT || DEFAULT_RECIPIENT).trim();
}

function isPaymentEnabled() {
  return Boolean(getPaymentPhone());
}

function buildSbpLink(phone, amount) {
  const params = new URLSearchParams({
    requisiteNumber: phone,
    amount: Number(amount).toFixed(2),
  });
  return `https://www.sberbank.com/sms/pbpn?${params.toString()}`;
}

function buildBankTransferLink(bankId, phone, amount) {
  const digits = normalizePhone(phone);
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

function buildTransferLinks(phone, amount) {
  const bankIds = [
    '100000000111',
    '100000000004',
    '110000000005',
    '100000000008',
    '100000000007',
    '100000000001',
    '100000000010',
    '100000000013',
    '100000000017',
  ];
  const links = {};
  for (const bankId of bankIds) {
    links[bankId] = buildBankTransferLink(bankId, phone, amount);
  }
  return links;
}

function buildPaymentDetails(order) {
  const phone = getPaymentPhone();
  const amount = Number(order.total);
  const comment = `Заказ MOTIVATOR ${order.orderNumber}`;

  return {
    recipientName: getRecipientName(),
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    amount,
    amountFormatted: `${amount.toLocaleString('ru-RU')} ₽`,
    comment,
    sbpLink: buildSbpLink(phone, amount),
    transferLinks: buildTransferLinks(phone, amount),
    instruction: 'Выберите свой банк для перевода через СБП.',
  };
}

module.exports = {
  isPaymentEnabled,
  getPaymentPhone,
  getRecipientName,
  formatPhoneDisplay,
  buildSbpLink,
  buildBankTransferLink,
  buildPaymentDetails,
};
