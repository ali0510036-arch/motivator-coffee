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
    instruction: 'Переведите сумму по номеру телефона через СБП. В комментарии укажите номер заказа.',
  };
}

module.exports = {
  isPaymentEnabled,
  getPaymentPhone,
  getRecipientName,
  formatPhoneDisplay,
  buildPaymentDetails,
};
