"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineEnvelope, HiOutlineArrowPath } from "react-icons/hi2";
import { FiLogOut, FiCheck } from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../../lib/auth";

export default function EmailConfirmationPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);

  // If user is already verified or verification is not required, redirect
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
      return;
    }
    if (user && (user.is_email_verified || !user.require_email_verification)) {
      router.replace("/workflow");
    }
  }, [user, loading, router]);

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try {
      await axios.post("/api/auth/resend-verification");
      setResent(true);
    } catch (err) {
      console.error("Resend failed:", err);
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const userData = await refreshUser();
      if (userData?.is_email_verified) {
        router.replace("/workflow");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-amber-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />

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
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-2xl text-center">
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <HiOutlineEnvelope size={36} className="text-amber-400" />
          </div>

          <h1 className="text-2xl font-black text-white mb-2">
            Подтвердите ваш Email
          </h1>
          <p className="text-zinc-400 text-sm mb-2 leading-relaxed">
            Мы отправили письмо с ссылкой для подтверждения на
          </p>
          <p className="text-white font-bold text-base mb-6 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10 inline-block">
            {user.email}
          </p>

          <p className="text-zinc-500 text-xs mb-8 leading-relaxed">
            Перейдите по ссылке в письме, чтобы подтвердить аккаунт и получить доступ к платформе.
            Проверьте также папку «Спам».
          </p>

          {/* Actions */}
          <div className="space-y-3">
            {/* Resend */}
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-sm uppercase tracking-widest transition-all ${
                resent
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
            >
              {resent ? (
                <>
                  <FiCheck size={16} />
                  Письмо отправлено!
                </>
              ) : resending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <HiOutlineEnvelope size={16} />
                  Отправить письмо повторно
                </>
              )}
            </button>

            {/* Check status */}
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-sm uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
            >
              {checking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <HiOutlineArrowPath size={16} />
                  Я уже подтвердил
                </>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-zinc-500 hover:text-zinc-300 text-xs font-medium uppercase tracking-widest transition-all"
            >
              <FiLogOut size={14} />
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
