// ISO 3166-1 alpha-2 country → ISO 4217 currency, for the "approximate
// price in your currency" line on the membership cards (see
// /api/geo-price and membership-cards.tsx). Not the billing currency —
// Stripe always charges in MXN regardless of what this maps to; this only
// decides which currency the reference conversion is shown in.
// Covers the countries WITERS realistically gets traffic from; anything
// missing here just falls back to USD in currencyForCountry() below,
// never to no conversion at all.
export const COUNTRY_CURRENCY: Record<string, string> = {
  // Mexico is handled separately (no conversion shown) — not in this map.

  // North America
  US: "USD",
  CA: "CAD",

  // Central America & Caribbean
  GT: "USD", // Guatemala's quetzal floats vs USD in practice for this kind of reference
  BZ: "BZD",
  SV: "USD",
  HN: "HNL",
  NI: "NIO",
  CR: "CRC",
  PA: "USD",
  CU: "USD",
  DO: "DOP",
  PR: "USD",
  JM: "JMD",
  HT: "USD",
  TT: "TTD",
  BS: "BSD",

  // South America
  CO: "COP",
  VE: "USD", // bolívar's official rate is unreliable for a casual reference
  EC: "USD",
  PE: "PEN",
  BO: "BOB",
  BR: "BRL",
  PY: "PYG",
  UY: "UYU",
  AR: "ARS",
  CL: "CLP",
  GY: "GYD",
  SR: "SRD",

  // Europe (Eurozone)
  ES: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",

  // Europe (non-Eurozone)
  GB: "GBP",
  CH: "CHF",
  NO: "NOK",
  SE: "SEK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  IS: "ISK",
  UA: "UAH",
  RS: "RSD",
  TR: "TRY",
  RU: "RUB",
  AL: "ALL",
  BA: "BAM",
  MK: "MKD",
  MD: "MDL",
  ME: "EUR",
  XK: "EUR",

  // Middle East
  IL: "ILS",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
  LB: "USD",
  EG: "EGP",
  IQ: "IQD",

  // Asia-Pacific
  CN: "CNY",
  JP: "JPY",
  KR: "KRW",
  IN: "INR",
  SG: "SGD",
  HK: "HKD",
  TW: "TWD",
  TH: "THB",
  VN: "VND",
  PH: "PHP",
  ID: "IDR",
  MY: "MYR",
  PK: "PKR",
  BD: "BDT",
  NZ: "NZD",
  AU: "AUD",
  LK: "LKR",
  NP: "NPR",
  KH: "KHR",
  MM: "MMK",

  // Africa
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  GH: "GHS",
  MA: "MAD",
  DZ: "DZD",
  TN: "TND",
  ET: "ETB",
  TZ: "TZS",
  UG: "UGX",
  CI: "XOF",
  SN: "XOF",
  CM: "XAF",
};

// Returns null only for Mexico (no conversion — the site is already in
// pesos there) or when there's no country signal at all. Every other
// recognized country gets at least a USD fallback, never nothing.
export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const code = country.toUpperCase();
  if (code === "MX") return null;
  return COUNTRY_CURRENCY[code] ?? "USD";
}
