import { handle, sameCase } from "@/lib/case/http";
import { confirmFields } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  return handle((role) => {
    sameCase(id);
    return confirmFields(role, body);
  });
}
