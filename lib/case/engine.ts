import { checkCredential } from "../session";
import { addBusinessDays, effectiveStart, fmtSgt } from "./calendar";
import { readBytes, readJson, removeRel, writeBytes, writeJson } from "./files";
import { RULES, STUDENT, currentStatement, expireCurrent, issueNewVersion, revokeCurrent, sampleDocument, seedIssuer, signPosting, studentRef } from "./issuer";
import { randomId, sha256Hex } from "./jws";
import { pdfText } from "./pdf";
import { buildPlan, evaluateSchemes, funding, idr, pickQuote, quoteRoutes, sgd } from "./planner";
import { PURPOSE, recheck, verifyDocument, verifyPosting } from "./verifier";
import { scanText } from "../policy";
import { load as loadBank, mutate as mutateBank, audit as bankAudit } from "../store";
import type { Attempt, CaseEvent, PaymentCase, ReasonCode, Role, UploadedDoc, ExtractedField } from "./types";

const FILE = "case/case.json";
const CRITICAL = ["amount", "currency", "reference", "dueDate"] as const;

let queue: Promise<unknown> = Promise.resolve();
export function locked<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export class CaseError extends Error {
  constructor(public code: ReasonCode | "NOT_FOUND" | "BAD_REQUEST", message: string, public status = 400) {
    super(message);
  }
}

function now() {
  return new Date().toISOString();
}

interface Stored {
  case: PaymentCase | null;
  executions: Record<string, unknown>;
}

function read(): Stored {
  return readJson<Stored>(FILE, () => ({ case: null, executions: {} }));
}
function write(s: Stored) {
  writeJson(FILE, s);
}

export function resetCase() {
  removeRel("case");
  removeRel("uploads");
  const due = addBusinessDays(effectiveStart(), 3);
  seedIssuer(due);
  write({ case: null, executions: {} });
}

function ensureSeeded() {
  try {
    currentStatement();
    if (!currentStatement()) throw new Error();
  } catch {
    resetCase();
  }
}

function studentBalanceCents() {
  const w = loadBank().wallets.find((x) => x.currency === "SGD");
  return Math.round((w?.balance ?? 0) * 100);
}

function ev(c: PaymentCase, actor: string, type: string, detail: string, refs?: CaseEvent["refs"]) {
  c.events.unshift({ id: randomId("ev"), at: now(), actor, type, detail, refs });
  if (c.events.length > 300) c.events.length = 300;
  mutateBank((b) => bankAudit(b, { actor: actor === "payer" || actor === "student" ? "user" : actor === "operator" ? "system" : "policy", action: "case." + type, outcome: /blocked|failed|mismatch|revoked|expired|unknown/i.test(type + detail) ? "blocked" : "ok", detail }));
}

export function getCase(): PaymentCase | null {
  ensureSeeded();
  return read().case;
}

function mutateCase<T>(fn: (c: PaymentCase, s: Stored) => T): T {
  const s = read();
  if (!s.case) throw new CaseError("NOT_FOUND", "No active case", 404);
  const out = fn(s.case, s);
  write(s);
  return out;
}

export function requireCase(id: string) {
  const c = getCase();
  if (!c || c.id !== id) throw new CaseError("NOT_FOUND", "Case not found", 404);
  return c;
}

function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) throw new CaseError("AUTH_REQUIRED", `This action needs the ${allowed.join(" or ")} role`, 403);
}

export function createCase(role: Role) {
  requireRole(role, ["student", "operator"]);
  ensureSeeded();
  const s = read();
  if (s.case && !s.case.completed) throw new CaseError("CASE_LOCKED", "An active case already exists for this obligation", 409);
  const c: PaymentCase = {
    id: randomId("case"),
    createdAt: now(),
    members: [
      { userId: "u_student", role: "student", name: STUDENT.name, accountRef: "Student SGD **** 3120" },
      { userId: "u_payer", role: "payer", name: "Budi Rahayu (father)", accountRef: "Family IDR **** 0912" },
      { userId: "u_operator", role: "operator", name: "Demo operator", accountRef: "-" },
    ],
    obligation: null,
    documents: [],
    activeDocId: null,
    consents: [],
    verification: null,
    constraints: { reserve: 150000, studentCap: null, familyLimitIdr: 4800000, unaccountedFees: 0, version: 1 },
    snapshot: { balance: studentBalanceCents(), holds: 0, pendingIncoming: 0, takenAt: now(), source: "Corridor sandbox ledger" },
    familyAccount: { balanceIdr: 9500000, accountRef: "Family IDR **** 0912" },
    quotes: [],
    schemes: [],
    plan: null,
    planHistory: [],
    approvals: [],
    attempts: [],
    reservations: [],
    outbox: [],
    posting: { status: "NOT_OBSERVED", postedAmount: 0, events: [] },
    provider: {},
    faults: { loseNextResponse: false, failNextTuition: false, delayTopup: false, postingMode: "auto", statusServiceDown: false },
    events: [],
    completed: false,
  };
  ev(c, role, "case_created", "Tuition payment case created for Lion City University");
  write({ case: c, executions: {} });
  return c;
}

function extract(text: string): UploadedDoc["fields"] {
  const f = (re: RegExp): ExtractedField => {
    const m = text.match(re);
    return m ? { value: m[1].trim(), source: "parsed", needsReview: false } : { value: "", source: "missing", needsReview: true };
  };
  const amt = text.match(/Amount due:\s*([A-Z]{3})\s*([\d,]+\.\d{2})/);
  return {
    amount: amt ? { value: amt[2].replace(/,/g, ""), source: "parsed", needsReview: false } : { value: "", source: "missing", needsReview: true },
    currency: amt ? { value: amt[1], source: "parsed", needsReview: false } : { value: "", source: "missing", needsReview: true },
    studentId: f(/Student ID:\s*(\S+)/),
    university: f(/University:\s*(.+)/),
    dueDate: f(/Due date:\s*(\d{4}-\d{2}-\d{2})/),
    reference: f(/Invoice reference:\s*(\S+)/),
    payeeAccount: f(/Pay to account:\s*(.+)/),
  };
}

