"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/i18n";
import { RoleSwitch } from "@/components/RoleSwitch";
import { StateChip, api, sgt } from "@/components/caseui";

type Any = any;

const GROUPS: { title: string; ops: { op: string; label: string; hint: string }[] }[] = [
  {
    title: "con.docs",
    ops: [
      { op: "new_version", label: "con.newVersion", hint: "con.newVersionH" },
      { op: "revoke", label: "con.revoke", hint: "con.revokeH" },
      { op: "tamper", label: "con.tamper", hint: "con.tamperH" },
      { op: "expire_proof", label: "con.expireProof", hint: "con.expireProofH" },
      { op: "status_down", label: "con.statusDown", hint: "con.statusDownH" },
    ],
  },
  {
    title: "con.funds",
    ops: [
      { op: "expire_quote", label: "con.expireQuote", hint: "con.expireQuoteH" },
      { op: "add_hold", label: "con.addHold", hint: "con.addHoldH" },
    ],
  },
  {
    title: "con.provider",
    ops: [
      { op: "lose_response", label: "con.lose", hint: "con.loseH" },
      { op: "delay_topup", label: "con.delay", hint: "con.delayH" },
      { op: "fail_tuition", label: "con.fail", hint: "con.failH" },
    ],
  },
  {
    title: "con.uni",
    ops: [
      { op: "posting_delayed", label: "con.postDelay", hint: "con.postDelayH" },
      { op: "posting_partial", label: "con.postPartial", hint: "con.postPartialH" },
      { op: "posting_auto", label: "con.postAuto", hint: "con.postAutoH" },
      { op: "post_now", label: "con.postNow", hint: "con.postNowH" },
    ],
  },
  {
    title: "con.audit",
    ops: [{ op: "tamper_audit", label: "con.tamperAudit", hint: "con.tamperAuditH" }],
  },
];

const SAMPLES = ["valid", "tampered", "other_student", "unknown_issuer", "injected"];

export default function ConsolePage() {
  const { t, toast } = useI18n();
  const [v, setV] = useState<Any>(null);
  const load = useCallback(async () => {
    const r = await api<Any>("/api/case");
    if (r.ok) setV(r.data);
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const role = v?.role ?? "student";
  const c = v?.case;

  async function op(o: string) {
    const r = await api("/api/console", "POST", { op: o });
    if (!r.ok) toast(`${r.code} · ${r.error}`, "warn");
    else toast("✓ " + t(GROUPS.flatMap((g) => g.ops).find((x) => x.op === o)?.label ?? "con.reset"));
    load();
  }

  return (
    <div className="shell">
      <main className="page">
        <header className="enter" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="between">
            <h1 className="title">{t("con.title")}</h1>
            <Link href="/case" className="btn small">{t("case.title")}</Link>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{t("con.sub")}</div>
          <RoleSwitch role={role} onChange={() => load()} />
        </header>

        {role !== "operator" && <div className="card warn pad" style={{ fontSize: 13 }}>{t("con.needOperator")}</div>}

        {c && (
          <section className="card pad enter" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(v.status ?? {}).filter(([k]) => k !== "completed").map(([k, s]) => (
              <span key={k} className="row" style={{ gap: 6, fontSize: 12 }}>
                <span className="muted">{k}</span> <StateChip value={String(s)} />
              </span>
            ))}
          </section>
        )}

        {GROUPS.map((g, gi) => (
          <section key={g.title} className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: `${gi * 60}ms` }}>
            <div className="eyebrow">{t(g.title)}</div>
            {g.ops.map((o) => (
              <button key={o.op} className="card tap" disabled={role !== "operator" || !c} onClick={() => op(o.op)} style={{ textAlign: "left", padding: "10px 12px", color: "var(--text)", background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t(o.label)}</span>
                <span className="muted" style={{ fontSize: 12 }}>{t(o.hint)}</span>
              </button>
            ))}
          </section>
        ))}

        <section className="card pad enter" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="eyebrow">{t("con.samples")}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t("con.samplesH")}</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {SAMPLES.map((s) => (
              <a key={s} className="btn small" href={`/api/issuer/sample?kind=${s}`}>
                <Icon name="log" size={14} /> {t("sample." + s)}
              </a>
            ))}
          </div>
        </section>

        <button className="btn" disabled={role !== "operator"} onClick={() => op("reset")}>
          <Icon name="reset" /> {t("con.reset")}
        </button>

        {c && (
          <section className="enter" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="eyebrow">{t("con.events")}</div>
            <div className="card" style={{ padding: "4px 12px" }}>
              <div className="list">
                {(c.events ?? []).slice(0, 20).map((e: Any) => (
                  <div key={e.id} style={{ padding: "8px 0", fontSize: 12 }}>
                    <div className="mono faint" style={{ fontSize: 10 }}>{sgt(e.at)} · {e.actor} · {e.type}</div>
                    <div style={{ color: "var(--text-2)" }}>{e.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Nav />
    </div>
  );
}
