import { handle, samePlan } from "@/lib/case/http";
import { execute } from "@/lib/case/engine";
import { anchorSoon } from "@/lib/anchor";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { planVersion: number; idempotencyKey: string };
  const res = await handle((role) => {
    samePlan(id);
    return execute(role, { planVersion: Number(body.planVersion), idempotencyKey: String(body.idempotencyKey || "") });
  });
  anchorSoon("execution");
  return res;
}
