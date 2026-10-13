"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { COIN, money, sym, type Cur } from "./format";
import { useI18n } from "./i18n";
import { checkLabel, flagLabel, reasonLabel, routeLabel } from "./labels";
import type { Card, ConvertPayload, PaymentPayload } from "@/lib/types";

export function AgentCard({ card, index = 0 }: { card: Card; index?: number }) {
  const { t } = useI18n();
  const style = { animationDelay: `${index * 140}ms` };

  switch (card.type) {
    case "routes":
      return (
        <div className="enter" style={style}>
          <div className="card" style={{ padding: "4px 14px" }}>
            <div className="list">
              {card.routes.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "10px 0", fontSize: 13 }}>
                  <div className="row" style={{ gap: 6, color: r.best ? "var(--lime)" : "var(--muted)", fontWeight: r.best ? 600 : 400 }}>
                    {routeLabel(r.id, t)}
                    {r.best && <span className="pop" style={{ padding: "2px 6px", borderRadius: 6, background: "var(--lime)", color: "var(--lime-ink)", fontSize: 10, animationDelay: `${index * 140 + 300}ms` }}>{t("card.best")}</span>}
                  </div>
                  <div className="mono muted">{t(r.id === "bank_wire" ? "eta.wire" : r.id === "card_topup" ? "eta.instant" : "eta.2h")}</div>
                  <div className="mono" style={{ minWidth: 84, textAlign: "right", color: r.best ? "var(--lime)" : "var(--text)", fontWeight: r.best ? 600 : 400 }}>
                    {money(r.receive, card.to as Cur, { cents: false })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mono faint" style={{ fontSize: 10, marginTop: 6 }}>
            {money(card.amount, card.from as Cur)} → {sym(card.to as Cur)} · {t("card.saves", { amount: money(card.savingVsWorst, card.to as Cur) })} · {card.sample ? t("card.sample") : t("card.live")}
          </div>
        </div>
      );
    case "plan":
      return (
        <div className="card lime pad enter" style={{ ...style, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="between">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{card.title}</div>
            {card.note && <div className="mono" style={{ fontSize: 11, color: "var(--lime)" }}>{card.note}</div>}
          </div>
          {card.steps.map((s, i) => (
            <div key={i} className="row enter" style={{ alignItems: "flex-start", fontSize: 13, lineHeight: 1.4, animationDelay: `${index * 140 + 120 * (i + 1)}ms` }}>
              <div className="step-dot" style={s.tier >= 3 ? { border: "1.5px solid var(--lime)", color: "var(--lime)" } : { background: "var(--lime)", color: "var(--lime-ink)" }}>{i + 1}</div>
              <div>
                {s.text} <span style={{ color: s.tier >= 3 ? "var(--warn)" : "var(--muted)" }}>· T{s.tier}{s.tier >= 3 ? `, ${t("card.needsYou")}` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "confirm": {
      let summary = card.summary;
      if (card.payload) {
        if (card.kind === "convert") {
          const p = card.payload as ConvertPayload;
          summary = t("card.convertSum", { a: money(p.amount, p.from), b: money(p.receive, p.to) });
        } else {
          const p = card.payload as PaymentPayload;
          summary = t("card.paySum", { a: money(p.amount, p.currency), to: p.payeeName });
        }
      }
      return (
        <div className="card pad enter" style={{ ...style, display: "flex", flexDirection: "column", gap: 10, borderColor: "rgba(200,241,105,.4)" }}>
          <div className="between">
            <span className="chip lime">T{card.tier} · {card.tier === 3 ? t("card.moneyOut") : t("card.ownWallets")}</span>
            <span className="row mono faint" style={{ fontSize: 11, gap: 6 }}><span className="live-dot" />{t("card.awaiting")}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{summary}</div>
          <div className="mono muted" style={{ fontSize: 11 }}>{t("card.checks", { a: card.checks.filter((c) => c.ok).length, b: card.checks.length })}</div>
          <Link href={`/confirm/${card.draftId}`} className="btn primary" style={{ alignSelf: "flex-start" }}>
            {t("card.review")} <Icon name="arrowRight" size={14} color="var(--lime-ink)" stroke={2.2} />
          </Link>
        </div>
      );
    }
    case "blocked":
      return (
        <div className="card warn pad enter" style={{ ...style, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ fontWeight: 600, color: "var(--warn)" }}>
            <Icon name="shieldAlert" color="var(--warn)" /> {t("card.blocked")}
          </div>
          <div style={{ fontSize: 13, color: "var(--warn-text)" }}>{reasonLabel(card.reason, t)}</div>
          {card.checks.filter((c) => !c.ok).map((c, i) => (
            <div key={i} className="row" style={{ fontSize: 13 }}>
              <Icon name="x" color="var(--warn)" size={16} /> {checkLabel(c, t)}
            </div>
          ))}
        </div>
      );
    case "risk": {
      const high = card.level === "high";
      return (
        <div className={`card pad enter ${card.level === "low" ? "" : "warn"}`} style={{ ...style, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="row">
            <div className="pop" style={{ width: 36, height: 36, borderRadius: 12, background: card.level === "low" ? "var(--lime)" : "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={card.level === "low" ? "shield" : "shieldAlert"} color="#0A0C12" size={20} stroke={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{high ? t("risk.high") : card.level === "medium" ? t("risk.medium") : t("risk.low")}</div>
              <div style={{ fontSize: 12, color: "var(--warn-text)" }}>{t("risk.sub", { level: t("risk.level." + card.level), n: card.flags.length })}</div>
            </div>
          </div>
          {card.flags.map((f, i) => (
            <div key={i} className="enter" style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 8, fontSize: 13, lineHeight: 1.4, animationDelay: `${index * 140 + 150 * (i + 1)}ms` }}>
              <div className="mono" style={{ color: "var(--warn)" }}>{String(i + 1).padStart(2, "0")}</div>
              <div>{flagLabel(card.codes?.[i], f, t)}</div>
            </div>
          ))}
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>{t("advice." + card.level)}</div>
        </div>
      );
    }
    case "balances":
      return (
        <div className="card enter" style={{ ...style, padding: "4px 14px" }}>
          <div className="list">
            {card.wallets.map((w) => (
              <div key={w.currency} className="between" style={{ padding: "10px 0", fontSize: 14 }}>
                <div className="row">
                  <div className="coin" style={{ width: 28, height: 28, fontSize: 11, background: COIN[w.currency as Cur].bg, color: COIN[w.currency as Cur].fg }}>{sym(w.currency as Cur)}</div>
                  {t("cur." + w.currency)}
                </div>
                <div className="mono">{money(w.balance, w.currency as Cur)}</div>
              </div>
            ))}
          </div>
          <div className="between mono muted" style={{ fontSize: 12, padding: "8px 0 10px", borderTop: "1px solid var(--line-soft)" }}>
            <span>{t("card.total")}</span>
            <span>{money(card.totalBase, "SGD")}</span>
          </div>
        </div>
      );
    case "alert":
      return (
        <div className="card sky pad row enter" style={{ ...style, fontSize: 14 }}>
          <Icon name="bell" color="var(--sky)" /> {card.text}
        </div>
      );
    case "credit":
      return (
        <div className="card pad enter" style={{ ...style, display: "flex", flexDirection: "column", gap: 8 }}>
          {card.steps.map((s) => (
            <div key={s.id} className="row" style={{ fontSize: 13, color: s.done ? "var(--muted)" : "var(--text)" }}>
              <Icon name={s.done ? "check" : "arrowRight"} color={s.done ? "var(--lime)" : "var(--sky)"} size={16} />
              <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{t("credit." + s.id)}</span>
            </div>
          ))}
        </div>
      );
  }
}
