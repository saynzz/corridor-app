import { NextResponse } from "next/server";
import { llmConfig } from "@/lib/llm";
import { simplifiedUntil } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = llmConfig();
  let llm = "unknown";
  if (cfg.provider === "mock") llm = "mock";
  else {
    try {
      const r = await fetch(cfg.baseUrl + "/models", { signal: AbortSignal.timeout(3000), headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {} });
      llm = r.ok ? "ok" : `http ${r.status}`;
    } catch {
      llm = "unreachable";
    }
  }
  const until = simplifiedUntil();
  return NextResponse.json({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, llm, mode: llm === "ok" || llm === "mock" ? "model" : "simplified", simplifiedUntil: until ? new Date(until).toISOString() : null });
}
