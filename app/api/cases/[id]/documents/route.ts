import { handle, sameCase } from "@/lib/case/http";
import { uploadDocument, useSample } from "@/lib/case/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (role) => {
    sameCase(id);
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const b = (await req.json()) as { sample?: string };
      return useSample(role, String(b.sample || "valid"));
    }
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) throw new Error("No file");
    return uploadDocument(role, { name: f.name, mime: f.type, bytes: Buffer.from(await f.arrayBuffer()) });
  });
}
