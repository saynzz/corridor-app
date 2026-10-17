import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CaseError, getCase } from "./engine";
import type { Role } from "./types";
import { SESSION_COOKIE, verifySession } from "../session";

export async function roleOf(): Promise<Role> {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value) ?? "student";
}

export async function handle(fn: (role: Role) => unknown | Promise<unknown>) {
  try {
    const role = await roleOf();
    const out = await fn(role);
    return NextResponse.json({ ok: true, data: out });
  } catch (e) {
    if (e instanceof CaseError) return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ ok: false, code: "INTERNAL", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export function sameCase(id: string) {
  const c = getCase();
  if (!c || c.id !== id) throw new CaseError("NOT_FOUND", "Case not found", 404);
  return c;
}

export function samePlan(id: string) {
  const c = getCase();
  if (!c || !c.plan || c.plan.id !== id) throw new CaseError("NOT_FOUND", "Plan not found", 404);
  return c;
}
