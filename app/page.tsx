"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { COIN, money, num, sym, type Cur } from "@/components/format";
import { useI18n } from "@/components/i18n";
import { useCountUp, useLiveRate } from "@/components/hooks";
import { draftSummary, txTitle } from "@/components/labels";
import { CaseCard } from "@/components/CaseCard";

interface State {
  profile: { name: string; homeCity: string; studyCountry: string };
  wallets: { currency: Cur; balance: number; label: string; inBase: number }[];
  totalBase: number;
  bills: { id: string; title: string; amount: number; currency: Cur; dueDate: string; status: string; payee?: string }[];
  pending: { id: string; kind: string; summary: string; tier: number; payload?: unknown }[];
  transactions: { id: string; kind: string; title: string; at: string; legs: { currency: Cur; amount: number }[] }[];
}

export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [ask, setAsk] = useState("");
  const router = useRouter();
  const { t, days, place, lang } = useI18n();
  const total = useCountUp(s?.totalBase ?? 0);
  const rate = useLiveRate();

  useEffect(() => {
    const load = () => fetch("/api/state").then((r) => r.json()).then(setS);
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const h = new Date().getHours();
  const greet = t(h < 12 ? "greet.morning" : h < 18 ? "greet.afternoon" : "greet.evening");
  const first = s?.profile.name.split(" ")[0] ?? "";
  const [whole, cents] = total.toFixed(2).split(".");
  const go = (q: string) => router.push("/agent?q=" + encodeURIComponent(q));
  const delta = rate ? rate.rate - rate.prev : 0;

  return (
    <div className="shell">
      <div className="glow lime" />
      <main className="page">
        <header className="between enter">
          <button className="avatar-btn tap" onClick={() => router.push("/profile")} aria-label={t("prof.title")}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #2a3247, #171c2a)", border: "1px solid #2a3247", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15 }}>
              {s ? s.profile.name.split(" ").map((x) => x[0]).join("") : ""}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>{greet}</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{first || <span className="skeleton" style={{ display: "inline-block", width: 80, height: 16 }} />}</div>
            </div>
          </button>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/profile#language" className="btn small mono" aria-label={t("prof.lang")}>{lang.toUpperCase()}</Link>
            <Link href="/shield" className="iconbtn" aria-label={t("nav.shield")} style={{ position: "relative" }}>
              <Icon name="bell" />
              {s && s.pending.length > 0 && <span className="badge">{s.pending.length}</span>}
            </Link>
          </div>
        </header>

        <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4, animationDelay: "60ms" }}>
          <div className="row muted" style={{ fontSize: 13, gap: 8, flexWrap: "wrap" }}>
            {t("home.total")}
            {s && <span className="chip">{t("home.from", { country: place(s.profile.studyCountry), city: place(s.profile.homeCity) })}</span>}
          </div>
          {s ? (
            <div className="amount-xl">S${Number(whole).toLocaleString("en-US")}<span className="cents">.{cents}</span></div>
          ) : (
            <div className="skeleton" style={{ width: 220, height: 50 }} />
          )}
          {rate && (
            <div className="ticker fade">
              <span className={rate.source === "sample" ? "" : "live-dot"} style={rate.source === "sample" ? { width: 6, height: 6, borderRadius: "50%", background: "var(--warn)" } : {}} />
              Rp{Math.round(rate.rate).toLocaleString("en-US")} / S$1
              <span className={delta <= 0 ? "up" : "down"}>{delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}</span>
              <span className="faint">{rate.source === "sample" ? t("rates.sample") : t("rates.live")}</span>
            </div>
          )}
        </section>

        <section className="enter" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, animationDelay: "120ms" }}>
          {[
            { label: "act.send", icon: "send", q: "q.send", primary: true },
            { label: "act.balances", icon: "request", q: "q.balances" },
            { label: "act.convert", icon: "convert", q: "q.convert" },
            { label: "act.tuition", icon: "tuition", q: "", href: "/case" },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => ("href" in a && a.href ? router.push(a.href) : go(t(a.q)))}
              style={{
                height: 66,
                borderRadius: 18,
                border: a.primary ? 0 : "1px solid var(--line)",
                background: a.primary ? "var(--lime)" : "var(--surface)",
                color: a.primary ? "var(--lime-ink)" : "var(--text)",
                fontSize: 12,
                fontWeight: a.primary ? 600 : 500,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "0 4px",
              }}
            >
              <Icon name={a.icon} color={a.primary ? "var(--lime-ink)" : "var(--text)"} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{t(a.label)}</span>
            </button>
          ))}
        </section>

        <section className="card enter" style={{ padding: "4px 16px", animationDelay: "180ms" }}>
          <div className="list">
            {!s &&
              [0, 1, 2, 3].map((i) => (
                <div key={i} style={{ padding: "12px 0" }}>
                  <div className="skeleton" style={{ height: 36 }} />
                </div>
              ))}
            {(s?.wallets ?? []).map((w) => (
              <div key={w.currency} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", padding: "12px 0" }}>
                <div className="coin" style={{ background: COIN[w.currency].bg, color: COIN[w.currency].fg }}>{sym(w.currency)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{t("cur." + w.currency)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("wal." + w.currency)}
                    {w.currency !== "SGD" ? ` · ≈ ${money(w.inBase, "SGD", { cents: false })}` : ""}
                  </div>
                </div>
                <div key={w.balance} className="mono flash" style={{ fontSize: 15, padding: "2px 4px" }}>{num(w.balance, w.currency)}</div>
              </div>
            ))}
          </div>
        </section>

        {s && s.pending.length > 0 && (
          <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 4, borderColor: "rgba(200,241,105,.4)" }}>
            <div className="row eyebrow" style={{ color: "var(--lime)", gap: 8 }}><span className="live-dot" />{t("home.waiting")}</div>
            {s.pending.map((d) => (
              <Link key={d.id} href={`/confirm/${d.id}`} className="between" style={{ color: "var(--text)", fontSize: 14, minHeight: 44 }}>
                <span>{draftSummary(d, t, money)}</span>
                <Icon name="arrowRight" size={16} color="var(--lime)" />
              </Link>
            ))}
          </section>
        )}

        <CaseCard />

        {s && (
          <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "300ms" }}>
            <div className="eyebrow">{t("home.recent")}</div>
            <div className="card" style={{ padding: "4px 16px" }}>
              <div className="list">
                {s.transactions.slice(0, 4).map((tx) => (
                  <div key={tx.id} className="between" style={{ padding: "11px 0", fontSize: 14 }}>
                    <div style={{ minWidth: 0 }}>
                      <div>{txTitle(tx, t)}</div>
                      <div className="faint mono" style={{ fontSize: 11 }}>{new Date(tx.at).toLocaleDateString(lang === "zh" ? "zh-CN" : lang, { day: "numeric", month: "short" })}</div>
                    </div>
                    <div className="mono" style={{ textAlign: "right", fontSize: 13, flexShrink: 0 }}>
                      {tx.legs.map((l, i) => (
                        <div key={i} style={{ color: l.amount > 0 ? "var(--lime)" : "var(--text)" }}>
                          {l.amount > 0 ? "+" : "−"}
                          {money(Math.abs(l.amount), l.currency)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) go(ask.trim());
          }}
          className="inputbar"
        >
          <textarea rows={1} aria-label={t("home.ask")} placeholder={t("home.ask")} value={ask} onChange={(e) => setAsk(e.target.value)} />
          <button className="send" aria-label="Ask"><Icon name="arrowUp" color="var(--lime-ink)" stroke={2.2} /></button>
        </form>
      </main>
      <Nav />
    </div>
  );
}
