export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type Msg =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface LlmReply {
  content: string;
  toolCalls: ToolCall[];
}

export function llmConfig() {
  return {
    provider: process.env.LLM_PROVIDER || "openai",
    baseUrl: (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, ""),
    model: process.env.LLM_MODEL || "qwen3:8b",
    apiKey: process.env.LLM_API_KEY || "",
  };
}

export async function chat(messages: Msg[], tools: ToolDef[]): Promise<LlmReply> {
  const cfg = llmConfig();
  if (cfg.provider === "mock") {
    const { mockChat } = await import("./mockllm");
    return mockChat(messages, tools);
  }
  const res = await fetch(cfg.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM error ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    choices: { message: { content?: string | null; tool_calls?: ToolCall[]; reasoning?: string } }[];
  };
  const m = j.choices?.[0]?.message || {};
  let content = stripThinking(m.content || "");
  let toolCalls = (m.tool_calls || []).map((tc, i) => ({
    id: tc.id || `call_${Date.now()}_${i}`,
    type: "function" as const,
    function: {
      name: tc.function.name,
      arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}),
    },
  }));

  if (!toolCalls.length) {
    const parsed = parseInlineToolCall(content, tools);
    if (parsed) {
      toolCalls = [parsed];
      content = "";
    }
  }
  return { content, toolCalls };
}

export function stripThinking(s: string) {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*<\/think>/, "").trim();
}

function parseInlineToolCall(text: string, tools: ToolDef[]): ToolCall | null {
  const names = new Set(tools.map((t) => t.function.name));
  const m = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/) || text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    const name = obj.name || obj.function?.name;
    const args = obj.arguments ?? obj.parameters ?? obj.function?.arguments ?? {};
    if (!names.has(name)) return null;
    return { id: `call_inline_${Date.now()}`, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } };
  } catch {
    return null;
  }
}
