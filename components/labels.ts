import type { Check } from "@/lib/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

export function checkLabel(c: Check, t: T) {
  if (!c.code) return c.label;
  const key = "check." + c.code;
  const out = t(key, c.vars);
  return out === key ? c.label : out;
}

export function flagLabel(code: string | undefined, fallback: string, t: T) {
  if (!code) return fallback;
  const k = "flag." + code;
  const v = t(k);
  return v === k ? fallback : v;
}

export function reasonLabel(reason: string, t: T) {
  if (/flagged untrusted content/i.test(reason)) return t("reason.tainted");
  if (/Payee not found/i.test(reason)) return t("reason.no_payee");
  if (/checks failed/i.test(reason)) return t("reason.checks");
  if (/tuition case/i.test(reason)) return t("reason.case");
  return reason;
}

export function routeLabel(id: string, t: T) {
  const k = "route." + id;
  const v = t(k);
  return v === k ? id : v;
}

export function txTitle(tx: { id: string; kind: string; title: string; legs: { currency: string }[] }, t: T) {
  const k = "tx." + tx.id;
  const v = t(k);
  if (v !== k) return v;
  if (tx.kind === "convert" && tx.legs.length === 2) return t("tx.convert", { from: tx.legs[0].currency, to: tx.legs[1].currency });
  return tx.title;
}

export function draftSummary(d: { kind: string; summary: string; payload?: unknown }, t: T, money: (n: number, c: never) => string) {
  const p = d.payload as Record<string, unknown> | undefined;
  if (!p) return d.summary;
  if (d.kind === "convert") return t("card.convertSum", { a: money(p.amount as number, p.from as never), b: money(p.receive as number, p.to as never) });
  return t("card.paySum", { a: money(p.amount as number, p.currency as never), to: String(p.payeeName) });
}
