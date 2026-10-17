import { NextResponse } from "next/server";
import { verifyAnchors } from "@/lib/anchor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(verifyAnchors());
}
