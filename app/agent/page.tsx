"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { AgentCard } from "@/components/Cards";
import { useI18n } from "@/components/i18n";
import { vibrate } from "@/components/hooks";
import type { Card } from "@/lib/types";

interface Item {
  role: "user" | "assistant";
  content: string;
  cards?: Card[];
  trace?: { tool: string; status: string }[];
  mode?: string;
  fresh?: boolean;
}

const KEY = "corridor.chat";

function loadChat(): Item[] {
  try {
    return (JSON.parse(sessionStorage.getItem(KEY) || "[]") as Item[]).map((i) => ({ ...i, fresh: false }));
  } catch {
    return [];
  }
}

function Typewriter({ text, onTick }: { text: string; onTick?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(1, Math.round(text.length / 60));
    const id = setInterval(() => {
      setN((x) => {
        const y = Math.min(text.length, x + step);
        if (y >= text.length) clearInterval(id);
        return y;
      });
      onTick?.();
    }, 18);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span style={{ opacity: 0.5 }}>▍</span>}
    </>
  );
}

function Thinking() {
  const { t } = useI18n();
  const [i, setI] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x < 5 ? x + 1 : x)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[1, 2, 3, 4, 5].slice(0, i).map((k) => (
        <div key={k} className="row enter mono" style={{ fontSize: 12, color: k === i ? "var(--text-2)" : "var(--faint)", gap: 8 }}>
          {k < i ? <Icon name="check" size={14} color="var(--lime)" stroke={2.4} /> : <span className="live-dot" />}
          {t("think." + k)}
        </div>
      ))}
    </div>
  );
}

function Chat() {
  const params = useSearchParams();
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ model: string; llm: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const scroll = () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  useEffect(() => {
    setItems(loadChat());
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
    scroll();
  }, [items, busy]);

  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      send(q);
      window.history.replaceState(null, "", "/agent");
    }
  }, [params]);

  async function send(msg: string) {
    if (!msg.trim() || busy) return;
    const prior = loadChat();
    const history = prior.map(({ role, content }) => ({ role, content }));
    const next = [...prior, { role: "user" as const, content: msg, fresh: true }];
    setItems(next);
    setText("");
    setBusy(true);
    vibrate(10);
    try {
      const started = Date.now();
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, message: msg, lang }),
      });
      const j = await r.json();
      const wait = Math.max(0, 1800 - (Date.now() - started));
      await new Promise((res) => setTimeout(res, wait));
      setItems([...next, { role: "assistant", content: j.reply || j.error || "…", cards: j.cards || [], trace: j.trace || [], mode: j.mode, fresh: true }]);
      if ((j.cards || []).some((c: Card) => c.type === "risk" && c.level !== "low")) vibrate([30, 60, 30]);
    } catch (e) {
      setItems([...next, { role: "assistant", content: "Network error: " + String(e), fresh: true }]);
    } finally {
      setBusy(false);
    }
  }

  const ready = health?.llm === "ok" || health?.llm === "mock";

  return (
    <div className="shell">
      <header className="row" style={{ gap: 12, padding: "max(env(safe-area-inset-top), 16px) 16px 12px", borderBottom: "1px solid var(--line-soft)", position: "sticky", top: 22, background: "rgba(7,9,15,.88)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" className="iconbtn" aria-label="Back"><Icon name="back" /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{t("agent.title")}</div>
          <div className="row muted" style={{ fontSize: 12, gap: 6 }}>
            <span className={ready ? "live-dot" : ""} style={ready ? {} : { width: 6, height: 6, borderRadius: "50%", background: "var(--warn)" }} />
            {busy ? t("think.1") : health ? (ready ? `${health.llm === "mock" ? t("agent.mock") : health.model} · ${t("agent.sandbox")}` : t("agent.simplified")) : t("agent.sandbox")}
          </div>
        </div>
        <button
          className="btn small"
          onClick={() => {
            setItems([]);
            try {
              sessionStorage.removeItem(KEY);
            } catch {}
          }}
        >
          {t("agent.new")}
        </button>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "16px 16px 170px" }}>
        {items.length === 0 && !busy && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}>
            <div className="enter" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>{t("agent.emptyTitle")}</div>
            <div className="muted enter" style={{ fontSize: 14, animationDelay: "60ms" }}>{t("agent.emptySub")}</div>
            {["s1", "s2", "s3", "s4", "s5"].map((k, i) => {
              const s = t(k);
              return (
                <button key={k} className="card enter tap" onClick={() => send(s)} style={{ textAlign: "left", padding: "12px 14px", color: "var(--text)", fontSize: 14, lineHeight: 1.4, animationDelay: `${120 + i * 70}ms` }}>
                  {s.length > 110 ? s.slice(0, 107) + "…" : s}
                </button>
              );
            })}
          </div>
        )}

        {items.map((it, i) =>
          it.role === "user" ? (
            <div key={i} className={`bubble-user ${it.fresh ? "enter" : ""}`}>{it.content}</div>
          ) : (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {it.mode === "simplified" && (
                <div className="row" style={{ gap: 6, alignSelf: "flex-start", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--warn)", color: "var(--warn)", fontSize: 11, fontWeight: 600 }} title={t("agent.simplifiedHint")}>
                  {t("agent.simplified")}
                </div>
              )}
              {it.cards?.map((c, k) => <AgentCard key={k} card={c} index={it.fresh ? k : 0} />)}
              <div className={`bubble-agent ${it.fresh ? "enter" : ""}`} style={it.fresh ? { animationDelay: `${(it.cards?.length ?? 0) * 140}ms` } : {}}>
                {it.fresh ? <Typewriter text={it.content} onTick={scroll} /> : it.content}
              </div>
              {it.trace && it.trace.length > 0 && (
                <details className="mono faint" style={{ fontSize: 11 }}>
                  <summary style={{ cursor: "pointer" }}>{t("agent.tools", { n: it.trace.length })}</summary>
                  {it.trace.map((x, k) => (
                    <div key={k}>
                      {x.tool}() → {x.status}
                    </div>
                  ))}
                </details>
              )}
            </div>
          )
        )}
        {busy && <Thinking />}
        <div ref={endRef} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="inputbar">
          <textarea
            rows={1}
            aria-label={t("agent.placeholder")}
            placeholder={t("agent.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
          />
          <button className="send" aria-label="Send" disabled={busy || !text.trim()}>
            <Icon name="arrowUp" color="var(--lime-ink)" stroke={2.2} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
