"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { LangPicker } from "@/components/LangPicker";
import { useI18n } from "@/components/i18n";
import { money } from "@/components/format";

interface St {
  profile: { name: string; homeCountry: string; homeCity: string; studyCountry: string; university: string };
  payees: { id: string; name: string; kind: string; account: string; verified: boolean }[];
  limits: { convertDailySGD: number; paymentSingleSGD: number; paymentMonthlySGD: number; newPayeeCoolOffHours: number };
}

const KIND_ICON: Record<string, string> = { university: "tuition", landlord: "home", family: "send", merchant: "log" };

export default function Profile() {
  const [s, setS] = useState<St | null>(null);
  const [health, setHealth] = useState<{ model: string; llm: string; provider: string } | null>(null);
  const { t, place, toast } = useI18n();

  useEffect(() => {
    fetch("/api/state").then((r) => r.json()).then(setS);
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="between" style={{ padding: "12px 0", fontSize: 14, gap: 16 }}>
      <span className="muted">{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div className="shell">
      <div className="glow lime" />
      <main className="page">
        <header className="between enter">
          <Link href="/" className="iconbtn" aria-label="Back"><Icon name="back" /></Link>
          <h1 style={{ fontSize: 17, fontWeight: 600 }}>{t("prof.title")}</h1>
          <span style={{ width: 44 }} />
        </header>

        <section className="enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0 4px", animationDelay: "60ms" }}>
          <div className="pop" style={{ width: 88, height: 88, borderRadius: "50%", background: "linear-gradient(135deg, var(--lime), #8ec9ff)", color: "var(--lime-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 600, boxShadow: "0 10px 40px rgba(200,241,105,.25)" }}>
            {s ? s.profile.name.split(" ").map((x) => x[0]).join("") : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>{s?.profile.name ?? <span className="skeleton" style={{ display: "inline-block", width: 180, height: 22 }} />}</div>
          {s && <div className="chip lime">{t("prof.student", { uni: s.profile.university })}</div>}
        </section>

        {s && (
          <section className="card enter" style={{ padding: "2px 16px", animationDelay: "120ms" }}>
            <div className="list">
              <Row label={t("prof.home")} value={`${place(s.profile.homeCountry)} · ${place(s.profile.homeCity)}`} />
              <Row label={t("prof.study")} value={place(s.profile.studyCountry)} />
            </div>
          </section>
        )}

        <section id="language" className="enter" style={{ display: "flex", flexDirection: "column", gap: 10, animationDelay: "180ms" }}>
          <div className="eyebrow">{t("prof.lang")}</div>
          <LangPicker />
        </section>

        <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "240ms" }}>
          <div className="eyebrow">{t("prof.payees")}</div>
          <div className="card" style={{ padding: "2px 16px" }}>
            <div className="list">
              {(s?.payees ?? []).map((p) => (
                <div key={p.id} className="row" style={{ padding: "11px 0", gap: 12 }}>
                  <div className="coin" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}><Icon name={KIND_ICON[p.kind] || "send"} size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{p.name}</div>
                    <div className="mono faint" style={{ fontSize: 11 }}>{p.account}</div>
                  </div>
                  {p.verified && <span className="chip lime row" style={{ gap: 4 }}><Icon name="check" size={11} color="var(--lime)" stroke={2.6} />{t("prof.verified")}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {s && (
          <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "300ms" }}>
            <div className="eyebrow">{t("prof.limits")}</div>
            <div className="card" style={{ padding: "2px 16px" }}>
              <div className="list">
                <Row label={t("prof.limConv")} value={<span className="mono">{money(s.limits.convertDailySGD, "SGD", { cents: false })}</span>} />
                <Row label={t("prof.limSingle")} value={<span className="mono">{money(s.limits.paymentSingleSGD, "SGD", { cents: false })}</span>} />
                <Row label={t("prof.limMonth")} value={<span className="mono">{money(s.limits.paymentMonthlySGD, "SGD", { cents: false })}</span>} />
                <Row label={t("prof.limCool")} value={<span className="mono">{t("prof.hours", { n: s.limits.newPayeeCoolOffHours })}</span>} />
              </div>
            </div>
            <div className="faint" style={{ fontSize: 12 }}>{t("prof.limNote")}</div>
          </section>
        )}

        <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "360ms" }}>
          <div className="eyebrow">{t("prof.security")}</div>
          <div className="card" style={{ padding: "2px 16px" }}>
            <div className="list">
              <Row label={t("prof.faceid")} value={<span className="chip lime">{t("prof.always")}</span>} />
              <Link href="/shield" className="between" style={{ padding: "12px 0", fontSize: 14, color: "var(--text)", minHeight: 44 }}>
                <span className="muted">{t("prof.agentPerms")}</span>
                <span className="row mono" style={{ gap: 6, fontSize: 12 }}>T0–T3 <Icon name="arrowRight" size={14} color="var(--lime)" /></span>
              </Link>
              <Row
                label={t("prof.model")}
                value={
                  <span className="row mono" style={{ gap: 6, fontSize: 12 }}>
                    <span className={health?.llm === "ok" || health?.llm === "mock" ? "live-dot" : ""} />
                    {health ? (health.llm === "mock" ? t("agent.mock") : health.model) : "…"}
                  </span>
                }
              />
            </div>
          </div>
        </section>

        <button
          className="btn enter"
          style={{ animationDelay: "420ms" }}
          onClick={async () => {
            await fetch("/api/reset", { method: "POST" });
            try {
              sessionStorage.removeItem("corridor.chat");
            } catch {}
            toast(t("shield.resetDone"));
            fetch("/api/state").then((r) => r.json()).then(setS);
          }}
        >
          <Icon name="reset" /> {t("shield.reset")}
        </button>

        <div className="faint" style={{ fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>{t("prof.about")}</div>
      </main>
      <Nav />
    </div>
  );
}
