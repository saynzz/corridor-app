export type Role = "student" | "payer" | "operator";

export type DocStatus = "VALID" | "MISMATCH" | "EXPIRED" | "REVOKED" | "UNKNOWN_ISSUER" | "UNAVAILABLE";
export type PlanStatus = "DRAFT" | "NEEDS_INFORMATION" | "READY" | "APPROVED" | "BLOCKED" | "EXPIRED" | "SUPERSEDED";
export type AttemptStatus = "CREATED" | "SUBMITTED" | "PROCESSING" | "UNKNOWN" | "SETTLED" | "FAILED" | "CANCELLED";
export type PostingStatus = "NOT_OBSERVED" | "PENDING" | "PARTIAL" | "POSTED";
export type ReasonCode =
  | "RESERVE_BREACH"
  | "METHOD_UNSUPPORTED"
  | "DEADLINE_INFEASIBLE"
  | "DOCUMENT_MISMATCH"
  | "PROOF_REVOKED"
  | "PROOF_EXPIRED"
  | "UNKNOWN_ISSUER"
  | "VERIFICATION_UNAVAILABLE"
  | "QUOTE_EXPIRED"
  | "AUTH_REQUIRED"
  | "ATTEMPT_UNKNOWN"
  | "BUDGET_EXCEEDED"
  | "SHORTFALL"
  | "UNKNOWN_FEE"
  | "NOT_VERIFIED"
  | "FIELDS_UNCONFIRMED"
  | "PLAN_CHANGED"
  | "SUSPICIOUS_INSTRUCTION"
  | "PAYEE_MISMATCH"
  | "NOT_APPROVED"
  | "CONSENT_REQUIRED"
  | "CASE_LOCKED";

export interface Member {
  userId: string;
  role: Role;
  name: string;
  accountRef: string;
}

export interface Obligation {
  id: string;
  version: number;
  amount: number;
  currency: "SGD";
  reference: string;
  dueDate: string;
  studentRef: string;
}

export interface ExtractedField {
  value: string;
  source: "parsed" | "manual" | "missing";
  needsReview: boolean;
}

export interface UploadedDoc {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  storedAs: string;
  text: string;
  fields: Record<"amount" | "currency" | "studentId" | "university" | "dueDate" | "reference" | "payeeAccount", ExtractedField>;
  fieldsConfirmed: boolean;
  suspicious: string[];
}

export interface Consent {
  id: string;
  purpose: string;
  scope: string[];
  grantedBy: string;
  at: string;
  revoked: boolean;
}

export interface VerificationRecord {
  proofId: string;
  issuerId: string | null;
  keyId: string | null;
  documentHash: string;
  hashAlgorithm: "SHA-256";
  subjectRef: string | null;
  obligationId: string | null;
  invoiceVersion: number | null;
  claims: { amount: number; currency: string; reference: string; dueDate: string; payeeRulesRef: string } | null;
  issuedAt: string | null;
  expiresAt: string | null;
  statusRef: string | null;
  audience: string;
  purpose: string;
  nonce: string;
  consentRef: string;
  verificationStatus: DocStatus;
  checks: { label: string; ok: boolean; code?: string }[];
  verifiedAt: string;
  jws?: string;
}

export interface Constraints {
  reserve: number;
  studentCap: number | null;
  familyLimitIdr: number;
  unaccountedFees: number;
  version: number;
}

export interface AccountSnapshot {
  balance: number;
  holds: number;
  pendingIncoming: number;
  takenAt: string;
  source: string;
}

export interface Quote {
  id: string;
  routeId: string;
  name: string;
  method: string;
  debitIdr: number;
  netSgd: number;
  receivingFee: number;
  feeKnown: boolean;
  businessDays: number;
  postingDate: string;
  expiresAt: string;
  feasible: boolean;
  reason?: ReasonCode;
  detail?: string;
  bufferDays?: number;
}

export interface SchemeResult {
  scheme: 1 | 2 | 3;
  feasible: boolean;
  reason?: ReasonCode;
  detail: string;
}

export interface PlanStep {
  n: 1 | 2;
  kind: "topup" | "tuition";
  owner: Role;
  accountRef: string;
  debit: { amount: number; currency: "SGD" | "IDR" };
  credit: { amount: number; currency: "SGD"; to: string };
  routeId?: string;
  quoteId?: string;
  reference?: string;
}

export interface Plan {
  id: string;
  version: number;
  createdAt: string;
  status: PlanStatus;
  scheme: 1 | 2 | 3;
  steps: PlanStep[];
  funding: { available: number; contribution: number; topup: number; reserve: number; holds: number; balance: number };
  invoiceVersion: number;
  rulesVersion: number;
  constraintsVersion: number;
  proofId: string;
  hash: string;
  blockedReason?: ReasonCode;
  blockedDetail?: string;
}

export interface Approval {
  id: string;
  planId: string;
  planVersion: number;
  planHash: string;
  role: Role;
  userId: string;
  steps: number[];
  at: string;
  method: "biometric" | "pin";
  valid: boolean;
}

export interface Attempt {
  id: string;
  planId: string;
  planVersion: number;
  step: 1 | 2;
  key: string;
  status: AttemptStatus;
  createdAt: string;
  updatedAt: string;
  amount: number;
  currency: "SGD" | "IDR";
  providerRef?: string;
  error?: string;
}

export interface Reservation {
  id: string;
  attemptId: string;
  amount: number;
  status: "ACTIVE" | "RELEASED" | "CONSUMED";
}

export interface PostingEvent {
  id: string;
  obligationId: string;
  amount: number;
  status: PostingStatus;
  at: string;
  jws: string;
  verified: boolean;
}

export interface CaseEvent {
  id: string;
  at: string;
  actor: string;
  type: string;
  detail: string;
  refs?: Record<string, string | number>;
}

export interface Faults {
  loseNextResponse: boolean;
  failNextTuition: boolean;
  delayTopup: boolean;
  postingMode: "auto" | "delayed" | "partial";
  statusServiceDown: boolean;
}

export interface PaymentCase {
  id: string;
  createdAt: string;
  members: Member[];
  obligation: Obligation | null;
  documents: UploadedDoc[];
  activeDocId: string | null;
  consents: Consent[];
  verification: VerificationRecord | null;
  constraints: Constraints;
  snapshot: AccountSnapshot;
  familyAccount: { balanceIdr: number; accountRef: string };
  quotes: Quote[];
  schemes: SchemeResult[];
  plan: Plan | null;
  planHistory: { id: string; version: number; status: PlanStatus; hash: string }[];
  approvals: Approval[];
  attempts: Attempt[];
  reservations: Reservation[];
  outbox: { id: string; attemptId: string; at: string; sent: boolean }[];
  posting: { status: PostingStatus; postedAmount: number; events: PostingEvent[]; firstSeenAt?: string };
  provider: Record<string, { status: AttemptStatus; at: string; op: string; amount: number; settleAfter?: number }>;
  faults: Faults;
  events: CaseEvent[];
  completed: boolean;
}