function invalidatePlan(c: PaymentCase, why: string, status: "SUPERSEDED" | "EXPIRED" | "BLOCKED" = "SUPERSEDED", reason?: ReasonCode) {
  if (!c.plan || c.plan.status === "SUPERSEDED") return;
  if (c.attempts.some((a) => a.planId === c.plan!.id && ["SUBMITTED", "PROCESSING", "UNKNOWN"].includes(a.status)) && status !== "BLOCKED") {
    c.plan.status = "BLOCKED";
    c.plan.blockedReason = "ATTEMPT_UNKNOWN";
    c.plan.blockedDetail = "A payment is in progress; it must be resolved before the plan changes";
    return;
  }
  c.plan.status = status;
  if (reason) {
    c.plan.blockedReason = reason;
    c.plan.blockedDetail = why;
  }
  let n = 0;
  for (const a of c.approvals) if (a.planId === c.plan.id && a.valid) {
    a.valid = false;
    n++;
  }
  const h = c.planHistory.find((x) => x.id === c.plan!.id);
  if (h) h.status = c.plan.status;
  ev(c, "system", "plan_" + status.toLowerCase(), `${why}${n ? ` — ${n} approval(s) cancelled` : ""}`, { plan: c.plan.version });
}

export function uploadDocument(role: Role, file: { name: string; mime: string; bytes: Buffer }) {
  requireRole(role, ["student"]);
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mime)) throw new CaseError("BAD_REQUEST", "Only PDF, PNG or JPG files are accepted");
  if (file.bytes.length > 5 * 1024 * 1024) throw new CaseError("BAD_REQUEST", "File is larger than 5 MB");
  return mutateCase((c) => {
    const id = randomId("doc");
    const ext = file.mime === "application/pdf" ? "pdf" : file.mime === "image/png" ? "png" : "jpg";
    const storedAs = `uploads/${id}.${ext}`;
    writeBytes(storedAs, file.bytes);
    const text = file.mime === "application/pdf" ? pdfText(file.bytes) : "";
    const fields = extract(text);
    const suspicious = [...scanText(text).flags];
    if (fields.payeeAccount.value && fields.payeeAccount.value !== RULES.payeeAccount) suspicious.push("Payee account differs from the university's published payment details");
    const doc: UploadedDoc = {
      id,
      fileName: file.name.slice(0, 120),
      mime: file.mime,
      size: file.bytes.length,
      sha256: sha256Hex(file.bytes),
      uploadedAt: now(),
      storedAs,
      text,
      fields,
      fieldsConfirmed: false,
      suspicious,
    };
    c.documents.unshift(doc);
    c.activeDocId = id;
    c.verification = null;
    invalidatePlan(c, "A new invoice document was uploaded");
    ev(c, role, "document_uploaded", `${doc.fileName} (${(doc.size / 1024).toFixed(1)} KB, SHA-256 ${doc.sha256.slice(0, 12)}…)${suspicious.length ? ` — ${suspicious.length} suspicious instruction(s)` : ""}`);
    return doc;
  });
}

export function useSample(role: Role, kind: string) {
  const s = sampleDocument(kind);
  return uploadDocument(role, { name: s.fileName, mime: "application/pdf", bytes: s.bytes });
}

export function docBytes(role: Role, docId: string) {
  requireRole(role, ["student", "operator"]);
  const c = getCase();
  const d = c?.documents.find((x) => x.id === docId);
  if (!d) throw new CaseError("NOT_FOUND", "Document not found", 404);
  return { bytes: readBytes(d.storedAs), mime: d.mime, name: d.fileName };
}

export function giveConsent(role: Role) {
  requireRole(role, ["student"]);
  return mutateCase((c) => {
    const consent = { id: randomId("consent"), purpose: PURPOSE, scope: ["document_hash", "issuer", "obligation_claims", "status"], grantedBy: "u_student", at: now(), revoked: false };
    c.consents.unshift(consent);
    ev(c, role, "consent_given", `Verification consent for "${PURPOSE}" (hash, issuer, obligation claims, status only)`);
    return consent;
  });
}

export function verify(role: Role) {
  requireRole(role, ["student", "operator"]);
  return mutateCase((c) => {
    const doc = c.documents.find((d) => d.id === c.activeDocId);
    if (!doc) throw new CaseError("BAD_REQUEST", "Upload the invoice first");
    const consent = c.consents.find((x) => !x.revoked && x.purpose === PURPOSE);
    if (!consent) throw new CaseError("CONSENT_REQUIRED", "Consent to verification is required first", 412);
    const bytes = readBytes(doc.storedAs);
    const r = verifyDocument({
      bytes,
      text: doc.text,
      subjectRef: studentRef(STUDENT.id),
      obligationId: c.obligation?.id ?? null,
      consent,
      statusServiceDown: c.faults.statusServiceDown,
    });
    c.verification = r;
    if (r.verificationStatus === "VALID" && r.claims) {
      const changed = c.obligation && (c.obligation.version !== r.invoiceVersion || c.obligation.amount !== r.claims.amount);
      c.obligation = { id: r.obligationId!, version: r.invoiceVersion!, amount: r.claims.amount, currency: "SGD", reference: r.claims.reference, dueDate: r.claims.dueDate, studentRef: r.subjectRef! };
      for (const k of Object.keys(doc.fields) as (keyof UploadedDoc["fields"])[]) {
        const fld = doc.fields[k];
        const truth: Record<string, string> = { amount: (r.claims.amount / 100).toFixed(2), currency: r.claims.currency, reference: r.claims.reference, dueDate: r.claims.dueDate };
        if (truth[k] !== undefined) fld.needsReview = fld.value !== truth[k];
      }
      if (changed) invalidatePlan(c, "Invoice version or amount changed");
    } else {
      for (const k of CRITICAL) doc.fields[k].needsReview = true;
      doc.fieldsConfirmed = false;
      invalidatePlan(c, `Document verification: ${r.verificationStatus}`, "BLOCKED", statusToReason(r.verificationStatus));
    }
    ev(c, role, "verification_" + r.verificationStatus.toLowerCase(), `Demo source verification: ${r.verificationStatus}`, { proof: r.proofId });
    return r;
  });
}

