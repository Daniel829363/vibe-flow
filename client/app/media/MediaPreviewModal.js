"use client";

import React, { useEffect } from "react";
import { useTranslation } from "workflow-builder";
import {
  FiX,
  FiDownload,
  FiCopy,
  FiTrash2,
  FiFile,
  FiImage,
  FiVideo,
  FiMusic,
  FiExternalLink,
  FiCalendar,
  FiHardDrive,
  FiLayers,
} from "react-icons/fi";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(isoString, locale = "ru") {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function MediaPreviewModal({
  file,
  isOpen,
  onClose,
  onDelete,
  onCopyUrl,
  onDownload,
}) {
  const { t, locale } = useTranslation();

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload(file.url, file.filename);
    } else {
      const dlUrl = `/api/media/download?url=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(file.filename || "download")}`;
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = file.filename || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const typeIcon = {
    image: <FiImage className="text-purple-400" size={18} />,
    video: <FiVideo className="text-blue-400" size={18} />,
    audio: <FiMusic className="text-emerald-400" size={18} />,
    other: <FiFile className="text-zinc-400" size={18} />,
  }[file.file_type] || <FiFile className="text-zinc-400" size={18} />;

  const isAI = file.source === "generation";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0f1015] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#14161f]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
              {typeIcon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md" title={file.filename}>
                {file.filename}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isAI
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                  {isAI ? t("media.previewModal.aiGeneration", {}, "✨ AI Генерация") : t("media.previewModal.upload", {}, "📤 Загрузка")}
                </span>
                <span>•</span>
                <span>{formatBytes(file.size_bytes)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition shrink-0"
            title={t("media.previewModal.closeTooltip", {}, "Закрыть (Esc)")}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* ── Media Content Area ── */}
        <div className="flex-1 overflow-auto bg-[#07080a] flex items-center justify-center min-h-[300px] max-h-[62vh] p-4 sm:p-8 relative">
          {file.file_type === "image" && (
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.filename}
                className="max-w-full max-h-[58vh] object-contain rounded-xl shadow-2xl transition-all"
              />
            </div>
          )}

          {file.file_type === "video" && (
            <div className="w-full max-w-4xl flex items-center justify-center">
              <video
                src={file.url}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[58vh] rounded-xl shadow-2xl bg-black"
              >
                {t("media.previewModal.videoUnsupported", {}, "Ваш браузер не поддерживает воспроизведение видео.")}
              </video>
            </div>
          )}

          {file.file_type === "audio" && (
            <div className="w-full max-w-md p-8 rounded-2xl bg-[#14151e] border border-white/10 flex flex-col items-center text-center shadow-xl space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <FiMusic size={36} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-white text-base truncate max-w-xs">{file.filename}</h4>
                <p className="text-xs text-zinc-400">{t("media.audioRecording", {}, "Аудиозапись")}</p>
              </div>
              <audio src={file.url} controls autoPlay className="w-full">
                {t("media.previewModal.audioUnsupported", {}, "Ваш браузер не поддерживает аудио.")}
              </audio>
            </div>
          )}

          {file.file_type === "other" && (
            <div className="w-full max-w-md p-8 rounded-2xl bg-[#14151e] border border-white/10 flex flex-col items-center text-center shadow-xl space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <FiFile size={36} />
              </div>
              <div>
                <h4 className="font-semibold text-white text-base truncate max-w-xs">{file.filename}</h4>
                <p className="text-xs text-zinc-400 mt-1">{file.mime_type || t("media.previewModal.docFile", {}, "Файл документа / данных")}</p>
              </div>
              <button
                onClick={handleDownloadClick}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition flex items-center gap-2"
              >
                <FiDownload size={16} /> {t("media.previewModal.downloadFile", {}, "Скачать файл")}
              </button>
            </div>
          )}
        </div>

        {/* ── Modal Footer & Actions ── */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#12131b] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          {/* File Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-zinc-400">
            <div className="flex items-center gap-1.5" title={t("media.previewModal.dateTooltip", {}, "Дата добавления")}>
              <FiCalendar size={14} className="text-zinc-500" />
              <span>{formatDate(file.created_at, locale)}</span>
            </div>
            {file.size_bytes ? (
              <div className="flex items-center gap-1.5" title={t("media.previewModal.sizeTooltip", {}, "Размер файла")}>
                <FiHardDrive size={14} className="text-zinc-500" />
                <span>{formatBytes(file.size_bytes)}</span>
              </div>
            ) : null}
            {file.workflow_name ? (
              <div className="flex items-center gap-1.5 text-blue-400" title={t("media.previewModal.workflowTooltip", {}, "Привязанный процесс")}>
                <FiLayers size={14} />
                <span className="truncate max-w-[200px]">{file.workflow_name}</span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onCopyUrl(file.url)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-zinc-200 font-medium transition flex items-center gap-1.5"
              title={t("media.copyLink", {}, "Скопировать прямую ссылку")}
            >
              <FiCopy size={14} />
              <span>{t("media.previewModal.copyUrl", {}, "Копировать URL")}</span>
            </button>

            <button
              onClick={handleDownloadClick}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              title={t("media.previewModal.download", {}, "Скачать файл")}
            >
              <FiDownload size={14} />
              <span>{t("media.previewModal.download", {}, "Скачать")}</span>
            </button>

            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition"
              title={t("media.previewModal.openInNewTab", {}, "Открыть в новой вкладке")}
            >
              <FiExternalLink size={16} />
            </a>

            <button
              onClick={() => onDelete(file.id)}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition"
              title={t("media.previewModal.deleteFile", {}, "Удалить файл")}
            >
              <FiTrash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

