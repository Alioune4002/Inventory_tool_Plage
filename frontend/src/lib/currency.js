export const DEFAULT_CURRENCY = "EUR";

export const FALLBACK_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "BRL",
  "MAD",
  "XOF",
  "XAF",
];

export function getCurrencyOptions() {
  if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
    const list = Intl.supportedValuesOf("currency") || [];
    return list.length ? list : FALLBACK_CURRENCIES;
  }
  return FALLBACK_CURRENCIES;
}

export function normalizeCurrency(code) {
  return (code || DEFAULT_CURRENCY).toUpperCase();
}

export function formatCurrency(value, currency = DEFAULT_CURRENCY, locale = "fr-FR", fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(raw)) return fallback;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizeCurrency(currency),
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
    }).format(raw);
  } catch {
    return `${raw.toFixed(2)} ${normalizeCurrency(currency)}`;
  }
}

export function currencyLabel(code) {
  return normalizeCurrency(code);
}