function statusToReason(s: string): ReasonCode {
  return s === "REVOKED" ? "PROOF_REVOKED" : s === "EXPIRED" ? "PROOF_EXPIRED" : s === "UNKNOWN_ISSUER" ? "UNKNOWN_ISSUER" : s === "UNAVAILABLE" ? "VERIFICATION_UNAVAILABLE" : "DOCUMENT_MISMATCH";
}

export function confirmFields(role: Role, edits: Partial<Record<keyof UploadedDoc["fields"], string>>) {
  requireRole(role, ["student"]);
  return mutateCase((c) => {
    const doc = c.documents.find((d) => d.id === c.activeDocId);
    if (!doc) throw new CaseError("BAD_REQUEST", "No document");
    for (const [k, v] of Object.entries(edits)) {
      const f = doc.fields[k as keyof UploadedDoc["fields"]];
      if (f && typeof v === "string" && v !== f.value) {
        f.value = v.trim().slice(0, 80);
        f.source = "manual";
      }
    }
    const claims = c.verification?.verificationStatus === "VALID" ? c.verification.claims : null;
    const problems: string[] = [];
    for (const k of CRITICAL) {
      const f = doc.fields[k];
      if (!f.value) problems.push(`${k} is missing`);
      else if (claims) {
        const truth: Record<string, string> = { amount: (claims.amount / 100).toFixed(2), currency: claims.currency, reference: claims.reference, dueDate: claims.dueDate };
        f.needsReview = f.value !== truth[k];
        if (f.needsReview) problems.push(`${k} "${f.value}" does not match the issuer's signed value "${truth[k]}"`);
      }
    }
    if (doc.suspicious.length) problems.push("Document contains suspicious payment instructions");
    if (problems.length) {
      doc.fieldsConfirmed = false;
      ev(c, role, "fields_rejected", problems.join("; "));
      throw new CaseError("FIELDS_UNCONFIRMED", problems.join("; "), 422);
    }
    doc.fieldsConfirmed = true;
    ev(c, role, "fields_confirmed", "Invoice data confirmed against the issuer's signed claims");
    return doc;
  });
}

export function setConstraints(role: Role, body: { reserve?: number; studentCap?: number | null; familyLimitIdr?: number }) {
  return mutateCase((c) => {
    const before = JSON.stringify(c.constraints);
    if (body.reserve !== undefined || body.studentCap !== undefined) requireRole(role, ["student"]);
    if (body.familyLimitIdr !== undefined) requireRole(role, ["payer"]);
    if (body.reserve !== undefined) c.constraints.reserve = Math.max(0, Math.round(Number(body.reserve)));
    if (body.studentCap !== undefined) c.constraints.studentCap = body.studentCap === null ? null : Math.max(0, Math.round(Number(body.studentCap)));
    if (body.familyLimitIdr !== undefined) c.constraints.familyLimitIdr = Math.max(0, Math.round(Number(body.familyLimitIdr)));
    if (JSON.stringify(c.constraints) !== before) {
      c.constraints.version++;
      ev(c, role, "constraints_changed", `Reserve ${sgd(c.constraints.reserve)}, family limit ${idr(c.constraints.familyLimitIdr)}`);
      invalidatePlan(c, "Funding constraints changed");
      recompute(c);
    }
    return c.constraints;
  });
}

function snapshot(c: PaymentCase) {
  const pending = c.attempts.filter((a) => a.step === 1 && ["SUBMITTED", "PROCESSING", "UNKNOWN"].includes(a.status)).reduce((s, a) => s + (planStep(c, a)?.credit.amount ?? 0), 0);
  const reserved = c.reservations.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.amount, 0);
  c.snapshot = { ...c.snapshot, balance: studentBalanceCents() - reserved, pendingIncoming: pending, takenAt: now(), source: "Corridor sandbox ledger" };
}

function planStep(c: PaymentCase, a: Attempt) {
  return c.plan?.steps.find((s) => s.n === a.step);
}

function settledTopup(c: PaymentCase) {
  return c.attempts.some((a) => a.step === 1 && a.status === "SETTLED");
}

function recompute(c: PaymentCase) {
  snapshot(c);
  if (!c.obligation) return null;
  const f = funding(c.snapshot, c.constraints, c.obligation.amount);
  c.quotes = f.topup > 0 ? quoteRoutes(f.topup, c.constraints.familyLimitIdr, c.obligation.dueDate) : [];
  c.schemes = evaluateSchemes(f, c.obligation.amount, c.quotes, c.constraints.familyLimitIdr);
  return f;
}

export function calculate(role: Role) {
  requireRole(role, ["student", "payer", "operator"]);
  return mutateCase((c) => {
    const f = recompute(c);
    if (!f) throw new CaseError("NOT_VERIFIED", "Verify the invoice first", 412);
    ev(c, role, "funding_calculated", `Available ${sgd(f.available)}, contribution ${sgd(f.contribution)}, top-up ${sgd(f.topup)}`);
    return { funding: f, quotes: c.quotes, schemes: c.schemes };
  });
}

