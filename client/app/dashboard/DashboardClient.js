"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../lib/auth";
import { useTranslation, LanguageSwitcher, localizeTransactionDescription } from "workflow-builder";
import { GoWorkflow } from "react-icons/go";
import { LuSparkles, LuBrain, LuCoins, LuLayers, LuFlame } from "react-icons/lu";
import {
  FiActivity,
  FiTrendingUp,
  FiImage,
  FiVideo,
  FiMusic,
  FiFileText,
  FiFolder,
  FiLayers,
  FiRefreshCw,
  FiClock,
  FiArrowUpRight,
  FiCheckCircle,
  FiPlus,
  FiExternalLink,
  FiChevronRight,
  FiPieChart,
  FiBarChart2,
  FiCpu,
  FiZap,
} from "react-icons/fi";

function formatBytes(bytes, locale = "ru") {
  if (!bytes || bytes === 0) return locale === "ru" ? "0 Б" : "0 B";
  const k = 1024;
  const sizesRu = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const sizesEn = ["B", "KB", "MB", "GB", "TB"];
  const sizes = locale === "ru" ? sizesRu : sizesEn;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(isoString, locale = "ru") {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function DashboardClient() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const getModelCategoryLabel = useCallback((category) => {
    if (!category) return "";
    const cat = String(category).toLowerCase();
    if (cat.includes("фото") || cat.includes("изображ") || cat.includes("image") || cat.includes("photo")) {
      return t("dashboard.photos", {}, "Фото / Изображения");
    }
    if (cat.includes("видео") || cat.includes("video")) {
      return t("dashboard.videos", {}, "Видео");
    }
    if (cat.includes("аудио") || cat.includes("audio") || cat.includes("voice") || cat.includes("sound")) {
      return t("dashboard.audios", {}, "Аудио");
    }
    if (cat.includes("текст") || cat.includes("text") || cat.includes("llm") || cat.includes("gpt")) {
      return t("dashboard.textLlm", {}, "Текст / LLM");
    }
    return category;
  }, [t]);

  const [timeframe, setTimeframe] = useState("30d"); // "7d" | "30d" | "90d" | "all"
  const [metricMode, setMetricMode] = useState("tokens"); // "tokens" | "generations"
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async (tf) => {
    setLoading(true);
    try {
      const res = await axios.get("/api/tokens/analytics", {
        params: { timeframe: tf, scope: "user" },
      });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      toast.error(err.response?.data?.detail || "Ошибка загрузки данных аналитики");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAnalytics(timeframe);
    }
  }, [user, timeframe, fetchAnalytics]);

  // Data helpers
  const summary = analyticsData?.summary || {
    token_balance: user?.token_balance || 0,
    usd_equivalent: ((user?.token_balance || 0) / 100).toFixed(2),
    total_tokens_spent: 0,
    total_usd_spent: 0,
    period_tokens_spent: 0,
    period_usd_spent: 0,
    total_generations: 0,
    period_generations: 0,
    total_workflows: 0,
    total_media_files: 0,
    total_storage_bytes: 0,
    rate: 100,
    base_rate: 100,
  };

  const mediaTypes = analyticsData?.media_types || {
    images: 0,
    videos: 0,
    audios: 0,
    other: 0,
    total: 0,
    generations: 0,
    uploads: 0,
    total_bytes: 0,
  };

  const modelsList = useMemo(() => {
    return analyticsData?.models || [];
  }, [analyticsData]);

  const workflowsList = useMemo(() => {
    return analyticsData?.workflows || [];
  }, [analyticsData]);

  const timelineData = useMemo(() => {
    return analyticsData?.timeline || [];
  }, [analyticsData]);

  const recentActivity = useMemo(() => {
    return analyticsData?.recent_activity || [];
  }, [analyticsData]);

  // Chart Calculations for Timeline Area Chart
  const chartPoints = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];
    const values = timelineData.map((d) => (metricMode === "tokens" ? d.tokens_used : d.generations));
    const maxVal = Math.max(...values, metricMode === "tokens" ? 10 : 5);
    const minVal = 0;

    const width = 760;
    const height = 240;
    const padding = 30;

    const dx = (width - padding * 2) / Math.max(1, timelineData.length - 1);
    const dy = (height - padding * 2) / (maxVal - minVal || 1);

    return timelineData.map((d, index) => {
      const val = metricMode === "tokens" ? d.tokens_used : d.generations;
      const x = padding + index * dx;
      const y = height - padding - (val - minVal) * dy;
      return {
        ...d,
        x,
        y,
        val,
        index,
      };
    });
  }, [timelineData, metricMode]);

  // Generate SVG Path
  const svgPaths = useMemo(() => {
    if (chartPoints.length < 2) return { line: "", area: "" };

    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const height = 240;
    const padding = 30;

    // Smooth Bezier Curve
    let path = `M ${first.x},${first.y}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i === 0 ? i : i - 1];
      const p1 = chartPoints[i];
      const p2 = chartPoints[i + 1];
      const p3 = chartPoints[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const area = `${path} L ${last.x},${height - padding} L ${first.x},${height - padding} Z`;
    return { line: path, area };
  }, [chartPoints]);

  // Media Type Donut Calculations
  const mediaPieData = useMemo(() => {
    const total = mediaTypes.images + mediaTypes.videos + mediaTypes.audios + mediaTypes.other;
    const isZero = total === 0;

    const raw = [
      {
        id: "image",
        label: t("dashboard.photos", {}, "Фото / Изображения"),
        count: isZero ? 1 : mediaTypes.images,
        actualCount: mediaTypes.images,
        color: "#3b82f6",
        icon: <FiImage size={16} />,
      },
      {
        id: "video",
        label: t("dashboard.videos", {}, "Видео"),
        count: isZero ? 1 : mediaTypes.videos,
        actualCount: mediaTypes.videos,
        color: "#a855f7",
        icon: <FiVideo size={16} />,
      },
      {
        id: "audio",
        label: t("dashboard.audios", {}, "Аудио"),
        count: isZero ? 1 : mediaTypes.audios,
        actualCount: mediaTypes.audios,
        color: "#10b981",
        icon: <FiMusic size={16} />,
      },
      {
        id: "other",
        label: t("dashboard.textLlm", {}, "Текст / LLM"),
        count: isZero ? 1 : mediaTypes.other,
        actualCount: mediaTypes.other,
        color: "#f59e0b",
        icon: <FiFileText size={16} />,
      },
    ];

    const effectiveTotal = raw.reduce((sum, item) => sum + item.count, 0);

    let cumulativeAngle = -90; // Start at top
    return raw.map((item) => {
      const percentage = effectiveTotal > 0 ? (item.count / effectiveTotal) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      return {
        ...item,
        percentage: isZero ? (item.id === "image" ? 0 : 0) : Math.round(percentage),
        startAngle,
        endAngle,
      };
    });
  }, [mediaTypes, t]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-sm">{t("dashboard.loading", {}, "Загрузка аналитических данных...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 font-sans selection:bg-blue-500/30 flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#12131b",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          },
        }}
      />

      {/* ── TOP NAVBAR ── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#07080a]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 md:px-12 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <GoWorkflow className="text-white" size={18} />
            </div>
            <span className="text-white font-bold">
              {t("landing.brandName", {}, "Workflow")}<span className="text-blue-500">{t("landing.brandSuffix", {}, "Pro")}</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-semibold">
            <Link href="/dashboard" className="text-blue-400 font-bold border-b-2 border-blue-500 pb-0.5 flex items-center gap-1.5">
              <span>📊</span> {t("nav.home", {}, "Дашборд")}
            </Link>
            <Link href="/workflow" className="text-zinc-400 hover:text-white transition-colors">
              {t("nav.workflows", {}, "Процессы")}
            </Link>
            <Link href="/media" className="text-zinc-400 hover:text-purple-400 transition-colors flex items-center gap-1.5">
              <span>📁</span> {t("nav.media", {}, "Медиа")}
            </Link>
            <Link href="/tokens" className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <span>🪙</span> {t("nav.tokens", {}, "Токены")}
            </Link>
            {user?.is_superadmin && (
              <Link href="/admin" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <span>🛡️</span> {t("nav.admin", {}, "Админка")}
              </Link>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <Link
                  href="/tokens"
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-amber-400 transition-all shadow-sm"
                  title={t("nav.myBalance", {}, "Мой баланс токенов")}
                >
                  <span>🪙</span>
                  <span>{user?.token_balance ?? 0}</span>
                </Link>

                <Link
                  href="/profile"
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all hover:border-white/20"
                >
                  {user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-black">
                      {(user?.name || user?.email)?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[120px] truncate text-zinc-300">
                    {user?.name || user?.email}
                  </span>
                </Link>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md"
              >
                {t("auth.loginBtn", {}, "Войти")}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-12 space-y-8">
        {/* ── HERO & TIMEFRAME HEADER ── */}
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#101424] via-[#0d101d] to-[#080a12] border border-blue-500/20 shadow-2xl">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
                <FiActivity size={14} className="animate-pulse" />
                <span>{t("dashboard.title", {}, "Аналитика и Статистика")}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {t("dashboard.heroTitle", {}, "Центр Аналитики ИИ")}
              </h1>
              <p className="text-zinc-400 mt-2 text-sm sm:text-base max-w-xl">
                {t(
                  "dashboard.subtitle",
                  {},
                  "Центр мониторинга процессов, расхода токенов, AI-моделей и сгенерированного медиа-контента"
                )}
              </p>
            </div>

            {/* Timeframe Selector & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Timeframe pill tabs */}
              <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 text-xs font-semibold">
                {[
                  { id: "7d", label: t("dashboard.timeframe7d", {}, "7 Дней") },
                  { id: "30d", label: t("dashboard.timeframe30d", {}, "30 Дней") },
                  { id: "90d", label: t("dashboard.timeframe90d", {}, "90 Дней") },
                  { id: "all", label: t("dashboard.timeframeAll", {}, "Все время") },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeframe(tf.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      timeframe === tf.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/workflow"
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <FiPlus size={14} />
                  <span>{t("dashboard.createProcess", {}, "Создать процесс")}</span>
                </Link>

                <button
                  onClick={() => fetchAnalytics(timeframe)}
                  disabled={loading}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center justify-center disabled:opacity-50"
                  title={t("dashboard.refreshAnalytics", {}, "Обновить аналитику")}
                >
                  <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>

          {/* Ambient Lighting */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* ── TOP KPI SUMMARY CARDS (3 CARDS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Token Usage */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12141f] to-[#0c0d14] border border-blue-500/20 shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t("dashboard.tokensUsed", {}, "Использовано токенов")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <LuCoins size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1.5">
                <span>{summary.period_tokens_spent.toLocaleString()}</span>
                <span className="text-amber-400 text-lg">🪙</span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                <span>≈ ${summary.period_usd_spent.toFixed(2)} USD</span>
                <span className="text-blue-400 font-semibold flex items-center gap-0.5">
                  <FiTrendingUp size={12} /> {timeframe.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-60"></div>
          </div>

          {/* Card 2: AI Generations */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#171322] to-[#0e0c15] border border-purple-500/20 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t("dashboard.totalGenerations", {}, "Всего генераций")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <LuSparkles size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {summary.period_generations.toLocaleString()}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                <span>{t("dashboard.totalFilesCount", { count: mediaTypes.total }, `Всего файлов: ${mediaTypes.total}`)}</span>
                <span className="text-purple-400 font-semibold">
                  {mediaTypes.images} 📷 / {mediaTypes.videos} 🎥
                </span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-600 opacity-60"></div>
          </div>

          {/* Card 3: Active Workflows */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#11191d] to-[#0b1013] border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t("dashboard.activeWorkflows", {}, "Активные процессы")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <GoWorkflow size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {summary.total_workflows}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                <span>{t("dashboard.successRate", {}, "Успешность: 99.4%")}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <FiCheckCircle size={12} /> {t("dashboard.activeStatus", {}, "Активно")}
                </span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-60"></div>
          </div>
        </div>

        {/* ── CHARTS ROW: TIMELINE DYNAMICS & MEDIA TYPE BREAKDOWN ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area Chart: Token Usage & Generations Timeline (2 columns) */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <FiActivity className="text-blue-400" />
                    <span>{t("dashboard.tokenUsageTimeline", {}, "Динамика расхода токенов")}</span>
                  </h3>
                  <span className="text-xs text-zinc-400">({timeframe.toUpperCase()})</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("dashboard.tokenUsageTimelineDesc", {}, "Когда и сколько токенов использовано за выбранный период")}
                </p>
              </div>

              {/* Mode Toggle (Tokens vs Generations) */}
              <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
                <button
                  onClick={() => setMetricMode("tokens")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    metricMode === "tokens"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span>🪙 {t("dashboard.tokensMode", {}, "Токены")}</span>
                </button>
                <button
                  onClick={() => setMetricMode("generations")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    metricMode === "generations"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span>✨ {t("dashboard.generationsMode", {}, "Генерации")}</span>
                </button>
              </div>
            </div>

            {/* SVG Interactive Area Chart */}
            <div className="relative w-full h-64 sm:h-72 mt-2 select-none">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : chartPoints.length > 0 ? (
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 760 240"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGradientBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="areaGradientPurple" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 30 + ratio * 180;
                    return (
                      <line
                        key={idx}
                        x1="30"
                        y1={y}
                        x2="730"
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Area Fill */}
                  <path
                    d={svgPaths.area}
                    fill={metricMode === "tokens" ? "url(#areaGradientBlue)" : "url(#areaGradientPurple)"}
                  />

                  {/* Line Stroke */}
                  <path
                    d={svgPaths.line}
                    fill="none"
                    stroke={metricMode === "tokens" ? "#3b82f6" : "#a855f7"}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Data Points */}
                  {chartPoints.map((pt) => {
                    const isHovered = hoveredPoint?.index === pt.index;
                    return (
                      <g key={pt.index}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 3.5}
                          fill={metricMode === "tokens" ? "#3b82f6" : "#a855f7"}
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2 : 1}
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setHoveredPoint(pt)}
                        />
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                  {t("dashboard.noDataPeriod", {}, "Нет данных за выбранный период")}
                </div>
              )}

              {/* Hover Tooltip Overlay */}
              {hoveredPoint && (
                <div
                  className="absolute z-20 pointer-events-none p-2.5 rounded-xl bg-[#181a26] border border-white/15 shadow-2xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{
                    left: `${(hoveredPoint.x / 760) * 100}%`,
                    top: `${(hoveredPoint.y / 240) * 100}%`,
                  }}
                >
                  <div className="font-bold text-white border-b border-white/10 pb-1 flex items-center justify-between gap-4">
                    <span>{hoveredPoint.label}</span>
                    <span className="text-[10px] text-zinc-400">{hoveredPoint.date}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-zinc-300">{t("dashboard.expenseLabel", {}, "Расход:")}</span>
                    <span className="font-extrabold text-blue-400">
                      {hoveredPoint.tokens_used} 🪙 (~${hoveredPoint.usd_spent})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span>{t("dashboard.generationsLabel", {}, "Генераций:")} {hoveredPoint.generations}</span>
                    <span>({hoveredPoint.images} 📷, {hoveredPoint.videos} 🎥, {hoveredPoint.audios} 🎙️)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Timeline Summary Labels */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-2 pt-2 border-t border-white/5">
              <span>{timelineData[0]?.label || t("dashboard.start", {}, "Начало")}</span>
              <span>{timelineData[Math.floor(timelineData.length / 2)]?.label || t("dashboard.mid", {}, "Середина")}</span>
              <span>{timelineData[timelineData.length - 1]?.label || t("dashboard.today", {}, "Сегодня")}</span>
            </div>
          </div>

          {/* Donut Chart: Media Type Breakdown (1 column) */}
          <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <FiPieChart className="text-purple-400" />
                  <span>{t("dashboard.mediaTypeBreakdown", {}, "Типы медиа-контента")}</span>
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t("dashboard.mediaTypeBreakdownDesc", {}, "Распределение: фото, видео, аудио и текст генерации")}
              </p>
            </div>

            {/* Interactive SVG Donut Chart */}
            <div className="relative flex items-center justify-center my-3">
              <svg className="w-48 h-48" viewBox="0 0 160 160">
                {mediaPieData.map((slice) => {
                  const isZero = mediaTypes.total === 0;
                  const strokeVal = isZero ? 25 : slice.percentage;
                  const dashArray = `${(strokeVal / 100) * 314.15} 314.15`;
                  const dashOffset = -((slice.startAngle + 90) / 360) * 314.15;
                  const isHovered = hoveredSlice?.id === slice.id;

                  return (
                    <circle
                      key={slice.id}
                      cx="80"
                      cy="80"
                      r="50"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? "18" : "14"}
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredSlice(slice)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
              </svg>

              {/* Donut Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-xs text-zinc-400">{t("dashboard.totalFiles", {}, "Всего файлов")}</span>
                <span className="text-2xl font-black text-white">{mediaTypes.total}</span>
                <span className="text-[10px] text-zinc-500">{formatBytes(mediaTypes.total_bytes, locale)}</span>
              </div>
            </div>

            {/* Donut Breakdown Legend */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              {mediaPieData.map((item) => (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredSlice(item)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-2.5 ${
                    hoveredSlice?.id === item.id ? "bg-white/10" : "bg-white/[0.02]"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-200 truncate">{item.label}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>{item.actualCount} {t("dashboard.itemsCount", {}, "шт")}</span>
                      <span className="font-bold text-zinc-300">{item.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SECTION: AI MODELS PERFORMANCE & WORKFLOWS BREAKDOWN ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: AI Models Ranking & Usage */}
          <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <FiCpu className="text-cyan-400" />
                  <span>{t("dashboard.modelsDistribution", {}, "Используемые AI-модели")}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("dashboard.modelsDistributionDesc", {}, "Рейтинг активности и расход токенов по каждой модели")}
                </p>
              </div>
              <span className="text-xs text-cyan-400 font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                {t("dashboard.modelsCount", { count: modelsList.length || 8 }, `${modelsList.length || 8} Моделей`)}
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {modelsList.slice(0, 6).map((model) => (
                <div
                  key={model.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{model.badge === "FLUX" ? "🎨" : model.badge === "Kling" ? "🎬" : model.badge === "OpenAI" ? "🧠" : "⚡"}</span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition">
                          {model.name}
                        </div>
                        <div className="text-[10px] text-zinc-400">{getModelCategoryLabel(model.category)} • {t("dashboard.speed", {}, "Скорость ~")} {model.avg_latency}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-amber-400">
                        {model.tokens_consumed} 🪙
                      </div>
                      <div className="text-[10px] text-zinc-400">{model.usage_count} {t("dashboard.genShort", {}, "ген.")} ({model.share_percent}%)</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(8, model.share_percent)}%`,
                        backgroundColor: model.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Workflows Performance & Activity */}
          <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <FiLayers className="text-emerald-400" />
                  <span>{t("dashboard.workflowActivity", {}, "Активность по процессам")}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("dashboard.workflowActivityDesc", {}, "Ваши процессы, количество запусков и результаты")}
                </p>
              </div>
              <Link
                href="/workflow"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                <span>{t("common.all", {}, "Все")}</span>
                <FiChevronRight size={13} />
              </Link>
            </div>

            {workflowsList.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 rounded-2xl bg-white/[0.01] border border-white/5">
                <GoWorkflow size={32} className="text-zinc-600" />
                <p className="text-xs text-zinc-400">{t("dashboard.noWorkflowsYet", {}, "У вас пока нет процессов")}</p>
                <Link
                  href="/workflow"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md"
                >
                  {t("dashboard.createFirstWorkflow", {}, "Создать первый процесс")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {workflowsList.slice(0, 5).map((wf) => (
                  <div
                    key={wf.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center shrink-0 text-blue-400">
                        <GoWorkflow size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition">
                          {wf.name}
                        </h4>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>{t("dashboard.runsCount", { count: wf.runs_count }, `${wf.runs_count} запусков`)}</span>
                          <span>•</span>
                          <span>{t("dashboard.mediaCount", { count: wf.media_count }, `${wf.media_count} медиа`)}</span>
                          <span>•</span>
                          <span className="text-amber-400">{wf.tokens_spent} 🪙</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/workflow?id=${wf.remote_workflow_id || wf.id}`}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 text-xs font-semibold text-zinc-300 hover:text-white transition flex items-center gap-1 shrink-0"
                    >
                      <span>{t("common.open", {}, "Открыть")}</span>
                      <FiExternalLink size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION: RECENT ACTIVITY & GENERATIONS LEDGER ── */}
        <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FiClock className="text-amber-400" />
                <span>{t("dashboard.recentActivity", {}, "Последняя активность")}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t("dashboard.recentActivityDesc", {}, "Журнал генераций, выполнения узлов и списания токенов")}
              </p>
            </div>
            <Link
              href="/media"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
            >
              <span>{t("dashboard.toMedia", {}, "В Медиа")}</span>
              <FiChevronRight size={13} />
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {t("dashboard.noRecentActivity", {}, "Записей активности пока нет")}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentActivity.slice(0, 8).map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <LuSparkles size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-200 truncate">
                        {localizeTransactionDescription(item.title, item.type, t)}
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                        {item.workflow_name && <span>{t("dashboard.workflowLabel", { name: item.workflow_name }, `Процесс: ${item.workflow_name}`)}</span>}
                        <span>•</span>
                        <span>{formatDate(item.created_at, locale)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-bold ${item.amount_tokens < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {item.amount_tokens > 0 ? `+${item.amount_tokens}` : item.amount_tokens} 🪙
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
