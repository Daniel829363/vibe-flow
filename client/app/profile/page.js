"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineEnvelope, HiOutlinePhone, HiArrowLeft, HiOutlineCheckCircle } from "react-icons/hi2";
import { HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import axios from "axios";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useTranslation, LanguageSwitcher } from "workflow-builder";

const Section = ({ icon, title, children }) => (
  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
      <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <h2 className="font-black text-white text-sm uppercase tracking-widest">{title}</h2>
    </div>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input
    {...props}
    className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none transition-all"
  />
);

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  // Profile form
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Email form
  const [newEmail, setNewEmail]     = useState("");
  const [emailPwd, setEmailPwd]     = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password form
  const [oldPwd, setOldPwd]     = useState("");
  const [newPwd, setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user, authLoading, isAuthenticated, router]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const res = await axios.put("/api/profile/", { name, phone });
      updateUser(res.data);
      toast.success(t("profile.profileUpdated", {}, "Профиль обновлён"));
    } catch (err) {
      toast.error(err.response?.data?.detail || t("common.error", {}, "Ошибка обновления профиля"));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const res = await axios.put("/api/profile/email", { email: newEmail, password: emailPwd });
      updateUser(res.data.user);
      setNewEmail("");
      setEmailPwd("");
      toast.success(t("profile.emailUpdated", {}, "Email обновлён. Проверьте почту для верификации."));
    } catch (err) {
      toast.error(err.response?.data?.detail || t("common.error", {}, "Ошибка смены email"));
    } finally {
      setEmailLoading(false);
    }
  };

  const hasPassword = user?.has_password ?? !user?.google_id;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error(t("auth.passwordsMismatch", {}, "Пароли не совпадают"));
      return;
    }
    if (newPwd.length < 8) {
      toast.error(t("auth.passwordMinLength", {}, "Минимум 8 символов"));
      return;
    }
    setPwdLoading(true);
    try {
      const payload = { new_password: newPwd };
      if (hasPassword) {
        payload.old_password = oldPwd;
      }
      const res = await axios.put("/api/profile/password", payload);
      if (res.data?.user) {
        updateUser(res.data.user);
      } else {
        updateUser({ ...user, has_password: true });
      }
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
      toast.success(hasPassword ? t("profile.passwordChanged", {}, "Пароль изменён") : t("profile.passwordSet", {}, "Пароль успешно установлен"));
    } catch (err) {
      toast.error(err.response?.data?.detail || t("common.error", {}, "Ошибка сохранения пароля"));
    } finally {
      setPwdLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#030303] text-white overflow-x-hidden">
      {/* Background */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Link
              href="/workflow"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <HiArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                {t("profile.title", {}, "Личный кабинет")}
              </h1>
              <p className="text-zinc-500 text-sm mt-1">{t("profile.subtitle", {}, "Управление профилем и настройками")}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Avatar & Identity */}
        <div className="flex items-center gap-5 mb-8 p-6 bg-white/[0.02] border border-white/10 rounded-2xl">
          <div className="relative">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.name} className="w-16 h-16 rounded-full border-2 border-white/10" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            {user?.is_email_verified && (
              <HiOutlineCheckCircle size={20} className="absolute -bottom-1 -right-1 text-green-400 bg-[#030303] rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg truncate">{user?.name || t("common.unnamed", {}, "Без имени")}</p>
            <p className="text-zinc-500 text-sm truncate">{user?.email}</p>
            <div className="flex items-center gap-3 mt-1">
              {user?.is_email_verified ? (
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">
                  ✓ {t("profile.emailVerified", {}, "Email подтверждён")}
                </span>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await axios.post("/api/auth/resend-verification");
                      toast.success(t("profile.verificationSent", {}, "Письмо отправлено"));
                    } catch { toast.error(t("common.error", {}, "Ошибка")); }
                  }}
                  className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-widest transition-colors"
                >
                  ⚠ {t("profile.emailNotVerified", {}, "Email не подтверждён — Отправить снова")}
                </button>
              )}
              {user?.google_id && (
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Google</span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-widest transition-all"
          >
            {t("profile.logout", {}, "Выйти")}
          </button>
        </div>

        {/* Token Balance & Admin Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-5 bg-white/[0.02] border border-amber-500/20 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span>🪙</span> {t("profile.tokenBalance", {}, "Баланс токенов")}
              </div>
              <div className="text-2xl font-black text-white">
                {user?.token_balance ?? 0} <span className="text-sm font-normal text-amber-400">{t("profile.tokensCount", {}, "токенов")}</span>
              </div>
            </div>
            <Link
              href="/tokens"
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider transition-all"
            >
              {t("profile.historyBtn", {}, "История")}
            </Link>
          </div>

          {user?.is_superadmin && (
            <div className="p-5 bg-white/[0.02] border border-indigo-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>🛡️</span> {t("profile.adminBadge", {}, "Администратор")}
                </div>
                <div className="text-sm font-bold text-white">
                  {t("profile.fullAccess", {}, "Полный доступ к системе")}
                </div>
              </div>
              <Link
                href="/admin"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all"
              >
                {t("profile.adminBtn", {}, "Админка")}
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">

          {/* Profile Info */}
          <Section icon={<HiOutlineUser size={16} />} title={t("profile.personalData", {}, "Личные данные")}>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <Field label={t("profile.name", {}, "Имя")}>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profile.namePlaceholder", {}, "Ваше имя")}
                />
              </Field>
              <Field label={t("profile.phone", {}, "Номер телефона")}>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("profile.phonePlaceholder", {}, "+7 (999) 000-00-00")}
                />
              </Field>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  {profileLoading ? t("profile.saving", {}, "Сохранение...") : t("profile.saveBtn", {}, "Сохранить")}
                </button>
              </div>
            </form>
          </Section>

          {/* Change Email */}
          <Section icon={<HiOutlineEnvelope size={16} />} title={t("profile.changeEmail", {}, "Изменить Email")}>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <Field label={t("profile.currentEmail", {}, "Текущий email")}>
                <Input type="email" value={user?.email || ""} disabled className="opacity-50 cursor-not-allowed" />
              </Field>
              <Field label={t("profile.newEmail", {}, "Новый email")}>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                  required
                />
              </Field>
              <Field label={t("profile.confirmCurrentPassword", {}, "Текущий пароль (для подтверждения)")}>
                <Input
                  type="password"
                  value={emailPwd}
                  onChange={(e) => setEmailPwd(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder", {}, "Введите пароль")}
                  required
                />
              </Field>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  {emailLoading ? t("profile.saving", {}, "Обновление...") : t("profile.updateEmailBtn", {}, "Обновить Email")}
                </button>
              </div>
            </form>
          </Section>

          {/* Change or Set Password */}
          <Section
            icon={<HiOutlineLockClosed size={16} />}
            title={hasPassword ? t("profile.changePassword", {}, "Изменить пароль") : t("profile.setPassword", {}, "Установить пароль")}
          >
            {!hasPassword && (
              <p className="text-zinc-400 text-xs mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl leading-relaxed">
                {t("profile.googleAccountNote", {}, "Ваш аккаунт создан через Google. Установите пароль, чтобы использовать вход по email.")}
              </p>
            )}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {hasPassword && (
                <Field label={t("profile.currentPassword", {}, "Текущий пароль")}>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={oldPwd}
                      onChange={(e) => setOldPwd(e.target.value)}
                      placeholder={t("profile.currentPassword", {}, "Текущий пароль")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPwd ? <HiOutlineEyeSlash size={16} /> : <HiOutlineEye size={16} />}
                    </button>
                  </div>
                </Field>
              )}
              <Field label={hasPassword ? t("profile.newPassword", {}, "Новый пароль") : t("profile.newPassword", {}, "Пароль")}>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder={t("auth.passwordMinLength", {}, "Минимум 8 символов")}
                    required
                  />
                  {!hasPassword && (
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPwd ? <HiOutlineEyeSlash size={16} /> : <HiOutlineEye size={16} />}
                    </button>
                  )}
                </div>
              </Field>
              <Field label={hasPassword ? t("profile.confirmNewPassword", {}, "Подтвердить новый пароль") : t("profile.confirmNewPassword", {}, "Подтвердить пароль")}>
                <Input
                  type={showPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder={t("auth.confirmPasswordPlaceholder", {}, "Повторите пароль")}
                  required
                />
              </Field>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {pwdLoading
                    ? t("profile.saving", {}, "Сохранение...")
                    : hasPassword
                    ? t("profile.changePasswordBtn", {}, "Изменить пароль")
                    : t("profile.setPasswordBtn", {}, "Установить пароль")}
                </button>
              </div>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}

