import { NextResponse } from "next/server";
import { reset } from "@/lib/store";
import { resetCase } from "@/lib/case/engine";
import { resetLedger } from "@/lib/anchor";
import { resetLocks } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  reset();
  resetCase();
  resetLedger();
  resetLocks();
  return NextResponse.json({ ok: true });
}
