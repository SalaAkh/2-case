"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { isLocale, locales, localeNames, translate, type Locale } from "@/lib/i18n";

const KEY = "zero-spoiler.locale.v1";
type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: (text: string, values?: Record<string, string | number>) => string };
const Context = createContext<I18n>({ locale: "ru", setLocale: () => {}, t: text => text });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("ru");
  const path = usePathname();
  useEffect(() => {
    const restore = () => {
      const requested = new URLSearchParams(window.location.search).get("lang");
      let saved: string | null = null;
      try { saved = localStorage.getItem(KEY); } catch { /* Language selection still works in memory. */ }
      updateLocale(isLocale(requested) ? requested : isLocale(saved) ? saved : "ru");
      if (isLocale(requested)) { try { localStorage.setItem(KEY, requested); } catch { /* URL preference remains available. */ } }
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try { localStorage.setItem(KEY, next); } catch { /* Keep using the selected language. */ }
    const url = new URL(window.location.href); url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, path === "/pilot" ? "Пилот и методика · Zero-Spoiler" : path === "/investigation" ? "Режим расследования · Tomorrow School" : "Tomorrow School · Zero-Spoiler Debugger");
  }, [locale, path]);
  const t = useCallback((source: string, values?: Record<string, string | number>) => translate(locale, source, values), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() { return useContext(Context); }
export function LocalizedLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { locale } = useI18n();
  if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) {
    const url = new URL(href, "https://2-case.vercel.app"); url.searchParams.set("lang", locale);
    href = url.pathname + url.search + url.hash;
  }
  return <Link href={href} {...props} />;
}
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <label className="language-switcher"><Globe2 size={16} aria-hidden="true" /><span className="sr-only">{t("Язык интерфейса")}</span><select aria-label={t("Язык интерфейса")} value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>{locales.map(item => <option key={item} value={item} lang={item}>{localeNames[item]}</option>)}</select></label>;
}
export function LearningLoading() {
  const { t } = useI18n();
  return <p className="lab-loading" role="status">{t("Открываем учебный путь…")}</p>;
}
