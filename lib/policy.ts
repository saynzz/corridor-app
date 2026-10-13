import crypto from "node:crypto";
import { audit, id, load, mutate } from "./store";
import { fmt, midRate, quoteRoutes, round2 } from "./fx";
import type { BankState, Check, ConvertPayload, Currency, Draft, PaymentPayload } from "./types";

export const TOOL_TIERS: Record<string, 0 | 1 | 2 | 3> = {
  get_balances: 0,
  get_bills: 0,
  list_payees: 0,
  get_recent_transactions: 0,
  get_fx_quote: 0,
  compare_routes: 0,
  check_message_risk: 0,
  get_credit_plan: 0,
  present_plan: 1,
  set_rate_alert: 1,
  propose_conversion: 2,
  propose_payment: 3,
};

const DRAFT_TTL_MIN = 30;

function secret() {
  return process.env.CONFIRM_SECRET || "dev-only-secret-change-me";
}

export function signDraft(d: Pick<Draft, "id" | "kind" | "payload" | "expiresAt">) {
  const body = JSON.stringify([d.id, d.kind, d.payload, d.expiresAt]);
  return crypto.createHmac("sha256", secret()).update(body).digest("hex");
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const PATTERNS: { re: RegExp; code: string; flag: string; weight: number }[] = [
  { re: /(ignore|disregard|forget)\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(rules|instructions|prompts?)/i, code: "injection", flag: "Contains instructions aimed at the assistant (prompt injection)", weight: 3 },
  { re: /\b(assistant|system|ai|bot|agent)\s*[:,]\s*(please\s+)?(transfer|send|pay|approve|execute|ignore)/i, code: "ai_direct", flag: "Addresses the AI directly and asks it to act", weight: 3 },
  { re: /игнорир\w*\s+(все\s+)?(предыдущ|прошл)\w*|забудь\s+(все\s+)?(правила|инструкц)/i, code: "injection", flag: "Contains instructions aimed at the assistant (prompt injection)", weight: 3 },
  { re: /(алдыңғы\s+)?ережелерді\s+елеме|忽略.{0,4}(规则|指令)|abaikan (arahan|peraturan)|bỏ qua (các )?(quy tắc|hướng dẫn)/i, code: "injection", flag: "Contains instructions aimed at the assistant (prompt injection)", weight: 3 },
  { re: /жаңа шот|新账户|新的账户|akaun baharu|tài khoản mới|банк ауыс|银行换/i, code: "new_account", flag: "Asks to pay a new or changed account", weight: 2 },
  { re: /шұғыл|дереу|立即|马上|今天.{0,6}(转|付)|segera|ngay hôm nay|gấp/i, code: "urgency", flag: "Urgency or threat pressure", weight: 1 },
  { re: /(new|changed|updated|different)\s+(bank\s+)?(account|iban|card|details)|bank\s+(has\s+)?changed|новы[йе]\s+(сч[её]т|реквизит)|сменил\w*\s+(сч[её]т|банк)/i, code: "new_account", flag: "Asks to pay a new or changed account", weight: 2 },
  { re: /\b(urgent|urgently|immediately|right now|today or|within \d+ (minutes|hours)|asap|lose the (room|place|apartment)|срочно|немедленно|сегодня же)\b/i, code: "urgency", flag: "Urgency or threat pressure", weight: 1 },
  { re: /\b(pin|password|otp|one[- ]time code|cvv|verification code|код из смс|пароль)\b/i, code: "credentials", flag: "Asks for credentials or codes", weight: 3 },
  { re: /\b(gift ?cards?|crypto|bitcoin|usdt|western union)\b/i, code: "unusual_method", flag: "Unusual payment method", weight: 2 },
  { re: /(raise|increase|change|remove|disable)\s+(my\s+|the\s+)?(limit|limits|confirmation|2fa|security)/i, code: "limits", flag: "Tries to change limits or security settings", weight: 3 },
  { re: /\b(i am|i'm|this is|it's)\s+(your\s+)?(landlord|bank|university|bursar|police|embassy)\b/i, code: "impersonation", flag: "Impersonation claim inside a forwarded message", weight: 1 },
];

export function scanText(text: string) {
  const flags = new Map<string, string>();
  let score = 0;
  for (const p of PATTERNS) {
    if (p.re.test(text) && !flags.has(p.code)) {
      score += p.weight;
      flags.set(p.code, p.flag);
    }
  }
  const level: "low" | "medium" | "high" = score >= 3 ? "high" : score >= 2 ? "medium" : "low";
  return { level, score, flags: [...flags.values()], codes: [...flags.keys()] };
}

async function sgdValue(amount: number, c: Currency) {
  const { rate } = await midRate(c, "SGD");
  return amount * rate;
}

async function usedToday(s: BankState, kind: "convert" | "payment") {
  const since = Date.now() - 24 * 3600 * 1000;
  let sum = 0;
  for (const d of s.drafts) {
    if (d.kind !== kind || d.status !== "executed" || Date.parse(d.createdAt) < since) continue;
    const p = d.payload as ConvertPayload & PaymentPayload;
    sum += await sgdValue(kind === "convert" ? p.amount : p.amount, kind === "convert" ? p.from : p.currency);
  }
  return sum;
}

async function usedThisMonth(s: BankState) {
  const m = new Date().toISOString().slice(0, 7);
  let sum = 0;
  for (const d of s.drafts) {
    if (d.kind !== "payment" || d.status !== "executed" || !d.createdAt.startsWith(m)) continue;
    const p = d.payload as PaymentPayload;
    sum += await sgdValue(p.amount, p.currency);
  }
  return sum;
}

export type DraftResult =
  | { ok: true; draft: Draft; token: string }
  | { ok: false; reason: string; checks: Check[] };

export async function proposeConversion(
  args: { from: Currency; to: Currency; amount: number; routeId?: string },
  createdBy: "agent" | "user" = "agent"
): Promise<DraftResult> {
  const s = load();
  const checks: Check[] = [];
  const amount = Number(args.amount);
  const wallet = s.wallets.find((w) => w.currency === args.from);
  const valid = !!wallet && s.wallets.some((w) => w.currency === args.to) && args.from !== args.to && amount > 0;
  checks.push({ code: "wallets_own", label: "Both wallets belong to you", ok: valid });
  if (!valid) return block(s, "propose_conversion", "Invalid currencies or amount", checks, 2);

  const q = await quoteRoutes(args.from, args.to, amount);
  const route = q.quotes.find((r) => r.id === args.routeId) || q.best;
  checks.push({ code: "enough_balance", vars: { cur: args.from }, label: `Enough ${args.from} in wallet`, ok: wallet!.balance >= amount, detail: `${fmt(wallet!.balance, args.from)} available` });
  const sgd = await sgdValue(amount, args.from);
  const used = await usedToday(s, "convert");
  checks.push({
    code: "daily_convert",
    label: "Within daily conversion limit",
    ok: used + sgd <= s.limits.convertDailySGD,
    detail: `${fmt(round2(used + sgd), "SGD")} of ${fmt(s.limits.convertDailySGD, "SGD")}`,
  });
  checks.push({ code: route.id === q.best.id ? "cheapest_route" : "route", vars: { route: route.id }, label: route.id === q.best.id ? "Cheapest route selected" : `Route: ${route.name}`, ok: true });
  if (checks.some((c) => !c.ok)) return block(s, "propose_conversion", "Conversion checks failed", checks, 2);

  const payload: ConvertPayload = { from: args.from, to: args.to, amount, routeId: route.id, receive: route.receive, rate: route.rate };
  const summary = `Convert ${fmt(amount, args.from)} → ${fmt(route.receive, args.to)} via ${route.name}`;
  return createDraft(s, "convert", 2, payload, summary, checks, createdBy);
}

export async function proposePayment(
  args: { payeeId: string; amount: number; currency?: Currency; reference?: string },
  ctx: { tainted?: boolean; createdBy?: "agent" | "user" } = {}
): Promise<DraftResult> {
  const s = load();
  const checks: Check[] = [];
  const payee = s.payees.find((p) => p.id === args.payeeId);

  if (ctx.tainted) {
    checks.push({ code: "not_tainted", label: "Request is not derived from flagged forwarded content", ok: false });
    return block(s, "propose_payment", "Blocked: this turn contains flagged untrusted content", checks, 3);
  }
  checks.push({ code: "payee_saved", label: "Payee is saved in your account", ok: !!payee, detail: payee ? payee.name : `Unknown payee id "${args.payeeId}"` });
  if (!payee) return block(s, "propose_payment", "Payee not found — new payees can only be added by you in the app, never from chat", checks, 3);

  const currency = (args.currency || payee.currency) as Currency;
  const amount = Number(args.amount);
  checks.push({ code: "payee_verified", label: "Payee verified", ok: payee.verified, detail: payee.verifiedVia });
  const ageH = (Date.now() - Date.parse(payee.addedAt)) / 3600e3;
  checks.push({
    code: "cooloff",
    vars: { h: s.limits.newPayeeCoolOffHours },
    label: `Payee older than ${s.limits.newPayeeCoolOffHours} h cooling-off`,
    ok: ageH >= s.limits.newPayeeCoolOffHours,
  });
  checks.push({ code: "currency_match", label: "Currency matches payee account", ok: currency === payee.currency, detail: payee.currency });
  checks.push({ code: "amount_positive", label: "Amount is positive", ok: amount > 0 });

  const bill = s.bills.find((b) => b.payeeId === payee.id && b.status === "due");
  if (bill) {
    checks.push({
      code: "invoice_match",
      label: "Amount matches the open invoice",
      ok: Math.abs(bill.amount - amount) < 0.01,
      detail: `${bill.title}: ${fmt(bill.amount, bill.currency)}`,
    });
  }
  const sgd = await sgdValue(amount, currency);
  checks.push({ code: "single_limit", label: "Within single-payment limit", ok: sgd <= s.limits.paymentSingleSGD, detail: `limit ${fmt(s.limits.paymentSingleSGD, "SGD")}` });
  const month = await usedThisMonth(s);
  checks.push({ code: "monthly_limit", label: "Within monthly limit", ok: month + sgd <= s.limits.paymentMonthlySGD });
  if (checks.some((c) => !c.ok)) return block(s, "propose_payment", "Payment checks failed", checks, 3);

  const payload: PaymentPayload = {
    payeeId: payee.id,
    payeeName: payee.name,
    amount,
    currency,
    reference: (args.reference || bill?.reference || "").slice(0, 60),
    billId: bill && Math.abs(bill.amount - amount) < 0.01 ? bill.id : undefined,
  };
  const summary = `Pay ${fmt(amount, currency)} to ${payee.name}${payload.reference ? ` · ref ${payload.reference}` : ""}`;
  return createDraft(s, "payment", 3, payload, summary, checks, ctx.createdBy || "agent");
}

function block(s: BankState, action: string, reason: string, checks: Check[], tier: number): DraftResult {
  mutate((st) => audit(st, { actor: "policy", action, tier, outcome: "blocked", detail: reason + " — " + checks.filter((c) => !c.ok).map((c) => c.label).join("; ") }));
  void s;
  return { ok: false, reason, checks };
}

function createDraft(
  _s: BankState,
  kind: Draft["kind"],
  tier: 2 | 3,
  payload: Draft["payload"],
  summary: string,
  checks: Check[],
  createdBy: "agent" | "user"
): DraftResult {
  const now = Date.now();
  const draft: Draft = {
    id: id("d"),
    kind,
    tier,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DRAFT_TTL_MIN * 60e3).toISOString(),
    status: "pending",
    payload,
    summary,
    checks,
    createdBy,
  };
  mutate((st) => {
    st.drafts.unshift(draft);
    audit(st, { actor: createdBy, action: `draft_${kind}`, tier, outcome: "needs_confirmation", detail: summary });
  });
  return { ok: true, draft, token: signDraft(draft) };
}

