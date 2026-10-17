import { addBusinessDays, businessDaysBetween, effectiveStart } from "./calendar";
import { RULES } from "./issuer";
import { randomId, sha256Hex } from "./jws";
import type { Constraints, AccountSnapshot, Quote, SchemeResult, Plan, PlanStep, ReasonCode } from "./types";

export const QUOTE_TTL_MIN = 15;

export const TOPUP_ROUTES = [
  { routeId: "A", name: "Bank wire (SWIFT)", method: "swift_idr_to_sgd", idrPerSgd: 12328.77, receivingFee: 0, feeKnown: true, businessDays: 5 },
  { routeId: "B", name: "Partner network", method: "partner_network_sgd", idrPerSgd: 12447.31, receivingFee: 0, feeKnown: true, businessDays: 2 },
  { routeId: "C", name: "Instant card top-up", method: "card_topup_sgd", idrPerSgd: 12223.39, receivingFee: 500, feeKnown: true, businessDays: 1 },
  { routeId: "D", name: "P2P marketplace", method: "p2p_sgd", idrPerSgd: 12100, receivingFee: 0, feeKnown: false, businessDays: 1 },
];

export const DIRECT_FAMILY_ROUTE = { method: "international_wire_idr", idrPerSgd: 12447.31 };

export function sgd(cents: number) {
  return "SGD " + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function idr(units: number) {
  return "IDR " + units.toLocaleString("en-US");
}

export function funding(snapshot: AccountSnapshot, c: Constraints, obligation: number) {
  const available = Math.max(0, snapshot.balance - c.reserve - snapshot.holds);
  const contribution = Math.min(available, c.studentCap ?? Number.MAX_SAFE_INTEGER, obligation + c.unaccountedFees);
  const topup = Math.max(0, obligation + c.unaccountedFees - contribution);
  return { balance: snapshot.balance, holds: snapshot.holds, reserve: c.reserve, available, contribution, topup };
}

export function quoteRoutes(topup: number, familyLimitIdr: number, dueDate: string, now = new Date()): Quote[] {
  const start = effectiveStart(now);
  const latest = addBusinessDays(dueDate, -RULES.bufferDays);
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MIN * 60e3).toISOString();
  return TOPUP_ROUTES.map((r) => {
    const debitIdr = Math.round(((topup / 100) * r.idrPerSgd) / 1000) * 1000;
    const netSgd = topup - r.receivingFee;
    const postingDate = addBusinessDays(start, r.businessDays);
    const q: Quote = {
      id: randomId("q"),
      routeId: r.routeId,
      name: r.name,
      method: r.method,
      debitIdr,
      netSgd,
      receivingFee: r.receivingFee,
      feeKnown: r.feeKnown,
      businessDays: r.businessDays,
      postingDate,
      expiresAt,
      feasible: true,
      bufferDays: businessDaysBetween(postingDate, dueDate),
    };
    const fail = (reason: ReasonCode, detail: string) => Object.assign(q, { feasible: false, reason, detail });
    if (!r.feeKnown) return fail("UNKNOWN_FEE", "Receiving fee is not disclosed, so the net amount cannot be guaranteed");
    if (postingDate > latest)
      return fail("DEADLINE_INFEASIBLE", `Posts on ${postingDate}; must post by ${latest} to keep ${RULES.bufferDays} business day before the due date ${dueDate}`);
    if (netSgd < topup) return fail("SHORTFALL", `Delivers ${sgd(netSgd)}, short by ${sgd(topup - netSgd)} after the receiving fee`);
    if (debitIdr > familyLimitIdr) return fail("BUDGET_EXCEEDED", `Family debit ${idr(debitIdr)} exceeds the family limit ${idr(familyLimitIdr)}`);
    return q;
  });
}

