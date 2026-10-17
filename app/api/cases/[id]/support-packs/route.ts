import { handle, sameCase } from "@/lib/case/http";
import { supportPack, supportPackFields, CaseError } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle((role) => {
    if (role === "payer") throw new CaseError("AUTH_REQUIRED", "Only the student can prepare a support pack", 403);
    const c = sameCase(id);
    return supportPackFields(c).map((f) => ({ key: f.key, label: f.label, personal: f.personal, preview: f.value }));
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { fields?: string[] };
  return handle((role) => {
    sameCase(id);
    return supportPack(role, Array.isArray(body.fields) ? body.fields.map(String) : []);
  });
}
