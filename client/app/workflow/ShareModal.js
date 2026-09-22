"use client";

import { useState, useEffect } from "react";
import { HiOutlineXMark, HiOutlineUserPlus, HiOutlineTrash, HiOutlineCircleStack } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useTranslation } from "workflow-builder";

const ACCESS_CONFIG = {
  full_access: { key: "listing.shareModal.fullAccess", fallback: "Полный доступ", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  view_only:   { key: "listing.shareModal.viewOnly", fallback: "Только просмотр", color: "text-zinc-400", bg: "bg-white/5 border-white/10" },
};

export default function ShareModal({ workflow, onClose }) {
  const { t } = useTranslation();
  const [shares, setShares]           = useState([]);
  const [email, setEmail]             = useState("");
  const [accessLevel, setAccessLevel] = useState("view_only");
  const [tokenSource, setTokenSource] = useState("runner");
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);

  const remoteId = workflow?.remote_workflow_id || workflow?.id;

  const loadShares = async () => {
    if (!remoteId) return;
    try {
      const res = await axios.get(`/api/workflows/${remoteId}/shares`);
      setShares(res.data || []);
    } catch {
      toast.error(t("listing.shareModal.fetchSharesFailed", {}, "Не удалось загрузить список доступа"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, [remoteId]);

  const handleAddShare = async (e) => {
    e.preventDefault();
    if (!email) return;
    setAdding(true);
    try {
      await axios.post(`/api/workflows/${remoteId}/share`, {
        email,
        access_level: accessLevel,
        token_source: accessLevel === "full_access" ? tokenSource : "runner",
      });
      toast.success(t("listing.shareModal.accessGranted", { email }, `Доступ выдан: ${email}`));
      await loadShares();
      setEmail("");
    } catch (err) {
      toast.error(err.response?.data?.detail || t("listing.shareModal.userNotFound", {}, "Пользователь не найден"));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateTokenSource = async (share, newSource) => {
    try {
      await axios.post(`/api/workflows/${remoteId}/share`, {
        email: share.user_email,
        access_level: share.access_level,
        token_source: newSource,
      });
      toast.success(t("listing.shareModal.tokenSourceUpdated", {}, "Источник токенов обновлён"));
      await loadShares();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка при обновлении источника токенов");
    }
  };

  const handleRevoke = async (userId, userEmail) => {
    if (!window.confirm(t("listing.shareModal.confirmRevoke", { email: userEmail }, `Отозвать доступ у ${userEmail}?`))) return;
    try {
      await axios.delete(`/api/workflows/${remoteId}/share/${userId}`);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
      toast.success(t("listing.shareModal.accessRevoked", {}, "Доступ отозван"));
    } catch {
      toast.error(t("listing.shareModal.revokeFailed", {}, "Ошибка при отзыве доступа"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">{t("listing.shareModal.title", {}, "Управление доступом")}</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">{workflow?.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <HiOutlineXMark size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add user form */}
          <form onSubmit={handleAddShare} className="space-y-3">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {t("listing.shareModal.addUserLabel", {}, "Добавить пользователя по email")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("listing.shareModal.placeholder", {}, "user@example.com")}
                required
                className="flex-1 bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              >
                <option value="view_only" className="bg-zinc-900">{t("listing.shareModal.viewOnly", {}, "Просмотр")}</option>
                <option value="full_access" className="bg-zinc-900">{t("listing.shareModal.fullAccess", {}, "Полный доступ")}</option>
              </select>
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HiOutlineUserPlus size={18} />
                <span className="sm:hidden text-xs">Добавить</span>
              </button>
            </div>

            {/* Token source selection for full_access */}
            {accessLevel === "full_access" && (
              <div className="p-3 bg-white/[0.02] border border-blue-500/20 rounded-xl flex flex-col gap-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
                  <HiOutlineCircleStack size={15} />
                  <span>Источник списания токенов при запуске:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTokenSource("runner")}
                    className={`py-2 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      tokenSource === "runner"
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300 font-semibold"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div>Запускающий</div>
                    <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Тратит свои личные токены</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTokenSource("owner")}
                    className={`py-2 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      tokenSource === "owner"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold"
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div>Владелец (Вы)</div>
                    <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Оплачивается с вашего баланса</div>
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Shares list */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              {t("listing.shareModal.usersWithAccess", {}, "Пользователи с доступом")}
            </label>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-4">{t("listing.shareModal.noShares", {}, "Доступ не выдан никому")}</p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => {
                  const meta = ACCESS_CONFIG[share.access_level] || ACCESS_CONFIG.view_only;
                  const isFull = share.access_level === "full_access";
                  return (
                    <div
                      key={share.id}
                      className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex-wrap sm:flex-nowrap"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/50 to-purple-600/50 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                        {(share.user_name || share.user_email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">
                          {share.user_name || share.user_email}
                        </p>
                        {share.user_name && (
                          <p className="text-zinc-500 text-xs truncate">{share.user_email}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${meta.bg} ${meta.color}`}>
                          {t(meta.key, {}, meta.fallback)}
                        </span>

                        {isFull && (
                          <select
                            value={share.token_source || "runner"}
                            onChange={(e) => handleUpdateTokenSource(share, e.target.value)}
                            title="Чьи токены списывать при запуске"
                            className="bg-white/5 border border-white/10 hover:border-amber-500/30 text-amber-300 text-[10px] font-semibold rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value="runner" className="bg-zinc-900 text-zinc-300">Токены: запускающий</option>
                            <option value="owner" className="bg-zinc-900 text-amber-300">Токены: владелец</option>
                          </select>
                        )}

                        <button
                          onClick={() => handleRevoke(share.user_id, share.user_email)}
                          className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 cursor-pointer"
                          title="Отозвать доступ"
                        >
                          <HiOutlineTrash size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
