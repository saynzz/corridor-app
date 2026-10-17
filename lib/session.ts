import crypto from "node:crypto";

export type SessionRole = "student" | "payer" | "operator";
export const SESSION_COOKIE = "corridor.session";
const TTL_SEC = 8 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

const DEFAULTS = { student: "2468", payer: "1357", operator: "ops-demo-2026" } as const;

function secret() {
  return process.env.SESSION_SECRET || process.env.CONFIRM_SECRET || "dev-only-secret-change-me";
}

export function credentialFor(role: SessionRole) {
  if (role === "student") return process.env.STUDENT_PIN || process.env.DEMO_PIN || DEFAULTS.student;
  if (role === "payer") return process.env.PAYER_PIN || DEFAULTS.payer;
  return process.env.OPERATOR_KEY || DEFAULTS.operator;
}

export function usingDefault(role: SessionRole) {
  return credentialFor(role) === DEFAULTS[role];
}

function mac(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function same(a: string, b: string) {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

export function checkCredential(role: SessionRole, given: string) {
  return same(String(given ?? ""), credentialFor(role));
}

export function issueSession(role: SessionRole, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TTL_SEC;
  const body = `${role}.${exp}.${crypto.randomBytes(8).toString("hex")}`;
  return `${body}.${mac(body)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): SessionRole | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const body = parts.slice(0, 3).join(".");
  if (!same(parts[3], mac(body))) return null;
  const role = parts[0];
  if (role !== "student" && role !== "payer" && role !== "operator") return null;
  if (Number(parts[1]) * 1000 < now) return null;
  return role;
}

const G = globalThis as { __corridorLock?: Record<string, { fails: number; until: number }> };
function locks() {
  return (G.__corridorLock ??= {});
}

export function resetLocks() {
  G.__corridorLock = {};
}

export type LoginResult = { ok: true; role: SessionRole; token: string } | { ok: false; code: "LOCKED" | "WRONG_CREDENTIAL" | "BAD_ROLE"; retryAfterSec?: number; left?: number };

export function login(role: string, given: string, now = Date.now()): LoginResult {
  if (role !== "student" && role !== "payer" && role !== "operator") return { ok: false, code: "BAD_ROLE" };
  const l = locks()[role] ?? { fails: 0, until: 0 };
  if (l.until > now) return { ok: false, code: "LOCKED", retryAfterSec: Math.ceil((l.until - now) / 1000) };
  if (!checkCredential(role, given)) {
    l.fails += 1;
    if (l.fails >= MAX_FAILS) {
      l.until = now + LOCK_MS;
      l.fails = 0;
    }
    locks()[role] = l;
    return l.until > now ? { ok: false, code: "LOCKED", retryAfterSec: Math.ceil(LOCK_MS / 1000) } : { ok: false, code: "WRONG_CREDENTIAL", left: MAX_FAILS - l.fails };
  }
  locks()[role] = { fails: 0, until: 0 };
  return { ok: true, role, token: issueSession(role, now) };
}

export const SESSION_MAX_AGE = TTL_SEC;
