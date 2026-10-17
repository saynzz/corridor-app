import { handle } from "@/lib/case/http";
import { view } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle((role) => view(role));
}
