"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  FiArrowLeft,
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiShield,
  FiRefreshCw,
  FiAlertCircle,
  FiGlobe,
} from "react-icons/fi";

function TermsViewer({ initialLang: propLang }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLang = propLang || searchParams?.get("lang") || "ru";

  const [offers, setOffers] = useState([]);
  const [currentLang, setCurrentLang] = useState(initialLang.toLowerCase());
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Fetch available offers
  const fetchOffers = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get("/api/payment/offers");
      const list = res.data.offers || [];
      setOffers(list);

      // Check if requested language is available, else fallback to first available or 'ru'
      if (list.length > 0) {
        const found = list.find((o) => o.language.toLowerCase() === initialLang.toLowerCase());
        if (found) {
          setCurrentLang(found.language.toLowerCase());
        } else {
          // If requested language not found, default to first or 'ru'
          const ruOffer = list.find((o) => o.language.toLowerCase() === "ru");
          setCurrentLang(ruOffer ? "ru" : list[0].language.toLowerCase());
        }
      }
    } catch (err) {
      console.error("Failed to fetch payment offers:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleLanguageChange = (lang) => {
    setCurrentLang(lang.toLowerCase());
    setIframeLoading(true);
    // Update URL query param without full page reload
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang.toLowerCase());
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tokens");
    }
  };

  const currentOffer = offers.find((o) => o.language.toLowerCase() === currentLang) || offers[0];
  const pdfUrl = `/api/payment/offers/${currentLang}`;
  const downloadUrl = `/api/payment/offers/${currentLang}?download=true`;

  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 font-sans flex flex-col selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-[#121318]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={handleGoBack}
              className="p-2.5 rounded-xl bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-300 hover:text-white transition shadow-sm"
              title="Назад"
            >
              <FiArrowLeft size={18} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <FiFileText size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Условия оплаты и оферта
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FiShield size={11} /> Официальный документ
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {currentOffer?.original_name || `Публичная оферта (${currentLang.toUpperCase()})`}
              </p>
            </div>
          </div>

          {/* Right: Language switch & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Language Selector */}
            {offers.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-[#181922] rounded-xl border border-zinc-800">
                <div className="px-2 text-zinc-500 text-xs flex items-center gap-1">
                  <FiGlobe size={12} />
                </div>
                {offers.map((off) => {
                  const isActive = off.language.toLowerCase() === currentLang;
                  return (
                    <button
                      key={off.id}
                      onClick={() => handleLanguageChange(off.language)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                      }`}
                    >
                      {off.language}
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 hover:text-white text-xs font-medium transition border border-zinc-700/60"
                title="Скачать PDF файл"
              >
                <FiDownload size={14} className="text-emerald-400" />
                <span className="hidden sm:inline">Скачать PDF</span>
              </a>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-600/20"
                title="Открыть PDF в новой вкладке"
              >
                <FiExternalLink size={14} />
                <span className="hidden sm:inline">В новой вкладке</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Document Viewer Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-zinc-400">
            <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium">Загрузка документа оферты...</p>
          </div>
        ) : loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <FiAlertCircle size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Не удалось загрузить документ</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Произошла ошибка при загрузке оферты. Пожалуйста, попробуйте обновить страницу.
            </p>
            <button
              onClick={fetchOffers}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
            >
              <FiRefreshCw size={15} /> Повторить
            </button>
          </div>
        ) : offers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <FiFileText size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Документ оферты пока не опубликован</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Администратор еще не загрузил файл условий оплаты. Пожалуйста, обратитесь в поддержку или вернитесь к управлению токенами.
            </p>
            <button
              onClick={() => router.push("/tokens")}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-500/20"
            >
              Вернуться к балансу
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative rounded-2xl overflow-hidden border border-zinc-800/90 bg-[#14151e] shadow-2xl min-h-[75vh]">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#14151e] text-zinc-400 gap-3">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-xs font-medium">Открытие PDF документа...</p>
              </div>
            )}

            {/* Embedded PDF Viewer */}
            <iframe
              key={currentLang}
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full flex-1 min-h-[75vh] border-0 bg-[#1b1c24]"
              title={`Условия оплаты (${currentLang.toUpperCase()})`}
              onLoad={() => setIframeLoading(false)}
            />

            {/* Bottom info footer */}
            <div className="p-3 bg-[#101117] border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span>Язык документа: <strong className="text-zinc-300 uppercase">{currentLang}</strong></span>
                {currentOffer?.filename && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-zinc-600">{currentOffer.filename}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">Не отображается PDF?</span>
                <a
                  href={downloadUrl}
                  download
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-medium"
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

export default function TermsPage({ initialLang }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm">Загрузка страницы оферты...</p>
          </div>
        </div>
      }
    >
      <TermsViewer initialLang={initialLang} />
    </Suspense>
  );
}
