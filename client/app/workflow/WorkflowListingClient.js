"use client";

import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState, useMemo } from "react";
import { FaRegEdit } from "react-icons/fa";
import { FaPlus, FaCopy } from "react-icons/fa6";
import { FiTrash2, FiSearch } from "react-icons/fi";
import { GoWorkflow } from "react-icons/go";
import { SlOptions } from "react-icons/sl";
import { HiOutlineGlobeAlt, HiOutlineLockClosed, HiOutlineUserGroup, HiOutlineCog6Tooth, HiOutlinePhoto } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useTranslation, LanguageSwitcher } from "workflow-builder";
import { useAuth } from "../lib/auth";
import ShareModal from "./ShareModal";
import SettingsModal from "./SettingsModal";
import CoverImageModal from "./CoverImageModal";

const TAB_MY = "my";
const TAB_PUBLIC = "public";

const ACCESS_BADGE = {
  owner: { label: "Мой", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  full_access: { label: "Полный доступ", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  view_only: { label: "Просмотр", color: "text-zinc-400", bg: "bg-white/5 border-white/10" },
};

const WorkflowListingClient = ({ initialWorkflowList }) => {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [tab, setTab] = useState(TAB_MY);
  const [myWorkflows, setMyWorkflows] = useState([]);
  const [publicWorkflows, setPublicWorkflows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [dropDown, setDropDown] = useState(0);
  const [workflowName, setWorkflowName] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [shareWorkflow, setShareWorkflow] = useState(null);
  const [settingsWorkflow, setSettingsWorkflow] = useState(null);
  const [coverWorkflow, setCoverWorkflow] = useState(null);
  const [openingWorkflowId, setOpeningWorkflowId] = useState(null);

  // ── Auth Guard & Initial load ──────────────────────────────────────────
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace("/auth/login?redirect=/workflow");
      } else {
        const fromBuilder = sessionStorage.getItem("fromWorkflowBuilder");
        if (fromBuilder) {
          sessionStorage.removeItem("fromWorkflowBuilder");
        }
        fetchMyWorkflows();
      }
    }
  }, [isAuthenticated, authLoading, router]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchMyWorkflows = () => {
    setLoading(true);
    axios.get("/api/workflows/my")
      .then((res) => setMyWorkflows(res.data || []))
      .catch(() => setMyWorkflows([]))
      .finally(() => setLoading(false));
  };

  const fetchPublicWorkflows = () => {
    setLoading(true);
    axios.get("/api/workflows/public")
      .then((res) => setPublicWorkflows(res.data || []))
      .catch(() => toast.error("Не удалось загрузить публичные процессы"))
      .finally(() => setLoading(false));
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setDropDown(0);
    if (newTab === TAB_PUBLIC && publicWorkflows.length === 0) {
      fetchPublicWorkflows();
    }
  };

  // ── Workflow CRUD ─────────────────────────────────────────────────────────
  const handleCreateWorkFlow = () => {
    const workflowPayload = {
      name: t("listing.untitledFlow", {}, "Untitled Workflow"),
      edges: [],
      data: { nodes: [] },
    };
    setLoading(true);
    setOpeningWorkflowId("new");
    axios.post("/api/workflow/create", workflowPayload)
      .then(async (response) => {
        const remoteId = response.data.workflow_id;
        // Register in local DB
        try {
          await axios.post(`/api/workflows/${remoteId}/register`, null, {
            params: { name: t("listing.untitledFlow", {}, "Untitled Workflow") },
          });
        } catch { /* non-critical */ }
        window.location.href = `/workflow/${remoteId}`;
      })
      .catch((error) => {
        setLoading(false);
        setOpeningWorkflowId(null);
        toast.error(error.response?.data?.detail || error.response?.data?.error || t("toasts.serverError", {}, "Server error"));
      });
  };

  const handleDeleteWorkflow = (wf) => {
    const confirmDelete = window.confirm(
      t("listing.confirmDelete", {}, "Are you sure you want to delete this workflow?")
    );
    if (!confirmDelete) return;

    const remoteId = wf.remote_workflow_id || wf.id;
    axios.delete(`/api/workflow/delete-workflow-def/${remoteId}`)
      .then(() => {
        setMyWorkflows((prev) => prev.filter((w) => (w.remote_workflow_id || w.id) !== remoteId));
        setDropDown(0);
        toast.success(t("toasts.workflowDeleted", {}, "Workflow deleted successfully"));
      })
      .catch((error) => {
        if (error.response?.status === 400 || error.response?.status === 404) {
          setMyWorkflows((prev) => prev.filter((w) => (w.remote_workflow_id || w.id) !== remoteId));
          setDropDown(0);
          toast.success(t("toasts.workflowDeleted", {}, "Workflow deleted successfully"));
        } else {
          toast.error(error.response?.data?.detail || error.response?.data?.error || t("toasts.workflowDeleteFailed", {}, "Failed to delete"));
        }
      });
  };

  const handleRenameWorkflow = (wf, newName) => {
    if (!newName.trim()) return;
    const remoteId = wf.remote_workflow_id || wf.id;
    setLoading(true);
    axios.post(`/api/workflow/update-name/${remoteId}`, { name: newName })
      .then(() => {
        setRenameId(null);
        setMyWorkflows((prev) =>
          prev.map((w) =>
            (w.remote_workflow_id || w.id) === remoteId
              ? { ...w, name: newName, updated_at: new Date().toISOString() }
              : w
          )
        );
        toast.success(t("toasts.workflowRenamed", {}, "Workflow renamed"));
      })
      .catch((error) => {
        setRenameId(null);
        toast.error(error.response?.data?.detail || "Ошибка переименования");
      })
      .finally(() => setLoading(false));
  };

  const handleCopyPublic = async (wf) => {
    const remoteId = wf.remote_workflow_id || wf.id;
    try {
      await axios.post(`/api/workflows/${remoteId}/copy`);
      toast.success("Копия создана в ваших процессах!");
      setTab(TAB_MY);
      fetchMyWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка копирования");
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "2-digit",
    });
  };

  const filteredWorkflows = useMemo(() => {
    const list = tab === TAB_MY ? myWorkflows : publicWorkflows;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((w) => (w.name || "").toLowerCase().includes(q));
  }, [tab, myWorkflows, publicWorkflows, searchQuery]);

  // ── Card component ────────────────────────────────────────────────────────
  const WorkflowCard = ({ work, isPublic = false }) => {
    const remoteId = work.remote_workflow_id || work.id;
    const isOwner = work.access_level === "owner";
    const badge = ACCESS_BADGE[work.access_level];

    return (
      <div className="group relative aspect-[3/4] rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.05] hover:-translate-y-1 shadow-2xl">
        {/* Thumbnail link - clickable for all workflows */}
        <Link
          href={`/workflow/${remoteId}`}
          onClick={() => setOpeningWorkflowId(remoteId)}
          className="absolute inset-0 z-0"
        >
          {work.thumbnail ? (
            <>
              <div
                className="absolute inset-0 bg-center bg-cover opacity-60 group-hover:opacity-100 transition-opacity transform group-hover:scale-105 duration-500"
                style={{ backgroundImage: `url(${work.thumbnail})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors flex items-center justify-center">
              <GoWorkflow size={48} className="text-zinc-800 group-hover:text-zinc-700 transition-colors" />
            </div>
          )}
        </Link>

        {/* Loading overlay when this card is being opened */}
        {openingWorkflowId === remoteId && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm gap-2.5 transition-all animate-in fade-in duration-200">
            <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
            <span className="text-[11px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
              Загрузка...
            </span>
          </div>
        )}

        {/* Top-right actions */}
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          {/* Access badge */}
          {badge && (
            <span className={`px-2 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${badge.bg} ${badge.color}`}>
              {badge.label}
            </span>
          )}

          {/* Public: copy button */}
          {isPublic && isAuthenticated && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyPublic(work);
              }}
              className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-110 shadow-lg cursor-pointer"
              title="Создать копию"
            >
              <FaCopy size={13} />
            </button>
          )}

          {/* My: options menu */}
          {!isPublic && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const key = remoteId + "_my";
                  setDropDown(dropDown === key ? 0 : key);
                }}
                className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-110 shadow-lg cursor-pointer"
              >
                <SlOptions size={14} />
              </button>
              {dropDown === remoteId + "_my" && (
                <div
                  className="absolute right-0 mt-2 w-44 py-1 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
                  onMouseLeave={() => setDropDown(0)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOwner && (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setRenameId(remoteId);
                          setWorkflowName(work.name || "");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <FaRegEdit size={13} /> Переименовать
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setCoverWorkflow(work);
                          setDropDown(0);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <HiOutlinePhoto size={13} /> {t("listing.coverImage", {}, "Обложка")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSettingsWorkflow(work);
                          setDropDown(0);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <HiOutlineCog6Tooth size={13} /> Настройки
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShareWorkflow(work);
                          setDropDown(0);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <HiOutlineUserGroup size={13} /> Поделиться
                      </button>
                      <hr className="border-white/5 my-1" />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteWorkflow(work);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <FiTrash2 size={13} /> Удалить
                      </button>
                    </>
                  )}
                  {!isOwner && (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleCopyPublic(work);
                          setDropDown(0);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer font-medium"
                      >
                        <FaCopy size={13} /> Создать копию
                      </button>
                      <div className="px-4 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-t border-white/5">
                        {work.access_level === "full_access" ? "Полный доступ" : "Только просмотр"}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visibility badge for own workflows */}
        {!isPublic && isOwner && (
          <div className="absolute top-3 left-3 z-20">
            {work.visibility === "public" ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-bold uppercase tracking-widest">
                <HiOutlineGlobeAlt size={10} /> Публичный
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-500 text-[9px] font-bold uppercase tracking-widest">
                <HiOutlineLockClosed size={10} /> Приватный
              </span>
            )}
          </div>
        )}

        {/* Public author badge */}
        {isPublic && work.owner_name && (
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
              {work.owner_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={work.owner_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-[8px] font-black">
                  {work.owner_name[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-zinc-300 text-[10px] font-semibold truncate max-w-[80px]">{work.owner_name}</span>
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 w-full p-4 pt-10 bg-gradient-to-t from-[#030303] to-transparent flex flex-col gap-1 pointer-events-none">
          <h4 className="text-sm font-black truncate uppercase tracking-tight text-zinc-300 group-hover:text-white transition-colors">
            {work.name || t("listing.untitledFlow", {}, "Untitled Flow")}
          </h4>
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            {formatDateTime(work.updated_at)}
          </span>
        </div>
      </div>
    );
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#030303] text-white">
        <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
        <span className="mt-4 text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">
          Проверка доступа...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#030303] text-white flex flex-col relative selection:bg-blue-500/30">
      {/* Top Global Progress Bar on workflow click / navigation */}
      {openingWorkflowId && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[9999] bg-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 animate-progress-bar shadow-[0_0_12px_rgba(59,130,246,0.9)] progress-glow" />
        </div>
      )}

      {/* Background ambient lighting effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* ── TOP NAVBAR / LAYOUT ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#030303]/80 backdrop-blur-xl">
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
            <Link href="/workflow" className="text-blue-400 font-bold border-b-2 border-blue-500 pb-0.5">
              Процессы
            </Link>
            <Link href="/media" className="text-zinc-400 hover:text-purple-400 transition-colors flex items-center gap-1.5">
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

          {/* Right Controls: Language & Profile */}
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

      {/* ── MAIN CONTENT (WORKFLOW INFO & PROCESSES) ──────────────────────── */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-10 md:px-12">
        {/* Banner Area with Title and New Workflow Button */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 mb-8 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
              <GoWorkflow size={14} />
              <span>{tab === TAB_MY ? t("listing.myWorkflows", {}, "Мои процессы") : "Публичные процессы"}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
              {tab === TAB_MY ? t("listing.title", {}, "Рабочие процессы") : "Галерея процессов"}
            </h1>
            <p className="text-zinc-400 mt-2 text-sm md:text-base font-medium max-w-xl">
              {tab === TAB_MY
                ? t("listing.subtitle", {}, "Создавайте, редактируйте и запускайте свои визуальные AI пайплайны.")
                : "Исследуйте и копируйте публичные процессы, опубликованные сообществом."}
            </p>
          </div>

          {tab === TAB_MY && (
            <button
              onClick={handleCreateWorkFlow}
              disabled={loading}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-full font-bold transition-all shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(37,99,235,0.5)] active:scale-95 disabled:opacity-50 shrink-0 self-start md:self-auto cursor-pointer"
            >
              <FaPlus />
              <span>{t("listing.newWorkflow", {}, "Новый процесс")}</span>
            </button>
          )}
        </div>

        {/* Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => handleTabChange(TAB_MY)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all whitespace-nowrap rounded-xl border uppercase tracking-wider cursor-pointer ${tab === TAB_MY
                  ? "text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-zinc-500 border-transparent hover:text-white hover:bg-white/5"
                }`}
            >
              <GoWorkflow size={16} />
              <span>{t("listing.myWorkflows", {}, "Мои Процессы")}</span>
              {myWorkflows.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-black">
                  {myWorkflows.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange(TAB_PUBLIC)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all whitespace-nowrap rounded-xl border uppercase tracking-wider cursor-pointer ${tab === TAB_PUBLIC
                  ? "text-green-400 border-green-500/30 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                  : "text-zinc-500 border-transparent hover:text-white hover:bg-white/5"
                }`}
            >
              <HiOutlineGlobeAlt size={16} />
              <span>Публичные</span>
              {publicWorkflows.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-300 font-black">
                  {publicWorkflows.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <div className="relative flex items-center">
              <FiSearch size={15} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tab === TAB_MY ? "Поиск по процессам..." : "Поиск по галерее..."}
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-blue-500/50 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-zinc-500 hover:text-white transition-colors cursor-pointer text-xs"
                  title="Очистить"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Workflows Grid */}
        {loading && filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[350px]">
            <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
            <span className="mt-4 text-zinc-500 font-bold uppercase tracking-widest text-xs animate-pulse">
              {t("listing.loadingFlows", {}, "Загрузка процессов...")}
            </span>
          </div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filteredWorkflows.map((work) => (
                <WorkflowCard
                  key={work.remote_workflow_id || work.id}
                  work={work}
                  isPublic={tab === TAB_PUBLIC}
                />
              ))}

              {filteredWorkflows.length === 0 && !loading && (
                searchQuery.trim() ? (
                  <div className="col-span-full py-16 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center bg-white/[0.01]">
                    <div className="p-4 bg-white/5 rounded-2xl mb-4 text-zinc-500">
                      <FiSearch size={32} />
                    </div>
                    <h2 className="text-base font-black text-white uppercase tracking-wider mb-1">Ничего не найдено</h2>
                    <p className="text-zinc-500 mb-5 max-w-xs text-xs font-medium">
                      По запросу «{searchQuery}» подходящих процессов не найдено.
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all cursor-pointer"
                    >
                      Сбросить поиск
                    </button>
                  </div>
                ) : (
                  <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center bg-white/[0.01]">
                    <div className="p-5 bg-white/5 rounded-2xl mb-5 text-zinc-600">
                      <GoWorkflow size={40} />
                    </div>
                    {tab === TAB_MY ? (
                      <>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1">Нет процессов</h2>
                        <p className="text-zinc-500 mb-6 max-w-xs text-sm font-medium">Создайте свой первый визуальный AI процесс прямо сейчас</p>
                        <button
                          onClick={handleCreateWorkFlow}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg cursor-pointer"
                        >
                          <FaPlus /> Создать процесс
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1">Нет публичных процессов</h2>
                        <p className="text-zinc-500 max-w-xs text-sm font-medium">Опубликованные процессы других участников сообщества появятся здесь</p>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {/* Rename modal */}
      {renameId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          onClick={() => setRenameId(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">
                  {t("listing.renameModalTitle", {}, "Переименовать процесс")}
                </h3>
              </div>
              <input
                type="text"
                value={workflowName}
                autoFocus
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-bold tracking-tight text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const wf = myWorkflows.find((w) => (w.remote_workflow_id || w.id) === renameId);
                    if (wf) handleRenameWorkflow(wf, workflowName);
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRenameId(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  {t("common.discard", {}, "Отмена")}
                </button>
                <button
                  onClick={() => {
                    const wf = myWorkflows.find((w) => (w.remote_workflow_id || w.id) === renameId);
                    if (wf) handleRenameWorkflow(wf, workflowName);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg cursor-pointer"
                >
                  {t("common.commit", {}, "Сохранить")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareWorkflow && (
        <ShareModal
          workflow={shareWorkflow}
          onClose={() => setShareWorkflow(null)}
        />
      )}

      {/* Settings modal */}
      {settingsWorkflow && (
        <SettingsModal
          workflow={settingsWorkflow}
          onClose={() => setSettingsWorkflow(null)}
          onOpenCoverModal={(wf) => setCoverWorkflow(wf)}
          onVisibilityChange={(updated) => {
            setMyWorkflows((prev) =>
              prev.map((w) =>
                (w.remote_workflow_id || w.id) === (updated.remote_workflow_id || updated.id)
                  ? { ...w, visibility: updated.visibility }
                  : w
              )
            );
          }}
        />
      )}

      {/* Cover image modal */}
      {coverWorkflow && (
        <CoverImageModal
          workflow={coverWorkflow}
          onClose={() => setCoverWorkflow(null)}
          onThumbnailChange={(newThumbnail) => {
            setMyWorkflows((prev) =>
              prev.map((w) =>
                (w.remote_workflow_id || w.id) === (coverWorkflow.remote_workflow_id || coverWorkflow.id)
                  ? { ...w, thumbnail: newThumbnail }
                  : w
              )
            );
          }}
        />
      )}
    </div>
  );
};

export default WorkflowListingClient;
