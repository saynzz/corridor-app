import { NextResponse } from "next/server";
import { getCase } from "@/lib/case/engine";
import { sampleDocument } from "@/lib/case/issuer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  getCase();
  const kind = new URL(req.url).searchParams.get("kind") || "valid";
  const s = sampleDocument(kind);
  return new NextResponse(new Uint8Array(s.bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${s.fileName}"` } });
}