export function evaluateSchemes(f: ReturnType<typeof funding>, obligation: number, quotes: Quote[], familyLimitIdr: number): SchemeResult[] {
  const s1: SchemeResult =
    f.available >= obligation
      ? { scheme: 1, feasible: true, detail: `Student pays ${sgd(obligation)} from available ${sgd(f.available)}; reserve ${sgd(f.reserve)} kept` }
      : { scheme: 1, feasible: false, reason: "RESERVE_BREACH", detail: `Available ${sgd(f.available)} is below ${sgd(obligation)} without touching the reserve ${sgd(f.reserve)}` };
  const directIdr = Math.round(((obligation / 100) * DIRECT_FAMILY_ROUTE.idrPerSgd) / 1000) * 1000;
  const s2: SchemeResult = !RULES.acceptedMethods.includes(DIRECT_FAMILY_ROUTE.method)
    ? { scheme: 2, feasible: false, reason: "METHOD_UNSUPPORTED", detail: `The university does not accept international IDR wires; direct family payment would also need ${idr(directIdr)} vs limit ${idr(familyLimitIdr)}` }
    : directIdr > familyLimitIdr
      ? { scheme: 2, feasible: false, reason: "BUDGET_EXCEEDED", detail: `${idr(directIdr)} exceeds the family limit ${idr(familyLimitIdr)}` }
      : { scheme: 2, feasible: true, detail: "Family pays the whole obligation" };
  const best = pickQuote(quotes);
  const s3: SchemeResult =
    f.topup === 0
      ? { scheme: 3, feasible: false, reason: "SHORTFALL", detail: "No top-up needed" }
      : best
        ? { scheme: 3, feasible: true, detail: `Family tops up ${sgd(f.topup)} via route ${best.routeId} (${idr(best.debitIdr)}), then the student pays ${sgd(obligation)}` }
        : { scheme: 3, feasible: false, reason: quotes.find((q) => q.reason)?.reason ?? "DEADLINE_INFEASIBLE", detail: "No complete route meets amount, budget and deadline" };
  return [s1, s2, s3];
}

export function pickQuote(quotes: Quote[]) {
  const ok = quotes.filter((q) => q.feasible);
  ok.sort((a, b) => a.debitIdr - b.debitIdr || a.businessDays - b.businessDays);
  return ok[0] ?? null;
}

export function buildPlan(input: {
  version: number;
  scheme: 1 | 3;
  f: ReturnType<typeof funding>;
  obligation: { amount: number; reference: string; version: number };
  quote: Quote | null;
  proofId: string;
  constraintsVersion: number;
  studentAccount: string;
  familyAccount: string;
}): Plan {
  const steps: PlanStep[] = [];
  if (input.scheme === 3 && input.quote) {
    steps.push({
      n: 1,
      kind: "topup",
      owner: "payer",
      accountRef: input.familyAccount,
      debit: { amount: input.quote.debitIdr, currency: "IDR" },
      credit: { amount: input.quote.netSgd, currency: "SGD", to: input.studentAccount },
      routeId: input.quote.routeId,
      quoteId: input.quote.id,
    });
  }
  steps.push({
    n: 2,
    kind: "tuition",
    owner: "student",
    accountRef: input.studentAccount,
    debit: { amount: input.obligation.amount, currency: "SGD" },
    credit: { amount: input.obligation.amount, currency: "SGD", to: `${RULES.payeeName} (${RULES.payeeAccount})` },
    reference: input.obligation.reference,
  });
  const body = {
    scheme: input.scheme,
    steps,
    funding: input.f,
    invoiceVersion: input.obligation.version,
    rulesVersion: RULES.version,
    constraintsVersion: input.constraintsVersion,
    proofId: input.proofId,
    quoteExpiresAt: input.quote?.expiresAt ?? null,
  };
  return {
    id: randomId("plan"),
    version: input.version,
    createdAt: new Date().toISOString(),
    status: "READY",
    scheme: input.scheme,
    steps,
    funding: input.f,
    invoiceVersion: input.obligation.version,
    rulesVersion: RULES.version,
    constraintsVersion: input.constraintsVersion,
    proofId: input.proofId,
    hash: sha256Hex(JSON.stringify(body)),
  };
}
