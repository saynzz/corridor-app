import { handle } from "@/lib/case/http";
import { consoleOp } from "@/lib/case/engine";
import { anchorSoon } from "@/lib/anchor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { op?: string };
  const op = String(body.op || "");
  const res = await handle((role) => consoleOp(role, op));
  if (res.status === 200 && op !== "tamper_audit") anchorSoon("console:" + op);
  return res;
}
