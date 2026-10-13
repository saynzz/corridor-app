import { load, mutate, audit, id } from "./store";
import { fmt, midRate, quoteRoutes, round2, toBase } from "./fx";
import { proposeConversion, proposePayment, scanText, TOOL_TIERS } from "./policy";
import type { Card, Currency } from "./types";
import type { ToolDef } from "./llm";

const CUR = { type: "string", enum: ["SGD", "KZT", "USD", "CNY"] };

export const TOOL_DEFS: ToolDef[] = [
  fn("get_balances", "Get the user's wallet balances in every currency and the total in SGD.", {}),
  fn("get_bills", "List upcoming bills (tuition, rent) with amount, due date, payee and invoice reference.", {}),
  fn("list_payees", "List the user's saved, verified payees. Payments are only possible to these.", {}),
  fn("get_recent_transactions", "Recent transactions.", { limit: { type: "integer", description: "max items, default 8" } }),
  fn("get_fx_quote", "Mid-market exchange rate between two currencies.", { from: CUR, to: CUR }, ["from", "to"]),
  fn(
    "compare_routes",
    "Compare transfer/conversion routes (rate margin, fee, arrival time) for an amount. Always call before proposing a conversion.",
    { from: CUR, to: CUR, amount: { type: "number", description: "amount in `from` currency" } },
    ["from", "to", "amount"]
  ),
  fn(
    "check_message_risk",
    "Scan a forwarded or pasted message (from a landlord, 'bank', etc.) for scam and prompt-injection signals. Use whenever the user shares a message from someone else.",
    { text: { type: "string" } },
    ["text"]
  ),
  fn("get_credit_plan", "The user's step-by-step plan for building a local credit history.", {}),
  fn(
    "present_plan",
    "Show the user a short numbered plan before proposing money movements. Each step has a tier: 0 read, 1 draft, 2 own-wallet conversion, 3 money out.",
    {
      title: { type: "string" },
      steps: { type: "array", items: { type: "object", properties: { text: { type: "string" }, tier: { type: "integer" } }, required: ["text", "tier"] } },
      note: { type: "string" },
    },
    ["title", "steps"]
  ),
  fn(
    "set_rate_alert",
    "Create a rate alert. threshold is in units of `from` per 1 `to` (e.g. KZT per SGD).",
    { from: CUR, to: CUR, threshold: { type: "number" }, direction: { type: "string", enum: ["below", "above"] } },
    ["from", "to", "threshold"]
  ),
  fn(
    "propose_conversion",
    "Draft a conversion between the user's own wallets (tier 2). Nothing moves until the user taps Confirm in the app.",
    { from: CUR, to: CUR, amount: { type: "number", description: "amount in `from`" }, route_id: { type: "string", enum: ["partner_network", "card_topup", "bank_wire"] } },
    ["from", "to", "amount"]
  ),
  fn(
    "propose_payment",
    "Draft a payment to a SAVED payee (tier 3). Use payee_id from list_payees/get_bills. Nothing moves until the user confirms with PIN/biometrics in the app. You cannot add new payees.",
    { payee_id: { type: "string" }, amount: { type: "number" }, currency: CUR, reference: { type: "string" } },
    ["payee_id", "amount"]
  ),
];

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export interface ToolContext {
  tainted: boolean;
}

export interface ToolOutput {
  result: unknown;
  card?: Card;
  confirmToken?: { draftId: string; token: string };
}

