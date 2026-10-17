"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { Icon } from "./Icon";

type Hints = { payer?: string; operator?: string };

export function RoleSwitch({ role, onChange }: { role: string; onChange: (r: string) => void }) {
  const { t, toast } = useI18n();
  const [target, setTarget] = useState<string | null>(null);
  const [cred, setCred] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState<Hints>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((j) => setHints(j.hints || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (target) inputRef.current?.focus();
  }, [target]);

  const roles = [
    { r: "student", k: "role.student" },
    { r: "payer", k: "role.payer" },
    { r: "operator", k: "role.operator" },
  ];

  async function switchTo(r: string, credential = "") {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: r, credential }) });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.code === "LOCKED" ? t("login.locked", { s: String(j.retryAfterSec ?? 300) }) : t("login.wrong", { n: String(j.left ?? "") }));
        setCred("");
        return;
      }
      setTarget(null);
      setCred("");
      toast(t("role.switched", { r: t("role." + r) }));
      onChange(r);
    } finally {
      setBusy(false);
    }
  }

  const hint = target === "payer" ? hints.payer : target === "operator" ? hints.operator : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row" role="group" aria-label={t("role.viewAs")} style={{ gap: 6, padding: 4, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", flexWrap: "wrap" }}>
        {roles.map((x) => (
          <button
            key={x.r}
            aria-pressed={role === x.r}
            disabled={busy}
            onClick={() => {
              if (role === x.r) return;
              if (x.r === "student") switchTo("student");
              else {
                setTarget(x.r);
                setErr("");
                setCred("");
              }
            }}
            style={{
              minHeight: 36,
              padding: "0 12px",
              borderRadius: 999,
              border: 0,
              fontSize: 12,
              fontWeight: 600,
              background: role === x.r ? "var(--text)" : target === x.r ? "var(--surface-2)" : "transparent",
              color: role === x.r ? "var(--lime-ink)" : "var(--text-2)",
            }}
          >
            <span className="row" style={{ gap: 4 }}>
              {role !== x.r && x.r !== "student" && <Icon name="lock" size={12} />}
              {t(x.k)}
            </span>
          </button>
        ))}
      </div>
      {target && (
        <form
          className="card pad"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (cred) switchTo(target, cred);
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>{t(target === "operator" ? "login.operatorTitle" : "login.payerTitle")}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t(target === "operator" ? "login.operatorSub" : "login.payerSub")}</div>
          <input
            ref={inputRef}
            type="password"
            inputMode={target === "payer" ? "numeric" : "text"}
            autoComplete="off"
            aria-label={t(target === "operator" ? "login.key" : "login.pin")}
            placeholder={t(target === "operator" ? "login.key" : "login.pin")}
            value={cred}
            onChange={(e) => setCred(e.target.value)}
            style={{ minHeight: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", fontSize: 15 }}
          />
          {err && <div style={{ color: "var(--danger, #ff6b6b)", fontSize: 12 }}>{err}</div>}
          {hint && <div className="mono faint" style={{ fontSize: 11 }}>{t("login.hint", { v: hint })}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" type="submit" disabled={busy || !cred}>
              {t("login.signIn")}
            </button>
            <button className="btn" type="button" onClick={() => setTarget(null)}>
              {t("login.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
