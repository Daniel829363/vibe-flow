"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import en from "./locales/en";
import ru from "./locales/ru";
import { HiGlobeAlt } from "react-icons/hi2";
import { FaAngleDown } from "react-icons/fa6";

const dictionaries = {
  en,
  ru,
};

export const AVAILABLE_LOCALES = [
  { code: "en", label: "English", shortLabel: "EN", flag: "🇺🇸" },
  { code: "ru", label: "Русский", shortLabel: "RU", flag: "🇷🇺" },
];

const I18nContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
  locales: AVAILABLE_LOCALES,
});

export const I18nProvider = ({ children, initialLocale = null }) => {
  const existingContext = useContext(I18nContext);
  if (existingContext && existingContext.isInsideProvider && !initialLocale) {
    return children;
  }

  // Always start with the server-safe default to avoid SSR hydration mismatch.
  // Client-side locale detection happens entirely in the useEffect below.
  const [locale, setLocaleState] = useState(
    initialLocale && dictionaries[initialLocale] ? initialLocale : "ru"
  );

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Skip if a fixed initialLocale was explicitly provided by the server
    if (initialLocale && dictionaries[initialLocale]) return;
    try {
      // Priority: localStorage → cookie → browser language → 'ru'
      const saved = localStorage.getItem("vibe_workflow_lang");
      if (saved && dictionaries[saved]) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
        return;
      }
      const cookieMatch = document.cookie.match(/vibe_workflow_lang=([a-z]{2})/);
      if (cookieMatch && dictionaries[cookieMatch[1]]) {
        setLocaleState(cookieMatch[1]);
        document.documentElement.lang = cookieMatch[1];
        return;
      }
      const browserLang = navigator.language?.slice(0, 2)?.toLowerCase();
      const targetLang = browserLang === "en" ? "en" : "ru";
      setLocaleState(targetLang);
      document.documentElement.lang = targetLang;
    } catch (e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined" && locale) {
      document.documentElement.lang = locale;
      document.documentElement.setAttribute("lang", locale);
      try {
        document.cookie = `vibe_workflow_lang=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (e) {}
    }
  }, [locale]);

  const setLocale = useCallback((newLocale) => {
    if (dictionaries[newLocale]) {
      setLocaleState(newLocale);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("vibe_workflow_lang", newLocale);
          if (typeof document !== "undefined") {
            document.documentElement.lang = newLocale;
            document.documentElement.setAttribute("lang", newLocale);
            document.cookie = `vibe_workflow_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
          }
        } catch (e) {}
      }
    }
  }, []);

  const t = useCallback((path, params = {}, fallback = "") => {
    if (!path) return "";
    
    const keys = path.split(".");
    let current = dictionaries[locale];
    
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // Fallback to English, then Russian
        let enCurrent = dictionaries.en;
        for (const enKey of keys) {
          if (enCurrent && typeof enCurrent === "object" && enKey in enCurrent) {
            enCurrent = enCurrent[enKey];
          } else {
            enCurrent = null;
            break;
          }
        }
        if (enCurrent !== null) {
          current = enCurrent;
        } else {
          let ruCurrent = dictionaries.ru;
          for (const ruKey of keys) {
            if (ruCurrent && typeof ruCurrent === "object" && ruKey in ruCurrent) {
              ruCurrent = ruCurrent[ruKey];
            } else {
              ruCurrent = null;
              break;
            }
          }
          current = ruCurrent !== null ? ruCurrent : (fallback || path);
        }
        break;
      }
    }

    if (typeof current !== "string") {
      return fallback || path;
    }

    // Replace template params: {name}, {count}, etc.
    if (params && Object.keys(params).length > 0) {
      return current.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
    }

    return current;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    locales: AVAILABLE_LOCALES,
    isInsideProvider: true,
  }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context || !context.isInsideProvider) {
    // Return fallback translation handler if provider is not mounted
    return {
      locale: "ru",
      setLocale: () => {},
      t: (key, params = {}, fallback = "") => fallback || key,
      locales: AVAILABLE_LOCALES,
    };
  }
  return context;
};

export const LanguageSwitcher = ({ className = "", compact = false }) => {
  const { locale, setLocale, locales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLocale = locales.find((l) => l.code === locale) || locales[0];

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm active:scale-95"
        title="Change Language"
      >
        <HiGlobeAlt className="text-blue-400 text-sm" />
        {/* suppressHydrationWarning: label changes after hydration when client detects locale */}
        <span suppressHydrationWarning>{compact ? currentLocale.shortLabel : currentLocale.label}</span>
        <FaAngleDown className={`text-[10px] text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-32 rounded-xl bg-[#121418] border border-white/10 shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
            {locales.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLocale(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                  locale === item.code
                    ? "bg-blue-600/20 text-blue-400 font-bold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{item.flag}</span>
                  <span>{item.label}</span>
                </div>
                {locale === item.code && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default I18nContext;
