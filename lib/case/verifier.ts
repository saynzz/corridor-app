import { decodeJws, randomId, sha256Hex, verifyJws } from "./jws";
import { ensureTrustRegistry, lookupByHash, lookupByReference, statusOf } from "./issuer";
import type { Consent, DocStatus, VerificationRecord } from "./types";

interface Trust {
  issuers: { issuerId: string; name: string; keyId: string; publicKeyPem: string; authorizedClaims: string[] }[];
}

export const PURPOSE = "tuition_obligation_verification";
export const AUDIENCE = "corridor-planner";

function claimedIssuer(text: string) {
  return text.match(/Issuer ID:\s*(\S+)/)?.[1] ?? null;
}
function claimedReference(text: string) {
  return text.match(/Invoice reference:\s*(\S+)/)?.[1] ?? null;
}

export function verifyDocument(input: {
  bytes: Buffer;
  text: string;
  subjectRef: string;
  obligationId: string | null;
  consent: Consent | undefined;
  statusServiceDown: boolean;
}): VerificationRecord {
  const documentHash = sha256Hex(input.bytes);
  const checks: VerificationRecord["checks"] = [];
  const base: VerificationRecord = {
    proofId: randomId("vr"),
    issuerId: null,
    keyId: null,
    documentHash,
    hashAlgorithm: "SHA-256",
    subjectRef: null,
    obligationId: null,
    invoiceVersion: null,
    claims: null,
    issuedAt: null,
    expiresAt: null,
    statusRef: null,
    audience: AUDIENCE,
    purpose: PURPOSE,
    nonce: randomId("n"),
    consentRef: input.consent?.id ?? "",
    verificationStatus: "UNAVAILABLE",
    checks,
    verifiedAt: new Date().toISOString(),
  };
  const done = (status: DocStatus) => ({ ...base, checks, verificationStatus: status });

  checks.push({ label: "Consent given for this verification purpose", ok: !!input.consent && !input.consent.revoked, code: "consent" });
  if (!input.consent || input.consent.revoked) return done("UNAVAILABLE");

  const trust = ensureTrustRegistry() as Trust;
  const iss = claimedIssuer(input.text);
  base.issuerId = iss;
  const entry = trust.issuers.find((t) => t.issuerId === iss);
  checks.push({ label: "Issuer is in the trust registry", ok: !!entry, code: "issuer_trusted" });
  if (!entry) return done("UNKNOWN_ISSUER");
  base.keyId = entry.keyId;

  if (input.statusServiceDown) {
    checks.push({ label: "Issuer status service reachable", ok: false, code: "status_service" });
    return done("UNAVAILABLE");
  }

  const st = lookupByHash(documentHash);
  checks.push({ label: "Exact file bytes match an issued document (SHA-256)", ok: !!st && st.issuerId === iss, code: "hash_match" });
  if (!st || st.issuerId !== iss) {
    const ref = claimedReference(input.text);
    const known = ref ? lookupByReference(iss!, ref) : [];
    if (known.length) base.obligationId = known[known.length - 1].obligationId;
    return done("MISMATCH");
  }

  const sigOk = verifyJws(st.jws, entry.publicKeyPem);
  const { header, payload } = decodeJws(st.jws);
  checks.push({ label: "Issuer signature valid (EdDSA, trusted key)", ok: sigOk && header.kid === entry.keyId, code: "signature" });
  if (!sigOk || header.kid !== entry.keyId) return done("MISMATCH");
  const authorized = entry.authorizedClaims.includes(payload.typ);
  checks.push({ label: "Issuer is authorised for this type of claim", ok: authorized, code: "authority" });
  if (!authorized) return done("UNKNOWN_ISSUER");

  base.jws = st.jws;
  base.subjectRef = payload.sub;
  base.obligationId = payload.obligationId;
  base.invoiceVersion = payload.invoiceVersion;
  base.claims = payload.claims;
  base.issuedAt = new Date(payload.iat * 1000).toISOString();
  base.expiresAt = new Date(payload.exp * 1000).toISOString();
  base.statusRef = payload.statusRef;

  const sameHash = payload.documentHash === documentHash;
  checks.push({ label: "Signed hash equals the uploaded file", ok: sameHash, code: "signed_hash" });
  if (!sameHash) return done("MISMATCH");

  const subjectOk = payload.sub === input.subjectRef;
  checks.push({ label: "Document belongs to this student", ok: subjectOk, code: "subject" });
  if (!subjectOk) return done("MISMATCH");

  if (input.obligationId) {
    const oblOk = payload.obligationId === input.obligationId;
    checks.push({ label: "Matches this case's obligation", ok: oblOk, code: "obligation" });
    if (!oblOk) return done("MISMATCH");
  }

  const notExpired = payload.exp * 1000 > Date.now();
  checks.push({ label: "Statement not expired", ok: notExpired, code: "expiry" });
  if (!notExpired) return done("EXPIRED");

  const status = statusOf(payload.jti);
  const notRevoked = !!status && !status.revoked;
  checks.push({ label: "Not revoked or superseded by the issuer", ok: notRevoked, code: "revocation" });
  if (!notRevoked) return done("REVOKED");

  return done("VALID");
}

export function recheck(record: VerificationRecord, statusServiceDown: boolean): { status: DocStatus; detail: string } {
  if (record.verificationStatus !== "VALID" || !record.jws) return { status: record.verificationStatus, detail: "not valid" };
  if (statusServiceDown) return { status: "UNAVAILABLE", detail: "issuer status service unreachable" };
  const trust = ensureTrustRegistry() as Trust;
  const entry = trust.issuers.find((t) => t.issuerId === record.issuerId);
  if (!entry || !verifyJws(record.jws, entry.publicKeyPem)) return { status: "UNKNOWN_ISSUER", detail: "issuer key no longer trusted" };
  const { payload } = decodeJws(record.jws);
  const st = statusOf(payload.jti);
  if (!st || st.revoked) return { status: "REVOKED", detail: st?.supersededBy ? "superseded by a newer invoice version" : "revoked by issuer" };
  const live = lookupByHash(record.documentHash);
  const exp = live ? decodeJws(live.jws).payload.exp : payload.exp;
  if (exp * 1000 <= Date.now()) return { status: "EXPIRED", detail: "statement expired" };
  return { status: "VALID", detail: "fresh" };
}

export function verifyPosting(jws: string) {
  const trust = ensureTrustRegistry() as Trust;
  const { header, payload } = decodeJws(jws);
  const entry = trust.issuers.find((t) => t.issuerId === payload.iss && t.keyId === header.kid);
  const ok = !!entry && entry.authorizedClaims.includes("payment_posting") && verifyJws(jws, entry.publicKeyPem);
  return { ok, payload };
}
