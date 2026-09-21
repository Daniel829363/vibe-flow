"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../lib/auth";
import {
  FiUsers,
  FiActivity,
  FiDollarSign,
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiLogIn,
  FiShield,
  FiLayers,
  FiCheckCircle,
  FiXCircle,
  FiArrowLeft,
  FiRefreshCw,
  FiLock,
  FiGlobe,
  FiEye,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiClock,
  FiGift,
  FiFileText,
  FiExternalLink,
  FiUploadCloud,
  FiBarChart2,
  FiCopy,
  FiCalendar,
  FiSliders,
  FiDatabase,
  FiDownload,
  FiUpload,
  FiAlertTriangle,
  FiHardDrive,
} from "react-icons/fi";

export default function AdminPage() {
  const { user, loading: authLoading, setImpersonationTokens } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("users"); // "users" | "workflows" | "transactions" | "promos" | "offers" | "backup"
  const [stats, setStats] = useState({ total_users: 0, total_tokens: 0, total_workflows: 0, token_rate: 100 });
  const [adminConfig, setAdminConfig] = useState({ token_rate_per_dollar: 100, token_price_coefficient: 1, super_admin_email: "" });

  // ── Users State ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // ── Workflows State ──
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowVisibilityFilter, setWorkflowVisibilityFilter] = useState("");
  const [workflowPage, setWorkflowPage] = useState(1);
  const [totalWorkflows, setTotalWorkflows] = useState(0);

  // ── Transactions State ──
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [totalTx, setTotalTx] = useState(0);

  // ── Promo Codes State ──
  const [promos, setPromos] = useState([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [createPromoModal, setCreatePromoModal] = useState(false);
  const [newPromoData, setNewPromoData] = useState({
    code: "",
    cashback_percent: 10,
    max_uses: 100,
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
  });
  const [editPromoModal, setEditPromoModal] = useState(null); // promo object
  const [editPromoData, setEditPromoData] = useState({
    code: "",
    cashback_percent: 10,
    max_uses: 100,
    valid_from: "",
    valid_until: "",
    is_active: true,
  });
  const [promoStatsModal, setPromoStatsModal] = useState(null);
  const [promoStatsData, setPromoStatsData] = useState(null);
  const [promoStatsLoading, setPromoStatsLoading] = useState(false);

  // ── Offers & Legal Docs State ──
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [legalDocs, setLegalDocs] = useState([]);
  const [legalDocsLoading, setLegalDocsLoading] = useState(false);
  const [uploadOfferModal, setUploadOfferModal] = useState(false);
  const [offerDocType, setOfferDocType] = useState("user_agreement"); // "user_agreement" | "privacy_policy" | "offer"
  const [offerLanguage, setOfferLanguage] = useState("ru");
  const [offerCustomLang, setOfferCustomLang] = useState("");
  const [offerFile, setOfferFile] = useState(null);
  const [uploadingOffer, setUploadingOffer] = useState(false);

  // ── Backup State ──
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // ── Modals State (Users & Tokens) ──
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ email: "", name: "", phone: "", password: "", initial_balance_usd: 0 });

  const [editUserModal, setEditUserModal] = useState(null); // user object
  const [editUserData, setEditUserData] = useState({ email: "", name: "", phone: "", password: "", is_email_verified: false });

  const [adjustTokensModal, setAdjustTokensModal] = useState(null); // user object
  const [tokenActionType, setTokenActionType] = useState("add"); // "add" | "deduct"
  const [tokenAmountUsd, setTokenAmountUsd] = useState("");
  const [tokenCoefficient, setTokenCoefficient] = useState("1");
  const [tokenDescription, setTokenDescription] = useState("");

  const [userHistoryModal, setUserHistoryModal] = useState(null); // user object
  const [userHistoryList, setUserHistoryList] = useState([]);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);

  // ── Access check ──
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/auth/login");
      } else if (!user.is_superadmin) {
        toast.error("Доступ запрещен. Только для суперадминистратора.");
        router.push("/workflow");
      }
    }
  }, [user, authLoading, router]);

  // ── Fetch Admin Config ──
  const fetchAdminConfig = useCallback(async () => {
    try {
      const res = await axios.get("/api/admin/config");
      setAdminConfig(res.data);
      if (res.data.token_price_coefficient !== undefined) {
        setTokenCoefficient(String(res.data.token_price_coefficient));
      }
    } catch (err) {
      console.error("Failed to fetch admin config:", err);
    }
  }, []);

  // ── Fetch Users ──
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await axios.get("/api/admin/users", {
        params: { search: userSearch, page: userPage, limit: 20 },
      });
      setUsers(res.data.users || []);
      setTotalUsers(res.data.total || 0);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки пользователей");
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, userPage]);

  // ── Fetch Workflows ──
  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    try {
      const res = await axios.get("/api/admin/workflows", {
        params: { search: workflowSearch, visibility: workflowVisibilityFilter || undefined, page: workflowPage, limit: 20 },
      });
      setWorkflows(res.data.workflows || []);
      setTotalWorkflows(res.data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки workflows");
    } finally {
      setWorkflowsLoading(false);
    }
  }, [workflowSearch, workflowVisibilityFilter, workflowPage]);

  // ── Fetch Transactions ──
  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await axios.get("/api/admin/transactions", {
        params: { search: txSearch, type: txTypeFilter || undefined, page: txPage, limit: 25 },
      });
      setTransactions(res.data.transactions || []);
      setTotalTx(res.data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки транзакций");
    } finally {
      setTxLoading(false);
    }
  }, [txSearch, txTypeFilter, txPage]);

  // ── Fetch Promos ──
  const fetchPromos = useCallback(async () => {
    setPromosLoading(true);
    try {
      const res = await axios.get("/api/admin/promo-codes");
      setPromos(res.data.promo_codes || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки промокодов");
    } finally {
      setPromosLoading(false);
    }
  }, []);

  // ── Fetch Offers & Legal Docs ──
  const fetchOffersAdmin = useCallback(async () => {
    setOffersLoading(true);
    try {
      const res = await axios.get("/api/admin/offers");
      setOffers(res.data.offers || []);
    } catch (err) {
      console.error("Failed to load offers:", err);
    } finally {
      setOffersLoading(false);
    }
  }, []);

  const fetchLegalDocsAdmin = useCallback(async () => {
    setLegalDocsLoading(true);
    try {
      const res = await axios.get("/api/admin/legal-documents");
      setLegalDocs(res.data.documents || []);
    } catch (err) {
      console.error("Failed to load legal documents:", err);
    } finally {
      setLegalDocsLoading(false);
    }
  }, []);

  // ── Fetch Backups ──
  const fetchBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const res = await axios.get("/api/admin/backup/list");
      setBackups(res.data.backups || []);
    } catch (err) {
      console.error("Failed to load backups:", err);
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  // ── Backup Handlers ──
  const handleDownloadBackup = async (format = "dump") => {
    setBackupDownloading(true);
    try {
      const endpoint = format === "sql" ? "/api/admin/backup/download-sql" : "/api/admin/backup/download";
      const res = await axios.get(endpoint, { responseType: "blob" });
      const contentDisposition = res.headers["content-disposition"];
      let filename = `vibeflow_backup.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Бекап (${format.toUpperCase()}) скачан успешно!`);
      fetchBackups();
    } catch (err) {
      console.error("Backup download failed:", err);
      toast.error(err.response?.data?.detail || "Ошибка скачивания бекапа");
    } finally {
      setBackupDownloading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      toast.error("Выберите файл бекапа");
      return;
    }
    setBackupRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", restoreFile);
      const res = await axios.post("/api/admin/backup/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 minutes for large backups
      });
      toast.success(res.data.message || "База данных восстановлена!");
      setRestoreFile(null);
      setShowRestoreConfirm(false);
      fetchBackups();
    } catch (err) {
      console.error("Backup restore failed:", err);
      toast.error(err.response?.data?.detail || "Ошибка восстановления бекапа");
    } finally {
      setBackupRestoring(false);
    }
  };

  // Trigger loads on tab changes
  useEffect(() => {
    if (user?.is_superadmin) {
      fetchAdminConfig();
      if (activeTab === "users") fetchUsers();
      if (activeTab === "workflows") fetchWorkflows();
      if (activeTab === "transactions") fetchTransactions();
      if (activeTab === "promos") fetchPromos();
      if (activeTab === "offers") {
        fetchOffersAdmin();
        fetchLegalDocsAdmin();
      }
      if (activeTab === "backup") fetchBackups();
    }
  }, [activeTab, fetchUsers, fetchWorkflows, fetchTransactions, fetchPromos, fetchOffersAdmin, fetchLegalDocsAdmin, fetchBackups, fetchAdminConfig, user?.is_superadmin]);

  // ── Handle User Impersonation ──
  const handleImpersonate = async (targetUser) => {
    if (!window.confirm(`Вы действительно хотите войти как ${targetUser.email}?`)) return;
    try {
      const res = await axios.post(`/api/admin/users/${targetUser.id}/impersonate`);
      const { access_token, refresh_token, user: impersonatedUser } = res.data;
      setImpersonationTokens(access_token, refresh_token, impersonatedUser);
      toast.success(`Вход выполнен от имени ${targetUser.email}`);
      router.push("/workflow");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка авторизации от имени пользователя");
    }
  };

  // ── Handle Create User ──
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/admin/users", newUserData);
      toast.success("Пользователь успешно создан");
      setCreateUserModal(false);
      setNewUserData({ email: "", name: "", phone: "", password: "", initial_balance_usd: 0 });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка создания пользователя");
    }
  };

  // ── Handle Edit User ──
  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editUserModal) return;
    try {
      await axios.put(`/api/admin/users/${editUserModal.id}`, editUserData);
      toast.success("Данные пользователя обновлены");
      setEditUserModal(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка обновления пользователя");
    }
  };

  // ── Handle Delete User ──
  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Удалить пользователя ${targetUser.email}? Все его процессы будут удалены!`)) return;
    try {
      await axios.delete(`/api/admin/users/${targetUser.id}`);
      toast.success("Пользователь удален");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления пользователя");
    }
  };

  // ── Handle Adjust Tokens ──
  const handleAdjustTokensSubmit = async (e) => {
    e.preventDefault();
    if (!adjustTokensModal) return;
    const amountNum = parseFloat(tokenAmountUsd);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Укажите корректную сумму больше 0");
      return;
    }

    const coeffNum = parseFloat(tokenCoefficient);
    if (isNaN(coeffNum) || coeffNum <= 0) {
      toast.error("Коэффициент должен быть больше 0");
      return;
    }

    const finalAmountUsd = tokenActionType === "add" ? amountNum : -amountNum;

    try {
      const res = await axios.post(`/api/admin/users/${adjustTokensModal.id}/tokens`, {
        amount_usd: finalAmountUsd,
        coefficient: coeffNum,
        description: tokenDescription || (tokenActionType === "add" ? "Пополнение баланса администратором" : "Списание баланса администратором"),
      });
      toast.success(res.data.message || "Баланс успешно обновлен");
      setAdjustTokensModal(null);
      setTokenAmountUsd("");
      setTokenDescription("");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка изменения баланса");
    }
  };

  // ── Open User History ──
  const openUserHistory = async (targetUser) => {
    setUserHistoryModal(targetUser);
    setUserHistoryLoading(true);
    try {
      const res = await axios.get(`/api/admin/users/${targetUser.id}/transactions`);
      setUserHistoryList(res.data.transactions || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки истории токенов");
    } finally {
      setUserHistoryLoading(false);
    }
  };

  // ── Toggle Workflow Visibility ──
  const handleToggleWorkflowVisibility = async (wf) => {
    const nextVis = wf.visibility === "public" ? "private" : "public";
    try {
      await axios.put(`/api/admin/workflows/${wf.remote_workflow_id || wf.id}/visibility`, {
        visibility: nextVis,
      });
      toast.success(`Видимость процесса изменена на: ${nextVis === "public" ? "Публичный" : "Приватный"}`);
      fetchWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка изменения видимости");
    }
  };

  // ── Delete Workflow ──
  const handleDeleteWorkflow = async (wf) => {
    if (!window.confirm(`Удалить процесс "${wf.name}" (${wf.remote_workflow_id || wf.id})?`)) return;
    try {
      await axios.delete(`/api/admin/workflows/${wf.remote_workflow_id || wf.id}`);
      toast.success("Процесс успешно удален");
      fetchWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления процесса");
    }
  };

  // ── Promo Code Actions ──
  const handleCreatePromo = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/admin/promo-codes", {
        code: newPromoData.code.trim().toUpperCase(),
        cashback_percent: parseFloat(newPromoData.cashback_percent),
        max_uses: parseInt(newPromoData.max_uses, 10),
        valid_from: new Date(newPromoData.valid_from).toISOString(),
        valid_until: new Date(newPromoData.valid_until).toISOString(),
      });
      toast.success("Промокод успешно создан");
      setCreatePromoModal(false);
      setNewPromoData({
        code: "",
        cashback_percent: 10,
        max_uses: 100,
        valid_from: new Date().toISOString().slice(0, 16),
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
      });
      fetchPromos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка создания промокода");
    }
  };

  const handleUpdatePromo = async (e) => {
    e.preventDefault();
    if (!editPromoModal) return;
    try {
      await axios.put(`/api/admin/promo-codes/${editPromoModal.id}`, {
        code: editPromoData.code.trim().toUpperCase(),
        cashback_percent: parseFloat(editPromoData.cashback_percent),
        max_uses: parseInt(editPromoData.max_uses, 10),
        valid_from: new Date(editPromoData.valid_from).toISOString(),
        valid_until: new Date(editPromoData.valid_until).toISOString(),
        is_active: editPromoData.is_active,
      });
      toast.success("Промокод обновлен");
      setEditPromoModal(null);
      fetchPromos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка обновления промокода");
    }
  };

  const handleDeletePromo = async (promo) => {
    if (!window.confirm(`Удалить промокод ${promo.code}?`)) return;
    try {
      await axios.delete(`/api/admin/promo-codes/${promo.id}`);
      toast.success("Промокод удален");
      fetchPromos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления промокода");
    }
  };

  const openPromoStats = async (promo) => {
    setPromoStatsModal(promo);
    setPromoStatsLoading(true);
    try {
      const res = await axios.get(`/api/admin/promo-codes/${promo.id}/stats`);
      setPromoStatsData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки статистики");
    } finally {
      setPromoStatsLoading(false);
    }
  };

  // ── Offer & Legal Doc Actions ──
  const handleUploadOffer = async (e) => {
    e.preventDefault();
    const lang = offerLanguage === "custom" ? offerCustomLang.trim().toLowerCase() : offerLanguage;
    if (!lang) {
      toast.error("Укажите код языка");
      return;
    }
    if (!offerFile) {
      toast.error("Выберите PDF файл");
      return;
    }
    setUploadingOffer(true);
    const formData = new FormData();
    formData.append("doc_type", offerDocType);
    formData.append("language", lang);
    formData.append("file", offerFile);

    try {
      if (offerDocType === "offer") {
        await axios.post("/api/admin/offers", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`Публичная оферта (${lang.toUpperCase()}) успешно загружена`);
      } else {
        await axios.post("/api/admin/legal-documents", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const typeLabels = {
          user_agreement: "Пользовательское соглашение",
          privacy_policy: "Политика конфиденциальности",
        };
        toast.success(`${typeLabels[offerDocType] || "Документ"} (${lang.toUpperCase()}) успешно загружен`);
      }
      setUploadOfferModal(false);
      setOfferFile(null);
      setOfferLanguage("ru");
      setOfferCustomLang("");
      fetchOffersAdmin();
      fetchLegalDocsAdmin();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка загрузки документа");
    } finally {
      setUploadingOffer(false);
    }
  };

  const handleDeleteOffer = async (off) => {
    if (!window.confirm(`Удалить оферту для языка "${off.language.toUpperCase()}"?`)) return;
    try {
      await axios.delete(`/api/admin/offers/${off.id}`);
      toast.success("Оферта удалена");
      fetchOffersAdmin();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления оферты");
    }
  };

  const handleDeleteLegalDoc = async (doc) => {
    const docLabels = {
      user_agreement: "Пользовательское соглашение",
      privacy_policy: "Политику конфиденциальности",
      offer: "Оферту",
    };
    const label = docLabels[doc.doc_type] || "документ";
    if (!window.confirm(`Удалить ${label} для языка "${doc.language.toUpperCase()}"?`)) return;
    try {
      await axios.delete(`/api/admin/legal-documents/${doc.id}`);
      toast.success("Документ удален");
      fetchLegalDocsAdmin();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления документа");
    }
  };

  if (authLoading || !user || !user.is_superadmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm">Проверка прав администратора...</p>
        </div>
      </div>
    );
  }

  const rate = stats.token_rate || adminConfig.token_rate_per_dollar || 100;
  const currentCoeff = parseFloat(tokenCoefficient) || adminConfig.token_price_coefficient || 1;
  const convertedTokensPreview = tokenAmountUsd && !isNaN(parseFloat(tokenAmountUsd))
    ? Math.round((parseFloat(tokenAmountUsd) * rate) / currentCoeff)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-right" toastOptions={{ style: { background: "#181920", color: "#fff", border: "1px solid #2e303d" } }} />

      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#101118]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow")}
              className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
              title="Назад к процессам"
            >
              <FiArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <FiShield size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Панель управления</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-zinc-400">Управление пользователями, токенами, промокодами и офертой</p>
            </div>
          </div>

          {/* Quick Rate & Config Info */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Курс:</span>
              <span className="text-xs font-bold text-amber-400">$1 = {rate} токенов</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Коэфф. .env:</span>
              <span className="text-xs font-bold text-indigo-400">x{adminConfig.token_price_coefficient || 1}</span>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200">{user.email}</div>
              <div className="text-[11px] text-zinc-500">Суперадминистратор</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#14151c] border border-zinc-800/80 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Пользователи</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><FiUsers size={18} /></div>
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">{stats.total_users}</div>
            <div className="text-xs text-zinc-500 mt-1">Всего зарегистрировано</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition"></div>
          </div>

          <div className="p-5 rounded-2xl bg-[#14151c] border border-zinc-800/80 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Токены в системе</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><FiDollarSign size={18} /></div>
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">🪙 {stats.total_tokens.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">~ ${(stats.total_tokens / rate).toFixed(2)} USD</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition"></div>
          </div>

          <div className="p-5 rounded-2xl bg-[#14151c] border border-zinc-800/80 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Всего процессов</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><FiLayers size={18} /></div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">{stats.total_workflows}</div>
            <div className="text-xs text-zinc-500 mt-1">Создано пользователями</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition"></div>
          </div>

          <div className="p-5 rounded-2xl bg-[#14151c] border border-zinc-800/80 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Ценовой коэфф.</span>
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400"><FiSliders size={18} /></div>
            </div>
            <div className="text-3xl font-extrabold text-violet-400 mt-2">x{adminConfig.token_price_coefficient || 1}</div>
            <div className="text-xs text-zinc-500 mt-1">1$ = {Math.round(rate / (adminConfig.token_price_coefficient || 1))}🪙 при покупке</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition"></div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-1">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "users"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiUsers size={16} /> Пользователи ({totalUsers})
          </button>
          <button
            onClick={() => setActiveTab("workflows")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "workflows"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiLayers size={16} /> Процессы ({totalWorkflows})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "transactions"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiActivity size={16} /> Все транзакции ({totalTx})
          </button>
          <button
            onClick={() => setActiveTab("promos")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "promos"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiGift size={16} /> Промокоды ({promos.length})
          </button>
          <button
            onClick={() => setActiveTab("offers")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "offers"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiFileText size={16} /> Документы PDF ({offers.length + legalDocs.length})
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition ${
              activeTab === "backup"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <FiDatabase size={16} /> Бекапы БД
          </button>
        </div>

        {/* ── TAB 1: USERS ── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  type="text"
                  placeholder="Поиск по email, имени, телефону..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  className="w-full bg-[#14151c] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={fetchUsers}
                  className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                  title="Обновить список"
                >
                  <FiRefreshCw size={16} className={usersLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setCreateUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
                >
                  <FiPlus size={16} /> Добавить пользователя
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Пользователь</th>
                      <th className="px-6 py-4">Контакты</th>
                      <th className="px-6 py-4">Баланс</th>
                      <th className="px-6 py-4">Статус</th>
                      <th className="px-6 py-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                          <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <div>Загрузка пользователей...</div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                          Пользователи не найдены
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
                                {u.email ? u.email[0].toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-2">
                                  {u.name || "Без имени"}
                                  {u.is_superadmin && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                      SUPERADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-400">
                            {u.phone ? (
                              <span>{u.phone}</span>
                            ) : (
                              <span className="text-zinc-600">Не указан</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-amber-400 flex items-center gap-1.5">
                              🪙 {u.token_balance || 0}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              ~ ${((u.token_balance || 0) / rate).toFixed(2)} USD
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {u.is_email_verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <FiCheckCircle size={12} /> Подтвержден
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <FiXCircle size={12} /> Не подтвержден
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Manage Tokens */}
                              <button
                                onClick={() => {
                                  setAdjustTokensModal(u);
                                  setTokenAmountUsd("");
                                  setTokenCoefficient(String(adminConfig.token_price_coefficient || 1));
                                  setTokenDescription("");
                                }}
                                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
                                title="Пополнить / Списать токены"
                              >
                                <FiDollarSign size={15} />
                              </button>

                              {/* Impersonate */}
                              <button
                                onClick={() => handleImpersonate(u)}
                                className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition"
                                title="Войти от имени этого пользователя"
                              >
                                <FiLogIn size={15} />
                              </button>

                              {/* User Token History */}
                              <button
                                onClick={() => openUserHistory(u)}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                                title="История операций пользователя"
                              >
                                <FiClock size={15} />
                              </button>

                              {/* Edit User */}
                              <button
                                onClick={() => {
                                  setEditUserModal(u);
                                  setEditUserData({
                                    email: u.email,
                                    name: u.name || "",
                                    phone: u.phone || "",
                                    password: "",
                                    is_email_verified: u.is_email_verified,
                                  });
                                }}
                                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                                title="Редактировать профиль"
                              >
                                <FiEdit2 size={15} />
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                title="Удалить пользователя"
                              >
                                <FiTrash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalUsers > 20 && (
                <div className="px-6 py-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div>Показаны {users.length} из {totalUsers} пользователей</div>
                  <div className="flex gap-2">
                    <button
                      disabled={userPage <= 1}
                      onClick={() => setUserPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Назад
                    </button>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium">
                      {userPage}
                    </span>
                    <button
                      disabled={userPage * 20 >= totalUsers}
                      onClick={() => setUserPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Вперед
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: WORKFLOWS ── */}
        {activeTab === "workflows" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Поиск по названию или ID..."
                    value={workflowSearch}
                    onChange={(e) => { setWorkflowSearch(e.target.value); setWorkflowPage(1); }}
                    className="w-full bg-[#14151c] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <select
                  value={workflowVisibilityFilter}
                  onChange={(e) => { setWorkflowVisibilityFilter(e.target.value); setWorkflowPage(1); }}
                  className="bg-[#14151c] border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">Все статусы</option>
                  <option value="public">Только публичные</option>
                  <option value="private">Только приватные</option>
                </select>
              </div>

              <button
                onClick={fetchWorkflows}
                className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                title="Обновить список"
              >
                <FiRefreshCw size={16} className={workflowsLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Workflows Table */}
            <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Название процесса</th>
                      <th className="px-6 py-4">Владелец</th>
                      <th className="px-6 py-4">Видимость</th>
                      <th className="px-6 py-4">Запусков</th>
                      <th className="px-6 py-4">Дата создания</th>
                      <th className="px-6 py-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {workflowsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <div>Загрузка процессов...</div>
                        </td>
                      </tr>
                    ) : workflows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          Процессы не найдены
                        </td>
                      </tr>
                    ) : (
                      workflows.map((wf) => (
                        <tr key={wf.id} className="hover:bg-zinc-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{wf.name || "Без названия"}</div>
                            <div className="text-xs text-zinc-500 font-mono">{wf.remote_workflow_id || wf.id}</div>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="text-zinc-200 font-medium">{wf.owner_name || wf.owner_email || "Неизвестно"}</div>
                            <div className="text-zinc-500">{wf.owner_email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleWorkflowVisibility(wf)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                                wf.visibility === "public"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                              }`}
                              title="Нажмите, чтобы переключить"
                            >
                              {wf.visibility === "public" ? <FiGlobe size={12} /> : <FiLock size={12} />}
                              {wf.visibility === "public" ? "Публичный" : "Приватный"}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-400">
                            {wf.run_count || 0}
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-500">
                            {wf.created_at ? new Date(wf.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => router.push(`/workflow/${wf.remote_workflow_id || wf.id}`)}
                                className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition"
                                title="Открыть процесс"
                              >
                                <FiEye size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkflow(wf)}
                                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                title="Удалить процесс"
                              >
                                <FiTrash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalWorkflows > 20 && (
                <div className="px-6 py-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div>Показаны {workflows.length} из {totalWorkflows} процессов</div>
                  <div className="flex gap-2">
                    <button
                      disabled={workflowPage <= 1}
                      onClick={() => setWorkflowPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Назад
                    </button>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium">
                      {workflowPage}
                    </span>
                    <button
                      disabled={workflowPage * 20 >= totalWorkflows}
                      onClick={() => setWorkflowPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Вперед
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: TRANSACTIONS ── */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Поиск по email, описанию..."
                    value={txSearch}
                    onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
                    className="w-full bg-[#14151c] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <select
                  value={txTypeFilter}
                  onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
                  className="bg-[#14151c] border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">Все типы</option>
                  <option value="admin">Пополнения и списания</option>
                  <option value="topup">Только пополнения</option>
                  <option value="deduction">Только списания</option>
                  <option value="usage">Только списания за генерации</option>
                </select>
              </div>

              <button
                onClick={fetchTransactions}
                className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                title="Обновить список"
              >
                <FiRefreshCw size={16} className={txLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Transactions Table */}
            <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Тип</th>
                      <th className="px-6 py-4">Пользователь</th>
                      <th className="px-6 py-4">Описание / Workflow</th>
                      <th className="px-6 py-4">Сумма токенов</th>
                      <th className="px-6 py-4">Эквивалент USD</th>
                      <th className="px-6 py-4">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {txLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <div>Загрузка транзакций...</div>
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          Транзакции не найдены
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-zinc-800/30 transition">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              tx.type === "topup"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tx.type === "deduction"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                              {tx.type === "topup" && <FiArrowDownLeft size={12} />}
                              {tx.type === "deduction" && <FiArrowUpRight size={12} />}
                              {tx.type === "usage" && <FiActivity size={12} />}
                              {tx.type === "topup" ? "Пополнение" : tx.type === "deduction" ? "Списание" : "Генерация"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="font-semibold text-white">{tx.user_name || tx.user_email || "Пользователь"}</div>
                            <div className="text-zinc-500">{tx.user_email}</div>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <div className="text-zinc-200">{tx.description || "Без описания"}</div>
                            {tx.workflow_name && (
                              <div className="text-indigo-400 font-mono mt-0.5">Workflow: {tx.workflow_name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold ${tx.amount_tokens > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {tx.amount_tokens > 0 ? `+${tx.amount_tokens}` : tx.amount_tokens} 🪙
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-400 font-medium">
                            {tx.amount_usd > 0 ? `+$${tx.amount_usd.toFixed(2)}` : `-$${Math.abs(tx.amount_usd).toFixed(2)}`}
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-500">
                            {tx.created_at ? new Date(tx.created_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalTx > 25 && (
                <div className="px-6 py-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div>Показаны {transactions.length} из {totalTx} транзакций</div>
                  <div className="flex gap-2">
                    <button
                      disabled={txPage <= 1}
                      onClick={() => setTxPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Назад
                    </button>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-medium">
                      {txPage}
                    </span>
                    <button
                      disabled={txPage * 25 >= totalTx}
                      onClick={() => setTxPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Вперед
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: PROMO CODES ── */}
        {activeTab === "promos" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiGift className="text-amber-400" /> Управление промокодами
                </h2>
                <p className="text-xs text-zinc-400">Создание промокодов с кешбеком при пополнении через FINIK</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchPromos}
                  className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                  title="Обновить список"
                >
                  <FiRefreshCw size={16} className={promosLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setCreatePromoModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-sm font-semibold shadow-lg shadow-amber-500/20 transition"
                >
                  <FiPlus size={16} /> Создать промокод
                </button>
              </div>
            </div>

            {/* Promos Table */}
            <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Промокод</th>
                      <th className="px-6 py-4">Кешбек</th>
                      <th className="px-6 py-4">Использования</th>
                      <th className="px-6 py-4">Период действия</th>
                      <th className="px-6 py-4">Статус</th>
                      <th className="px-6 py-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {promosLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <div>Загрузка промокодов...</div>
                        </td>
                      </tr>
                    ) : promos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          Промокоды не созданы. Нажмите "Создать промокод" выше.
                        </td>
                      </tr>
                    ) : (
                      promos.map((p) => {
                        const now = new Date();
                        const from = new Date(p.valid_from);
                        const until = new Date(p.valid_until);
                        const isExpired = now > until || now < from;
                        const isFull = p.current_uses >= p.max_uses;

                        return (
                          <tr key={p.id} className="hover:bg-zinc-800/30 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 font-mono font-bold text-amber-400 text-sm tracking-wider">
                                  {p.code}
                                </span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Код скопирован"); }}
                                  className="p-1 rounded text-zinc-500 hover:text-zinc-300"
                                  title="Скопировать код"
                                >
                                  <FiCopy size={13} />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-emerald-400 text-base">{p.cashback_percent}%</span>
                              <span className="text-xs text-zinc-500 block">бонус к токенам</span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{p.current_uses}</span>
                                <span className="text-zinc-500">/ {p.max_uses}</span>
                              </div>
                              <div className="w-24 bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                  className="bg-amber-500 h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (p.current_uses / p.max_uses) * 100)}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-400">
                              <div>{new Date(p.valid_from).toLocaleDateString()} — {new Date(p.valid_until).toLocaleDateString()}</div>
                              <div className="text-[11px] text-zinc-500 mt-0.5">
                                {isExpired ? <span className="text-rose-400">Срок истёк</span> : "Действует"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {p.is_active && !isExpired && !isFull ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <FiCheckCircle size={12} /> Активен
                                </span>
                              ) : isFull ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Лимит исчерпан
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Истёк
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Отключен
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Stats */}
                                <button
                                  onClick={() => openPromoStats(p)}
                                  className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition"
                                  title="Статистика использования"
                                >
                                  <FiBarChart2 size={15} />
                                </button>

                                {/* Edit */}
                                <button
                                  onClick={() => {
                                    setEditPromoModal(p);
                                    setEditPromoData({
                                      code: p.code,
                                      cashback_percent: p.cashback_percent,
                                      max_uses: p.max_uses,
                                      valid_from: new Date(p.valid_from).toISOString().slice(0, 16),
                                      valid_until: new Date(p.valid_until).toISOString().slice(0, 16),
                                      is_active: p.is_active,
                                    });
                                  }}
                                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                                  title="Редактировать промокод"
                                >
                                  <FiEdit2 size={15} />
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeletePromo(p)}
                                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                  title="Удалить промокод"
                                >
                                  <FiTrash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: LEGAL DOCUMENTS & OFFERS ── */}
        {activeTab === "offers" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiFileText className="text-blue-400" /> Юридические документы (PDF)
                </h2>
                <p className="text-xs text-zinc-400">
                  Управление PDF-файлами Пользовательского соглашения, Политики конфиденциальности и Публичной оферты
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    fetchOffersAdmin();
                    fetchLegalDocsAdmin();
                  }}
                  className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                  title="Обновить список"
                >
                  <FiRefreshCw size={16} className={offersLoading || legalDocsLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => {
                    setOfferDocType("user_agreement");
                    setUploadOfferModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition"
                >
                  <FiUploadCloud size={16} /> Загрузить PDF документ
                </button>
              </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
              <FiShield size={18} className="shrink-0 mt-0.5 text-blue-400" />
              <div>
                <div className="font-semibold text-blue-200">Где используются эти документы:</div>
                <div>
                  • <strong>При регистрации</strong> отображается чекбокс согласия со ссылками на Пользовательское соглашение, Политику конфиденциальности и Публичную оферту.<br />
                  • <strong>При пополнении баланса</strong> в модальном окне отображается согласие с условиями оплаты (офертой).<br />
                  • Документы доступны для онлайн-просмотра на страницах <code>/legal</code> и <code>/terms</code>.
                </div>
              </div>
            </div>

            {/* 1. USER AGREEMENT SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <FiFileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">1. Пользовательское соглашение (User Agreement)</h3>
                    <p className="text-[11px] text-zinc-400">Обязательный документ при создании нового аккаунта</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOfferDocType("user_agreement");
                    setUploadOfferModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition"
                >
                  <FiUploadCloud size={13} /> Загрузить PDF
                </button>
              </div>

              <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-3.5">Язык</th>
                        <th className="px-6 py-3.5">Название файла</th>
                        <th className="px-6 py-3.5">Дата загрузки</th>
                        <th className="px-6 py-3.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {legalDocsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                            <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-1"></div>
                            <div>Загрузка...</div>
                          </td>
                        </tr>
                      ) : legalDocs.filter((d) => d.doc_type === "user_agreement").length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 text-xs">
                            Пользовательское соглашение еще не загружено. Нажмите "+ Загрузить PDF" выше.
                          </td>
                        </tr>
                      ) : (
                        legalDocs
                          .filter((d) => d.doc_type === "user_agreement")
                          .map((doc) => (
                            <tr key={doc.id} className="hover:bg-zinc-800/30 transition">
                              <td className="px-6 py-3.5">
                                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 font-bold text-blue-400 text-xs uppercase tracking-wider">
                                  {doc.language}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="font-medium text-white flex items-center gap-2">
                                  <FiFileText className="text-blue-400" />
                                  {doc.original_name || doc.filename}
                                </div>
                                <div className="text-xs text-zinc-500 font-mono">{doc.filename}</div>
                              </td>
                              <td className="px-6 py-3.5 text-xs text-zinc-500">
                                {doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => window.open(`/legal?type=user_agreement&lang=${doc.language}`, "_blank")}
                                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition flex items-center gap-1 text-xs font-semibold px-2.5"
                                    title="Просмотреть документ"
                                  >
                                    <FiExternalLink size={13} />
                                    <span>Просмотр</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLegalDoc(doc)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                    title="Удалить документ"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 2. PRIVACY POLICY SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <FiLock size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">2. Политика конфиденциальности (Privacy Policy)</h3>
                    <p className="text-[11px] text-zinc-400">Правила сбора, хранения и защиты персональных данных</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOfferDocType("privacy_policy");
                    setUploadOfferModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 text-xs font-semibold transition"
                >
                  <FiUploadCloud size={13} /> Загрузить PDF
                </button>
              </div>

              <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-3.5">Язык</th>
                        <th className="px-6 py-3.5">Название файла</th>
                        <th className="px-6 py-3.5">Дата загрузки</th>
                        <th className="px-6 py-3.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {legalDocsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                            <div className="inline-block w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-1"></div>
                            <div>Загрузка...</div>
                          </td>
                        </tr>
                      ) : legalDocs.filter((d) => d.doc_type === "privacy_policy").length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 text-xs">
                            Политика конфиденциальности еще не загружена. Нажмите "+ Загрузить PDF" выше.
                          </td>
                        </tr>
                      ) : (
                        legalDocs
                          .filter((d) => d.doc_type === "privacy_policy")
                          .map((doc) => (
                            <tr key={doc.id} className="hover:bg-zinc-800/30 transition">
                              <td className="px-6 py-3.5">
                                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 font-bold text-purple-400 text-xs uppercase tracking-wider">
                                  {doc.language}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="font-medium text-white flex items-center gap-2">
                                  <FiLock className="text-purple-400" />
                                  {doc.original_name || doc.filename}
                                </div>
                                <div className="text-xs text-zinc-500 font-mono">{doc.filename}</div>
                              </td>
                              <td className="px-6 py-3.5 text-xs text-zinc-500">
                                {doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => window.open(`/legal?type=privacy_policy&lang=${doc.language}`, "_blank")}
                                    className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition flex items-center gap-1 text-xs font-semibold px-2.5"
                                    title="Просмотреть документ"
                                  >
                                    <FiExternalLink size={13} />
                                    <span>Просмотр</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLegalDoc(doc)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                    title="Удалить документ"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. PUBLIC OFFER SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FiShield size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">3. Публичная оферта (Public Payment Offer)</h3>
                    <p className="text-[11px] text-zinc-400">Условия оплаты и пополнения баланса токенов платформы</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOfferDocType("offer");
                    setUploadOfferModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
                >
                  <FiUploadCloud size={13} /> Загрузить PDF
                </button>
              </div>

              <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-[#181922] text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-3.5">Язык</th>
                        <th className="px-6 py-3.5">Название файла</th>
                        <th className="px-6 py-3.5">Дата загрузки</th>
                        <th className="px-6 py-3.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {offersLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                            <div className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-1"></div>
                            <div>Загрузка...</div>
                          </td>
                        </tr>
                      ) : offers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 text-xs">
                            PDF оферты пока не загружены. Нажмите "+ Загрузить PDF" выше.
                          </td>
                        </tr>
                      ) : (
                        offers.map((off) => (
                          <tr key={off.id} className="hover:bg-zinc-800/30 transition">
                            <td className="px-6 py-3.5">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-400 text-xs uppercase tracking-wider">
                                {off.language}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="font-medium text-white flex items-center gap-2">
                                <FiFileText className="text-emerald-400" />
                                {off.original_name || off.filename}
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">{off.filename}</div>
                            </td>
                            <td className="px-6 py-3.5 text-xs text-zinc-500">
                              {off.created_at ? new Date(off.created_at).toLocaleString() : "—"}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => window.open(`/terms?lang=${off.language}`, "_blank")}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1 text-xs font-semibold px-2.5"
                                  title="Просмотреть страницу оферты"
                                >
                                  <FiExternalLink size={13} />
                                  <span>Просмотр</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteOffer(off)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                  title="Удалить оферту"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: DATABASE BACKUP ── */}
        {activeTab === "backup" && (
          <div className="space-y-6">
            {/* Download Section */}
            <div className="p-6 rounded-2xl bg-[#14151c] border border-zinc-800/80">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <FiDownload size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Скачать бекап</h3>
                  <p className="text-xs text-zinc-500">Создать и скачать резервную копию базы данных</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDownloadBackup("dump")}
                  disabled={backupDownloading}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 hover:border-indigo-400/50 text-white transition group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-indigo-500/20 group-hover:bg-indigo-500/30 transition">
                    <FiHardDrive size={18} className="text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">Формат .dump</div>
                    <div className="text-[11px] text-zinc-400">Сжатый формат pg_dump (рекомендуется)</div>
                  </div>
                  {backupDownloading && <FiRefreshCw size={16} className="animate-spin ml-auto text-indigo-400" />}
                </button>

                <button
                  onClick={() => handleDownloadBackup("sql")}
                  disabled={backupDownloading}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 hover:border-emerald-400/50 text-white transition group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition">
                    <FiFileText size={18} className="text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">Формат .sql</div>
                    <div className="text-[11px] text-zinc-400">Текстовый SQL-дамп для просмотра</div>
                  </div>
                  {backupDownloading && <FiRefreshCw size={16} className="animate-spin ml-auto text-emerald-400" />}
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="p-6 rounded-2xl bg-[#14151c] border border-zinc-800/80">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <FiUpload size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Восстановить из бекапа</h3>
                  <p className="text-xs text-zinc-500">Загрузить файл бекапа (.dump или .sql) для восстановления БД</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <label className="flex-1 w-full">
                  <div className={`flex items-center justify-center gap-3 px-5 py-6 rounded-xl border-2 border-dashed transition cursor-pointer ${
                    restoreFile
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"
                  }`}>
                    {restoreFile ? (
                      <>
                        <FiCheckCircle size={20} className="text-amber-400" />
                        <div>
                          <div className="text-sm font-medium text-white">{restoreFile.name}</div>
                          <div className="text-[11px] text-zinc-400">{(restoreFile.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setRestoreFile(null); }}
                          className="ml-auto text-zinc-500 hover:text-rose-400 transition"
                        >
                          <FiXCircle size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <FiUploadCloud size={24} className="text-zinc-500" />
                        <div className="text-sm text-zinc-400">
                          Нажмите чтобы выбрать файл <span className="text-zinc-600">(.dump или .sql)</span>
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".dump,.sql"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setRestoreFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>

                <button
                  onClick={() => {
                    if (!restoreFile) {
                      toast.error("Сначала выберите файл бекапа");
                      return;
                    }
                    setShowRestoreConfirm(true);
                  }}
                  disabled={!restoreFile || backupRestoring}
                  className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-lg shadow-amber-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {backupRestoring ? (
                    <><FiRefreshCw size={16} className="animate-spin" /> Восстановление...</>
                  ) : (
                    <><FiUpload size={16} /> Восстановить</>
                  )}
                </button>
              </div>

              {/* Danger Warning */}
              <div className="mt-4 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-start gap-2">
                  <FiAlertTriangle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-rose-300/80 leading-relaxed">
                    <strong>Внимание!</strong> Восстановление из бекапа <strong>полностью заменит</strong> текущие данные базы.
                    Рекомендуется сначала скачать текущий бекап перед восстановлением.
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Backups List */}
            <div className="p-6 rounded-2xl bg-[#14151c] border border-zinc-800/80">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                    <FiHardDrive size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Сохранённые бекапы</h3>
                    <p className="text-xs text-zinc-500">Бекапы, сохранённые на сервере</p>
                  </div>
                </div>
                <button
                  onClick={fetchBackups}
                  className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
                  title="Обновить список"
                >
                  <FiRefreshCw size={16} className={backupsLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {backupsLoading ? (
                <div className="text-center py-8 text-zinc-500 text-sm">Загрузка...</div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8">
                  <FiDatabase size={32} className="mx-auto text-zinc-600 mb-2" />
                  <div className="text-sm text-zinc-500">Нет сохранённых бекапов</div>
                  <div className="text-xs text-zinc-600 mt-1">Скачайте бекап — он автоматически сохранится на сервере</div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800/70">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-zinc-900/60 text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Файл</th>
                        <th className="px-4 py-3">Размер</th>
                        <th className="px-4 py-3">Дата создания</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {backups.map((b, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FiFileText size={14} className={b.filename.endsWith(".sql") ? "text-emerald-400" : "text-indigo-400"} />
                              <span className="text-xs font-medium">{b.filename}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                b.filename.endsWith(".sql")
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-indigo-500/20 text-indigo-400"
                              }`}>
                                {b.filename.endsWith(".sql") ? "SQL" : "DUMP"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {b.size_bytes < 1024
                              ? `${b.size_bytes} B`
                              : b.size_bytes < 1048576
                              ? `${(b.size_bytes / 1024).toFixed(1)} KB`
                              : `${(b.size_bytes / 1048576).toFixed(2)} MB`
                            }
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Restore Confirm Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <FiAlertTriangle size={22} />
              </div>
              <h2 className="text-lg font-bold text-white">Подтверждение восстановления</h2>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <p className="text-sm text-rose-300/90 leading-relaxed">
                Вы уверены, что хотите восстановить базу данных из файла <strong className="text-white">{restoreFile?.name}</strong>?
              </p>
              <p className="text-xs text-rose-400/70 mt-2">
                ⚠️ Все текущие данные будут заменены данными из бекапа. Это действие необратимо.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition"
                disabled={backupRestoring}
              >
                Отмена
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={backupRestoring}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                {backupRestoring ? (
                  <><FiRefreshCw size={14} className="animate-spin" /> Восстановление...</>
                ) : (
                  <>Да, восстановить</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── MODALS ────────────────────────────────────────────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}

      {/* ── MODAL: CREATE USER ── */}
      {createUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiPlus className="text-indigo-400" /> Новый пользователь
              </h2>
              <button onClick={() => setCreateUserModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Имя</label>
                <input
                  type="text"
                  placeholder="Иван Иванов"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Телефон</label>
                <input
                  type="text"
                  placeholder="+996 555 123456"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Пароль *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Минимум 6 символов"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Стартовый баланс ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newUserData.initial_balance_usd}
                  onChange={(e) => setNewUserData({ ...newUserData, initial_balance_usd: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Будет начислено: ~{Math.round((newUserData.initial_balance_usd || 0) * rate)} токенов (курс $1={rate}🪙)
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateUserModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT USER ── */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiEdit2 className="text-indigo-400" /> Редактировать пользователя
              </h2>
              <button onClick={() => setEditUserModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Имя</label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Телефон</label>
                <input
                  type="text"
                  value={editUserData.phone}
                  onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Новый пароль (оставьте пустым, если не меняется)</label>
                <input
                  type="password"
                  value={editUserData.password}
                  onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Оставьте пустым"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="verified"
                  checked={editUserData.is_email_verified}
                  onChange={(e) => setEditUserData({ ...editUserData, is_email_verified: e.target.checked })}
                  className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="verified" className="text-xs text-zinc-300">Email подтвержден</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADJUST TOKENS (WITH COEFFICIENT) ── */}
      {adjustTokensModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiDollarSign className="text-amber-400" /> Управление токенами
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{adjustTokensModal.email}</p>
              </div>
              <button onClick={() => setAdjustTokensModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400">Текущий баланс:</span>
                <div className="text-xl font-extrabold text-amber-400">🪙 {adjustTokensModal.token_balance || 0} токенов</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-zinc-500">Эквивалент</span>
                <div className="text-sm font-semibold text-zinc-300">~ ${((adjustTokensModal.token_balance || 0) / rate).toFixed(2)} USD</div>
              </div>
            </div>

            <form onSubmit={handleAdjustTokensSubmit} className="space-y-4">
              {/* Action Type: Add / Deduct */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#121318] rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTokenActionType("add")}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    tokenActionType === "add"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  + Пополнить
                </button>
                <button
                  type="button"
                  onClick={() => setTokenActionType("deduct")}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    tokenActionType === "deduct"
                      ? "bg-rose-600 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  - Списать
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Сумма в долларах ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Например: 10"
                  value={tokenAmountUsd}
                  onChange={(e) => setTokenAmountUsd(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Coefficient field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-400">Ценовой коэффициент</label>
                  <span className="text-[11px] text-zinc-500">По умолчанию из .env: {adminConfig.token_price_coefficient || 1}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={tokenCoefficient}
                  onChange={(e) => setTokenCoefficient(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Расчёт: токенов = (USD * {rate}) / {currentCoeff}
                </span>
              </div>

              {/* Converted Live Preview */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <div className="flex justify-between">
                  <span>Базовый курс:</span>
                  <span className="font-bold">$1 = {rate} токенов</span>
                </div>
                <div className="flex justify-between">
                  <span>Эффективный курс (с коэфф. {currentCoeff}):</span>
                  <span className="font-bold">$1 = {(rate / currentCoeff).toFixed(2)} токенов</span>
                </div>
                <div className="flex justify-between font-bold text-amber-400 text-sm pt-1.5 border-t border-amber-500/20">
                  <span>{tokenActionType === "add" ? "Будет начислено:" : "Будет списано:"}</span>
                  <span>{tokenActionType === "add" ? `+${convertedTokensPreview}` : `-${convertedTokensPreview}`} 🪙</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Комментарий / Причина</label>
                <input
                  type="text"
                  placeholder="Например: Бонус за регистрацию / Ручное пополнение"
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAdjustTokensModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg transition ${
                    tokenActionType === "add"
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                      : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                  }`}
                >
                  {tokenActionType === "add" ? "Пополнить баланс" : "Списать токены"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PROMO CODE ── */}
      {createPromoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiGift className="text-amber-400" /> Создать промокод
              </h2>
              <button onClick={() => setCreatePromoModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Код промокода *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: SUMMER2024"
                  value={newPromoData.code}
                  onChange={(e) => setNewPromoData({ ...newPromoData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 uppercase font-mono font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Кешбек (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    placeholder="10"
                    value={newPromoData.cashback_percent}
                    onChange={(e) => setNewPromoData({ ...newPromoData, cashback_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Макс. использований *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="100"
                    value={newPromoData.max_uses}
                    onChange={(e) => setNewPromoData({ ...newPromoData, max_uses: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Начало действия</label>
                  <input
                    type="datetime-local"
                    required
                    value={newPromoData.valid_from}
                    onChange={(e) => setNewPromoData({ ...newPromoData, valid_from: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Окончание действия</label>
                  <input
                    type="datetime-local"
                    required
                    value={newPromoData.valid_until}
                    onChange={(e) => setNewPromoData({ ...newPromoData, valid_until: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                Каждый пользователь сможет применить этот промокод ровно 1 раз при оплате через FINIK.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCreatePromoModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-lg shadow-amber-600/20 transition"
                >
                  Создать промокод
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT PROMO CODE ── */}
      {editPromoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiEdit2 className="text-amber-400" /> Редактировать промокод
              </h2>
              <button onClick={() => setEditPromoModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUpdatePromo} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Код промокода</label>
                <input
                  type="text"
                  required
                  value={editPromoData.code}
                  onChange={(e) => setEditPromoData({ ...editPromoData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 uppercase font-mono font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Кешбек (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    value={editPromoData.cashback_percent}
                    onChange={(e) => setEditPromoData({ ...editPromoData, cashback_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Макс. использований</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editPromoData.max_uses}
                    onChange={(e) => setEditPromoData({ ...editPromoData, max_uses: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Начало действия</label>
                  <input
                    type="datetime-local"
                    required
                    value={editPromoData.valid_from}
                    onChange={(e) => setEditPromoData({ ...editPromoData, valid_from: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Окончание действия</label>
                  <input
                    type="datetime-local"
                    required
                    value={editPromoData.valid_until}
                    onChange={(e) => setEditPromoData({ ...editPromoData, valid_until: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="promo_active"
                  checked={editPromoData.is_active}
                  onChange={(e) => setEditPromoData({ ...editPromoData, is_active: e.target.checked })}
                  className="rounded border-zinc-700 text-amber-600 focus:ring-0"
                />
                <label htmlFor="promo_active" className="text-xs text-zinc-300">Промокод активен</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditPromoModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-lg shadow-amber-600/20 transition"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PROMO STATS ── */}
      {promoStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiBarChart2 className="text-amber-400" /> Статистика промокода: <span className="text-amber-400 font-mono">{promoStatsModal.code}</span>
                </h2>
                <p className="text-xs text-zinc-400">Кешбек {promoStatsModal.cashback_percent}% • Использовано {promoStatsModal.current_uses} из {promoStatsModal.max_uses}</p>
              </div>
              <button onClick={() => setPromoStatsModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            {promoStatsLoading ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Загрузка статистики...</div>
              </div>
            ) : !promoStatsData ? (
              <div className="text-center py-12 text-zinc-500">Нет данных</div>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 uppercase">Использований</span>
                    <div className="text-xl font-bold text-white mt-1">{promoStatsData.total_uses}</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 uppercase">Выплачено токенов</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">+{promoStatsData.total_cashback_tokens} 🪙</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 uppercase">Сумма кешбека</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">${promoStatsData.total_cashback_usd.toFixed(2)} USD</div>
                  </div>
                </div>

                {/* Usages list */}
                <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">История применений:</div>
                  {promoStatsData.usages.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">Промокод еще никто не применял</div>
                  ) : (
                    promoStatsData.usages.map((u) => (
                      <div key={u.id} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{u.user_name || u.user_email}</div>
                          <div className="text-zinc-500">{u.user_email} • {new Date(u.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-amber-400">+{u.cashback_amount_tokens} 🪙</div>
                          <div className="text-[11px] text-zinc-500">${u.cashback_amount_usd.toFixed(2)} USD</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setPromoStatsModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: UPLOAD LEGAL DOCUMENT / OFFER (PDF) ── */}
      {uploadOfferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiUploadCloud className="text-blue-400" /> Загрузить PDF документ
              </h2>
              <button onClick={() => setUploadOfferModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUploadOffer} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Тип документа *</label>
                <select
                  value={offerDocType}
                  onChange={(e) => setOfferDocType(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="user_agreement">📄 Пользовательское соглашение (User Agreement)</option>
                  <option value="privacy_policy">🔒 Политика конфиденциальности (Privacy Policy)</option>
                  <option value="offer">💳 Публичная оферта (Payment Offer)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Язык документа *</label>
                <select
                  value={offerLanguage}
                  onChange={(e) => setOfferLanguage(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 mb-2"
                >
                  <option value="ru">Русский (RU)</option>
                  <option value="en">English (EN)</option>
                  <option value="kg">Кыргызча (KG)</option>
                  <option value="kz">Қазақша (KZ)</option>
                  <option value="custom">Другой язык...</option>
                </select>

                {offerLanguage === "custom" && (
                  <input
                    type="text"
                    required
                    placeholder="Код языка (например: uz, de, es)"
                    value={offerCustomLang}
                    onChange={(e) => setOfferCustomLang(e.target.value)}
                    className="w-full bg-[#1c1e28] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Файл PDF *</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setOfferFile(e.target.files[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-[#1c1e28] border border-zinc-700/80 rounded-xl p-2"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Если документ этого типа для выбранного языка уже был загружен, он будет автоматически заменен.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setUploadOfferModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={uploadingOffer || !offerFile}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
                >
                  {uploadingOffer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Загрузка...</span>
                    </>
                  ) : (
                    <span>Загрузить</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: USER HISTORY ── */}
      {userHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161720] border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiClock className="text-indigo-400" /> История транзакций пользователя
                </h2>
                <p className="text-xs text-zinc-400">{userHistoryModal.email}</p>
              </div>
              <button onClick={() => setUserHistoryModal(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {userHistoryLoading ? (
                <div className="text-center py-12 text-zinc-500">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <div>Загрузка истории...</div>
                </div>
              ) : userHistoryList.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">У пользователя пока нет транзакций</div>
              ) : (
                userHistoryList.map((tx) => (
                  <div key={tx.id} className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          tx.type === "topup"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : tx.type === "deduction"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {tx.type === "topup" ? "Пополнение" : tx.type === "deduction" ? "Списание" : "Генерация"}
                        </span>
                        <span className="text-xs text-zinc-400">{tx.description}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
                        {tx.workflow_name && ` • Workflow: ${tx.workflow_name}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-bold ${tx.amount_tokens > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.amount_tokens > 0 ? `+${tx.amount_tokens}` : tx.amount_tokens} 🪙
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {tx.amount_usd > 0 ? `+$${tx.amount_usd.toFixed(2)}` : `-$${Math.abs(tx.amount_usd).toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setUserHistoryModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
