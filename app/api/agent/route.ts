import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import type { ChatTurn } from "@/lib/types";
import { roleOf } from "@/lib/case/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { history?: ChatTurn[]; message?: string; lang?: string };
  if ((await roleOf()) !== "student") return NextResponse.json({ reply: "The assistant works for the account owner. Switch back to the Student role to chat.", cards: [], trace: [], code: "wrong_role" }, { status: 403 });
  const message = String(body.message || "").slice(0, 4000);
  if (!message.trim()) return NextResponse.json({ error: "empty message" }, { status: 400 });
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  const out = await runAgent(history, message, String(body.lang || "en").slice(0, 5));
  return NextResponse.json(out);
}
