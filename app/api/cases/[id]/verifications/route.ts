import { handle, sameCase } from "@/lib/case/http";
import { verify } from "@/lib/case/engine";
import { anchorSoon } from "@/lib/anchor";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await handle((role) => {
    sameCase(id);
    return verify(role);
  });
  anchorSoon("verification");
  return res;
}
