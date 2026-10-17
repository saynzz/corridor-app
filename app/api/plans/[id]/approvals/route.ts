import { handle, samePlan } from "@/lib/case/http";
import { approve } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { planVersion: number; steps?: number[]; method?: "biometric" | "pin"; pin?: string };
  return handle((role) => {
    samePlan(id);
    return approve(role, body);
  });
}
