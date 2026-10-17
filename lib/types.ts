export type Currency = "SGD" | "IDR" | "USD" | "CNY";
export const CURRENCIES: Currency[] = ["SGD", "IDR", "USD", "CNY"];

export interface Wallet {
  currency: Currency;
  balance: number;
  label: string;
}

export type PayeeKind = "university" | "landlord" | "family" | "merchant";

export interface Payee {
  id: string;
  name: string;
  kind: PayeeKind;
  currency: Currency;
  account: string;
  phone?: string;
  verified: boolean;
  verifiedVia: string;
  addedAt: string;
}

export interface Transaction {
  id: string;
  at: string;
  kind: "incoming" | "convert" | "payment";
  title: string;
  legs: { currency: Currency; amount: number }[];
  draftId?: string;
}

export interface Bill {
  id: string;
  payeeId: string;
  title: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  reference: string;
  status: "due" | "paid";
}

export interface Check {
  code?: string;
  vars?: Record<string, string | number>;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ConvertPayload {
  from: Currency;
  to: Currency;
  amount: number;
  routeId: string;
  receive: number;
  rate: number;
}

export interface PaymentPayload {
  payeeId: string;
  payeeName: string;
  amount: number;
  currency: Currency;
  reference: string;
  billId?: string;
}

export interface Draft {
  id: string;
  kind: "convert" | "payment";
  tier: 2 | 3;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "executed" | "cancelled" | "expired" | "blocked";
  payload: ConvertPayload | PaymentPayload;
  summary: string;
  checks: Check[];
  createdBy: "agent" | "user";
}

export interface RateAlert {
  id: string;
  from: Currency;
  to: Currency;
  threshold: number;
  direction: "below" | "above";
  autoDraft: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: "user" | "agent" | "policy" | "system";
  action: string;
  tier?: number;
  outcome: "ok" | "blocked" | "needs_confirmation" | "error" | "flagged";
  detail: string;
  prev?: string;
  hash?: string;
}

export interface CreditStep {
  id: string;
  title: string;
  why: string;
  done: boolean;
}

export interface Profile {
  name: string;
  homeCountry: string;
  homeCity: string;
  studyCountry: string;
  university: string;
  baseCurrency: Currency;
  homeCurrency: Currency;
}

export interface Limits {
  convertDailySGD: number;
  paymentSingleSGD: number;
  paymentMonthlySGD: number;
  newPayeeCoolOffHours: number;
}

export interface BankState {
  version: number;
  profile: Profile;
  wallets: Wallet[];
  payees: Payee[];
  bills: Bill[];
  transactions: Transaction[];
  drafts: Draft[];
  alerts: RateAlert[];
  audit: AuditEntry[];
  credit: CreditStep[];
  limits: Limits;
}

export type Card =
  | { type: "balances"; wallets: (Wallet & { inBase: number })[]; totalBase: number; base: Currency }
  | {
      type: "routes";
      from: Currency;
      to: Currency;
      amount: number;
      routes: { id: string; name: string; eta: string; receive: number; fee: number; best: boolean }[];
      savingVsWorst: number;
      sample: boolean;
    }
  | { type: "plan"; title: string; steps: { text: string; tier: number }[]; note?: string }
  | { type: "confirm"; draftId: string; kind: Draft["kind"]; tier: 2 | 3; summary: string; checks: Check[]; payload?: Draft["payload"] }
  | { type: "blocked"; reason: string; checks: Check[] }
  | { type: "risk"; level: "low" | "medium" | "high"; flags: string[]; codes?: string[]; advice: string }
  | { type: "alert"; text: string }
  | { type: "credit"; steps: CreditStep[] }
  | {
      type: "case";
      obligation: { amount: number; reference: string; dueDate: string } | null;
      status: Record<string, string | boolean>;
      funding?: { reserve: number; available: number; contribution: number; topup: number } | null;
      routes?: { routeId: string; name: string; feasible: boolean; reason?: string; detail?: string; debitIdr: number; netSgd: number; postingDate: string }[];
      next?: string;
      whatIf?: boolean;
    };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
