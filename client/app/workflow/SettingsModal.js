"use client";

import { useState } from "react";
import { HiOutlineXMark, HiOutlineGlobeAlt, HiOutlineLockClosed } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useTranslation } from "workflow-builder";

export default function SettingsModal({ workflow, onClose, onVisibilityChange, onOpenCoverModal }) {
  const { t } = useTranslation();
  const [visibility, setVisibility] = useState(
    workflow?.visibility === "public" ? "public" : "private"
  );
  const [saving, setSaving] = useState(false);

  const remoteId = workflow?.remote_workflow_id || workflow?.id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`/api/workflows/${remoteId}/visibility`, { visibility });
      toast.success(
        visibility === "public"
          ? t("listing.settingsModal.nowPublicToast", {}, "Процесс теперь публичный")
          : t("listing.settingsModal.nowPrivateToast", {}, "Процесс теперь приватный")
      );
      onVisibilityChange?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t("listing.settingsModal.visibilityErrorToast", {}, "Ошибка изменения видимости"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">{t("listing.settingsModal.title", {}, "Настройка")}</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[200px]">{workflow?.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <HiOutlineXMark size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{t("listing.settingsModal.visibility", {}, "Видимость")}</p>

          {/* Private option */}
          <button
            onClick={() => setVisibility("private")}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${visibility === "private"
                ? "bg-blue-600/10 border-blue-500/40"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
              }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${visibility === "private" ? "bg-blue-600/20 text-blue-400" : "bg-white/5 text-zinc-500"
              }`}>
              <HiOutlineLockClosed size={18} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{t("listing.settingsModal.private", {}, "Приватный")}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t("listing.settingsModal.privateDesc", {}, "Доступен только вам и тем, кому вы выдали доступ")}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 ml-auto mt-1 flex-shrink-0 ${visibility === "private" ? "border-blue-500 bg-blue-500" : "border-zinc-600"
              }`} />
          </button>

          {/* Public option */}
          <button
            onClick={() => setVisibility("public")}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${visibility === "public"
                ? "bg-green-600/10 border-green-500/40"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
              }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${visibility === "public" ? "bg-green-600/20 text-green-400" : "bg-white/5 text-zinc-500"
              }`}>
              <HiOutlineGlobeAlt size={18} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{t("listing.settingsModal.public", {}, "Публичный")}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t("listing.settingsModal.publicDesc", {}, "Виден всем в разделе «Публичные». Только просмотр и копирование")}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 ml-auto mt-1 flex-shrink-0 ${visibility === "public" ? "border-green-500 bg-green-500" : "border-zinc-600"
              }`} />
          </button>

          {/* Cover image section */}
          {onOpenCoverModal && (
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{t("listing.settingsModal.coverSection", {}, "Обложка процесса")}</p>
                  <p className="text-zinc-500 text-[11px]">
                    {workflow?.thumbnail ? t("listing.settingsModal.coverSet", {}, "Обложка установлена") : t("listing.settingsModal.defaultIcon", {}, "Стандартная иконка")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCoverModal(workflow);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-blue-400 hover:text-blue-300 transition-all cursor-pointer"
                >
                  {workflow?.thumbnail ? t("common.edit", {}, "Изменить") : t("listing.settingsModal.addCover", {}, "Добавить")}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest transition-all"
            >
              {t("common.discard", {}, "Отмена")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || visibility === (workflow?.visibility || "private")}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest transition-all"
            >
              {saving ? t("listing.settingsModal.saving", {}, "Сохранение...") : t("common.save", {}, "Сохранить")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
