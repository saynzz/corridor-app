import { NextResponse } from "next/server";
import { load } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ audit: load().audit.slice(0, 100) });
}
