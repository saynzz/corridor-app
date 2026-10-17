import { NextResponse } from "next/server";
import { executeDraft } from "@/lib/policy";
import { roleOf } from "@/lib/case/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { token?: string; pin?: string; biometric?: boolean };
  if ((await roleOf()) !== "student") return NextResponse.json({ ok: false, reason: "Only the account owner (student) can confirm wallet payments", code: "wrong_role" }, { status: 403 });
  const r = await executeDraft(id, String(body.token || ""), body.pin, body.biometric === true);
  return NextResponse.json(r, { status: r.ok ? 200 : 403 });
}
