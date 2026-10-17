import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { login, SESSION_COOKIE, SESSION_MAX_AGE, usingDefault, verifySession } from "@/lib/session";
import { audit, mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

function hints() {
  if (process.env.DEMO_HINTS === "0") return {};
  return {
    payer: usingDefault("payer") ? "1357" : undefined,
    operator: usingDefault("operator") ? "ops-demo-2026" : undefined,
  };
}

export async function GET() {
  const c = await cookies();
  const role = verifySession(c.get(SESSION_COOKIE)?.value) ?? "student";
  return NextResponse.json({ ok: true, role, hints: hints() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { role?: string; credential?: string };
  const role = String(body.role || "");
  if (role === "student") {
    const res = NextResponse.json({ ok: true, role: "student" });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  const r = login(role, String(body.credential ?? ""));
  mutate((s) => audit(s, { actor: "user", action: "role_login", tier: 0, outcome: r.ok ? "ok" : "blocked", detail: `${role}: ${r.ok ? "signed in" : r.code}` }));
  if (!r.ok) return NextResponse.json(r, { status: r.code === "LOCKED" ? 429 : 403 });
  const res = NextResponse.json({ ok: true, role: r.role });
  res.cookies.set(SESSION_COOKIE, r.token, { path: "/", httpOnly: true, sameSite: "strict", maxAge: SESSION_MAX_AGE });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, role: "student" });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
