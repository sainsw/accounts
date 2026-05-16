const CACHE_KEY = 'accounts.exchangeRates';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

type RateCache = {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt: number;
};

export const COMMON_CURRENCIES = [
  'GBP', 'USD', 'EUR', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'INR', 'ZAR',
] as const;

function getCachedRates(): RateCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: RateCache = JSON.parse(raw);
    if (Date.now() - cache.fetchedAt > CACHE_DURATION_MS) return null;
    return cache;
  } catch {
    return null;
  }
}

function setCachedRates(cache: RateCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full — ignore
  }
}

export async function fetchExchangeRates(base: string = 'GBP'): Promise<Record<string, number>> {
  const cached = getCachedRates();
  if (cached && cached.base === base) return cached.rates;

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?base=${base}`);
    if (!res.ok) throw new Error('Failed to fetch rates');
    const data = await res.json();
    const rates: Record<string, number> = { [base]: 1, ...data.rates };
    setCachedRates({ base, date: data.date, rates, fetchedAt: Date.now() });
    return rates;
  } catch {
    if (cached) return cached.rates;
    return { [base]: 1 };
  }
}

export async function fetchHistoricalRate(base: string, target: string, date: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?base=${base}&symbols=${target}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates[target] ?? null;
  } catch {
    return null;
  }
}

export function convertAmount(amount: number, fromRate: number, toRate: number): number {
  if (fromRate === 0) return amount;
  return (amount / fromRate) * toRate;
}

export function formatExchangeRate(rate: number): string {
  return rate.toFixed(4);
}
