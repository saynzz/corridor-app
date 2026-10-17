import { handle, sameCase } from "@/lib/case/http";
import { getCase, notifications, reconcile, status } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    sameCase(id);
    reconcile("status");
    const c = getCase()!;
    return { status: status(c), notifications: notifications(c) };
  });
}
