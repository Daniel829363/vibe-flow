"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  FiArrowLeft,
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiShield,
  FiLock,
  FiRefreshCw,
  FiAlertCircle,
  FiGlobe,
  FiCheckCircle,
} from "react-icons/fi";

const DOC_CONFIGS = {
  user_agreement: {
    id: "user_agreement",
    title: "Пользовательское соглашение",
    shortTitle: "Соглашение",
    icon: FiFileText,
    badgeColor: "from-blue-500 to-indigo-600",
    activeColor: "bg-blue-600",
    description: "Условия использования сервиса и правила работы с платформой",
  },
  privacy_policy: {
    id: "privacy_policy",
    title: "Политика конфиденциальности",
    shortTitle: "Конфиденциальность",
    icon: FiLock,
    badgeColor: "from-purple-500 to-pink-600",
    activeColor: "bg-purple-600",
    description: "Порядок обработки и защиты персональных данных пользователей",
  },
  offer: {
    id: "offer",
    title: "Публичная оферта",
    shortTitle: "Оферта",
    icon: FiShield,
    badgeColor: "from-emerald-500 to-teal-600",
    activeColor: "bg-emerald-600",
    description: "Условия оказания платных услуг и пополнения баланса токенов",
  },
};

function LegalViewer({ initialType: propType }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType = propType || searchParams?.get("type") || searchParams?.get("doc") || "user_agreement";
  const initialLang = searchParams?.get("lang") || "ru";

  const [activeType, setActiveType] = useState(
    DOC_CONFIGS[initialType] ? initialType : "user_agreement"
  );
  const [activeLang, setActiveLang] = useState(initialLang.toLowerCase());
  const [documents, setDocuments] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Fetch all available documents
  const fetchAllDocs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get("/api/legal/documents");
      setDocuments(res.data.documents || []);
      setOffers(res.data.offers || []);
    } catch (err) {
      console.error("Failed to fetch legal documents:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDocs();
  }, []);

  // Update state when URL params change
  useEffect(() => {
    const typeParam = searchParams?.get("type") || searchParams?.get("doc");
    const langParam = searchParams?.get("lang");
    if (typeParam && DOC_CONFIGS[typeParam]) {
      setActiveType(typeParam);
    }
    if (langParam) {
      setActiveLang(langParam.toLowerCase());
    }
  }, [searchParams]);

  // Available docs for currently selected type
  const availableDocsForType = useMemo(() => {
    if (activeType === "offer") {
      return offers;
    }
    return documents.filter((d) => d.doc_type === activeType);
  }, [activeType, documents, offers]);

  // Available languages for current type
  const availableLangs = useMemo(() => {
    return availableDocsForType.map((d) => d.language.toLowerCase());
  }, [availableDocsForType]);

  // Current document matching language
  const currentDoc = useMemo(() => {
    if (availableDocsForType.length === 0) return null;
    const exact = availableDocsForType.find(
      (d) => d.language.toLowerCase() === activeLang
    );
    if (exact) return exact;
    const ruDoc = availableDocsForType.find(
      (d) => d.language.toLowerCase() === "ru"
    );
    if (ruDoc) return ruDoc;
    return availableDocsForType[0];
  }, [availableDocsForType, activeLang]);

  // Update current language if not available
  useEffect(() => {
    if (availableLangs.length > 0 && !availableLangs.includes(activeLang)) {
      if (availableLangs.includes("ru")) {
        setActiveLang("ru");
      } else {
        setActiveLang(availableLangs[0]);
      }
    }
  }, [availableLangs, activeLang]);

  const handleTypeChange = (typeKey) => {
    setActiveType(typeKey);
    setIframeLoading(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("type", typeKey);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleLangChange = (lang) => {
    setActiveLang(lang.toLowerCase());
    setIframeLoading(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang.toLowerCase());
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const currentConfig = DOC_CONFIGS[activeType] || DOC_CONFIGS.user_agreement;
  const CurrentIcon = currentConfig.icon;

  const pdfUrl = `/api/legal/documents/${activeType}/${activeLang}`;
  const downloadUrl = `/api/legal/documents/${activeType}/${activeLang}?download=true`;

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-zinc-100 font-sans flex flex-col selection:bg-blue-500/30">
      {/* ── Top Header Navigation ── */}
      <header className="border-b border-zinc-800/80 bg-[#101117]/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Back + Doc Title */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={handleGoBack}
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition shadow-sm"
              title="Назад"
            >
              <FiArrowLeft size={18} />
            </button>

            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${currentConfig.badgeColor} flex items-center justify-center text-white shadow-lg`}>
              <CurrentIcon size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {currentConfig.title}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FiCheckCircle size={11} /> Официально
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {currentDoc?.original_name || `${currentConfig.title} (${activeLang.toUpperCase()})`}
              </p>
            </div>
          </div>

          {/* Right: Language switch & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Language Selector */}
            {availableLangs.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-[#171822] rounded-xl border border-zinc-800">
                <div className="px-2 text-zinc-500 text-xs flex items-center gap-1">
                  <FiGlobe size={12} />
                </div>
                {availableLangs.map((lang) => {
                  const isActive = lang === activeLang;
                  return (
                    <button
                      key={lang}
                      onClick={() => handleLangChange(lang)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <a
                href={downloadUrl}
                download
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition border border-zinc-700/60"
                title="Скачать PDF"
              >
                <FiDownload size={14} className="text-blue-400" />
                <span className="hidden sm:inline">Скачать PDF</span>
              </a>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-600/25"
                title="Открыть PDF в новой вкладке"
              >
                <FiExternalLink size={14} />
                <span className="hidden sm:inline">В новой вкладке</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── Document Switcher Subheader Tabs ── */}
      <nav aria-label="Юридические документы" className="bg-[#12131b] border-b border-zinc-800/60 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          {Object.entries(DOC_CONFIGS).map(([key, cfg]) => {
            const isActive = activeType === key;
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-800 text-white shadow-md border border-zinc-700/80"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon size={14} className={isActive ? "text-blue-400" : "text-zinc-500"} />
                <span>{cfg.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Main Document Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-zinc-400">
            <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium">Загрузка документов...</p>
          </div>
        ) : loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <FiAlertCircle size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Не удалось загрузить документ</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Произошла ошибка при загрузке. Пожалуйста, попробуйте обновить страницу.
            </p>
            <button
              onClick={fetchAllDocs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
            >
              <FiRefreshCw size={15} /> Повторить
            </button>
          </div>
        ) : availableDocsForType.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <CurrentIcon size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {currentConfig.title} пока не опубликован
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              Администратор еще не загрузил файл этого документа. Пожалуйста, проверьте другие разделы или обратитесь в поддержку.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoBack}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-500/20"
              >
                Вернуться назад
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative rounded-2xl overflow-hidden border border-zinc-800/90 bg-[#13141d] shadow-2xl min-h-[75vh]">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#13141d] text-zinc-400 gap-3">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-xs font-medium">Открытие документа...</p>
              </div>
            )}

            {/* Embedded PDF Viewer */}
            <iframe
              key={`${activeType}-${activeLang}`}
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full flex-1 min-h-[75vh] border-0 bg-[#191a24]"
              title={`${currentConfig.title} (${activeLang.toUpperCase()})`}
              onLoad={() => setIframeLoading(false)}
            />

            {/* Bottom metadata footer */}
            <div className="p-3 bg-[#0f1016] border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span>Язык: <strong className="text-zinc-300 uppercase">{activeLang}</strong></span>
                {currentDoc?.original_name && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-zinc-600 truncate max-w-xs">
                      {currentDoc.original_name}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">Не отображается PDF?</span>
                <a
                  href={downloadUrl}
                  download
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium"
                >
                  Скачать файл
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LegalPage({ initialType }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-sm">Загрузка документа...</p>
          </div>
        </div>
      }
    >
      <LegalViewer initialType={initialType} />
    </Suspense>
  );
}
