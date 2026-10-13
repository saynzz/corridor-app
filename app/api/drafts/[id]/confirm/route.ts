import { NextResponse } from "next/server";
import { executeDraft } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { token?: string; pin?: string; biometric?: boolean };
  const r = await executeDraft(id, String(body.token || ""), body.pin, body.biometric === true);
  return NextResponse.json(r, { status: r.ok ? 200 : 403 });
}
