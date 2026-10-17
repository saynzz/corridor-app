"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/i18n";
import { useLiveRate } from "@/components/hooks";
import { LangPicker } from "@/components/LangPicker";

interface Rates { points: { date: string; rate: number }[]; current: number; avg: number }
interface St { alerts: { id: string; from: string; to: string; threshold: number; direction: string }[]; credit: { id: string; done: boolean }[] }

export default function RatesPage() {
  const [r, setR] = useState<Rates | null>(null);
  const [s, setS] = useState<St | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();
  const live = useLiveRate("SGD", "IDR", 2500);

  useEffect(() => {
    fetch("/api/rates?base=SGD&quote=IDR").then((x) => x.json()).then(setR);
    fetch("/api/state").then((x) => x.json()).then(setS);
  }, []);

  const W = 320, H = 96;
  let path = "", area = "", last = { x: 0, y: 0 };
  if (r) {
    const pts0 = [...r.points.slice(0, -1).map((p) => p.rate), live?.rate ?? r.current];
    const min = Math.min(...pts0), max = Math.max(...pts0);
    const pts = pts0.map((v, i) => ({ x: (i / (pts0.length - 1)) * W, y: 8 + (1 - (v - min) / (max - min || 1)) * (H - 16) }));
    path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    area = `${path} L${W} ${H} L0 ${H} Z`;
    last = pts[pts.length - 1];
  }
  const cur = live?.rate ?? r?.current ?? 0;
  const better = r ? cur < r.avg : false;
  const delta = live ? live.rate - live.prev : 0;
  const done = s ? s.credit.filter((c) => c.done).length : 0;
  const alert = s?.alerts[0];

  return (
    <div className="shell">
      <main className="page">
        <header className="between enter">
          <h1 className="title">{t("rates.title")}</h1>
          <Link href="/" className="iconbtn" aria-label="Close"><Icon name="close" size={16} /></Link>
        </header>

        <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 10, animationDelay: "60ms" }}>
          <div className="between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>{t("rates.per")}</div>
              <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
                <div key={Math.round(cur)} className="mono fade" style={{ fontSize: 30, fontWeight: 500, marginTop: 2 }}>{r ? Math.round(cur).toLocaleString("en-US") : "—"}</div>
                {live && <span className={`mono ${delta <= 0 ? "up" : "down"}`} style={{ fontSize: 12 }}>{delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              {r && <span className={`chip ${better ? "lime" : "warn"}`}>{better ? t("rates.better") : t("rates.worse")}</span>}
              <span className="row mono faint" style={{ fontSize: 11, gap: 6 }}><span className={live?.source === "sample" ? "" : "live-dot"} style={live?.source === "sample" ? { width: 6, height: 6, borderRadius: "50%", background: "var(--warn)" } : {}} />{live?.source === "sample" ? t("rates.sample") : `${t("rates.live")} · ${live?.source ?? ""}`}</span>
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="30-day exchange rate trend">
            {r && (
              <>
                <path d={area} fill="rgba(200,241,105,0.10)" />
                <path d={path} fill="none" stroke="var(--lime)" strokeWidth={2} strokeLinejoin="round" style={{ transition: "d .6s" }} />
                <circle cx={last.x} cy={last.y} r={7} fill="var(--lime)" opacity={0.25} className="live-dot" />
                <circle cx={last.x} cy={last.y} r={4} fill="var(--lime)" />
              </>
            )}
          </svg>
          <div className="between mono faint" style={{ fontSize: 10 }}>
            <span>{r?.points[0]?.date.slice(5)}</span>
            <span>{r ? t("rates.avg", { n: Math.round(r.avg).toLocaleString("en-US") }) : ""}</span>
            <span>{t("today")}</span>
          </div>
          <div className="between" style={{ paddingTop: 10, borderTop: "1px solid var(--line-soft)", fontSize: 13 }}>
            <span>{alert ? t("rates.alertAt", { sign: alert.direction === "below" ? "≤" : "≥", n: alert.threshold }) : t("rates.noAlert")}</span>
            <button className="btn small primary" onClick={() => router.push("/agent?q=" + encodeURIComponent(t("q.alert", { n: r ? Math.floor((r.current - 100) / 50) * 50 : 12100 })))}>
              {alert ? t("rates.change") : t("rates.set")}
            </button>
          </div>
        </section>

        <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 12, animationDelay: "120ms" }}>
          <div className="between">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("rates.credit")}</h2>
            <span className="mono muted" style={{ fontSize: 12 }}>{done} / {s?.credit.length ?? 5}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${s?.credit.length ?? 5}, 1fr)`, gap: 6 }}>
            {(s?.credit ?? []).map((c, i) => (
              <div key={c.id} style={{ height: 6, borderRadius: 999, background: c.done ? "var(--lime)" : i === done ? "var(--sky)" : "var(--line)", transformOrigin: "left", animation: `fadeIn .4s ${i * 90}ms both` }} />
            ))}
          </div>
          {(s?.credit ?? []).map((c, i) => (
            <div key={c.id}>
              <button
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="between"
                aria-expanded={open === c.id}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: i === done ? "8px 12px" : "4px 0",
                  borderRadius: 14,
                  border: i === done ? "1px solid rgba(142,201,255,.3)" : 0,
                  background: i === done ? "rgba(142,201,255,.08)" : "transparent",
                  color: c.done ? "var(--muted)" : "var(--text)",
                  fontSize: 14,
                  textAlign: "left",
                }}
              >
                <span className="row">
                  <Icon name={c.done ? "check" : "arrowRight"} size={16} color={c.done ? "var(--lime)" : i === done ? "var(--sky)" : "var(--faint)"} />
                  <span style={{ textDecoration: c.done ? "line-through" : "none" }}>{i === done ? t("rates.next") + " " : ""}{t("credit." + c.id)}</span>
                </span>
                <span className="mono faint" style={{ fontSize: 11 }}>{t("rates.why")}</span>
              </button>
              {open === c.id && <div className="muted fade" style={{ fontSize: 13, padding: "6px 4px 2px 30px" }}>{t("credit." + c.id + "w")}</div>}
            </div>
          ))}
        </section>

        <section id="language" className="enter" style={{ display: "flex", flexDirection: "column", gap: 10, animationDelay: "180ms" }}>
          <div className="eyebrow">{t("rates.talk")}</div>
          <LangPicker />
          <div className="faint" style={{ fontSize: 12 }}>{t("rates.anyLang")}</div>
        </section>
      </main>
      <Nav />
    </div>
  );
}
