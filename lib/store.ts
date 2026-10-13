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
  return JSON.parse(fs.readFileSync(file, "utf8")) as BankState;
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

export function audit(s: BankState, e: Omit<AuditEntry, "id" | "at">) {
  s.audit.unshift({ id: id("a"), at: new Date().toISOString(), ...e });
  if (s.audit.length > 500) s.audit.length = 500;
}