export function createPlan(role: Role) {
  requireRole(role, ["student"]);
  return mutateCase((c) => {
    const doc = c.documents.find((d) => d.id === c.activeDocId);
    const v = c.verification;
    if (!v || v.verificationStatus !== "VALID" || !c.obligation) throw new CaseError(v ? statusToReason(v.verificationStatus) : "NOT_VERIFIED", "The invoice must be verified (VALID) before planning", 412);
    if (doc?.suspicious.length) throw new CaseError("SUSPICIOUS_INSTRUCTION", "The document contains suspicious payment instructions", 412);
    if (!doc?.fieldsConfirmed) throw new CaseError("FIELDS_UNCONFIRMED", "Confirm the invoice data first", 412);
    const f = recompute(c)!;
    const s1 = c.schemes.find((s) => s.scheme === 1)!;
    const best = pickQuote(c.quotes);
    const scheme: 1 | 3 | null = s1.feasible ? 1 : best ? 3 : null;
    const version = (c.planHistory[0]?.version ?? 0) + 1;
    if (c.plan && c.plan.status !== "SUPERSEDED") invalidatePlan(c, "Replaced by a new plan version");
    if (!scheme) {
      const reason = (c.quotes.find((q) => q.reason === "BUDGET_EXCEEDED")?.reason ?? c.quotes.find((q) => !q.feasible)?.reason ?? "DEADLINE_INFEASIBLE") as ReasonCode;
      ev(c, role, "plan_blocked", "No complete route meets the amount, budget and deadline");
      throw new CaseError(reason, "No feasible plan: " + c.quotes.map((q) => `${q.routeId} ${q.reason}`).join(", "), 422);
    }
    const plan = buildPlan({
      version,
      scheme,
      f,
      obligation: c.obligation,
      quote: scheme === 3 ? best : null,
      proofId: v.proofId,
      constraintsVersion: c.constraints.version,
      studentAccount: "Student SGD **** 3120",
      familyAccount: c.familyAccount.accountRef,
    });
    if (settledTopup(c)) plan.steps = plan.steps.filter((s) => s.kind !== "topup");
    c.plan = plan;
    c.planHistory.unshift({ id: plan.id, version: plan.version, status: plan.status, hash: plan.hash });
    ev(c, role, "plan_ready", `Plan v${plan.version} (scheme ${scheme}${scheme === 3 ? `, route ${best!.routeId}` : ""}) hash ${plan.hash.slice(0, 10)}…`, { plan: plan.version });
    return plan;
  });
}

export function approve(role: Role, body: { planVersion: number; steps?: number[]; method?: "biometric" | "pin"; pin?: string }) {
  requireRole(role, ["student", "payer"]);
  return mutateCase((c) => {
    const p = c.plan;
    if (!p || p.version !== body.planVersion) throw new CaseError("PLAN_CHANGED", "The plan changed — review the new version", 409);
    if (!["READY", "APPROVED"].includes(p.status)) throw new CaseError("NOT_APPROVED", `Plan is ${p.status}`, 409);
    const mine = p.steps.filter((s) => s.owner === role).map((s) => s.n);
    const requested = body.steps ?? mine;
    const foreign = requested.filter((n) => !mine.includes(n as 1 | 2));
    if (foreign.length) {
      ev(c, role, "approval_rejected", `${role} tried to approve step(s) ${foreign.join(",")} owned by someone else`);
      throw new CaseError("AUTH_REQUIRED", "You can only approve debits from your own account", 403);
    }
    if (!requested.length) throw new CaseError("BAD_REQUEST", "Nothing for this role to approve");
    if (body.method !== "biometric" && !checkCredential(role, body.pin ?? "")) {
      ev(c, role, "approval_rejected", `${role} entered a wrong PIN`);
      throw new CaseError("AUTH_REQUIRED", "Wrong PIN", 403);
    }
    const topup = p.steps.find((s) => s.kind === "topup");
    if (topup && requested.includes(1)) {
      const q = c.quotes.find((x) => x.id === topup.quoteId);
      if (!q || Date.parse(q.expiresAt) < Date.now()) {
        invalidatePlan(c, "Quote expired before approval", "EXPIRED", "QUOTE_EXPIRED");
        throw new CaseError("QUOTE_EXPIRED", "The quote expired — recalculate the plan", 409);
      }
    }
    const a = {
      id: randomId("appr"),
      planId: p.id,
      planVersion: p.version,
      planHash: p.hash,
      role,
      userId: role === "student" ? "u_student" : "u_payer",
      steps: requested,
      at: now(),
      method: body.method === "biometric" ? ("biometric" as const) : ("pin" as const),
      valid: true,
    };
    c.approvals.unshift(a);
    const owners = [...new Set(p.steps.map((s) => s.owner))];
    const all = owners.every((o) => c.approvals.some((x) => x.valid && x.planId === p.id && x.planHash === p.hash && x.role === o));
    if (all) {
      p.status = "APPROVED";
      const h = c.planHistory.find((x) => x.id === p.id);
      if (h) h.status = "APPROVED";
    }
    ev(c, role, "approved", `${role} approved step(s) ${requested.join(",")} of plan v${p.version} (${a.method})${all ? " — plan APPROVED" : ""}`, { plan: p.version });
    return { approval: a, planStatus: p.status };
  });
}

function provider(c: PaymentCase, key: string, op: "topup" | "tuition", amount: number) {
  const ex = c.provider[key];
  if (ex) {
    if (ex.status === "PROCESSING" && ex.settleAfter && Date.now() >= ex.settleAfter) ex.status = "SETTLED";
    return { status: ex.status, lost: false };
  }
  let status: Attempt["status"] = "SETTLED";
  let settleAfter: number | undefined;
  if (op === "topup" && c.faults.delayTopup) {
    status = "PROCESSING";
    settleAfter = Date.now() + 15000;
    c.faults.delayTopup = false;
  }
  if (op === "tuition" && c.faults.failNextTuition) {
    status = "FAILED";
    c.faults.failNextTuition = false;
  }
  c.provider[key] = { status, at: now(), op, amount, settleAfter };
  if (c.faults.loseNextResponse) {
    c.faults.loseNextResponse = false;
    return { status, lost: true };
  }
  return { status, lost: false };
}

function lookupProvider(c: PaymentCase, key: string) {
  const ex = c.provider[key];
  if (!ex) return null;
  if (ex.status === "PROCESSING" && ex.settleAfter && Date.now() >= ex.settleAfter) ex.status = "SETTLED";
  return ex.status;
}

