"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { money, type Cur } from "@/components/format";
import { useI18n } from "@/components/i18n";
import { vibrate } from "@/components/hooks";
import { checkLabel, routeLabel } from "@/components/labels";
import type { Draft, Payee, ConvertPayload, PaymentPayload } from "@/lib/types";

type Phase = "review" | "scanning" | "pin" | "sending" | "done";

export default function Confirm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t, toast } = useI18n();
  const [data, setData] = useState<{ draft: Draft; payee?: Payee; token: string | null } | null>(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [now, setNow] = useState(Date.now());
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetch(`/api/drafts/${id}`).then((r) => r.json()).then(setData);
    const tm = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tm);
  }, [id]);

  useEffect(() => {
    if (phase === "pin") setTimeout(() => refs.current[0]?.focus(), 50);
  }, [phase]);

  if (!data) {
    return (
      <div className="shell">
        <main className="page" style={{ gap: 16 }}>
          <div className="skeleton" style={{ height: 44, width: 44, borderRadius: 22 }} />
          <div className="skeleton" style={{ height: 60, width: "70%", margin: "20px auto" }} />
          <div className="skeleton" style={{ height: 140 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </main>
      </div>
    );
  }
  if (!data.draft) return <div className="shell"><main className="page">{t("conf.notFound")} <Link href="/">{t("nav.home")}</Link></main></div>;

  const d = data.draft;
  const isPay = d.kind === "payment";
  const p = d.payload as PaymentPayload & ConvertPayload;
  const cur = (isPay ? p.currency : p.from) as Cur;
  const [whole, cents] = money(p.amount, cur).split(".");
  const left = Math.max(0, Date.parse(d.expiresAt) - now);
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const pending = d.status === "pending" && left > 0;

  async function execute(opts: { pin?: string; biometric?: boolean }) {
    setPhase("sending");
    setErr(null);
    const r = await fetch(`/api/drafts/${id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: data!.token, ...opts }),
    });
    const j = await r.json();
    await new Promise((res) => setTimeout(res, 500));
    if (j.ok) {
      vibrate([20, 40, 60]);
      setPhase("done");
      setData({ ...data!, draft: { ...d, status: "executed" }, token: null });
    } else {
      vibrate([60, 40, 60]);
      const msg = t("err." + (j.code || "generic"));
      setErr(msg);
      toast(msg, "warn");
      setPin(["", "", "", ""]);
      setPhase(isPay && opts.pin !== undefined ? "pin" : "review");
    }
  }

  function faceId() {
    setPhase("scanning");
    vibrate(15);
    setTimeout(() => execute({ biometric: true }), 1700);
  }

  async function cancel() {
    await fetch(`/api/drafts/${id}/cancel`, { method: "POST" });
    router.push("/agent");
  }

  const doneText = isPay
    ? t("conf.donePay", { amount: money(p.amount, p.currency), to: p.payeeName })
    : t("conf.doneConv", { a: money(p.amount, p.from), b: money(p.receive, p.to) });

  return (
    <div className="shell">
      <div className="glow" style={{ bottom: -180, left: "50%", marginLeft: -230, width: 460, height: 460, background: "radial-gradient(circle, rgba(200,241,105,.2), rgba(200,241,105,0) 65%)" }} />
      <main className="page" style={{ paddingBottom: 32, gap: 18 }}>
        <header className="between enter">
          <button className="iconbtn" aria-label="Back" onClick={() => router.back()}><Icon name="back" /></button>
          <span className="chip lime row" style={{ gap: 6 }}>
            <Icon name="shield" size={13} color="var(--lime)" stroke={2} />
            TIER {d.tier} · {isPay ? t("card.moneyOut") : t("card.ownWallets")}
          </span>
        </header>

        <section className="enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, animationDelay: "60ms" }}>
          <div className="muted" style={{ fontSize: 14 }}>{isPay ? t("conf.pay") : t("conf.convert")}</div>
          <div className="amount-xl" style={{ fontSize: 50 }}>
            {whole}
            {cents && <span className="cents">.{cents}</span>}
          </div>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--text-2)" }}>
            {isPay ? p.reference || "" : `→ ${money(p.receive, p.to as Cur)}`}
          </div>
        </section>

        <section className="card enter" style={{ padding: "4px 16px", animationDelay: "120ms" }}>
          <div className="list">
            <div className="between" style={{ padding: "12px 0" }}>
              <span className="muted" style={{ fontSize: 13 }}>{isPay ? t("conf.to") : t("conf.route")}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{isPay ? p.payeeName : routeLabel(p.routeId, t)}</div>
                {isPay && data.payee && <div className="muted" style={{ fontSize: 12 }}>{data.payee.account}</div>}
              </div>
            </div>
            <div className="between" style={{ padding: "12px 0" }}>
              <span className="muted" style={{ fontSize: 13 }}>{t("conf.from")}</span>
              <span style={{ fontSize: 14 }}>{t("conf.wallet", { c: cur })}</span>
            </div>
            <div className="between" style={{ padding: "12px 0" }}>
              <span className="muted" style={{ fontSize: 13 }}>{t("conf.expires")}</span>
              <span className="mono" style={{ fontSize: 14, color: left < 5 * 60e3 && pending ? "var(--warn)" : "var(--text)" }}>
                {pending ? `${mm}:${String(ss).padStart(2, "0")}` : t("conf.status." + d.status)}
              </span>
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow enter" style={{ animationDelay: "160ms" }}>{t("conf.checks", { a: d.checks.filter((c) => c.ok).length, b: d.checks.length })}</div>
          {d.checks.map((c, i) => (
            <div key={i} className="row enter" style={{ fontSize: 14, alignItems: "flex-start", animationDelay: `${200 + i * 90}ms` }}>
              <span className="pop" style={{ animationDelay: `${260 + i * 90}ms`, display: "flex" }}>
                <Icon name={c.ok ? "check" : "x"} color={c.ok ? "var(--lime)" : "var(--warn)"} stroke={2.4} />
              </span>
              <div>
                {checkLabel(c, t)}
                {c.detail && <div className="faint" style={{ fontSize: 12 }}>{c.detail}</div>}
              </div>
            </div>
          ))}
        </section>

        <div className="card pad enter" style={{ borderStyle: "dashed", fontSize: 13, lineHeight: 1.45, color: "var(--text-2)", animationDelay: `${300 + d.checks.length * 90}ms` }}>
          <b style={{ color: "var(--text)" }}>{t("conf.notice")}</b> {isPay ? t("conf.pinHint") : t("conf.oneTap")}
        </div>

        {err && <div className="card warn pad fade" role="alert" style={{ fontSize: 14 }}>{err}</div>}

        <div style={{ flex: 1 }} />

        {pending && (
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {phase === "pin" && (
              <div className="pin enter" aria-label="PIN">
                {pin.map((v, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    inputMode="numeric"
                    type="password"
                    maxLength={1}
                    aria-label={`PIN ${i + 1}`}
                    value={v}
                    onChange={(e) => {
                      const ch = e.target.value.replace(/\D/g, "").slice(-1);
                      const n = [...pin];
                      n[i] = ch;
                      setPin(n);
                      vibrate(5);
                      if (ch && i < 3) refs.current[i + 1]?.focus();
                      if (ch && i === 3 && n.every(Boolean)) execute({ pin: n.join("") });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !pin[i] && i > 0) refs.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
            )}
            {isPay ? (
              <>
                <button className="btn primary big" disabled={phase === "sending" || phase === "scanning"} onClick={faceId}>
                  <Icon name="face" size={22} color="var(--lime-ink)" stroke={2} />
                  {phase === "sending" ? t("conf.confirming") : t("conf.useFace")}
                </button>
                {phase !== "pin" && (
                  <button className="btn" style={{ border: 0, color: "var(--text-2)" }} onClick={() => setPhase("pin")}>{t("conf.usePin")}</button>
                )}
              </>
            ) : (
              <button className="btn primary big" disabled={phase === "sending"} onClick={() => execute({})}>
                <Icon name="convert" size={20} color="var(--lime-ink)" stroke={2} />
                {phase === "sending" ? t("conf.confirming") : t("conf.confirmConv")}
              </button>
            )}
            <button className="btn" style={{ border: 0, color: "var(--muted)" }} onClick={cancel}>{t("conf.cancel")}</button>
          </section>
        )}
        {!pending && phase !== "done" && <Link href="/agent" className="btn big">{t("conf.back")}</Link>}
      </main>

      {phase === "scanning" && (
        <div className="overlay">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div className="face">
              <Icon name="face" size={64} color="var(--lime)" stroke={1.4} />
              <div className="line" />
            </div>
            <div className="mono" style={{ fontSize: 13, color: "var(--text-2)" }}>{t("conf.scan")}</div>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="overlay" style={{ flexDirection: "column", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", maxWidth: 340 }}>
            <div className="pop" style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--lime)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 60px rgba(200,241,105,.45)" }}>
              <svg className="check-draw" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0A0C12" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </div>
            <div className="enter" style={{ fontSize: 28, fontWeight: 600, animationDelay: "200ms" }}>{t("conf.doneTitle")}</div>
            <div className="enter muted" style={{ fontSize: 15, lineHeight: 1.45, animationDelay: "300ms" }}>{doneText}</div>
            <div className="enter" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 12, animationDelay: "420ms" }}>
              <Link href="/agent" className="btn primary big">{t("conf.back")}</Link>
              <Link href="/" className="btn big">{t("conf.home")}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
