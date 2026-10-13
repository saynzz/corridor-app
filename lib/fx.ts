import type { Currency } from "./types";

const SAMPLE_PER_USD: Record<Currency, number> = { USD: 1, SGD: 1.29, KZT: 505, CNY: 7.12 };

let cache: { at: number; perUsd: Record<Currency, number>; live: boolean } | null = null;

export async function perUsd(): Promise<{ perUsd: Record<Currency, number>; live: boolean }> {
  if (process.env.FX_LIVE !== "1") return { perUsd: SAMPLE_PER_USD, live: false };
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { rates: Record<string, number> };
    const p = { USD: 1, SGD: j.rates.SGD, KZT: j.rates.KZT, CNY: j.rates.CNY } as Record<Currency, number>;
    if (Object.values(p).some((v) => !v)) throw new Error("missing rate");
    cache = { at: Date.now(), perUsd: p, live: true };
    return cache;
  } catch {
    return { perUsd: SAMPLE_PER_USD, live: false };
  }
}

export async function midRate(from: Currency, to: Currency) {
  const { perUsd: p, live } = await perUsd();
  return { rate: p[to] / p[from], live };
}

export async function toBase(amount: number, from: Currency, base: Currency = "SGD") {
  const { rate } = await midRate(from, base);
  return amount * rate;
}

export const ROUTES = [
  { id: "bank_wire", name: "Bank wire (SWIFT)", marginPct: 1.8, feeBase: 15, eta: "2–4 days" },
  { id: "card_topup", name: "Card top-up", marginPct: 1.6, feeBase: 0, eta: "instant" },
  { id: "partner_network", name: "Partner network", marginPct: 0.35, feeBase: 2, eta: "~2 h" },
] as const;
export type RouteId = (typeof ROUTES)[number]["id"];

export async function quoteRoutes(from: Currency, to: Currency, amount: number) {
  const { rate: mid, live } = await midRate(from, to);
  const { rate: sgdToFrom } = await midRate("SGD", from);
  const quotes = ROUTES.map((r) => {
    const feeInFrom = r.feeBase * sgdToFrom;
    const effRate = mid * (1 - r.marginPct / 100);
    const receive = Math.max(0, (amount - feeInFrom) * effRate);
    return { id: r.id, name: r.name, eta: r.eta, receive: round2(receive), fee: round2(feeInFrom), rate: effRate, marginPct: r.marginPct };
  });
  const best = quotes.reduce((a, b) => (b.receive > a.receive ? b : a));
  const worst = quotes.reduce((a, b) => (b.receive < a.receive ? b : a));
  return { mid, live, quotes, best, savingVsWorst: round2(best.receive - worst.receive) };
}

export async function history(from: Currency, to: Currency, days = 30) {
  const { rate } = await midRate(from, to);
  const pts: { date: string; rate: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) - 0.5;
  for (let i = days; i >= 0; i--) {
    const drift = (i / days) * 0.012;
    const noise = rnd() * 0.006;
    pts.push({ date: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), rate: rate * (1 + drift + noise) });
  }
  pts[pts.length - 1].rate = rate;
  const avg = pts.reduce((a, p) => a + p.rate, 0) / pts.length;
  return { points: pts, current: rate, avg };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const SYMBOL: Record<Currency, string> = { SGD: "S$", KZT: "₸", USD: "$", CNY: "¥" };
export function fmt(amount: number, c: Currency) {
  const digits = c === "KZT" ? 0 : 2;
  return SYMBOL[c] + amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export const symbol = (c: Currency) => SYMBOL[c];
