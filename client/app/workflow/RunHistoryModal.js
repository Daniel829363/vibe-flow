"use client";

import { useState, useEffect } from "react";
import {
  HiOutlineXMark,
  HiOutlineClock,
  HiOutlineCpuChip,
  HiOutlineCircleStack,
  HiOutlineArrowPath,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from "react-icons/hi2";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useTranslation } from "workflow-builder";

export default function RunHistoryModal({ workflow, onClose }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const remoteId = workflow?.remote_workflow_id || workflow?.id;

  const fetchHistory = async (pageNumber = 1) => {
    if (!remoteId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/workflows/${remoteId}/run-history`, {
        params: { page: pageNumber, limit: 15 },
      });
      setLogs(res.data.items || []);
      setPage(res.data.page || 1);
      setTotalPages(res.data.pages || 1);
      setTotalItems(res.data.total || 0);
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          t("listing.historyFetchFailed", {}, "Не удалось загрузить историю запусков")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [remoteId]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <HiOutlineClock size={20} />
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <span>{t("listing.runHistoryTitle", {}, "История запусков")}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">
                  {totalItems}
                </span>
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-md">
                {workflow?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory(page)}
              disabled={loading}
              className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              title="Обновить"
            >
              <HiOutlineArrowPath
                size={16}
                className={loading ? "animate-spin text-blue-400" : ""}
              />
            </button>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors p-2 cursor-pointer"
            >
              <HiOutlineXMark size={20} />
            </button>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
              <span className="mt-3 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Загрузка истории...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 space-y-2">
              <HiOutlineClock size={36} className="mx-auto text-zinc-700" />
              <p className="text-sm font-semibold">История запусков пуста</p>
              <p className="text-xs text-zinc-500">
                Запуски этого процесса появятся здесь с подробной информацией о моделях и расходе токенов.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isNodeRun = log.run_type === "node";
                const isShared = log.is_shared_run;
                const paidByOwner = isShared && log.token_source === "owner";

                return (
                  <div
                    key={log.id}
                    className="p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl transition-all flex flex-col gap-3"
                  >
                    {/* Top row: Runner info + Timestamp + Type */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600/60 to-purple-600/60 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                          {(log.runner_name || log.runner_email || "U")?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold flex items-center gap-1.5">
                            {log.runner_name || log.runner_email || "Пользователь"}
                            {isShared && (
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({log.runner_email})
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isNodeRun ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-bold">
                            Нода: {log.node_label || log.node_id}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold">
                            Весь workflow
                          </span>
                        )}

                        {isShared && (
                          paidByOwner ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold" title="Токены списаны с владельца">
                              С баланса владельца
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold" title="Токены списаны с запускающего">
                              С баланса запускающего
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Middle: Models chain */}
                    {Array.isArray(log.model_chain) && log.model_chain.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                          <HiOutlineCpuChip size={12} /> Модели:
                        </span>
                        {log.model_chain.map((m, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-mono flex items-center gap-1"
                          >
                            <span>{m.model || m.label || "AI Model"}</span>
                            {m.label && m.label !== m.model && (
                              <span className="text-zinc-500">({m.label})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom: Cost & Tokens */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <HiOutlineCircleStack size={14} />
                          <span>{log.tokens_total} токенов</span>
                        </span>
                        {log.cost_usd_total > 0 && (
                          <span className="text-zinc-500 text-[11px]">
                            (${log.cost_usd_total})
                          </span>
                        )}
                      </div>

                      {log.charged_user_name && log.charged_user_id !== log.runner_id && (
                        <span className="text-[10px] text-zinc-500">
                          Списано у: <span className="text-zinc-300 font-medium">{log.charged_user_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 flex-shrink-0 bg-white/[0.01]">
            <span>
              Страница {page} из {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <HiOutlineChevronLeft size={14} />
                <span>Назад</span>
              </button>
              <button
                onClick={() => fetchHistory(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Вперёд</span>
                <HiOutlineChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
