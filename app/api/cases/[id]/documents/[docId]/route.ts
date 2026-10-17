import { NextResponse } from "next/server";
import { roleOf } from "@/lib/case/http";
import { CaseError, docBytes, requireCase } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  try {
    requireCase(id);
    const d = docBytes(await roleOf(), docId);
    return new NextResponse(new Uint8Array(d.bytes), { headers: { "content-type": d.mime, "content-disposition": `inline; filename="${d.name.replace(/"/g, "")}"`, "cache-control": "no-store" } });
  } catch (e) {
    const s = e instanceof CaseError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: s });
  }
}
