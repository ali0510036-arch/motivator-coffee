const POPULAR_BANK_IDS = [
  '100000000111', // Сбербанк
  '100000000004', // Т-Банк
  '110000000005', // ВТБ (NSPK schema bank110000000005)
  '100000000008', // Альфа-Банк
  '100000000007', // Райффайзен
  '100000000001', // Газпромбанк
  '100000000010', // ПСБ
  '100000000013', // Совкомбанк
  '100000000017', // МТС Банк
  '100000000020', // РСХБ
  '100000000012', // Росбанк
  '100000000015', // Банк Открытие
  '100000000014', // Россельхозбанк
  '100000000016', // Почта Банк
  '100000000019', // Уралсиб
  '100000000021', // Солидарность
];

const NSPK_BANKS_URL = 'https://qr.nspk.ru/proxyapp/c2bmembers.json';
const CACHE_MS = 24 * 60 * 60 * 1000;

let cache = { banks: null, fetchedAt: 0 };

function normalizeBank(raw) {
  const schema = raw.schema || null;
  const id = schema ? schema.replace(/^bank/, '') : null;
  return {
    id,
    name: raw.bankName,
    logo: raw.logoURL || null,
    schema,
    packageName: raw.package_name || null,
    webClientUrl: raw.webClientUrl || null,
    isDrActive: Boolean(raw.isDrActive),
  };
}

async function fetchBanksFromNspk() {
  const res = await fetch(NSPK_BANKS_URL);
  if (!res.ok) throw new Error(`NSPK banks fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.dictionary || []).map(normalizeBank).filter((bank) => bank.id);
}

function getFallbackBanks() {
  return [
    { id: '100000000111', name: 'Сбербанк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000111.png', schema: 'bank100000000111', packageName: 'ru.sberbankmobile', isDrActive: true },
    { id: '100000000004', name: 'Т-Банк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000004.png', schema: 'bank100000000004', packageName: 'com.idamob.tinkoff.android', webClientUrl: 'https://www.tinkoff.ru/mybank/payments/qr-pay', isDrActive: true },
    { id: '110000000005', name: 'Банк ВТБ', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000005.png', schema: 'bank110000000005', packageName: 'ru.vtb24.mobilebanking.android', webClientUrl: 'https://online.vtb.ru/i/paymentSbp', isDrActive: true },
    { id: '100000000008', name: 'АЛЬФА-БАНК', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000008.png', schema: 'bank100000000008', packageName: 'ru.alfabank.mobile.android', webClientUrl: 'https://alfa-mobile.alfabank.ru/mobile-public/goto/qr', isDrActive: true },
    { id: '100000000007', name: 'Райффайзен Банк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000007.png', schema: 'bank100000000007', packageName: 'ru.raiffeisennews', webClientUrl: 'https://online.raiffeisen.ru/outer/qr/qr.nspk.ru', isDrActive: true },
    { id: '100000000001', name: 'Газпромбанк', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000001.png', schema: 'bank100000000001', packageName: 'ru.gazprombank.android.mobilebank.app', isDrActive: true },
    { id: '100000000010', name: 'Банк ПСБ', logo: 'https://qr.nspk.ru/proxyapp/logo/bank100000000010.png', schema: 'bank100000000010', packageName: 'logo.com.mbanking', isDrActive: true },
  ];
}

async function getPopularBanks() {
  const now = Date.now();
  if (cache.banks && now - cache.fetchedAt < CACHE_MS) {
    return cache.banks;
  }

  try {
    const all = await fetchBanksFromNspk();
    const byId = new Map(all.map((bank) => [bank.id, bank]));
    const bySchema = new Map(all.map((bank) => [bank.schema, bank]));
    const popular = POPULAR_BANK_IDS
      .map((id) => byId.get(id) || bySchema.get(`bank${id}`))
      .filter(Boolean);

    if (!popular.some((bank) => bank.id === '110000000005')) {
      const vtb = byId.get('110000000005')
        || bySchema.get('bank110000000005')
        || getFallbackBanks().find((bank) => bank.id === '110000000005');
      if (vtb) {
        const tbankIndex = popular.findIndex((bank) => bank.id === '100000000004');
        popular.splice(tbankIndex >= 0 ? tbankIndex + 1 : 2, 0, vtb);
      }
    }

    cache = {
      banks: popular.length ? popular : getFallbackBanks(),
      fetchedAt: now,
    };
  } catch (err) {
    console.error('[SBP] Failed to load bank list:', err.message);
    cache = { banks: getFallbackBanks(), fetchedAt: now };
  }

  return cache.banks;
}

module.exports = {
  getPopularBanks,
};
