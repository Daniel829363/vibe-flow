"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../lib/auth";
import { useTranslation, LanguageSwitcher } from "workflow-builder";
import { GoWorkflow } from "react-icons/go";
import { LuSparkles } from "react-icons/lu";
import {
  FiFolder,
  FiImage,
  FiVideo,
  FiMusic,
  FiFile,
  FiSearch,
  FiTrash2,
  FiDownload,
  FiCopy,
  FiEye,
  FiRefreshCw,
  FiFilter,
  FiHardDrive,
  FiLayers,
  FiGrid,
  FiChevronLeft,
  FiChevronRight,
  FiUser,
  FiUsers,
  FiX,
  FiShield,
} from "react-icons/fi";
import MediaPreviewModal from "./MediaPreviewModal";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function MediaManagerClient() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  // Media Listing State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    images: 0,
    videos: 0,
    audios: 0,
    uploads: 0,
    generations: 0,
    total_size_bytes: 0,
  });

  const [activeType, setActiveType] = useState("all"); // "all" | "image" | "video" | "audio" | "other"
  const [activeSource, setActiveSource] = useState("all"); // "all" | "upload" | "generation"
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Super Admin Filtering State
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminWorkflows, setAdminWorkflows] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("all");
  const [loadingAdminFilters, setLoadingAdminFilters] = useState(false);

  // Sync & Action State
  const [isSyncing, setIsSyncing] = useState(false);
  const hasAutoSynced = useRef(false);

  // Preview Modal
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState(null);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Fetch Superadmin Filter Options
  useEffect(() => {
    if (user?.is_superadmin) {
      const fetchAdminFilters = async () => {
        setLoadingAdminFilters(true);
        try {
          const res = await axios.get("/api/media/admin/filters");
          setAdminUsers(res.data.users || []);
          setAdminWorkflows(res.data.workflows || []);
        } catch (err) {
          console.error("Failed to load admin filters:", err);
        } finally {
          setLoadingAdminFilters(false);
        }
      };
      fetchAdminFilters();
    }
  }, [user]);

  // Sync media from accessible workflows
  const handleSyncWorkflows = useCallback(async (isAuto = false) => {
    setIsSyncing(true);
    try {
      const res = await axios.post("/api/media/sync");
      if (res.data.synced > 0) {
        toast.success(res.data.message || `Найдено и добавлено ${res.data.synced} медиафайлов!`);
        fetchMedia(activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId, 1);
      } else if (!isAuto) {
        toast.success("Все файлы из процессов уже синхронизированы");
      }
    } catch (err) {
      console.error("Sync error:", err);
      if (!isAuto) {
        toast.error(err.response?.data?.detail || "Ошибка при синхронизации процессов");
      }
    } finally {
      setIsSyncing(false);
    }
  }, [activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Media Items
  const fetchMedia = useCallback(async (type, source, search, uId, wfId, pg) => {
    setLoading(true);
    try {
      const params = {
        file_type: type === "all" ? undefined : type,
        source: source === "all" ? undefined : source,
        search: search && search.trim() ? search.trim() : undefined,
        page: pg,
        limit: 24,
      };

      if (user?.is_superadmin) {
        if (uId && uId !== "all") params.user_id = uId;
        if (wfId && wfId !== "all") params.workflow_id = wfId;
      }

      const res = await axios.get("/api/media", { params });
      const loadedItems = res.data.items || [];
      setItems(loadedItems);
      setTotalItems(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      if (res.data.stats) {
        setStats(res.data.stats);
      }

      // If user has 0 items and hasn't auto-synced yet, try to discover media from workflows
      if (
        (res.data.total === 0 || loadedItems.length === 0) &&
        !hasAutoSynced.current &&
        !search.trim() &&
        (!user?.is_superadmin || (uId === "all" && wfId === "all"))
      ) {
        hasAutoSynced.current = true;
        handleSyncWorkflows(true);
      }
    } catch (err) {
      console.error("Failed to load media:", err);
      toast.error(err.response?.data?.detail || "Ошибка загрузки медиафайлов");
    } finally {
      setLoading(false);
    }
  }, [user, handleSyncWorkflows]);

  // Fetch on filter changes
  useEffect(() => {
    if (user) {
      fetchMedia(activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId, page);
    }
  }, [user, activeType, activeSource, selectedUserId, selectedWorkflowId, page, fetchMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMedia(activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId, 1);
  };

  // Reset all admin filters
  const handleResetAdminFilters = () => {
    setSelectedUserId("all");
    setSelectedWorkflowId("all");
    setPage(1);
  };

  // Copy URL
  const handleCopyUrl = (url) => {
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Ссылка скопирована в буфер обмена!");
  };

  // Download Media File
  const handleDownloadMedia = async (url, filename) => {
    if (!url) return;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Direct fetch failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback to proxy streaming attachment
      const dlUrl = `/api/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || "download")}`;
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Open Preview
  const handleOpenPreview = (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  // Delete Media
  const handleDeleteMedia = async (id) => {
    if (!confirm("Вы уверены, что хотите удалить этот файл?")) return;

    setDeletingId(id);
    try {
      await axios.delete(`/api/media/${id}`);
      toast.success("Файл удален");
      if (previewFile?.id === id) {
        setIsPreviewOpen(false);
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchMedia(activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId, page);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.response?.data?.detail || "Не удалось удалить файл");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-sm">Загрузка медиа-менеджера...</p>
        </div>
      </div>
    );
  }

  const typeTabs = [
    { id: "all", label: "Все файлы", icon: <FiGrid size={15} />, count: stats.total },
    { id: "image", label: "Изображения", icon: <FiImage size={15} />, count: stats.images },
    { id: "video", label: "Видео", icon: <FiVideo size={15} />, count: stats.videos },
    { id: "audio", label: "Аудио", icon: <FiMusic size={15} />, count: stats.audios },
    { id: "other", label: "Прочее", icon: <FiFile size={15} />, count: Math.max(0, stats.total - stats.images - stats.videos - stats.audios) },
  ];

  const hasAdminFilterActive = selectedUserId !== "all" || selectedWorkflowId !== "all";

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 font-sans selection:bg-purple-500/30 flex flex-col">
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
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <GoWorkflow className="text-white" size={18} />
            </div>
            <span className="text-white font-bold">
              {t("landing.brandName", {}, "Workflow")}<span className="text-blue-500">{t("landing.brandSuffix", {}, "Pro")}</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-semibold">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
              Главная
            </Link>
            <Link href="/workflow" className="text-zinc-400 hover:text-white transition-colors">
              Процессы
            </Link>
            <Link href="/media" className="text-purple-400 font-bold border-b-2 border-purple-500 pb-0.5 flex items-center gap-1.5">
              <span>📁</span> Медиа
            </Link>
            <Link href="/tokens" className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <span>🪙</span> Токены
            </Link>
            {user?.is_superadmin && (
              <Link href="/admin" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <span>🛡️</span> Админка
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
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-amber-400 transition-all"
                  title="Мой баланс токенов"
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
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-12 space-y-8">
        {/* ── Hero & Stats Banner ── */}
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#13141f] via-[#0f1017] to-[#0c0d12] border border-white/10 shadow-2xl">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-3">
                <FiFolder size={14} />
                <span>Хранилище материалов</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Медиа-менеджер
              </h1>
              <p className="text-zinc-400 mt-2 text-sm sm:text-base max-w-xl">
                Централизованное хранилище сгенерированных AI-материалов и исходников из ваших процессов.
              </p>

              {/* Quick Stat Badges */}
              <div className="flex flex-wrap items-center gap-3 mt-5">
                <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-center gap-2">
                  <FiHardDrive className="text-purple-400" size={14} />
                  <span>Объем: <strong>{formatBytes(stats.total_size_bytes)}</strong></span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
                  <LuSparkles size={14} />
                  <span>AI Генерации: <strong>{stats.generations}</strong></span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                  <FiFile size={14} />
                  <span>Всего файлов: <strong>{stats.total}</strong></span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                onClick={() => handleSyncWorkflows(false)}
                disabled={isSyncing}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                title="Сканировать процессы и синхронизировать сгенерированные файлы"
              >
                <LuSparkles size={18} className={`text-white ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Синхронизация..." : "Синхронизировать"}</span>
              </button>

              <button
                onClick={() => fetchMedia(activeType, activeSource, searchQuery, selectedUserId, selectedWorkflowId, page)}
                className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center justify-center"
                title="Обновить список"
              >
                <FiRefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* ── SUPER ADMIN FILTER TOOLBAR ── */}
        {user?.is_superadmin && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#181a28] via-[#131520] to-[#12131b] border border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-sm">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                  <FiShield size={16} />
                </div>
                <span>Панель суперадминистратора: Фильтрация по пользователям и процессам</span>
              </div>

              {hasAdminFilterActive && (
                <button
                  onClick={handleResetAdminFilters}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FiX size={13} />
                  <span>Сбросить фильтры админа</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {/* User Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <FiUsers size={13} className="text-indigo-400" />
                  <span>Пользователь</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition cursor-pointer"
                >
                  <option value="all">👥 Все пользователи системы ({adminUsers.length})</option>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email} — {u.media_count} медиа
                    </option>
                  ))}
                </select>
              </div>

              {/* Workflow / Process Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <FiLayers size={13} className="text-purple-400" />
                  <span>Процесс / Workflow</span>
                </label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => {
                    setSelectedWorkflowId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/60 transition cursor-pointer"
                >
                  <option value="all">⚡ Все процессы ({adminWorkflows.length})</option>
                  {adminWorkflows.map((wf) => (
                    <option key={wf.id} value={wf.remote_workflow_id || wf.id}>
                      {wf.name} ({wf.owner_email}) — {wf.media_count} медиа
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters & Search Bar ── */}
        <div className="space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {typeTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveType(tab.id);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeType === tab.id
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                      : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/5"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    activeType === tab.id ? "bg-white/20 text-white" : "bg-white/5 text-zinc-400"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Source Filter (All / Uploads / Generations) */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              {[
                { id: "all", label: "Все источники" },
                { id: "generation", label: "✨ AI Генерации" },
                { id: "upload", label: "📤 Исходники" },
              ].map((src) => (
                <button
                  key={src.id}
                  onClick={() => {
                    setActiveSource(src.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    activeSource === src.id
                      ? "bg-purple-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию файла или процесса..."
                className="w-full bg-[#101118] border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-semibold text-white transition"
            >
              Искать
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchMedia(activeType, activeSource, "", selectedUserId, selectedWorkflowId, 1);
                }}
                className="px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-400 hover:text-white transition"
              >
                Сбросить
              </button>
            )}
          </form>
        </div>

        {/* ── Media Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse flex flex-col justify-between p-4"
              >
                <div className="w-full h-36 rounded-xl bg-white/[0.04]"></div>
                <div className="space-y-2">
                  <div className="w-3/4 h-4 rounded bg-white/[0.06]"></div>
                  <div className="w-1/2 h-3 rounded bg-white/[0.04]"></div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 rounded-3xl border border-white/5 bg-white/[0.01]">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <FiFolder size={32} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-bold text-white">Файлы не найдены</h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                {searchQuery || hasAdminFilterActive
                  ? "По вашему запросу ничего не найдено. Попробуйте изменить параметры фильтрации."
                  : "В этой категории пока нет файлов. Сгенерируйте их в ваших процессах."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => handleSyncWorkflows(false)}
                disabled={isSyncing}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition flex items-center gap-2"
              >
                <LuSparkles size={14} className={`text-white ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Синхронизация..." : "Синхронизировать из процессов"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((file) => {
              const isAI = file.source === "generation";
              return (
                <div
                  key={file.id}
                  className="group relative flex flex-col bg-[#101117] hover:bg-[#141620] border border-white/10 hover:border-purple-500/40 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-200"
                >
                  {/* Thumbnail / Media Container */}
                  <div
                    onClick={() => handleOpenPreview(file)}
                    className="relative w-full h-40 bg-[#07080a] flex items-center justify-center overflow-hidden cursor-pointer group/thumb"
                  >
                    {file.file_type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                      />
                    )}

                    {file.file_type === "video" && (
                      <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                        <video
                          src={file.url}
                          className="w-full h-full object-cover opacity-80"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                            <FiVideo size={18} />
                          </div>
                        </div>
                      </div>
                    )}

                    {file.file_type === "audio" && (
                      <div className="w-full h-full bg-gradient-to-br from-[#131d1a] to-[#0c1311] flex flex-col items-center justify-center text-emerald-400 gap-2 p-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover/thumb:scale-110 transition-transform">
                          <FiMusic size={22} />
                        </div>
                        <span className="text-[11px] font-medium text-emerald-300">Аудиозапись</span>
                      </div>
                    )}

                    {file.file_type === "other" && (
                      <div className="w-full h-full bg-zinc-900/60 flex flex-col items-center justify-center text-zinc-400 gap-2">
                        <FiFile size={32} />
                        <span className="text-[10px] text-zinc-500">{file.mime_type || "Файл"}</span>
                      </div>
                    )}

                    {/* Source Badge on Top Left */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-sm border ${
                        isAI
                          ? "bg-purple-950/80 text-purple-300 border-purple-500/40"
                          : "bg-blue-950/80 text-blue-300 border-blue-500/40"
                      }`}>
                        {isAI ? "✨ AI" : "📤 Исходник"}
                      </span>
                    </div>

                    {/* Superadmin User Badge on Top Right */}
                    {user?.is_superadmin && (file.user_email || file.user_name) && (
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-500/40 backdrop-blur-md shadow-sm max-w-[110px] truncate block"
                          title={`Пользователь: ${file.user_name || file.user_email}`}
                        >
                          👤 {file.user_name || file.user_email}
                        </span>
                      </div>
                    )}

                    {/* Quick Preview Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                      <span className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                        <FiEye size={13} /> Просмотр
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 space-y-3">
                    <div>
                      <h4
                        className="text-xs sm:text-sm font-bold text-white truncate cursor-pointer hover:text-purple-400 transition"
                        title={file.filename}
                        onClick={() => handleOpenPreview(file)}
                      >
                        {file.filename}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span>{formatDate(file.created_at)}</span>
                      </div>

                      {file.workflow_name && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-400/90 mt-1.5 truncate" title={`Процесс: ${file.workflow_name}`}>
                          <FiLayers size={11} className="shrink-0" />
                          <span className="truncate">{file.workflow_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyUrl(file.url)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                          title="Скопировать ссылку"
                        >
                          <FiCopy size={13} />
                        </button>
                        <button
                          onClick={() => handleDownloadMedia(file.url, file.filename)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                          title="Скачать файл"
                        >
                          <FiDownload size={13} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteMedia(file.id)}
                        disabled={deletingId === file.id}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                        title="Удалить"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <FiChevronLeft size={18} />
            </button>

            <span className="text-xs font-semibold text-zinc-400 px-4">
              Страница {page} из {totalPages} ({totalItems} файлов)
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        )}
      </main>

      {/* ── Preview Modal ── */}
      <MediaPreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onDelete={handleDeleteMedia}
        onCopyUrl={handleCopyUrl}
        onDownload={handleDownloadMedia}
      />
    </div>
  );
}
