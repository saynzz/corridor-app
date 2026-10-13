"use client";
import { LANG_LIST } from "./dict";
import { useI18n } from "./i18n";
import { vibrate } from "./hooks";

export function LangPicker() {
  const { lang, setLang, t, toast } = useI18n();
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
      {LANG_LIST.map((l) => (
        <button
          key={l.code}
          className={`btn ${lang === l.code ? "light" : ""}`}
          aria-pressed={lang === l.code}
          onClick={() => {
            if (l.code === lang) return;
            setLang(l.code);
            vibrate(12);
            toast("✓ " + l.label);
          }}
        >
          {l.label}
        </button>
      ))}
      <span className="sr-only">{t("prof.lang")}</span>
    </div>
  );
}