function applySettlement(c: PaymentCase, a: Attempt) {
  if (a.status !== "SETTLED") return;
  if ((a as Attempt & { applied?: boolean }).applied) return;
  (a as Attempt & { applied?: boolean }).applied = true;
  const step = c.plan?.steps.find((s) => s.n === a.step) ?? null;
  if (a.step === 1) {
    const credit = step?.credit.amount ?? 0;
    c.familyAccount.balanceIdr -= a.amount;
    mutateBank((b) => {
      const w = b.wallets.find((x) => x.currency === "SGD")!;
      w.balance = Math.round((w.balance + credit / 100) * 100) / 100;
      b.transactions.unshift({ id: randomId("t"), at: now(), kind: "incoming", title: "Top-up from Budi Rahayu (father)", legs: [{ currency: "SGD", amount: credit / 100 }] });
    });
    ev(c, "provider", "topup_settled", `Family debited ${idr(a.amount)}; student credited ${sgd(credit)}`, { key: a.key });
  } else {
    mutateBank((b) => {
      const w = b.wallets.find((x) => x.currency === "SGD")!;
      w.balance = Math.round((w.balance - a.amount / 100) * 100) / 100;
      b.transactions.unshift({ id: randomId("t"), at: now(), kind: "payment", title: `Lion City University · ${c.obligation?.reference}`, legs: [{ currency: "SGD", amount: -a.amount / 100 }] });
    });
    for (const r of c.reservations) if (r.attemptId === a.id && r.status === "ACTIVE") r.status = "CONSUMED";
    c.posting.firstSeenAt = now();
    ev(c, "provider", "transfer_settled", `Tuition transfer ${sgd(a.amount)} executed by the provider; university posting not yet observed`, { key: a.key });
  }
}

function attemptKey(c: PaymentCase, kind: "topup" | "tuition") {
  const failed = c.attempts.filter((a) => a.step === (kind === "topup" ? 1 : 2) && ["FAILED", "CANCELLED"].includes(a.status)).length;
  return `${c.id}:${c.obligation?.id}:v${c.obligation?.version}:${kind}:${failed + 1}`;
}

export function reconcile(actor = "worker") {
  return mutateCase((c) => {
    let changed = false;
    for (const a of c.attempts) {
      if (!["SUBMITTED", "PROCESSING", "UNKNOWN"].includes(a.status)) continue;
      const st = lookupProvider(c, a.key);
      if (st === null) {
        if (a.status === "UNKNOWN") {
          a.status = "FAILED";
          a.error = "Provider never received the request";
          for (const r of c.reservations) if (r.attemptId === a.id && r.status === "ACTIVE") r.status = "RELEASED";
          ev(c, actor, "attempt_not_received", `Attempt ${a.key} was never received — safe to retry`);
          changed = true;
        }
        continue;
      }
      if (st !== a.status) {
        ev(c, actor, "attempt_reconciled", `Attempt ${a.key}: ${a.status} → ${st} (found by provider key, no new payment created)`);
        a.status = st;
        a.updatedAt = now();
        changed = true;
        if (st === "SETTLED") applySettlement(c, a);
        if (st === "FAILED") for (const r of c.reservations) if (r.attemptId === a.id && r.status === "ACTIVE") r.status = "RELEASED";
      }
    }
    const tuition = c.attempts.find((a) => a.step === 2 && a.status === "SETTLED");
    if (tuition && c.obligation && c.posting.status !== "POSTED") {
      const lastPending = c.posting.events.find((e) => e.status === "PENDING");
      const mode = c.faults.postingMode;
      if (mode !== "delayed" && !c.posting.events.length) {
        pushPosting(c, "PENDING", 0);
        changed = true;
      } else if (mode === "auto" && lastPending && Date.now() - Date.parse(lastPending.at) > 10000) {
        pushPosting(c, "POSTED", c.obligation.amount);
        changed = true;
      } else if (mode === "partial" && !c.posting.events.some((e) => e.status === "PARTIAL")) {
        pushPosting(c, "PARTIAL", c.obligation.amount - 50000);
        changed = true;
      }
    }
    snapshot(c);
    return { changed };
  });
}

function pushPosting(c: PaymentCase, status: "PENDING" | "PARTIAL" | "POSTED", amount: number) {
  const jws = signPosting(c.obligation!.id, amount, status);
  const vr = verifyPosting(jws);
  const okObligation = vr.payload.obligationId === c.obligation!.id;
  const e = { id: randomId("pe"), obligationId: c.obligation!.id, amount, status, at: now(), jws, verified: vr.ok && okObligation };
  c.posting.events.unshift(e);
  if (!e.verified) {
    ev(c, "university", "posting_rejected", "Posting event failed signature or obligation check");
    return;
  }
  if (status === "POSTED" && amount === c.obligation!.amount) {
    c.posting.status = "POSTED";
    c.posting.postedAmount = amount;
    c.completed = true;
    ev(c, "university", "posting_posted", `University confirmed ${sgd(amount)} on the student account — case complete`);
  } else if (status === "POSTED" || status === "PARTIAL") {
    c.posting.status = "PARTIAL";
    c.posting.postedAmount = amount;
    ev(c, "university", "posting_partial", `University shows ${sgd(amount)} of ${sgd(c.obligation!.amount)} — not complete`);
  } else {
    c.posting.status = "PENDING";
    ev(c, "university", "posting_pending", "University ledger received the payment and is allocating it");
  }
}

