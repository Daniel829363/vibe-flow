"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../lib/auth";
import { useTranslation, LanguageSwitcher, localizeTransactionDescription } from "workflow-builder";
import {
  FiDollarSign,
  FiActivity,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiArrowLeft,
  FiRefreshCw,
  FiLayers,
  FiInfo,
  FiCreditCard,
  FiCheck,
  FiX,
  FiGift,
  FiFileText,
  FiExternalLink,
} from "react-icons/fi";

export default function TokensPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [balanceData, setBalanceData] = useState({ token_balance: 0, usd_equivalent: 0, rate: 100 });
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("all"); // "all" | "admin" | "usage"
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalTx, setTotalTx] = useState(0);
  const hasLoaded = useRef(false);

  // ── Payment Modal State ──
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("finik");
  const [promoCode, setPromoCode] = useState("");
  const [promoValidated, setPromoValidated] = useState(null); // { valid, cashback_percent }
  const [promoLoading, setPromoLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // ── Fetch Balance ──
  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await axios.get("/api/tokens/balance");
      setBalanceData(res.data);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // ── Fetch Transactions ──
  const fetchTransactions = useCallback(async (category, pg) => {
    setTxLoading(true);
    try {
      const res = await axios.get("/api/tokens/transactions", {
        params: {
          category: category === "all" ? undefined : category,
          page: pg,
          limit: 20,
        },
      });
      setTransactions(res.data.transactions || []);
      setTotalTx(res.data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("tokens.loadingTransactions", {}, "Ошибка загрузки истории операций"));
    } finally {
      setTxLoading(false);
    }
  }, [t]);

  // ── Initial load (runs once when user is available) ──
  useEffect(() => {
    if (user && !hasLoaded.current) {
      hasLoaded.current = true;
      fetchBalance();
      fetchTransactions(activeCategory, page);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch transactions when category or page changes ──
  useEffect(() => {
    if (hasLoaded.current) {
      fetchTransactions(activeCategory, page);
    }
  }, [activeCategory, page, fetchTransactions]);

  // ── Validate Promo Code ──
  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoValidated(null);
    try {
      const res = await axios.post("/api/payment/promo/validate", { code: promoCode.trim() });
      setPromoValidated(res.data);
      toast.success(t("tokens.promoSuccess", { percent: res.data.cashback_percent }, `Промокод принят! Кешбек: ${res.data.cashback_percent}%`));
    } catch (err) {
      toast.error(err.response?.data?.detail || t("tokens.promoInvalid", {}, "Промокод недействителен"));
      setPromoValidated(null);
    } finally {
      setPromoLoading(false);
    }
  };

  // ── Submit Payment ──
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!agreeTerms) {
      toast.error(t("tokens.agreeTermsError", {}, "Необходимо согласиться с условиями оплаты"));
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (!amount || amount < 0.01) {
      toast.error(t("tokens.minAmountError", {}, "Минимальная сумма: $0.01"));
      return;
    }
    setPaymentLoading(true);
    try {
      const res = await axios.post("/api/payment/finik/create", {
        amount_usd: amount,
        promo_code: promoValidated?.valid ? promoCode.trim() : undefined,
      });
      // Redirect to payment URL
      if (res.data.payment_url) {
        window.open(res.data.payment_url, "_blank");
        toast.success(t("tokens.linkOpened", {}, "Ссылка на оплату открыта в новой вкладке"));
        setPaymentModal(false);
        resetPaymentForm();
      } else {
        toast.error(t("tokens.paymentError", {}, "Не удалось получить ссылку на оплату"));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t("tokens.paymentError", {}, "Ошибка создания платежа"));
    } finally {
      setPaymentLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPromoCode("");
    setPromoValidated(null);
    setAgreeTerms(false);
    setPaymentProvider("finik");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          <p className="text-sm">{t("dashboard.loading", {}, "Загрузка данных...")}</p>
        </div>
      </div>
    );
  }

  const rate = balanceData.rate || 100;
  const baseRate = balanceData.base_rate || 100;
  const balance = balanceData.token_balance ?? user.token_balance ?? 0;
  const usdEquiv = balanceData.usd_equivalent !== undefined ? Number(balanceData.usd_equivalent).toFixed(2) : (balance / baseRate).toFixed(2);

  const previewTokens = paymentAmount ? (parseFloat(paymentAmount) * rate).toFixed(0) : "0";
  const previewCashback = paymentAmount && promoValidated?.valid
    ? (parseFloat(paymentAmount) * rate * promoValidated.cashback_percent / 100).toFixed(0)
    : "0";

  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 font-sans selection:bg-amber-500/30">
      <Toaster position="top-right" toastOptions={{ style: { background: "#181920", color: "#fff", border: "1px solid #2e303d" } }} />

      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#121318]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow")}
              className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
              title={t("builder.backToWorkflows", {}, "Назад к процессам")}
            >
              <FiArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <span className="text-lg">🪙</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{t("tokens.title", {}, "Мой баланс и токены")}</h1>
              <p className="text-xs text-zinc-400">{t("tokens.subtitle", {}, "История начислений, списаний и расходов")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => { setPaymentModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold transition shadow-lg shadow-emerald-500/20"
            >
              <FiCreditCard size={16} />
              <span>{t("tokens.topUpBtn", {}, "Пополнить")}</span>
            </button>
            <button
              onClick={() => { fetchBalance(); fetchTransactions(activeCategory, page); }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-medium transition"
            >
              <FiRefreshCw size={14} className={balanceLoading || txLoading ? "animate-spin" : ""} />
              <span>{t("tokens.refresh", {}, "Обновить")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Balance Card Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#181924] via-[#14151e] to-[#121319] border border-amber-500/20 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span>🪙</span> {t("tokens.availableBalance", {}, "Доступный баланс токенов")}
              </span>
              <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                <span>{balance.toLocaleString()}</span>
                <span className="text-xl font-medium text-amber-400">{t("tokens.tokensWord", {}, "токенов")}</span>
              </div>
              <div className="text-sm text-zinc-400 mt-2 flex items-center gap-2">
                <span>{t("tokens.equivalent", {}, "Эквивалент:")}</span>
                <span className="font-semibold text-emerald-400">~ ${usdEquiv} USD</span>
                <span className="text-zinc-600">•</span>
                <span className="text-xs text-zinc-500">{t("tokens.rateDesc", { rate }, `Курс: $1 = ${rate} токенов`)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setPaymentModal(true); }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-bold transition shadow-xl shadow-emerald-500/20"
              >
                <FiCreditCard size={18} />
                {t("tokens.topUpBalance", {}, "Пополнить баланс")}
              </button>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                  <FiInfo className="text-amber-400" size={14} /> {t("tokens.howTokensWork", {}, "Как работают токены?")}
                </div>
                <p>{t("tokens.tokensWorkDesc", {}, "Токены списываются при генерации контента в AI нодах и запуске workflows.")}</p>
              </div>
            </div>
          </div>

          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Transactions Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FiActivity className="text-indigo-400" /> {t("tokens.transactionsHistory", {}, "История операций")}
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#14151c] rounded-xl border border-zinc-800 text-xs">
              <button
                onClick={() => { setActiveCategory("all"); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeCategory === "all"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t("tokens.filterAll", { count: totalTx }, `Все (${totalTx})`)}
              </button>
              <button
                onClick={() => { setActiveCategory("admin"); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeCategory === "admin"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t("tokens.filterAdmin", {}, "Пополнения / Списания")}
              </button>
              <button
                onClick={() => { setActiveCategory("usage"); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeCategory === "usage"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t("tokens.filterUsage", {}, "Использование в процессах")}
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <div className="rounded-2xl bg-[#14151c] border border-zinc-800/80 overflow-hidden shadow-xl">
            {txLoading ? (
              <div className="text-center py-16 text-zinc-500">
                <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>{t("tokens.loadingTransactions", {}, "Загрузка истории операций...")}</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 space-y-2">
                <div className="text-2xl">🪙</div>
                <div className="text-sm font-medium">{t("tokens.noTransactionsTitle", {}, "Операции не найдены")}</div>
                <div className="text-xs text-zinc-600">{t("tokens.noTransactionsSubtitle", {}, "Здесь будут отображаться ваши начисления и расходы токенов")}</div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-800/20 transition">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        tx.type === "topup"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : tx.type === "deduction"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {tx.type === "topup" && <FiArrowDownLeft size={18} />}
                        {tx.type === "deduction" && <FiArrowUpRight size={18} />}
                        {tx.type === "usage" && <FiLayers size={18} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-zinc-100">
                            {localizeTransactionDescription(tx.description, tx.type, t)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                          <span>{tx.created_at ? new Date(tx.created_at).toLocaleString(locale === "ru" ? "ru-RU" : "en-US") : ""}</span>
                          {tx.workflow_name && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-400">{t("tokens.workflowLabel", { name: tx.workflow_name }, `Процесс: ${tx.workflow_name}`)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className={`text-base font-extrabold ${tx.amount_tokens > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.amount_tokens > 0 ? `+${tx.amount_tokens}` : tx.amount_tokens} 🪙
                      </div>
                      {tx.type !== "usage" && (
                        <div className="text-xs text-zinc-500 font-medium">
                          {tx.amount_usd > 0 ? `+$${tx.amount_usd.toFixed(2)}` : `-$${Math.abs(tx.amount_usd).toFixed(2)}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ═══════ Payment Modal ═══════ */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setPaymentModal(false); resetPaymentForm(); }}>
          <div
            className="bg-[#181920] border border-zinc-700/80 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                  <FiCreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t("tokens.modalTitle", {}, "Пополнение баланса")}</h3>
                  <p className="text-xs text-zinc-400">{t("tokens.modalSubtitle", {}, "Выберите способ и сумму оплаты")}</p>
                </div>
              </div>
              <button
                onClick={() => { setPaymentModal(false); resetPaymentForm(); }}
                className="p-2 rounded-xl hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">{t("tokens.amountUsd", {}, "Сумма (USD)")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="10.00"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition text-lg font-semibold"
                    required
                  />
                </div>
                {paymentAmount && parseFloat(paymentAmount) > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
                    <div className="flex justify-between text-zinc-300">
                      <span>{t("tokens.youWillGet", {}, "Вы получите:")}</span>
                      <span className="font-bold text-emerald-400">~{previewTokens} {t("tokens.tokensWord", {}, "токенов")}</span>
                    </div>
                    {promoValidated?.valid && (
                      <div className="flex justify-between text-zinc-300 mt-1">
                        <span>{t("tokens.cashback", { percent: promoValidated.cashback_percent }, `Кешбек (${promoValidated.cashback_percent}%):`)}</span>
                        <span className="font-bold text-amber-400">+{previewCashback} {t("tokens.tokensWord", {}, "токенов")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">{t("tokens.provider", {}, "Провайдер оплаты")}</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider("finik")}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                      paymentProvider === "finik"
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      paymentProvider === "finik" ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      <span className="text-lg font-bold">F</span>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">FINIK</div>
                      <div className="text-xs text-zinc-400">{t("tokens.qrPayment", {}, "Оплата через QR-код (AversPay)")}</div>
                    </div>
                    {paymentProvider === "finik" && (
                      <FiCheck className="ml-auto text-emerald-400" size={20} />
                    )}
                  </button>
                </div>
              </div>

              {/* Promo Code */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  <FiGift className="inline mr-1.5 text-amber-400" size={14} />
                  {t("tokens.promoCode", {}, "Промокод")} <span className="text-zinc-500 font-normal">{t("tokens.promoOptional", {}, "(необязательно)")}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValidated(null); }}
                    placeholder={t("tokens.promoPlaceholder", {}, "Введите промокод")}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition text-sm font-medium uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handleValidatePromo}
                    disabled={!promoCode.trim() || promoLoading}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-semibold transition"
                  >
                    {promoLoading ? "..." : t("tokens.checkPromo", {}, "Проверить")}
                  </button>
                </div>
                {promoValidated?.valid && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                    <FiCheck size={14} />
                    <span>{t("tokens.promoSuccess", { percent: promoValidated.cashback_percent }, `Промокод принят! Кешбек: ${promoValidated.cashback_percent}%`)}</span>
                  </div>
                )}
              </div>

              {/* Terms Agreement */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                      agreeTerms
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-zinc-600 group-hover:border-zinc-400"
                    }`}>
                      {agreeTerms && <FiCheck size={12} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-300">
                    {t("tokens.agreeTerms", {}, "Оплачивая на нашей платформе, вы соглашаетесь с")}{" "}
                    <a
                      href={`/terms?lang=${locale || "ru"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 inline-flex items-center gap-0.5 font-medium"
                    >
                      {t("tokens.termsOfPayment", {}, "условиями оплаты")}
                      <FiExternalLink size={10} />
                    </a>
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={paymentLoading || !agreeTerms || !paymentAmount}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white text-base font-bold transition shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {paymentLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t("tokens.processing", {}, "Обработка...")}
                  </>
                ) : (
                  <>
                    <FiCreditCard size={18} />
                    {t("tokens.payBtn", { amount: paymentAmount ? `$${parseFloat(paymentAmount).toFixed(2)}` : "" }, `Оплатить ${paymentAmount ? `$${parseFloat(paymentAmount).toFixed(2)}` : ""}`)}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

