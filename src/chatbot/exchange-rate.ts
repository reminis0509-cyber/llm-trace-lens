/**
 * Exchange Rate Service
 * Fetches daily USD/JPY rate and caches in DB.
 */
import { saveExchangeRate, getExchangeRate, type ExchangeRate } from './storage.js';

let cachedRate: { rate: ExchangeRate; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch USD/JPY rate from public API
 */
async function fetchFromApi(): Promise<number> {
  // Try exchangerate-api.com (free tier: 1500 req/month)
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (response.ok) {
      const data = await response.json();
      const rate = data?.rates?.JPY;
      if (typeof rate === 'number' && rate > 0) {
        return rate;
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: try another free API
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=JPY');
    if (response.ok) {
      const data = await response.json();
      const rate = data?.rates?.JPY;
      if (typeof rate === 'number' && rate > 0) {
        return rate;
      }
    }
  } catch {
    // Fall through
  }

  // Last resort: use a reasonable default
  console.warn('[ExchangeRate] All APIs failed, using fallback rate 150.0');
  return 150.0;
}

/**
 * Get today's USD/JPY rate (with caching)
 */
export async function getUsdJpyRate(): Promise<ExchangeRate> {
  const today = new Date().toISOString().split('T')[0];

  // Check in-memory cache
  if (cachedRate && cachedRate.rate.date === today && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  // Check DB
  const dbRate = await getExchangeRate(today);
  if (dbRate) {
    cachedRate = { rate: dbRate, fetchedAt: Date.now() };
    return dbRate;
  }

  // Fetch from API
  const usdJpy = await fetchFromApi();
  await saveExchangeRate(today, usdJpy, 'open.er-api.com');

  const rate = await getExchangeRate(today);
  if (rate) {
    cachedRate = { rate, fetchedAt: Date.now() };
    return rate;
  }

  // Should not reach here, but construct a fallback
  const fallback: ExchangeRate = {
    id: 'fallback',
    date: today,
    usd_jpy: usdJpy,
    source: 'fallback',
    fetched_at: new Date().toISOString(),
  };
  cachedRate = { rate: fallback, fetchedAt: Date.now() };
  return fallback;
}

/**
 * Convert USD amount to JPY using today's rate
 */
export async function usdToJpy(usdAmount: number): Promise<{ jpy: number; rate: number; date: string }> {
  const exchangeRate = await getUsdJpyRate();
  return {
    jpy: Math.round(usdAmount * exchangeRate.usd_jpy),
    rate: exchangeRate.usd_jpy,
    date: exchangeRate.date,
  };
}

/**
 * Start daily exchange rate fetch scheduler.
 * Fetches at startup and then every 24 hours.
 */
export function startExchangeRateScheduler(): void {
  // Fetch immediately
  getUsdJpyRate().catch(err => {
    console.warn('[ExchangeRate] Initial fetch failed:', err);
  });

  // Schedule daily fetch
  schedulerInterval = setInterval(() => {
    getUsdJpyRate().catch(err => {
      console.warn('[ExchangeRate] Scheduled fetch failed:', err);
    });
  }, CACHE_TTL_MS);

  console.log('[ExchangeRate] Scheduler started (24h interval)');
}

/**
 * Stop the exchange rate scheduler
 */
export function stopExchangeRateScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ExchangeRate] Scheduler stopped');
  }
}
