import { loadEnv } from "./env";
loadEnv();

(async () => {
  const { chat, llmConfig } = await import("../lib/llm");
  const { TOOL_DEFS } = await import("../lib/tools");
  const cfg = llmConfig();
  console.log(`Provider: ${cfg.provider} · model: ${cfg.model} · url: ${cfg.baseUrl}`);
  const t0 = Date.now();
  try {
    const r = await chat(
      [
        { role: "system", content: "You are a banking agent. Use tools. /no_think" },
        { role: "user", content: "What are my balances?" },
      ],
      TOOL_DEFS
    );
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    if (r.toolCalls.length) console.log(`✅ Tool calling works (${s}s): ${r.toolCalls.map((c) => c.function.name).join(", ")}`);
    else console.log(`⚠️  Model answered without calling a tool (${s}s): "${r.content.slice(0, 120)}"\n   Try a stronger model, e.g. qwen3:8b or qwen2.5:7b-instruct.`);
  } catch (e) {
    console.log("❌ Could not reach the model:", e instanceof Error ? e.message : e);
    console.log("   Is Ollama running? Try: ollama serve   and   ollama pull " + cfg.model);
    process.exit(1);
  }
})();
