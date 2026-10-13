import { NextResponse } from "next/server";
import { load } from "@/lib/store";
import { signDraft } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = load();
  const d = s.drafts.find((x) => x.id === id);
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  const payee = d.kind === "payment" ? s.payees.find((p) => p.id === (d.payload as { payeeId: string }).payeeId) : undefined;
  return NextResponse.json({ draft: d, payee, token: d.status === "pending" ? signDraft(d) : null });
}
