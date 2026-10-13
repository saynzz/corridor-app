export type Cur = "SGD" | "KZT" | "USD" | "CNY";
const SYM: Record<Cur, string> = { SGD: "S$", KZT: "₸", USD: "$", CNY: "¥" };
export const sym = (c: Cur) => SYM[c];
export function money(n: number, c: Cur, opts: { cents?: boolean } = {}) {
  const d = c === "KZT" ? 0 : opts.cents === false ? 0 : 2;
  return SYM[c] + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function num(n: number, c: Cur) {
  const d = c === "KZT" ? 0 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const COIN: Record<Cur, { bg: string; fg: string }> = {
  SGD: { bg: "#2A1E24", fg: "#FF9AA8" },
  KZT: { bg: "#16263A", fg: "#8EC9FF" },
  USD: { bg: "#1E2A1A", fg: "#C8F169" },
  CNY: { bg: "#2C2416", fg: "#FFB45C" },
};
