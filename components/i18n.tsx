"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { COUNTRY, DICTS, LANG_LIST, type Lang } from "./dict";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  days: (n: number) => string;
  place: (name: string) => string;
  toast: (text: string, kind?: "ok" | "warn") => void;
}

const I18n = createContext<Ctx | null>(null);
const KEY = "corridor.lang";

export function langName(l: Lang) {
  const x = LANG_LIST.find((y) => y.code === l)!;
  return `${x.name} (${x.code})`;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setL] = useState<Lang>("en");
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: "ok" | "warn" }[]>([]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) as Lang | null;
      if (v && DICTS[v]) setL(v);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setL(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang]
  );

  const days = useCallback(
    (n: number) => {
      const d = DICTS[lang];
      if (lang === "ru") {
        const m10 = n % 10, m100 = n % 100;
        const w = m10 === 1 && m100 !== 11 ? d["day.one"] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? d["day.few"] : d["day.many"];
        return `${n} ${w}`;
      }
      if (lang === "zh") return `${n} ${d["day.one"]}`;
      return `${n} ${n === 1 ? d["day.one"] : d["day.many"]}`;
    },
    [lang]
  );

  const place = useCallback((name: string) => COUNTRY[lang][name] ?? name, [lang]);

  const toast = useCallback((text: string, kind: "ok" | "warn" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, text, kind }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2600);
  }, []);

  const value = useMemo(() => ({ lang, setLang, t, days, place, toast }), [lang, setLang, t, days, place, toast]);

  return (
    <I18n.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}>
            {x.text}
          </div>
        ))}
      </div>
    </I18n.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18n);
  if (!c) throw new Error("useI18n outside Providers");
  return c;
}
