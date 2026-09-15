"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import axios from "axios";
import Link from "next/link";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Пароли не совпадают"); return; }
    if (password.length < 8)  { toast.error("Минимум 8 символов"); return; }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { token, new_password: password });
      setDone(true);
      toast.success("Пароль успешно изменён");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ссылка недействительна или истекла");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="relative min-h-screen bg-[#030303] flex items-center justify-center">
        <p className="text-zinc-500">Недействительная ссылка</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <span className="text-white font-black text-xl tracking-tight">
            Workflow<span className="text-blue-500">Pro</span>
          </span>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-1">Новый пароль</h1>
          <p className="text-zinc-500 text-sm text-center mb-8">Введите новый пароль для аккаунта</p>

          {done ? (
            <div className="text-center space-y-4">
              <p className="text-green-400 font-bold">Пароль успешно изменён!</p>
              <Link
                href="/auth/login"
                className="inline-block bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-3 font-black text-sm uppercase tracking-widest transition-all"
              >
                Войти
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Новый пароль</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 8 символов"
                    required
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                    {showPwd ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Подтвердить пароль</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  required
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-black text-sm uppercase tracking-widest transition-all"
              >
                {loading ? "Сохранение..." : "Сохранить пароль"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
