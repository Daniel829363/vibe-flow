"use client";

import { useState, useRef } from "react";
import { 
  HiOutlineXMark, 
  HiOutlineArrowUpTray, 
  HiOutlineLink, 
  HiOutlineTrash, 
  HiOutlinePhoto,
  HiOutlineCheck
} from "react-icons/hi2";
import { GoWorkflow } from "react-icons/go";
import { toast } from "react-hot-toast";
import axios from "axios";

export default function CoverImageModal({ workflow, onClose, onThumbnailChange }) {
  const [activeTab, setActiveTab] = useState("upload"); // "upload" | "url"
  const [urlInput, setUrlInput] = useState(workflow?.thumbnail || "");
  const [previewUrl, setPreviewUrl] = useState(workflow?.thumbnail || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const remoteId = workflow?.remote_workflow_id || workflow?.id;

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите файл изображения (PNG, JPG, WebP, GIF, SVG)");
      return;
    }
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrlInput(val);
    setPreviewUrl(val.trim());
    setSelectedFile(null);
  };

  const handleRemoveCover = async () => {
    if (!previewUrl && !workflow?.thumbnail) return;
    setSaving(true);
    try {
      await axios.delete(`/api/workflows/${remoteId}/thumbnail`);
      toast.success("Обложка удалена");
      onThumbnailChange?.(null);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка удаления обложки");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalThumbnail = null;

      if (selectedFile) {
        // Upload file
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await axios.post(`/api/workflows/${remoteId}/thumbnail/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
          },
        });
        finalThumbnail = res.data.thumbnail;
        toast.success("Обложка успешно загружена!");
      } else if (activeTab === "url" || urlInput.trim()) {
        // Set URL
        const res = await axios.post(`/api/workflows/${remoteId}/thumbnail`, {
          thumbnail: urlInput.trim() || null,
        });
        finalThumbnail = res.data.thumbnail;
        toast.success("Обложка успешно обновлена!");
      } else {
        // Nothing changed or empty
        onClose();
        return;
      }

      onThumbnailChange?.(finalThumbnail);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка сохранения обложки");
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0d0e12] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <HiOutlinePhoto size={18} />
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest">
                Обложка процесса
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[280px]">
                {workflow?.name || "Без названия"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        {/* Content Body: Left Preview, Right Controls */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-[170px_1fr] gap-6">
          {/* Left Preview: 3:4 Card Frame */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest self-start">
              Предпросмотр
            </span>
            <div className="relative w-[150px] aspect-[3/4] rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-xl flex flex-col justify-end">
              {previewUrl ? (
                <>
                  <div
                    className="absolute inset-0 bg-center bg-cover transition-all duration-300"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-700 bg-white/[0.01]">
                  <GoWorkflow size={36} />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-600">Нет обложки</span>
                </div>
              )}
              {/* Overlay card info sample */}
              <div className="relative z-10 p-3 flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-white truncate drop-shadow-md">
                  {workflow?.name || "Процесс"}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-semibold">
                  3:4 Обложка
                </span>
              </div>
            </div>
            {(previewUrl || workflow?.thumbnail) && (
              <button
                type="button"
                onClick={handleRemoveCover}
                disabled={saving}
                className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 font-semibold pt-1 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <HiOutlineTrash size={13} />
                <span>Удалить обложку</span>
              </button>
            )}
          </div>

          {/* Right Controls: Tabs + Inputs */}
          <div className="flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("upload");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "upload"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <HiOutlineArrowUpTray size={14} />
                <span>Загрузить файл</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("url");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "url"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <HiOutlineLink size={14} />
                <span>По ссылке (URL)</span>
              </button>
            </div>

            {/* Tab 1: File Upload */}
            {activeTab === "upload" && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                  className="hidden"
                />

                <div className="w-11 h-11 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                  <HiOutlineArrowUpTray size={20} />
                </div>

                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-white truncate max-w-[220px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-blue-400 mt-1 font-semibold">
                      {(selectedFile.size / 1024).toFixed(1)} KB — Нажмите для замены
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold text-zinc-200">
                      Перетащите изображение сюда
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      или нажмите для выбора файла (PNG, JPG, WebP)
                    </p>
                  </div>
                )}

                {uploadProgress > 0 && (
                  <div className="w-full mt-4 bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: URL Input */}
            {activeTab === "url" && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Прямая ссылка на изображение
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={handleUrlChange}
                  placeholder="https://images.unsplash.com/... or https://..."
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Вставьте прямую ссылку на картинку в формате JPG, PNG, WebP или GIF.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!selectedFile && activeTab === "upload" && !previewUrl)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Сохранение...
              </span>
            ) : (
              <>
                <HiOutlineCheck size={16} />
                <span>Сохранить</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