export async function execute(role: Role, body: { planVersion: number; idempotencyKey: string }) {
  requireRole(role, ["student", "payer"]);
  return locked(() => {
    const st = read();
    if (body.idempotencyKey && st.executions[body.idempotencyKey]) return st.executions[body.idempotencyKey];
    reconcile("execution");
    const out = mutateCase((c, s) => {
      const p = c.plan;
      if (!p || p.version !== body.planVersion) throw new CaseError("PLAN_CHANGED", "Plan version changed — review and approve the new plan", 409);
      if (p.status !== "APPROVED") throw new CaseError(p.status === "EXPIRED" ? "QUOTE_EXPIRED" : "NOT_APPROVED", `Plan is ${p.status}${p.blockedDetail ? ": " + p.blockedDetail : ""}`, 409);
      const owners = [...new Set(p.steps.map((x) => x.owner))];
      for (const o of owners) {
        if (!c.approvals.some((a) => a.valid && a.planId === p.id && a.planHash === p.hash && a.role === o)) throw new CaseError("NOT_APPROVED", `Missing a valid approval from ${o}`, 409);
      }
      const fresh = recheck(c.verification!, c.faults.statusServiceDown);
      if (fresh.status !== "VALID") {
        c.verification!.verificationStatus = fresh.status;
        invalidatePlan(c, `Proof re-check before execution: ${fresh.status} (${fresh.detail})`, "BLOCKED", statusToReason(fresh.status));
        throw new CaseError(statusToReason(fresh.status), `Execution blocked: document is ${fresh.status} — ${fresh.detail}`, 409);
      }
      const results: { step: number; status: string; key: string }[] = [];
      for (const step of p.steps) {
        const prev = c.attempts.filter((a) => a.step === step.n).at(-1);
        if (prev?.status === "SETTLED") {
          results.push({ step: step.n, status: "SETTLED", key: prev.key });
          continue;
        }
        if (prev && ["SUBMITTED", "PROCESSING", "UNKNOWN"].includes(prev.status)) {
          results.push({ step: step.n, status: prev.status, key: prev.key });
          if (prev.status === "UNKNOWN") throw new CaseError("ATTEMPT_UNKNOWN", "The provider has not confirmed the previous attempt. We are checking the existing payment — do not create a new one.", 409);
          break;
        }
        if (step.kind === "topup") {
          const q = c.quotes.find((x) => x.id === step.quoteId);
          if (!q || Date.parse(q.expiresAt) < Date.now()) {
            invalidatePlan(c, "Quote expired before execution", "EXPIRED", "QUOTE_EXPIRED");
            throw new CaseError("QUOTE_EXPIRED", "The quote expired — recalculate; only the unfinished step will be re-planned", 409);
          }
        } else {
          snapshot(c);
          const after = c.snapshot.balance - c.snapshot.holds - step.debit.amount;
          if (c.snapshot.balance - c.snapshot.holds < step.debit.amount || after < c.constraints.reserve) {
            invalidatePlan(c, `Paying now would leave ${sgd(Math.max(0, after))}, below the reserve ${sgd(c.constraints.reserve)}`, "BLOCKED", "RESERVE_BREACH");
            throw new CaseError("RESERVE_BREACH", `Execution would breach the living reserve (${sgd(c.constraints.reserve)})`, 409);
          }
        }
        const key = attemptKey(c, step.kind);
        const a: Attempt = {
          id: randomId("att"),
          planId: p.id,
          planVersion: p.version,
          step: step.n,
          key,
          status: "CREATED",
          createdAt: now(),
          updatedAt: now(),
          amount: step.debit.amount,
          currency: step.debit.currency,
        };
        c.attempts.push(a);
        if (step.kind === "tuition") c.reservations.push({ id: randomId("res"), attemptId: a.id, amount: step.debit.amount, status: "ACTIVE" });
        c.outbox.push({ id: randomId("ob"), attemptId: a.id, at: now(), sent: false });
        a.status = "SUBMITTED";
        const r = provider(c, key, step.kind, step.debit.amount);
        c.outbox[c.outbox.length - 1].sent = true;
        if (r.lost) {
          a.status = "UNKNOWN";
          a.error = "Provider response lost (timeout)";
          ev(c, "provider", "attempt_unknown", `Step ${step.n} response lost — will reconcile with key ${key}; no new payment will be created`);
          results.push({ step: step.n, status: "UNKNOWN", key });
          break;
        }
        a.status = r.status;
        a.updatedAt = now();
        a.providerRef = "prv_" + sha256Hex(key).slice(0, 10);
        ev(c, role, "attempt_" + r.status.toLowerCase(), `Step ${step.n} (${step.kind}) ${r.status} — key ${key}`);
        if (r.status === "SETTLED") applySettlement(c, a);
        if (r.status === "FAILED") {
          for (const res of c.reservations) if (res.attemptId === a.id && res.status === "ACTIVE") res.status = "RELEASED";
          invalidatePlan(c, `Step ${step.n} failed at the provider; completed steps are kept, only this step will be re-planned`, "BLOCKED", "ATTEMPT_UNKNOWN");
          results.push({ step: step.n, status: "FAILED", key });
          break;
        }
        results.push({ step: step.n, status: r.status, key });
        if (r.status !== "SETTLED") break;
      }
      snapshot(c);
      const res = { ok: true, results };
      if (body.idempotencyKey) s.executions[body.idempotencyKey] = res;
      return res;
    });
    reconcile("execution");
    return out;
  });
}

