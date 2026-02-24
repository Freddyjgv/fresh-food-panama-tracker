import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UILang = "es" | "en";

type Ctx = {
  lang: UILang;
  setLang: (v: UILang) => void;
  toggle: () => void;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "ff_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILang>("es");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
      if (saved === "en" || saved === "es") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (v: UILang) => {
    setLangState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {}
  };

  const toggle = () => setLang(lang === "es" ? "en" : "es");

  const value = useMemo(() => ({ lang, setLang, toggle }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUILang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useUILang must be used within <LanguageProvider />");
  return ctx;
}