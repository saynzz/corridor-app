"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/i18n";

interface Entry { id: string; at: string; actor: string; action: string; tier?: number; outcome: string; detail: string }

const TIERS = [
  { t: "T0 · READ", k: "tier.t0", c: "var(--sky)" },
  { t: "T1 · DRAFT", k: "tier.t1", c: "var(--sky)" },
  { t: "T2 · OWN", k: "tier.t2", c: "var(--lime)" },
  { t: "T3 · MONEY OUT", k: "tier.t3", c: "var(--lime)" },
  { t: "NEVER", k: "tier.never", c: "var(--warn)" },
];

export default function Shield() {
  const [log, setLog] = useState<Entry[] | null>(null);
  const router = useRouter();
  const { t, toast } = useI18n();
  const refresh = () => fetch("/api/audit").then((r) => r.json()).then((j) => setLog(j.audit));
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  const blocked = (log ?? []).filter((e) => e.outcome === "blocked" || e.outcome === "flagged").length;

  return (
    <div className="shell">
      <div className="glow warn" />
      <main className="page">
        <header className="enter">
          <h1 className="title">{t("shield.title")}</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t("shield.sub")}</div>
        </header>

        <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "60ms" }}>
          <div className="eyebrow">{t("shield.tiers")}</div>
          {TIERS.map((x) => (
            <div key={x.t} style={{ display: "grid", gridTemplateColumns: "118px 1fr", gap: 10, fontSize: 13 }}>
              <span className="mono" style={{ color: x.c, fontSize: 11 }}>{x.t}</span>
              <span className="muted">{t(x.k)}</span>
            </div>
          ))}
        </section>

        <div className="row enter" style={{ gap: 8, animationDelay: "120ms" }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => router.push("/agent?q=" + encodeURIComponent(t("s5")))}>
            <Icon name="shieldAlert" color="var(--warn)" /> {t("shield.try")}
          </button>
          <button
            className="btn"
            onClick={async () => {
              await fetch("/api/reset", { method: "POST" });
              try {
                sessionStorage.removeItem("corridor.chat");
              } catch {}
              toast(t("shield.resetDone"));
              refresh();
            }}
          >
            <Icon name="reset" /> {t("shield.reset")}
          </button>
        </div>

        <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "180ms" }}>
          <div className="between">
            <div className="eyebrow">{t("shield.audit")}</div>
            <span className="chip warn">{t("shield.blocked", { n: blocked })}</span>
          </div>
          <div className="card" style={{ padding: "2px 14px" }}>
            <div className="list">
              {log === null && [0, 1, 2].map((i) => <div key={i} style={{ padding: "12px 0" }}><div className="skeleton" style={{ height: 34 }} /></div>)}
              {log?.length === 0 && <div className="muted" style={{ padding: "14px 0", fontSize: 13 }}>{t("shield.empty")}</div>}
              {log?.map((e, i) => (
                <div key={e.id} className={i < 3 ? "enter" : ""} style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 3, animationDelay: `${i * 60}ms` }}>
                  <div className="between mono" style={{ fontSize: 11 }}>
                    <span style={{ color: e.outcome === "blocked" || e.outcome === "flagged" ? "var(--warn)" : e.outcome === "ok" ? "var(--lime)" : "var(--sky)" }}>
                      {e.outcome.toUpperCase()} · {e.action}
                      {e.tier !== undefined ? ` · T${e.tier}` : ""}
                    </span>
                    <span className="faint">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {e.actor}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", wordBreak: "break-word" }}>{e.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Nav />
    </div>
  );
}
