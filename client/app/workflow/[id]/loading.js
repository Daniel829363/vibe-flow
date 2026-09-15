import React from "react";
import { GoWorkflow } from "react-icons/go";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030303] text-white selection:bg-blue-500/30">
      {/* Top Animated Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[10000] bg-white/5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 animate-progress-bar shadow-[0_0_12px_rgba(59,130,246,0.9)] progress-glow" />
      </div>

      {/* Ambient background glow */}
      <div className="absolute w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Center Loading Card */}
      <div className="relative z-10 flex flex-col items-center gap-5 p-8 rounded-3xl bg-[#0a0a0a]/80 border border-white/10 backdrop-blur-xl shadow-2xl max-w-sm w-full mx-4 text-center">
        {/* Animated Icon */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-[0_0_25px_rgba(37,99,235,0.5)]">
          <GoWorkflow className="text-white animate-pulse" size={32} />
          <div className="absolute inset-0 rounded-2xl border-2 border-blue-400/40 animate-ping opacity-25" />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-bold text-white tracking-tight">
            Загрузка рабочего процесса
          </h3>
          <p className="text-xs text-zinc-400 font-medium">
            Инициализация холста и загрузка компонентов...
          </p>
        </div>

        {/* Local Progress Bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative mt-1">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-progress-bar shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </div>
      </div>
    </div>
  );
}