export function consoleOp(role: Role, op: string) {
  requireRole(role, ["operator"]);
  if (op === "tamper_audit") {
    mutateBank((b) => {
      const e = b.audit.find((x) => x.action.startsWith("case.")) ?? b.audit[Math.min(2, b.audit.length - 1)];
      if (e) e.detail = e.detail + " (edited)";
    });
    return { ok: true };
  }
  if (op === "reset") {
    resetCase();
    return { ok: true };
  }
  if (op === "new_version") {
    const st = issueNewVersion();
    mutateCase((c) => {
      ev(c, "issuer", "invoice_new_version", `University issued invoice v${st.version} (${sgd(st.amount)}); previous version superseded`);
      const fresh = c.verification ? recheck(c.verification, c.faults.statusServiceDown) : null;
      if (fresh && fresh.status !== "VALID") {
        c.verification!.verificationStatus = fresh.status;
        invalidatePlan(c, "Invoice superseded by a new version", "BLOCKED", "PROOF_REVOKED");
      }
    });
    return { ok: true };
  }
  if (op === "revoke") {
    revokeCurrent();
    mutateCase((c) => {
      ev(c, "issuer", "invoice_revoked", "University revoked the invoice statement");
      if (c.verification) {
        c.verification.verificationStatus = "REVOKED";
        invalidatePlan(c, "Invoice revoked by the issuer", "BLOCKED", "PROOF_REVOKED");
      }
    });
    return { ok: true };
  }
  if (op === "expire_proof") {
    expireCurrent();
    mutateCase((c) => ev(c, "issuer", "proof_expired", "Issuer statement expiry moved to the past"));
    return { ok: true };
  }
  return mutateCase((c) => {
    switch (op) {
      case "tamper":
        {
          const doc = c.documents.find((d) => d.id === c.activeDocId);
          if (!doc) throw new CaseError("BAD_REQUEST", "No document uploaded");
          const b = readBytes(doc.storedAs);
          writeBytes(doc.storedAs, Buffer.concat([b, Buffer.from("\n% edited after download\n")]));
          ev(c, "operator", "document_tampered", "Uploaded file bytes changed (simulates an edited or re-exported file)");
        }
        break;
      case "status_down":
        c.faults.statusServiceDown = !c.faults.statusServiceDown;
        ev(c, "operator", "status_service", c.faults.statusServiceDown ? "Issuer status service unavailable" : "Issuer status service restored");
        break;
      case "expire_quote":
        for (const q of c.quotes) q.expiresAt = new Date(Date.now() - 1000).toISOString();
        ev(c, "operator", "quote_expired", "All quotes expired");
        break;
      case "add_hold":
        c.snapshot.holds += 20000;
        ev(c, "operator", "hold_added", `Card hold ${sgd(20000)} placed on the student account`);
        invalidatePlan(c, "Account balance changed (new hold)");
        recompute(c);
        break;
      case "lose_response":
        c.faults.loseNextResponse = true;
        ev(c, "operator", "fault_armed", "Next provider response will be lost");
        break;
      case "fail_tuition":
        c.faults.failNextTuition = true;
        ev(c, "operator", "fault_armed", "Next tuition transfer will fail at the provider");
        break;
      case "delay_topup":
        c.faults.delayTopup = true;
        ev(c, "operator", "fault_armed", "Next family top-up will be delayed");
        break;
      case "posting_delayed":
        c.faults.postingMode = "delayed";
        ev(c, "operator", "posting_mode", "University posting delayed");
        break;
      case "posting_partial":
        c.faults.postingMode = "partial";
        ev(c, "operator", "posting_mode", "University will post a partial amount");
        break;
      case "posting_auto":
        c.faults.postingMode = "auto";
        ev(c, "operator", "posting_mode", "University posting back to normal");
        break;
      case "post_now":
        if (!c.attempts.some((a) => a.step === 2 && a.status === "SETTLED") || !c.obligation) throw new CaseError("BAD_REQUEST", "No settled tuition transfer to post");
        pushPosting(c, "POSTED", c.obligation.amount);
        break;
      default:
        throw new CaseError("BAD_REQUEST", "Unknown console operation");
    }
    return { ok: true };
  });
}

export function notifications(c: PaymentCase) {
  const out: { owner: string; action: string; due?: string; level: "info" | "warn" }[] = [];
  const doc = c.documents.find((d) => d.id === c.activeDocId);
  const p = c.plan;
  if (!doc) out.push({ owner: "student", action: "Upload the tuition invoice", level: "info" });
  else if (!c.verification) out.push({ owner: "student", action: "Give consent and verify the invoice", level: "info" });
  else if (c.verification.verificationStatus !== "VALID") out.push({ owner: "student", action: `Invoice is ${c.verification.verificationStatus} — upload the current invoice from the university`, level: "warn" });
  else if (!doc.fieldsConfirmed) out.push({ owner: "student", action: "Confirm the invoice data", level: "info" });
  else if (!p || p.status === "SUPERSEDED") out.push({ owner: "student", action: "Calculate funding and check the plan", level: "info" });
  if (p && p.status === "READY") {
    for (const o of [...new Set(p.steps.map((s) => s.owner))]) {
      if (!c.approvals.some((a) => a.valid && a.planId === p.id && a.role === o)) {
        const q = c.quotes.find((x) => x.id === p.steps.find((s) => s.kind === "topup")?.quoteId);
        out.push({ owner: o, action: o === "payer" ? "Approve the family top-up" : "Approve the tuition payment", due: q?.expiresAt, level: "warn" });
      }
    }
  }
  if (p && ["BLOCKED", "EXPIRED"].includes(p.status)) out.push({ owner: "student", action: `Plan ${p.status.toLowerCase()}: ${p.blockedDetail ?? p.blockedReason ?? ""} — recalculate`, level: "warn" });
  if (p?.status === "APPROVED" && !c.attempts.some((a) => a.planId === p.id && a.step === 2 && a.status === "SETTLED")) out.push({ owner: "student", action: "Execute the approved plan", level: "info" });
  const q = c.quotes.find((x) => x.feasible);
  if (q && p?.status === "READY") {
    const left = Date.parse(q.expiresAt) - Date.now();
    if (left < 5 * 60e3) out.push({ owner: "student, payer", action: "Quote expires soon", due: q.expiresAt, level: "warn" });
  }
  for (const a of c.attempts) {
    if (a.status === "UNKNOWN") out.push({ owner: "system", action: "Checking the existing payment with the provider — do not pay again", level: "warn" });
    if (a.step === 1 && a.status === "PROCESSING") out.push({ owner: "payer", action: "Family top-up is delayed at the provider", level: "warn" });
  }
  if (c.attempts.some((a) => a.step === 2 && a.status === "SETTLED") && c.posting.status !== "POSTED")
    out.push({
      owner: "university",
      action: "The provider confirmed the transfer. The university has not yet confirmed posting to your student account. We are checking the existing payment; do not create a new payment for this invoice.",
      due: c.obligation ? addBusinessDays(c.obligation.dueDate, 0) : undefined,
      level: "warn",
    });
  return out;
}