export async function executeDraft(draftId: string, token: string, pin?: string, biometric = false) {
  const s = load();
  const d = s.drafts.find((x) => x.id === draftId);
  const fail = (reason: string, code = "generic") => {
    mutate((st) => audit(st, { actor: "policy", action: "execute", tier: d?.tier, outcome: "blocked", detail: `${draftId}: ${reason}` }));
    return { ok: false as const, reason, code };
  };
  if (!d) return fail("Draft not found", "not_found");
  if (d.status !== "pending") return fail(`Draft is ${d.status}`, "status");
  if (Date.now() > Date.parse(d.expiresAt)) {
    mutate((st) => {
      const x = st.drafts.find((y) => y.id === draftId);
      if (x) x.status = "expired";
    });
    return fail("Draft expired — ask the agent for a fresh quote", "expired");
  }
  if (!sameToken(token, signDraft(d))) return fail("Invalid confirmation token (draft was modified or token forged)", "bad_token");
  const bioOk = biometric && process.env.DEMO_BIOMETRIC !== "0";
  if (d.tier === 3 && !bioOk && (pin || "") !== (process.env.DEMO_PIN || "2468")) return fail("Wrong PIN", "wrong_pin");

  if (d.kind === "convert") {
    const p = d.payload as ConvertPayload;
    const w = s.wallets.find((x) => x.currency === p.from)!;
    if (w.balance < p.amount) return fail(`Not enough ${p.from}`, "insufficient");
    return mutate((st) => {
      st.wallets.find((x) => x.currency === p.from)!.balance = round2(st.wallets.find((x) => x.currency === p.from)!.balance - p.amount);
      st.wallets.find((x) => x.currency === p.to)!.balance = round2(st.wallets.find((x) => x.currency === p.to)!.balance + p.receive);
      const x = st.drafts.find((y) => y.id === draftId)!;
      x.status = "executed";
      st.transactions.unshift({
        id: id("t"),
        at: new Date().toISOString(),
        kind: "convert",
        title: d.summary,
        legs: [
          { currency: p.from, amount: -p.amount },
          { currency: p.to, amount: p.receive },
        ],
        draftId,
      });
      audit(st, { actor: "user", action: "execute_convert", tier: 2, outcome: "ok", detail: d.summary });
      return { ok: true as const, summary: d.summary };
    });
  }

  const p = d.payload as PaymentPayload;
  const w = s.wallets.find((x) => x.currency === p.currency);
  if (!w || w.balance < p.amount) return fail(`Not enough ${p.currency} — convert first`, "insufficient");
  const payee = s.payees.find((x) => x.id === p.payeeId);
  if (!payee || !payee.verified) return fail("Payee no longer verified", "payee_unverified");
  return mutate((st) => {
    const wallet = st.wallets.find((x) => x.currency === p.currency)!;
    wallet.balance = round2(wallet.balance - p.amount);
    const x = st.drafts.find((y) => y.id === draftId)!;
    x.status = "executed";
    if (p.billId) {
      const b = st.bills.find((y) => y.id === p.billId);
      if (b) b.status = "paid";
    }
    st.transactions.unshift({
      id: id("t"),
      at: new Date().toISOString(),
      kind: "payment",
      title: `${p.payeeName}${p.reference ? " · " + p.reference : ""}`,
      legs: [{ currency: p.currency, amount: -p.amount }],
      draftId,
    });
    audit(st, { actor: "user", action: "execute_payment", tier: 3, outcome: "ok", detail: d.summary });
    return { ok: true as const, summary: d.summary };
  });
}

export function cancelDraft(draftId: string) {
  return mutate((st) => {
    const d = st.drafts.find((x) => x.id === draftId);
    if (!d || d.status !== "pending") return { ok: false, reason: "Not pending" };
    d.status = "cancelled";
    audit(st, { actor: "user", action: "cancel_draft", tier: d.tier, outcome: "ok", detail: d.summary });
    return { ok: true };
  });
}
