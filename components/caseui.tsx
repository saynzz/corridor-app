"use client";
import { Icon } from "./Icon";

export function sgd(cents: number) {
  return "SGD " + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function idr(n: number) {
  return "IDR " + Math.round(n).toLocaleString("en-US");
}
export function sgt(iso?: string | null) {
  if (!iso) return "—";
  const x = new Date(Date.parse(iso) + 8 * 3600e3).toISOString();
  return `${x.slice(0, 10)} ${x.slice(11, 16)} SGT`;
}

const GOOD = ["VALID", "READY", "APPROVED", "SETTLED", "POSTED", "DONE", "NOT_NEEDED"];
const BAD = ["MISMATCH", "EXPIRED", "REVOKED", "UNKNOWN_ISSUER", "BLOCKED", "FAILED", "CANCELLED", "SUPERSEDED"];
const WAIT = ["UNAVAILABLE", "UNKNOWN", "PROCESSING", "SUBMITTED", "PENDING", "PARTIAL", "NEEDS_INFORMATION", "CREATED", "DRAFT"];

export function StateChip({ value, label }: { value: string; label?: string }) {
  const kind = GOOD.includes(value) ? "good" : BAD.includes(value) ? "bad" : WAIT.includes(value) ? "wait" : "none";
  const color = kind === "good" ? "var(--lime)" : kind === "bad" ? "var(--warn)" : kind === "wait" ? "var(--sky)" : "var(--muted)";
  const icon = kind === "good" ? "check" : kind === "bad" ? "x" : kind === "wait" ? "reset" : "arrowRight";
  return (
    <span className="mono row" style={{ gap: 5, fontSize: 11, padding: "4px 9px", borderRadius: 999, border: `1px solid ${color}`, color, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={12} color={color} stroke={2.4} />
      {label ?? value.replace(/_/g, " ")}
    </span>
  );
}

export function Section({
  n,
  title,
  state,
  children,
  id,
  open = true,
  done,
  current,
  summary,
  onToggle,
  hint,
}: {
  n: number;
  title: string;
  state?: string;
  children: React.ReactNode;
  id?: string;
  open?: boolean;
  done?: boolean;
  current?: boolean;
  summary?: React.ReactNode;
  onToggle?: () => void;
  hint?: string;
}) {
  const dotBg = done ? "var(--lime)" : current ? "var(--text)" : "var(--surface-2)";
  const dotFg = done || current ? "var(--lime-ink)" : "var(--text-2)";
  return (
    <section
      id={id}
      className="card pad enter"
      style={{ display: "flex", flexDirection: "column", gap: open ? 12 : 6, borderColor: current ? "rgba(200,241,105,.45)" : undefined, opacity: !open && !done && !current ? 0.72 : 1 }}
    >
      <button
        type="button"
        className="between"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id ? id + "-body" : undefined}
        style={{ background: "none", border: 0, padding: 0, color: "inherit", cursor: onToggle ? "pointer" : "default", textAlign: "left", width: "100%" }}
      >
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="step-dot" style={{ background: dotBg, color: dotFg, width: 26, height: 26, flexShrink: 0 }}>
            {done ? <Icon name="check" size={14} color="var(--lime-ink)" stroke={2.6} /> : n}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
            {!open && summary && (
              <div className="mono faint" style={{ fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {summary}
              </div>
            )}
            {!open && !summary && hint && <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
          </div>
        </div>
        <span className="row" style={{ gap: 8, flexShrink: 0 }}>
          {state && <StateChip value={state} />}
          {onToggle && (
            <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <Icon name="arrowRight" size={14} />
            </span>
          )}
        </span>
      </button>
      {open && (
        <div id={id ? id + "-body" : undefined} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </section>
  );
}

export function KV({ k, v, mono, warn }: { k: string; v: React.ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <div className="between" style={{ fontSize: 13, padding: "6px 0", gap: 12 }}>
      <span className="muted">{k}</span>
      <span className={mono ? "mono" : ""} style={{ textAlign: "right", color: warn ? "var(--warn)" : "var(--text)", wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; data?: T; error?: string; code?: string }> {
  const r = await fetch(path, {
    method,
    headers: body instanceof FormData ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  return r.json();
}
