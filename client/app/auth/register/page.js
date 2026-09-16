"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";
import { FiCheck } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useAuth } from "../../lib/auth";
import { useTranslation, LanguageSwitcher } from "workflow-builder";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const { t } = useTranslation();

  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [agreeLegal, setAgreeLegal]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      const msg = t("auth.passwordsMismatch", {}, "Пароли не совпадают");
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password.length < 8) {
      const msg = t("auth.passwordMinLength", {}, "Пароль должен быть не менее 8 символов");
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!agreeLegal) {
      const msg = t("auth.agreeLegalRequired", {}, "Пожалуйста, подтвердите согласие с Пользовательским соглашением, Политикой конфиденциальности и Публичной офертой");
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name, phone);
      toast.success(t("auth.accountCreatedVerify", {}, "Аккаунт создан! Проверьте почту для верификации."));
      router.push("/workflow");
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = detail === "Email already registered"
        ? t("auth.alreadyRegistered", {}, "Пользователь с таким email уже зарегистрирован")
        : (detail || t("auth.registrationError", {}, "Ошибка при регистрации. Проверьте данные."));
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center overflow-hidden py-12">
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 hover:opacity-90 transition">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <span className="text-white font-black text-xl tracking-tight">
            {t("landing.brandName", {}, "Workflow")}<span className="text-blue-500">{t("landing.brandSuffix", {}, "Pro")}</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-1">{t("auth.registerTitle", {}, "Создать аккаунт")}</h1>
          <p className="text-zinc-500 text-sm text-center mb-8">{t("auth.registerSubtitle", {}, "Присоединяйтесь к Vibe Workflow")}</p>

          {/* Google */}
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl px-4 py-3 font-semibold text-sm transition-all mb-6"
          >
            <FcGoogle size={20} />
            {t("auth.googleContinue", {}, "Продолжить через Google")}
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest">{t("auth.or", {}, "или")}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                {t("auth.nameLabel", {}, "Имя")}
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.namePlaceholder", {}, "Ваше имя")}
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                {t("auth.emailLabel", {}, "Email")}
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder", {}, "you@example.com")}
                required
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                {t("auth.phoneLabel", {}, "Номер телефона")}
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phonePlaceholder", {}, "+7 (999) 000-00-00")}
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                {t("auth.passwordLabel", {}, "Пароль")}
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordMinLength", {}, "Минимум 8 символов")}
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

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                {t("auth.confirmPasswordLabel", {}, "Подтвердить пароль")}
              </label>
              <input
                id="reg-confirm"
                type={showPwd ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("auth.confirmPasswordPlaceholder", {}, "Повторите пароль")}
                required
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
              />
            </div>

            {/* Terms & Privacy Agreement Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none group py-1">
              <div className="relative flex items-center pt-0.5">
                <input
                  id="reg-agree-legal"
                  type="checkbox"
                  checked={agreeLegal}
                  onChange={(e) => setAgreeLegal(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    agreeLegal
                      ? "bg-blue-600 border-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                      : "border-white/20 bg-white/5 group-hover:border-white/40"
                  }`}
                >
                  {agreeLegal && <FiCheck size={11} className="text-white stroke-[3]" />}
                </div>
              </div>
              <span className="text-xs text-zinc-400 leading-relaxed">
                {t("auth.agreePrefix", {}, "Я согласен с")}{" "}
                <a
                  href="/legal?type=user_agreement"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
                >
                  {t("auth.userAgreement", {}, "Пользовательским соглашением")}
                </a>
                ,{" "}
                <a
                  href="/legal?type=privacy_policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
                >
                  {t("auth.privacyPolicy", {}, "Политикой конфиденциальности")}
                </a>{" "}
                {t("auth.and", {}, "и")}{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
                >
                  {t("auth.publicOffer", {}, "Публичной офертой")}
                </a>
              </span>
            </label>

            <button
              id="reg-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-black text-sm uppercase tracking-widest transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("auth.registering", {}, "Создание аккаунта...")}
                </span>
              ) : t("auth.registerBtn", {}, "Зарегистрироваться")}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            {t("auth.haveAccount", {}, "Уже есть аккаунт?")}{" "}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              {t("auth.signIn", {}, "Войти")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

