"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiCheckCircle, HiXCircle } from "react-icons/hi2";
import axios from "axios";
import Link from "next/link";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) { setStatus("error"); return; }

    axios.post("/api/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <span className="text-white font-black text-xl tracking-tight">
            Workflow<span className="text-blue-500">Pro</span>
          </span>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-2xl">
          {status === "loading" && (
            <>
              <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Проверяем токен...</p>
            </>
          )}
          {status === "success" && (
            <>
              <HiCheckCircle size={56} className="text-green-400 mx-auto mb-4" />
              <h1 className="text-2xl font-black text-white mb-2">Email подтверждён!</h1>
              <p className="text-zinc-500 text-sm mb-8">Ваш аккаунт успешно верифицирован</p>
              <Link
                href="/workflow"
                className="inline-block bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-3 font-black text-sm uppercase tracking-widest transition-all"
              >
                Перейти к процессам
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <HiXCircle size={56} className="text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-black text-white mb-2">Ссылка недействительна</h1>
              <p className="text-zinc-500 text-sm mb-8">Токен истёк или уже использован</p>
              <Link
                href="/auth/login"
                className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl px-8 py-3 font-black text-sm uppercase tracking-widest transition-all"
              >
                Вернуться к входу
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
