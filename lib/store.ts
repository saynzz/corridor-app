import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { seedState } from "./seed";
import type { AuditEntry, BankState } from "./types";

function dataFile() {
  return process.env.DATA_FILE || path.join(process.cwd(), "data", "bank.json");
}

export function load(): BankState {
  const file = dataFile();
  if (!fs.existsSync(file)) {
    const s = seedState();
    save(s);
    return s;
  }
  const s = JSON.parse(fs.readFileSync(file, "utf8")) as BankState;
  if (s.audit?.length && s.audit.every((e) => !e.hash)) {
    let prev = GENESIS;
    for (let i = s.audit.length - 1; i >= 0; i--) {
      s.audit[i].prev = prev;
      s.audit[i].hash = entryHash(s.audit[i]);
      prev = s.audit[i].hash!;
    }
    save(s);
  }
  return s;
}

export function save(state: BankState) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

export function mutate<T>(fn: (s: BankState) => T): T {
  const s = load();
  const out = fn(s);
  save(s);
  return out;
}

export function reset(): BankState {
  const s = seedState();
  save(s);
  return s;
}

export function id(prefix: string) {
  return prefix + "_" + crypto.randomBytes(5).toString("hex");
}

export const GENESIS = "0".repeat(64);
const MAX_AUDIT = 500;

export function entryHash(e: AuditEntry) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([e.prev ?? GENESIS, e.id, e.at, e.actor, e.action, e.tier ?? null, e.outcome, e.detail]))
    .digest("hex");
}

export function audit(s: BankState, e: Omit<AuditEntry, "id" | "at" | "prev" | "hash">) {
  const entry: AuditEntry = { id: id("a"), at: new Date().toISOString(), ...e, prev: s.audit[0]?.hash ?? GENESIS };
  entry.hash = entryHash(entry);
  s.audit.unshift(entry);
  if (s.audit.length > MAX_AUDIT) s.audit.length = MAX_AUDIT;
}

export interface ChainCheck {
  ok: boolean;
  length: number;
  head: string;
  firstPrev: string;
  trimmed: boolean;
  brokenAt?: { id: string; at: string; index: number; reason: string };
}

export function verifyChain(s: BankState): ChainCheck {
  const a = s.audit;
  const head = a[0]?.hash ?? GENESIS;
  const firstPrev = a[a.length - 1]?.prev ?? GENESIS;
  for (let i = a.length - 1; i >= 0; i--) {
    const e = a[i];
    const fail = (reason: string): ChainCheck => ({ ok: false, length: a.length, head, firstPrev, trimmed: firstPrev !== GENESIS, brokenAt: { id: e.id, at: e.at, index: i, reason } });
    if (!e.hash) return fail("entry has no hash");
    if (i < a.length - 1 && e.prev !== a[i + 1].hash) return fail("link to the previous entry is broken (entry removed or reordered)");
    if (entryHash(e) !== e.hash) return fail("entry content was changed after it was written");
  }
  return { ok: true, length: a.length, head, firstPrev, trimmed: firstPrev !== GENESIS };
}
