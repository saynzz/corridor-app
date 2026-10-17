"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/i18n";
import { RoleSwitch } from "@/components/RoleSwitch";
import { KV, Section, StateChip, api, idr, sgd, sgt } from "@/components/caseui";
import { vibrate } from "@/components/hooks";

type Any = any;

const FIELD_KEYS = ["amount", "currency", "reference", "dueDate", "studentId", "university", "payeeAccount"] as const;

export default function CasePage() {
  const { t, toast } = useI18n();
  const [v, setV] = useState<Any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [reserveInput, setReserveInput] = useState<string>("");
  const [limitInput, setLimitInput] = useState<string>("");
  const [scan, setScan] = useState(false);
  const [pin, setPin] = useState("");
  const [packSel, setPackSel] = useState<Record<string, boolean>>({});
  const [pack, setPack] = useState<Any[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({});
  const lastCurrent = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await api<Any>("/api/case");
    if (r.ok) setV(r.data);
  }, []);

  useEffect(() => {
    load();
    const a = setInterval(load, 3000);
    const b = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [load]);

  useEffect(() => {
    const c = v?.case;
    if (!c) return;
    if (c.constraints?.reserve !== undefined && reserveInput === "") setReserveInput(String(c.constraints.reserve / 100));
    if (c.constraints?.familyLimitIdr !== undefined && limitInput === "") setLimitInput(String(c.constraints.familyLimitIdr));
  }, [v, reserveInput, limitInput]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; code?: string; data?: Any }>, okMsg?: string) {
    setBusy(label);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      vibrate([40, 40, 40]);
      toast(`${r.code ? r.code + " · " : ""}${r.error}`, "warn");
    } else if (okMsg) toast(okMsg);
    await load();
    return r;
  }

  const role: string = v?.role ?? "student";
  const c = v?.case;
  const st = v?.status;

  if (!v) {
    return (
      <div className="shell">
        <main className="page">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </main>
      </div>
    );
  }

  const header = (
    <header style={{ display: "flex", flexDirection: "column", gap: 12 }} className="enter">
      <div className="between">
        <h1 className="title">{t("case.title")}</h1>
        <Link href="/console" className="btn small">{t("case.console")}</Link>
      </div>
      <RoleSwitch role={role} onChange={() => load()} />
    </header>
  );

  if (!c) {
    return (
      <div className="shell">
        <main className="page">
          {header}
          <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{t("case.emptyTitle")}</div>
            <div className="muted" style={{ fontSize: 14 }}>{t("case.emptySub")}</div>
            <button className="btn primary" disabled={!!busy} onClick={() => run("create", () => api("/api/cases", "POST"), t("case.created"))}>
              {t("case.create")}
            </button>
          </section>
        </main>
        <Nav />
      </div>
    );
  }

  const doc = role !== "payer" ? c.documents?.find((d: Any) => d.id === c.activeDocId) : null;
  const ver = c.verification;
  const plan = c.plan;
  const myStepsPending = !!plan && plan.steps?.some((s: Any) => s.owner === role) && !c.approvals?.some((a: Any) => a.valid && a.role === role && (a.planId === undefined || a.planId === plan.id));
  const quoteFeasible = (c.quotes ?? []).find((q: Any) => q.feasible);
  const chosen = plan?.steps?.find((s: Any) => s.kind === "topup");
  const chosenQuote = chosen ? (c.quotes ?? []).find((q: Any) => q.id === chosen.quoteId) : null;
  const quoteLeft = chosenQuote ? Math.max(0, Date.parse(chosenQuote.expiresAt) - now) : quoteFeasible ? Math.max(0, Date.parse(quoteFeasible.expiresAt) - now) : 0;

  const tracks = [
    { k: "document", label: t("case.trDoc") },
    { k: "plan", label: t("case.trPlan") },
    { k: "funding", label: t("case.trFunding") },
    { k: "transfer", label: t("case.trTransfer") },
    { k: "posting", label: t("case.trPosting") },
  ];

  const execStarted = (c.attempts ?? []).length > 0;
  const approvedAll = !!plan && plan.status === "APPROVED";
  const doneMap: Record<number, boolean> = {
    1: ver?.verificationStatus === "VALID" && !!doc?.fieldsConfirmed,
    2: (!!plan && plan.status !== "BLOCKED") || ((c.quotes ?? []).length > 0 && (c.schemes ?? []).some((x: Any) => x.feasible)),
    3: !!plan && ["READY", "APPROVED"].includes(plan.status),
    4: approvedAll || execStarted,
    5: !!st?.completed,
  };
  if (role === "payer") doneMap[1] = !!c.obligation;
  const order = [1, 2, 3, 4, 5];
  const current = order.find((n) => !doneMap[n]) ?? 6;
  if (lastCurrent.current !== current) {
    lastCurrent.current = current;
    if (Object.keys(openMap).length) setTimeout(() => setOpenMap({}), 0);
  }
  const isDefaultOpen = (n: number) => n === current || (current > 5 && n === 5);
  const isOpen = (n: number) => openMap[n] ?? isDefaultOpen(n);
  const toggle = (n: number) => () => setOpenMap((m) => ({ ...m, [n]: !(m[n] ?? isDefaultOpen(n)) }));
  const stepProps = (n: number) => ({ open: isOpen(n), done: doneMap[n], current: n === current, onToggle: toggle(n), hint: n > current ? t("step.locked") : undefined });
  const summaries: Record<number, string | undefined> = {
    1: ver ? `${ver.verificationStatus} · ${c.obligation?.reference ?? ""} · ${c.obligation ? sgd(c.obligation.amount) : ""}` : undefined,
    2: (plan?.funding ?? c.funding) ? `${t("case.topup")}: ${sgd((plan?.funding ?? c.funding).topup)}` : undefined,
    3: chosenQuote ? `${t("case.route")} ${chosenQuote.routeId} · ${idr(chosenQuote.debitIdr)} · ${chosenQuote.postingDate}` : quoteFeasible ? `${quoteFeasible.routeId} · ${idr(quoteFeasible.debitIdr)}` : undefined,
    4: plan ? `v${plan.version} · ${plan.status}` : undefined,
    5: st ? `${st.transfer} · ${st.posting}` : undefined,
  };
  const stepTitles = [t("case.s2"), t("case.s3"), t("case.s4"), t("case.s5"), t("case.s6")];

  async function approve(method: "biometric" | "pin") {
    if (method === "biometric") {
      setScan(true);
      await new Promise((r) => setTimeout(r, 1400));
      setScan(false);
    }
    await run("approve", () => api(`/api/plans/${plan.id}/approvals`, "POST", { planVersion: plan.version, method, pin }), t("case.approved"));
    setPin("");
  }

  return (
    <div className="shell">
      <main className="page" style={{ gap: 14 }}>
        {header}

        <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{t("case.obligation")}</div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>{c.obligation ? sgd(c.obligation.amount) : t("case.unverified")}</div>
              <div className="mono faint" style={{ fontSize: 11 }}>
                {c.obligation ? `${c.obligation.reference} · ${t("case.due")} ${c.obligation.dueDate} (SGT)` : t("case.uploadFirst")}
              </div>
            </div>
            {st?.completed ? <StateChip value="DONE" label={t("case.complete")} /> : <StateChip value={st?.plan ?? "NONE"} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 8 }}>
            {tracks.map((x) => (
              <div key={x.k} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, borderRadius: 12, background: "var(--surface-2)" }}>
                <span className="muted" style={{ fontSize: 11 }}>{x.label}</span>
                <StateChip value={st?.[x.k] ?? "—"} />
              </div>
            ))}
          </div>
          <div className="faint mono" style={{ fontSize: 10 }}>{t("case.separate")}</div>
        </section>

        <nav aria-label={t("step.progress")} className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="between" style={{ fontSize: 12 }}>
            <span className="muted">{current <= 5 ? t("step.of", { n: String(current), total: "5" }) : t("case.complete")}</span>
            <span style={{ fontWeight: 600 }}>{current <= 5 ? stepTitles[current - 1] : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {order.map((n) => (
              <button
                key={n}
                aria-label={stepTitles[n - 1]}
                onClick={() => {
                  setOpenMap((m) => ({ ...m, [n]: true }));
                  setTimeout(() => document.getElementById(["invoice", "funding", "routes", "approval", "tracking"][n - 1])?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                style={{ height: 6, borderRadius: 999, border: 0, padding: 0, cursor: "pointer", background: doneMap[n] ? "var(--lime)" : n === current ? "var(--text)" : "var(--surface-2)" }}
              />
            ))}
          </div>
        </nav>

        {v.notifications?.length > 0 && (
          <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 8, borderColor: "rgba(142,201,255,.35)" }}>
            <div className="eyebrow">{t("case.next")}</div>
            {v.notifications.map((n: Any, i: number) => (
              <div key={i} className="row" style={{ alignItems: "flex-start", fontSize: 13, gap: 10 }}>
                <Icon name={n.level === "warn" ? "shieldAlert" : "arrowRight"} size={16} color={n.level === "warn" ? "var(--warn)" : "var(--sky)"} />
                <div>
                  <div>{n.action}</div>
                  <div className="mono faint" style={{ fontSize: 11 }}>
                    {t("case.owner")}: {n.owner}
                    {n.due ? ` · ${t("case.by")} ${sgt(n.due)}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {role !== "payer" && (
          <Section n={1} title={t("case.s2")} state={ver?.verificationStatus ?? (doc ? "UNVERIFIED" : "NONE")} id="invoice" {...stepProps(1)} summary={summaries[1]}>
            {!doc && <div className="muted" style={{ fontSize: 13 }}>{t("case.uploadHint")}</div>}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={!!busy || role !== "student"} onClick={() => run("sample", () => api(`/api/cases/${c.id}/documents`, "POST", { sample: "valid" }), t("case.uploaded"))}>
                <Icon name="tuition" color="var(--lime-ink)" /> {t("case.fromPortal")}
              </button>
              <button className="btn" disabled={!!busy || role !== "student"} onClick={() => fileRef.current?.click()}>
                <Icon name="arrowUp" /> {t("case.upload")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  await run("upload", () => api(`/api/cases/${c.id}/documents`, "POST", fd), t("case.uploaded"));
                  e.target.value = "";
                }}
              />
            </div>

            {doc && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", background: "#fff", minHeight: 220 }}>
                    {doc.mime === "application/pdf" ? (
                      <object data={`/api/cases/${c.id}/documents/${doc.id}#toolbar=0&view=FitH`} type="application/pdf" aria-label={doc.fileName} style={{ width: "100%", height: 300, display: "block" }}>
                        <div style={{ padding: 14, color: "#111", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {doc.text || doc.fileName}
                          {"\n\n"}
                          <a href={`/api/cases/${c.id}/documents/${doc.id}`} target="_blank" rel="noreferrer" style={{ color: "#2357c6" }}>{t("case.openOriginal")}</a>
                        </div>
                      </object>
                    ) : (
                      <img alt={doc.fileName} src={`/api/cases/${c.id}/documents/${doc.id}`} style={{ width: "100%", display: "block" }} />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      {doc.fileName} · {(doc.size / 1024).toFixed(1)} KB · {sgt(doc.uploadedAt)}
                    </div>
                    {FIELD_KEYS.map((k) => {
                      const f = doc.fields[k];
                      return (
                        <label key={k} style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 8, alignItems: "center", fontSize: 12 }}>
                          <span className="muted">{t("field." + k)}</span>
                          <span className="row" style={{ gap: 6 }}>
                            <input
                              value={edits[k] ?? f.value}
                              onChange={(e) => setEdits({ ...edits, [k]: e.target.value })}
                              disabled={role !== "student"}
                              style={{ flex: 1, minWidth: 0, minHeight: 34, padding: "0 10px", borderRadius: 10, border: `1px solid ${f.needsReview ? "var(--warn)" : "var(--line)"}`, background: "var(--surface-2)", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12 }}
                            />
                            {f.needsReview ? <Icon name="shieldAlert" size={14} color="var(--warn)" /> : <Icon name="check" size={14} color="var(--lime)" />}
                          </span>
                        </label>
                      );
                    })}
                    <div className="faint" style={{ fontSize: 11 }}>{t("case.fieldsNote")}</div>
                  </div>
                </div>

                {doc.suspicious?.length > 0 && (
                  <div className="card warn pad" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="row" style={{ color: "var(--warn)", fontWeight: 600, fontSize: 14 }}><Icon name="shieldAlert" color="var(--warn)" /> {t("case.suspicious")}</div>
                    {doc.suspicious.map((s: string, i: number) => <div key={i} style={{ fontSize: 13 }}>• {s}</div>)}
                  </div>
                )}

                <div className="card pad" style={{ background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="between">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t("case.demoSource")}</div>
                    {ver && <StateChip value={ver.verificationStatus} />}
                  </div>
                  <label className="row" style={{ fontSize: 13, gap: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={consent || (c.consents?.length ?? 0) > 0} disabled={(c.consents?.length ?? 0) > 0 || role !== "student"} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>{t("case.consent")}</span>
                  </label>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn primary"
                      disabled={!!busy || (role !== "student" && role !== "operator") || (!consent && !(c.consents?.length > 0))}
                      onClick={async () => {
                        if (!(c.consents?.length > 0)) await api(`/api/cases/${c.id}/verification-consents`, "POST");
                        await run("verify", () => api(`/api/cases/${c.id}/verifications`, "POST"));
                      }}
                    >
                      <Icon name="shield" color="var(--lime-ink)" /> {busy === "verify" ? t("case.verifying") : t("case.verify")}
                    </button>
                    <button className="btn" disabled={!!busy || role !== "student" || ver?.verificationStatus !== "VALID"} onClick={() => run("fields", () => api(`/api/cases/${c.id}/fields`, "POST", edits), t("case.fieldsOk"))}>
                      <Icon name="check" /> {t("case.confirmData")}
                    </button>
                    {doc.fieldsConfirmed && <StateChip value="VALID" label={t("case.dataConfirmed")} />}
                  </div>
                  {ver && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {ver.checks.map((x: Any, i: number) => (
                        <div key={i} className="row" style={{ fontSize: 12, gap: 8 }}>
                          <Icon name={x.ok ? "check" : "x"} size={14} color={x.ok ? "var(--lime)" : "var(--warn)"} stroke={2.4} /> {x.label}
                        </div>
                      ))}
                      <div className="mono faint" style={{ fontSize: 10 }}>{t("case.source")}: {ver.issuerId ?? "?"} · {sgt(ver.verifiedAt)}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Section>
        )}

        <Section n={2} title={t("case.s3")} state={c.schemes?.some((s: Any) => s.feasible) ? "READY" : c.obligation ? "NEEDS_INFORMATION" : undefined} id="funding" {...stepProps(2)} summary={summaries[2]}>
          {role !== "payer" && (
            <div>
              <KV k={t("case.balance")} v={sgd(c.snapshot.balance)} mono />
              <KV k={t("case.pending")} v={`${sgd(c.snapshot.pendingIncoming)} · ${t("case.notCounted")}`} mono />
              <KV k={t("case.holds")} v={sgd(c.snapshot.holds)} mono warn={c.snapshot.holds > 0} />
              <label className="between" style={{ fontSize: 13, padding: "6px 0", gap: 12 }}>
                <span className="muted">{t("case.reserve")}</span>
                <span className="row" style={{ gap: 6 }}>
                  <span className="mono faint">SGD</span>
                  <input
                    inputMode="decimal"
                    value={reserveInput}
                    disabled={role !== "student"}
                    onChange={(e) => setReserveInput(e.target.value)}
                    onBlur={() => {
                      const cents = Math.round(Number(reserveInput) * 100);
                      if (!Number.isNaN(cents) && cents !== c.constraints.reserve) run("reserve", () => api(`/api/cases/${c.id}/funding-constraints`, "PUT", { reserve: cents }), t("case.recalc"));
                    }}
                    style={{ width: 110, minHeight: 34, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", fontFamily: "var(--mono)", textAlign: "right" }}
                  />
                </span>
              </label>
            </div>
          )}
          <label className="between" style={{ fontSize: 13, padding: "6px 0", gap: 12 }}>
            <span className="muted">{t("case.familyLimit")}</span>
            <span className="row" style={{ gap: 6 }}>
              <span className="mono faint">IDR</span>
              <input
                inputMode="numeric"
                value={limitInput}
                disabled={role !== "payer"}
                onChange={(e) => setLimitInput(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => {
                  const n = Number(limitInput);
                  if (n && n !== c.constraints.familyLimitIdr) run("limit", () => api(`/api/cases/${c.id}/funding-constraints`, "PUT", { familyLimitIdr: n }), t("case.recalc"));
                }}
                style={{ width: 130, minHeight: 34, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", fontFamily: "var(--mono)", textAlign: "right" }}
              />
            </span>
          </label>
          {(plan?.funding || c.funding) && (
            <div className="card pad" style={{ background: "var(--surface-2)" }}>
              {role !== "payer" && plan?.funding && <KV k={t("case.available")} v={sgd(plan.funding.available)} mono />}
              <KV k={t("case.contribution")} v={sgd((plan?.funding ?? c.funding).contribution)} mono />
              <KV k={t("case.topup")} v={sgd((plan?.funding ?? c.funding).topup)} mono />
              {role !== "payer" && <div className="mono faint" style={{ fontSize: 10, marginTop: 4 }}>{t("case.formula")}</div>}
            </div>
          )}
          {role !== "payer" && (c.schemes ?? []).map((s: Any) => (
            <div key={s.scheme} className="row" style={{ fontSize: 12, gap: 8, alignItems: "flex-start" }}>
              <Icon name={s.feasible ? "check" : "x"} size={14} color={s.feasible ? "var(--lime)" : "var(--warn)"} stroke={2.4} />
              <div>
                <b>{t("case.scheme" + s.scheme)}</b> {s.reason && <span className="mono" style={{ color: "var(--warn)" }}>{s.reason}</span>}
                <div className="muted">{s.detail}</div>
              </div>
            </div>
          ))}
          {role !== "payer" && (
            <button className="btn" disabled={!!busy || !c.obligation} onClick={() => run("calc", () => api(`/api/cases/${c.id}/calculate`, "POST"))}>
              <Icon name="convert" /> {t("case.calculate")}
            </button>
          )}
          <div className="mono faint" style={{ fontSize: 10 }}>{t("case.dataSource")}: {c.snapshot?.source ?? "—"} · {sgt(c.snapshot?.takenAt)}</div>
        </Section>

        <Section n={3} title={t("case.s4")} state={plan ? plan.status : quoteFeasible ? "READY" : c.quotes?.length ? "BLOCKED" : undefined} id="routes" {...stepProps(3)} summary={summaries[3]}>
          {(c.quotes ?? []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>{t("case.noQuotes")}</div>}
          {(c.quotes ?? []).map((q: Any) => (
            <div key={q.id} className="card" style={{ padding: 12, background: q.feasible ? "rgba(200,241,105,.06)" : "var(--surface-2)", borderColor: q.feasible ? "rgba(200,241,105,.35)" : "var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="between">
                <span style={{ fontWeight: 600, fontSize: 14 }}>{q.routeId} · {q.name}</span>
                {q.feasible ? <StateChip value="VALID" label={t("case.allowed")} /> : <StateChip value="BLOCKED" label={q.reason} />}
              </div>
              <div className="mono" style={{ fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <span className="muted">{t("case.familyDebit")}</span><span style={{ textAlign: "right" }}>{idr(q.debitIdr)}</span>
                <span className="muted">{t("case.netArrives")}</span><span style={{ textAlign: "right" }}>{sgd(q.netSgd)}</span>
                <span className="muted">{t("case.posts")}</span><span style={{ textAlign: "right" }}>{q.postingDate} (SGT)</span>
                <span className="muted">{t("case.buffer")}</span><span style={{ textAlign: "right" }}>{q.bufferDays} {t("case.bd")}</span>
              </div>
              {!q.feasible && <div style={{ fontSize: 12, color: "var(--warn-text)" }}>{q.detail}</div>}
            </div>
          ))}
          {quoteFeasible && <div className="mono faint" style={{ fontSize: 11 }}>{t("case.quoteExpires")}: {Math.floor(quoteLeft / 60000)}:{String(Math.floor((quoteLeft % 60000) / 1000)).padStart(2, "0")}</div>}
          {role === "student" && (
            <button className="btn primary" disabled={!!busy || !c.obligation} onClick={() => run("plan", () => api(`/api/cases/${c.id}/plans`, "POST"), t("case.planReady"))}>
              <Icon name="check" color="var(--lime-ink)" /> {t("case.checkPlan")}
            </button>
          )}
        </Section>

        <Section n={4} title={t("case.s5")} state={plan?.status} id="approval" {...stepProps(4)} summary={summaries[4]}>
          {!plan && <div className="muted" style={{ fontSize: 13 }}>{t("case.noPlan")}</div>}
          {plan && (
            <>
              <div className="mono faint" style={{ fontSize: 11 }}>v{plan.version} · hash {String(plan.hash).slice(0, 16)}… {plan.blockedDetail ? `· ${plan.blockedReason}: ${plan.blockedDetail}` : ""}</div>
              {plan.steps.map((s: Any) => {
                const ok = c.approvals?.some((a: Any) => a.valid && a.role === s.owner && a.steps.includes(s.n) && (a.planId ? a.planId === plan.id : true));
                return (
                  <div key={s.n} className="card" style={{ padding: 12, background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="between">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{t("case.step")} {s.n} · {s.kind === "topup" ? t("case.stepTopup") : t("case.stepTuition")}</span>
                      <StateChip value={ok ? "APPROVED" : "PENDING"} label={ok ? t("case.approvedBy", { r: t("role." + s.owner) }) : t("case.waitingFor", { r: t("role." + s.owner) })} />
                    </div>
                    <KV k={t("case.from")} v={s.accountRef} mono />
                    <KV k={t("case.debit")} v={s.debit.currency === "IDR" ? idr(s.debit.amount) : sgd(s.debit.amount)} mono />
                    <KV k={t("case.to")} v={s.credit.to} />
                    <KV k={t("case.credit")} v={sgd(s.credit.amount)} mono />
                    {s.reference && <KV k={t("case.reference")} v={s.reference} mono />}
                    {s.routeId && <KV k={t("case.route")} v={`${s.routeId} · ${t("case.fees")} SGD 0.00`} mono />}
                  </div>
                );
              })}
              {role !== "payer" && plan.funding && <KV k={t("case.reserveKept")} v={sgd(plan.funding.reserve)} mono />}
              <div className="faint" style={{ fontSize: 12 }}>{t("case.materialNote")}</div>
              {myStepsPending && ["READY", "APPROVED"].includes(plan.status) && role !== "operator" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn primary big" disabled={!!busy} onClick={() => approve("biometric")}>
                    <Icon name="face" color="var(--lime-ink)" size={22} /> {t("case.approveFace")}
                  </button>
                  <div className="row" style={{ gap: 8 }}>
                    <input aria-label="PIN" type="password" inputMode="numeric" maxLength={4} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} style={{ width: 90, minHeight: 44, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", textAlign: "center", fontFamily: "var(--mono)" }} />
                    <button className="btn" disabled={!!busy || pin.length < 4} onClick={() => approve("pin")}>{t("case.approvePin")}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        <Section n={5} title={t("case.s6")} state={st?.completed ? "POSTED" : st?.transfer !== "NOT_STARTED" ? st?.transfer : undefined} id="tracking" {...stepProps(5)} summary={summaries[5]}>
          {(["funding", "transfer", "posting"] as const).map((k) => (
            <div key={k} className="between" style={{ fontSize: 13 }}>
              <span>{t(k === "funding" ? "case.trFunding" : k === "transfer" ? "case.trTransfer" : "case.trPosting")}</span>
              <StateChip value={st?.[k] ?? "—"} />
            </div>
          ))}
          {(c.attempts ?? []).map((a: Any) => (
            <div key={a.id} className="mono" style={{ fontSize: 11, padding: "6px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
              {t("case.step")} {a.step} · {a.status} · {a.currency === "IDR" ? idr(a.amount) : sgd(a.amount)} · {sgt(a.updatedAt)}
              <div className="faint">key {a.key}</div>
            </div>
          ))}
          {(c.posting?.events ?? []).length > 0 && role !== "payer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {c.posting.events.map((e: Any) => (
                <div key={e.id} className="row mono" style={{ fontSize: 11, gap: 6 }}>
                  <Icon name={e.verified ? "check" : "x"} size={12} color={e.verified ? "var(--lime)" : "var(--warn)"} /> {e.status} {sgd(e.amount)} · {sgt(e.at)} · {t("case.signedByUni")}
                </div>
              ))}
            </div>
          )}
          {st?.transfer === "SETTLED" && st?.posting !== "POSTED" && <div className="card sky pad" style={{ fontSize: 13 }}>{t("case.postingMsg")}</div>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {plan?.status === "APPROVED" && role !== "operator" && !st?.completed && st?.transfer !== "SETTLED" && (
              <button
                className="btn primary"
                disabled={!!busy}
                onClick={() => run("exec", () => api(`/api/plans/${plan.id}/execute`, "POST", { planVersion: plan.version, idempotencyKey: crypto.randomUUID() }), t("case.executed"))}
              >
                <Icon name="send" color="var(--lime-ink)" /> {busy === "exec" ? t("case.executing") : t("case.execute")}
              </button>
            )}
            <button className="btn" disabled={!!busy} onClick={() => run("status", () => api(`/api/cases/${c.id}/status`))}>
              <Icon name="reset" /> {t("case.checkStatus")}
            </button>
          </div>
        </Section>

        {role !== "payer" && (
          <Section n={6} title={t("case.s7")} id="evidence" open={openMap[6] ?? current > 5} onToggle={() => setOpenMap((m) => ({ ...m, 6: !(m[6] ?? current > 5) }))}>
            <details className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{t("case.evidence")}</summary>
              <div className="mono" style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3, marginTop: 8, wordBreak: "break-all" }}>
                {ver && (
                  <>
                    <div>proofId: {ver.proofId}</div>
                    <div>issuerId: {ver.issuerId} · keyId: {ver.keyId}</div>
                    <div>documentHash ({ver.hashAlgorithm}): {ver.documentHash}</div>
                    <div>subjectRef: {ver.subjectRef} · obligationId: {ver.obligationId} · v{ver.invoiceVersion}</div>
                    <div>issuedAt: {sgt(ver.issuedAt)} · expiresAt: {sgt(ver.expiresAt)}</div>
                    <div>statusRef: {ver.statusRef}</div>
                    <div>audience: {ver.audience} · purpose: {ver.purpose} · nonce: {ver.nonce} · consentRef: {ver.consentRef}</div>
                    <div>verificationStatus: {ver.verificationStatus}</div>
                  </>
                )}
                {plan && <div>plan v{plan.version} hash: {plan.hash}</div>}
                {(c.approvals ?? []).slice(0, 6).map((a: Any) => <div key={a.id}>approval {a.role} steps {a.steps.join(",")} {a.valid ? "valid" : "cancelled"} · {a.method} · {sgt(a.at)}</div>)}
                {(c.events ?? []).slice(0, 15).map((e: Any) => <div key={e.id} className="faint">{sgt(e.at)} · {e.actor} · {e.type} · {e.detail}</div>)}
              </div>
            </details>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="between">
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t("case.supportPack")}</div>
                <button
                  className="btn small"
                  onClick={async () => {
                    const r = await api<Any[]>(`/api/cases/${c.id}/support-packs`);
                    if (r.ok && r.data) {
                      setPack(r.data);
                      const sel: Record<string, boolean> = {};
                      for (const f of r.data) sel[f.key] = !f.personal;
                      setPackSel(sel);
                    }
                  }}
                >
                  {t("case.preview")}
                </button>
              </div>
              {pack && (
                <>
                  {pack.map((f: Any) => (
                    <label key={f.key} className="row" style={{ fontSize: 12, gap: 8, alignItems: "flex-start" }}>
                      <input type="checkbox" checked={!!packSel[f.key]} onChange={(e) => setPackSel({ ...packSel, [f.key]: e.target.checked })} style={{ marginTop: 2 }} />
                      <span>
                        {f.label} {f.personal && <span className="chip warn" style={{ fontSize: 10 }}>{t("case.personal")}</span>}
                      </span>
                    </label>
                  ))}
                  <pre className="mono" style={{ fontSize: 10, maxHeight: 180, overflow: "auto", background: "var(--surface-2)", padding: 10, borderRadius: 10, margin: 0 }}>
                    {JSON.stringify(Object.fromEntries(pack.filter((f: Any) => packSel[f.key]).map((f: Any) => [f.key, f.preview])), null, 2)}
                  </pre>
                  <button
                    className="btn primary"
                    onClick={async () => {
                      const r = await api<Any>(`/api/cases/${c.id}/support-packs`, "POST", { fields: Object.keys(packSel).filter((k) => packSel[k]) });
                      if (!r.ok) return toast(r.error ?? "error", "warn");
                      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `corridor-support-pack-${c.id}.json`;
                      a.click();
                      toast(t("case.packDone"));
                    }}
                  >
                    <Icon name="log" color="var(--lime-ink)" /> {t("case.download")}
                  </button>
                </>
              )}
            </div>
          </Section>
        )}
      </main>

      {scan && (
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
      <Nav />
    </div>
  );
}
