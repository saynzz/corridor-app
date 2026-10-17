import { handle, sameCase } from "@/lib/case/http";
import { calculate } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle((role) => {
    sameCase(id);
    return calculate(role);
  });
}
