import { handle, sameCase } from "@/lib/case/http";
import { setConstraints } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reserve?: number; studentCap?: number | null; familyLimitIdr?: number };
  return handle((role) => {
    sameCase(id);
    return setConstraints(role, body);
  });
}
