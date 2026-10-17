"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useI18n } from "./i18n";
import { StateChip, api, sgd } from "./caseui";

export function CaseCard() {
  const { t, days } = useI18n();
  const [v, setV] = useState<any>(null);
  useEffect(() => {
    const load = () => api<any>("/api/case").then((r) => r.ok && setV(r.data));
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  if (!v) return <div className="skeleton" style={{ height: 150 }} />;
  const c = v.case;
  if (!c) {
    return (
      <section className="card lime pad enter" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row eyebrow" style={{ color: "var(--lime)", gap: 8 }}><span className="live-dot" />{t("home.caseTitle")}</div>
        <div style={{ fontSize: 15, lineHeight: 1.45 }}>{t("home.caseNone")}</div>
        <Link href="/case" className="btn primary" style={{ alignSelf: "flex-start" }}>{t("home.caseCreate")} <Icon name="arrowRight" size={14} color="var(--lime-ink)" stroke={2.2} /></Link>
      </section>
    );
  }
  const st = v.status;
  const next = v.notifications?.[0];
  const dueDays = c.obligation ? Math.max(0, Math.ceil((Date.parse(c.obligation.dueDate + "T23:59:00+08:00") - Date.now()) / 864e5)) : null;
  const topup = c.plan?.funding?.topup ?? c.funding?.topup;
  const stage = st.completed ? "POSTED" : st.transfer !== "NOT_STARTED" ? st.transfer : st.plan !== "NONE" ? st.plan : st.document;
  return (
    <section className="card lime pad enter" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="between">
        <div className="row eyebrow" style={{ color: "var(--lime)", gap: 8 }}><span className="live-dot" />{t("home.caseTitle")}</div>
        <StateChip value={stage} />
      </div>
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.02em" }}>{c.obligation ? sgd(c.obligation.amount) : t("case.unverified")}</div>
          <div className="mono muted" style={{ fontSize: 11 }}>{c.obligation ? `${c.obligation.reference} · ${t("case.due")} ${c.obligation.dueDate} SGT${dueDays !== null ? " · " + days(dueDays) : ""}` : t("case.uploadFirst")}</div>
        </div>
        {typeof topup === "number" && topup > 0 && !st.completed && (
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 11 }}>{t("home.caseTopup")}</div>
            <div className="mono" style={{ fontSize: 14 }}>{sgd(topup)}</div>
          </div>
        )}
      </div>
      {st.completed ? (
        <div className="row" style={{ fontSize: 14 }}><Icon name="check" color="var(--lime)" stroke={2.4} /> {t("home.caseDone")}</div>
      ) : (
        next && <div style={{ fontSize: 13, color: "var(--text-2)" }}><b>{t("home.caseNext", { owner: next.owner })}</b> — {next.action}</div>
      )}
      <Link href="/case" className="btn primary" style={{ alignSelf: "flex-start" }}>{t("home.continue")} <Icon name="arrowRight" size={14} color="var(--lime-ink)" stroke={2.2} /></Link>
    </section>
  );
}