export function status(c: PaymentCase) {
  const att = (n: 1 | 2) => c.attempts.filter((a) => a.step === n).at(-1) ?? null;
  return {
    document: c.verification?.verificationStatus ?? (c.documents.length ? "UNVERIFIED" : "NONE"),
    plan: c.plan?.status ?? "NONE",
    funding: att(1)?.status ?? (!c.plan || c.plan.steps.some((s) => s.kind === "topup") ? "NOT_STARTED" : settledTopupLabel(c)),
    transfer: att(2)?.status ?? "NOT_STARTED",
    posting: c.posting.status,
    completed: c.completed,
  };
}

function settledTopupLabel(c: PaymentCase) {
  return c.attempts.some((a) => a.step === 1 && a.status === "SETTLED") ? "SETTLED" : "NOT_NEEDED";
}

export function view(role: Role) {
  const c = getCase();
  if (!c) return { case: null, role };
  if (role !== "operator") reconcile("view");
  const fresh = getCase()!;
  snapshotView(fresh);
  const base = { role, status: status(fresh), notifications: notifications(fresh).filter((n) => role === "operator" || n.owner.includes(role) || n.owner === "system" || n.owner === "university"), timezone: "SGT (UTC+8)" };
  if (role === "payer") {
    const p = fresh.plan;
    const topup = p?.steps.find((s) => s.kind === "topup");
    return {
      ...base,
      case: {
        id: fresh.id,
        members: fresh.members.map((m) => ({ role: m.role, name: m.name })),
        obligation: fresh.obligation ? { amount: fresh.obligation.amount, currency: "SGD", reference: fresh.obligation.reference, dueDate: fresh.obligation.dueDate } : null,
        verification: fresh.verification ? { verificationStatus: fresh.verification.verificationStatus, issuerId: fresh.verification.issuerId } : null,
        constraints: { familyLimitIdr: fresh.constraints.familyLimitIdr },
        familyAccount: fresh.familyAccount,
        funding: p ? { contribution: p.funding.contribution, topup: p.funding.topup } : null,
        quotes: fresh.quotes,
        plan: p ? { id: p.id, version: p.version, status: p.status, hash: p.hash, steps: p.steps.filter((s) => s.owner === "payer"), blockedReason: p.blockedReason, blockedDetail: p.blockedDetail } : null,
        topupStep: topup ?? null,
        approvals: fresh.approvals.filter((a) => a.planId === p?.id).map((a) => ({ role: a.role, at: a.at, valid: a.valid, steps: a.steps })),
        attempts: fresh.attempts.filter((a) => a.step === 1),
        posting: { status: fresh.posting.status },
      },
    };
  }
  return { ...base, case: { ...fresh, documents: fresh.documents.map((d) => ({ ...d })), provider: role === "operator" ? fresh.provider : undefined }, rules: RULES };
}

function snapshotView(c: PaymentCase) {
  void c;
}

export function supportPackFields(c: PaymentCase) {
  const tuition = c.attempts.filter((a) => a.step === 2);
  const tl = c.events.slice(0, 25).reverse().map((e) => `${fmtSgt(e.at)} · ${e.type} · ${e.detail}`);
  return [
    { key: "caseId", label: "Case ID", personal: false, value: c.id },
    { key: "obligation", label: "Obligation ID, reference, amount, due date", personal: false, value: c.obligation ? { id: c.obligation.id, version: c.obligation.version, reference: c.obligation.reference, amount: sgd(c.obligation.amount), dueDate: c.obligation.dueDate + " SGT" } : null },
    { key: "verification", label: "Verification result (proof ID, status, document SHA-256)", personal: false, value: c.verification ? { proofId: c.verification.proofId, status: c.verification.verificationStatus, documentHash: c.verification.documentHash, issuerId: c.verification.issuerId, keyId: c.verification.keyId } : null },
    { key: "attempts", label: "Payment attempts (keys, provider refs, statuses, times)", personal: false, value: c.attempts.map((a) => ({ step: a.step, key: a.key, providerRef: a.providerRef, status: a.status, at: fmtSgt(a.updatedAt), amount: a.currency === "SGD" ? sgd(a.amount) : idr(a.amount) })) },
    { key: "posting", label: "University posting status", personal: false, value: { status: c.posting.status, postedAmount: sgd(c.posting.postedAmount), events: c.posting.events.map((e) => ({ status: e.status, at: fmtSgt(e.at), verified: e.verified })) } },
    { key: "timeline", label: "Timeline (last 25 events, SGT)", personal: false, value: tl },
    { key: "question", label: "Open question for the university", personal: false, value: tuition.some((a) => a.status === "SETTLED") && c.posting.status !== "POSTED" ? `Transfer ${tuition.at(-1)?.providerRef} for ${c.obligation?.reference} was executed but is not yet posted to the student account. Please allocate it.` : "No open question" },
    { key: "studentName", label: "Student name", personal: true, value: STUDENT.name },
    { key: "studentId", label: "Student ID", personal: true, value: STUDENT.id },
    { key: "familyAccount", label: "Family payer account reference", personal: true, value: c.familyAccount.accountRef },
  ];
}

export function supportPack(role: Role, selected: string[]) {
  requireRole(role, ["student", "operator"]);
  const c = getCase();
  if (!c) throw new CaseError("NOT_FOUND", "No case", 404);
  const fields = supportPackFields(c);
  const out: Record<string, unknown> = { generatedAt: fmtSgt(now()), simulation: true, note: "Synthetic sandbox data — Corridor demo" };
  for (const f of fields) if (selected.includes(f.key)) out[f.key] = f.value;
  out.hash = sha256Hex(JSON.stringify(out));
  mutateCase((x) => ev(x, role, "support_pack", `Support pack exported with ${selected.length} field group(s): ${selected.join(", ")}`));
  return out;
}
