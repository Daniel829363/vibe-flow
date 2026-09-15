"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";
import { toast } from "react-hot-toast";
import { useAuth } from "../../lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/workflow";
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
      router.push(redirect);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = detail === "Invalid email or password"
        ? "Неверный email или пароль"
        : (detail || "Ошибка входа. Проверьте соединение с сервером.");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const axios = (await import("axios")).default;
      await axios.post("/api/auth/forgot-password", { email: forgotEmail });
      toast.success("Письмо отправлено на вашу почту");
      setForgotOpen(false);
    } catch {
      toast.error("Ошибка при отправке письма");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <span className="text-white font-black text-xl tracking-tight">
            Workflow<span className="text-blue-500">Pro</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-1">Войти в аккаунт</h1>
          <p className="text-zinc-500 text-sm text-center mb-8">Добро пожаловать обратно</p>

          {/* Google */}
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl px-4 py-3 font-semibold text-sm transition-all mb-6"
          >
            <FcGoogle size={20} />
            Продолжить через Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest">или</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                  Пароль
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest transition-colors"
                >
                  Забыли?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPwd ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-black text-sm uppercase tracking-widest transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_15px_40px_-8px_rgba(37,99,235,0.6)] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Вход...
                </span>
              ) : "Войти"}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Сброс пароля</h3>
            <p className="text-zinc-500 text-sm mb-6">Введите email — мы отправим ссылку для сброса</p>
            <form onSubmit={handleForgot} className="space-y-4">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold text-sm transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm disabled:opacity-50 transition-all"
                >
                  {forgotLoading ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

