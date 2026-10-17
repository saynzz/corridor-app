import { NextResponse } from "next/server";
import { anchorNow } from "@/lib/anchor";
import { roleOf } from "@/lib/case/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const role = await roleOf();
  if (role === "payer") return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 403 });
  const rec = await anchorNow("manual:" + role);
  return NextResponse.json({ ok: rec.status === "ANCHORED", anchor: rec });
}