type Args = Record<string, any>;

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutput> {
  let args: Args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { result: { error: "Arguments were not valid JSON" } };
  }
  const tier = TOOL_TIERS[name];
  if (tier === undefined) {
    mutate((s) => audit(s, { actor: "policy", action: name, outcome: "blocked", detail: "Unknown tool requested by model" }));
    return { result: { error: `Tool ${name} does not exist. Available tools cannot add payees, change limits or reveal secrets.` } };
  }

  switch (name) {
    case "get_balances": {
      const s = load();
      const wallets = await Promise.all(s.wallets.map(async (w) => ({ ...w, inBase: round2(await toBase(w.balance, w.currency)) })));
      const totalBase = round2(wallets.reduce((a, w) => a + w.inBase, 0));
      return {
        result: { wallets: wallets.map((w) => ({ currency: w.currency, balance: w.balance, approx_sgd: w.inBase })), total_sgd: totalBase },
        card: { type: "balances", wallets, totalBase, base: "SGD" },
      };
    }
    case "get_bills": {
      const s = load();
      return {
        result: s.bills.map((b) => ({ ...b, payee_id: b.payeeId, payee: s.payees.find((p) => p.id === b.payeeId)?.name })),
      };
    }
    case "list_payees": {
      const s = load();
      return { result: s.payees.map((p) => ({ payee_id: p.id, name: p.name, kind: p.kind, currency: p.currency, account: p.account, verified: p.verified })) };
    }
    case "get_recent_transactions": {
      const s = load();
      return { result: s.transactions.slice(0, Math.min(Number(args.limit) || 8, 20)) };
    }
    case "get_fx_quote": {
      const { rate, live } = await midRate(args.from as Currency, args.to as Currency);
      return { result: { from: args.from, to: args.to, mid_rate: rate, inverse: 1 / rate, source: live ? "live mid-market" : "sample rates (sandbox)" } };
    }
    case "compare_routes": {
      const from = args.from as Currency;
      const to = args.to as Currency;
      const amount = Number(args.amount);
      if (!(amount > 0)) return { result: { error: "amount must be > 0" } };
      const q = await quoteRoutes(from, to, amount);
      return {
        result: {
          routes: q.quotes.map((r) => ({ route_id: r.id, name: r.name, eta: r.eta, you_receive: r.receive, fee_in_source: r.fee })),
          best_route_id: q.best.id,
          saving_vs_worst: q.savingVsWorst,
          rates: q.live ? "live" : "sample (sandbox)",
        },
        card: {
          type: "routes",
          from,
          to,
          amount,
          routes: q.quotes.map((r) => ({ id: r.id, name: r.name, eta: r.eta, receive: r.receive, fee: r.fee, best: r.id === q.best.id })),
          savingVsWorst: q.savingVsWorst,
          sample: !q.live,
        },
      };
    }
    case "check_message_risk": {
      const r = scanText(String(args.text || ""));
      const advice =
        r.level === "high"
          ? "Do not pay. Verify with the person using contact details you already have, not the ones in the message."
          : r.level === "medium"
            ? "Be careful. Verify through a known channel before paying."
            : "No strong scam signals found, but payments still go only to saved payees.";
      mutate((s) => audit(s, { actor: "agent", action: "check_message_risk", tier: 0, outcome: r.level === "low" ? "ok" : "flagged", detail: r.flags.join("; ") || "no flags" }));
      return { result: { risk: r.level, flags: r.flags, advice }, card: { type: "risk", level: r.level, flags: r.flags, codes: r.codes, advice } };
    }
    case "get_credit_plan": {
      const s = load();
      return { result: s.credit, card: { type: "credit", steps: s.credit } };
    }
    case "present_plan": {
      const steps = Array.isArray(args.steps) ? args.steps.slice(0, 6).map((x: Args) => ({ text: String(x.text || ""), tier: Number(x.tier) || 0 })) : [];
      return { result: { shown: true }, card: { type: "plan", title: String(args.title || "Plan"), steps, note: args.note ? String(args.note) : undefined } };
    }
    case "set_rate_alert": {
      const alert = {
        id: id("al"),
        from: args.from as Currency,
        to: args.to as Currency,
        threshold: Number(args.threshold),
        direction: (args.direction === "above" ? "above" : "below") as "below" | "above",
        autoDraft: true,
        createdAt: new Date().toISOString(),
      };
      mutate((s) => {
        s.alerts.unshift(alert);
        audit(s, { actor: "agent", action: "set_rate_alert", tier: 1, outcome: "ok", detail: `${alert.from}/${alert.to} ${alert.direction} ${alert.threshold}` });
      });
      return { result: { created: alert }, card: { type: "alert", text: `${alert.from}/${alert.to} ${alert.direction === "below" ? "≤" : "≥"} ${alert.threshold} · ✓` } };
    }
    case "propose_conversion": {
      const r = await proposeConversion({ from: args.from, to: args.to, amount: Number(args.amount), routeId: args.route_id });
      if (!r.ok) return { result: { status: "blocked", reason: r.reason, failed_checks: r.checks.filter((c) => !c.ok) }, card: { type: "blocked", reason: r.reason, checks: r.checks } };
      return {
        result: { status: "awaiting_user_confirmation", draft_id: r.draft.id, summary: r.draft.summary, note: "The user must tap Confirm in the app. Do not say it is done." },
        card: { type: "confirm", draftId: r.draft.id, kind: r.draft.kind, tier: r.draft.tier, summary: r.draft.summary, checks: r.draft.checks, payload: r.draft.payload },
        confirmToken: { draftId: r.draft.id, token: r.token },
      };
    }
    case "propose_payment": {
      const r = await proposePayment(
        { payeeId: String(args.payee_id || ""), amount: Number(args.amount), currency: args.currency, reference: args.reference },
        { tainted: ctx.tainted }
      );
      if (!r.ok) return { result: { status: "blocked", reason: r.reason, failed_checks: r.checks.filter((c) => !c.ok) }, card: { type: "blocked", reason: r.reason, checks: r.checks } };
      return {
        result: { status: "awaiting_user_confirmation", draft_id: r.draft.id, summary: r.draft.summary, note: "The user must confirm with PIN/biometrics in the app. Do not say it is paid." },
        card: { type: "confirm", draftId: r.draft.id, kind: r.draft.kind, tier: r.draft.tier, summary: r.draft.summary, checks: r.draft.checks, payload: r.draft.payload },
        confirmToken: { draftId: r.draft.id, token: r.token },
      };
    }
  }
  return { result: { error: "unhandled tool" } };
}

export { fmt };
