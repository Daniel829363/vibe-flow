"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { toast } from "react-hot-toast";
import { useAuth } from "../../../lib/auth";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleGoogleCallback, completeGoogleRegistration } = useAuth();

  const [requiresPhone, setRequiresPhone]   = useState(false);
  const [googleToken, setGoogleToken]       = useState("");
  const [googleUser, setGoogleUser]         = useState(null);
  const [phone, setPhone]                   = useState("");
  const [loading, setLoading]               = useState(true);
  const [submitting, setSubmitting]         = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      toast.error("Ошибка авторизации через Google");
      router.push("/auth/login");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/google/callback`;

    handleGoogleCallback(code, redirectUri)
      .then((result) => {
        if (result.requiresPhone) {
          setRequiresPhone(true);
          setGoogleToken(result.googleToken);
          setGoogleUser(result.googleUser);
          setLoading(false);
        } else {
          toast.success("Добро пожаловать!");
          router.push("/workflow");
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || "Ошибка входа через Google");
        router.push("/auth/login");
      });
  }, []);

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (!phone) {
      toast.error("Введите номер телефона");
      return;
    }
    setSubmitting(true);
    try {
      await completeGoogleRegistration(googleToken, phone);
      toast.success("Добро пожаловать!");
      router.push("/workflow");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Ошибка завершения регистрации");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] animate-pulse">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest animate-pulse">
            Авторизация через Google...
          </p>
        </div>
      </div>
    );
  }

  // Phone number required for new Google users
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
          {/* Google User Info */}
          {googleUser?.avatar_url && (
            <div className="flex justify-center mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={googleUser.avatar_url}
                alt={googleUser.name}
                className="w-16 h-16 rounded-full border-2 border-white/10"
              />
            </div>
          )}

          <h1 className="text-xl font-black text-white text-center mb-1">
            Один последний шаг
          </h1>
          <p className="text-zinc-500 text-sm text-center mb-2">
            Привет, <span className="text-white font-semibold">{googleUser?.name || googleUser?.email}</span>!
          </p>
          <p className="text-zinc-600 text-xs text-center mb-8">
            Для завершения регистрации укажите номер телефона
          </p>

          <form onSubmit={handleCompleteRegistration} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Номер телефона
              </label>
              <input
                id="google-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 000-00-00"
                autoFocus
                required
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            <button
              id="google-complete-submit"
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-black text-sm uppercase tracking-widest transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Создание аккаунта...
                </span>
              ) : "Завершить регистрацию"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
