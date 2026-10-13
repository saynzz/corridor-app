import { NextResponse } from "next/server";
import { llmConfig } from "@/lib/llm";

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
  return NextResponse.json({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, llm });
}
