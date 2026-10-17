import { handle } from "@/lib/case/http";
import { createCase } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle((role) => createCase(role));
}
