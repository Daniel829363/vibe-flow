"use client";

import Link from "next/link";
import { HiArrowRight, HiPlay, HiSparkles, HiCpuChip, HiPhoto, HiVideoCamera, HiMusicalNote, HiCommandLine, HiCloudArrowUp, HiChatBubbleLeftRight, HiEye, HiCurrencyDollar, HiGlobeAlt, HiShare, HiSquares2X2 } from "react-icons/hi2";
import { GoWorkflow } from "react-icons/go";
import { useTranslation, LanguageSwitcher } from "workflow-builder";
import { useAuth } from "./lib/auth";

/* ─── Auth Navigation (preserved) ──────────────────────────────────────── */
function AuthNav() {
  const { user, isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return null;
  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all"
        >
          <span>📊</span>
          <span>{t("nav.home", {}, "Дашборд")}</span>
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm font-bold transition-all"
        >
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-[10px] font-black">
              {(user?.name || user?.email)?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-zinc-300 max-w-[100px] truncate">{user?.name || user?.email}</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/auth/login" className="text-zinc-400 hover:text-white text-sm font-bold transition-colors px-3 py-2">
        {t("nav.login", {}, "Войти")}
      </Link>
      <Link href="/auth/register" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-all">
        {t("auth.signUp", {}, "Регистрация")}
      </Link>
    </div>
  );
}

/* ─── Animated Workflow Graph (Hero Illustration) ──────────────────────── */
function WorkflowGraphIllustration() {
  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[16/10]">
      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 640 400" fill="none">
        {/* Upload → Image */}
        <path d="M155 120 L260 100" stroke="url(#line-grad-1)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" />
        {/* Upload → Text */}
        <path d="M155 140 L260 200" stroke="url(#line-grad-2)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" style={{ animationDelay: '0.5s' }} />
        {/* Image → Video */}
        <path d="M380 100 L460 160" stroke="url(#line-grad-1)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" style={{ animationDelay: '1s' }} />
        {/* Text → Video */}
        <path d="M380 200 L460 180" stroke="url(#line-grad-2)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" style={{ animationDelay: '0.7s' }} />
        {/* Video → Output */}
        <path d="M570 170 L600 280" stroke="url(#line-grad-3)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" style={{ animationDelay: '1.3s' }} />
        {/* Text → Audio */}
        <path d="M380 220 L460 300" stroke="url(#line-grad-2)" strokeWidth="2" strokeDasharray="6 4" className="animate-pulse-line" style={{ animationDelay: '0.9s' }} />
        <defs>
          <linearGradient id="line-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="line-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="line-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>

      {/* Upload Node */}
      <div className="absolute left-[8%] top-[22%] animate-float" style={{ animationDelay: '0s' }}>
        <div className="w-28 bg-zinc-900/90 border border-zinc-700/60 rounded-xl p-3 backdrop-blur-sm shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center">
              <HiCloudArrowUp className="text-emerald-400" size={12} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300">Upload</span>
          </div>
          <div className="w-full h-8 bg-zinc-800 rounded-md border border-dashed border-zinc-600 flex items-center justify-center">
            <span className="text-[8px] text-zinc-500">image.jpg</span>
          </div>
        </div>
      </div>

      {/* Image Gen Node */}
      <div className="absolute left-[35%] top-[12%] animate-float-delayed" style={{ animationDelay: '0.3s' }}>
        <div className="w-32 bg-zinc-900/90 border border-blue-500/30 rounded-xl p-3 backdrop-blur-sm shadow-lg shadow-blue-500/5 animate-glow-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
              <HiPhoto className="text-blue-400" size={12} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300">Image Gen</span>
          </div>
          <div className="w-full h-12 bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-md border border-blue-500/10 flex items-center justify-center">
            <HiSparkles className="text-blue-400/60" size={18} />
          </div>
        </div>
      </div>

      {/* Text/LLM Node */}
      <div className="absolute left-[35%] top-[42%] animate-float" style={{ animationDelay: '0.6s' }}>
        <div className="w-32 bg-zinc-900/90 border border-purple-500/30 rounded-xl p-3 backdrop-blur-sm shadow-lg shadow-purple-500/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center">
              <HiChatBubbleLeftRight className="text-purple-400" size={12} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300">LLM</span>
          </div>
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-purple-500/20 rounded-full" />
            <div className="w-3/4 h-1.5 bg-purple-500/15 rounded-full" />
            <div className="w-1/2 h-1.5 bg-purple-500/10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Video Node */}
      <div className="absolute left-[62%] top-[28%] animate-float-delayed" style={{ animationDelay: '0.9s' }}>
        <div className="w-32 bg-zinc-900/90 border border-pink-500/30 rounded-xl p-3 backdrop-blur-sm shadow-lg shadow-pink-500/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-pink-500/20 flex items-center justify-center">
              <HiVideoCamera className="text-pink-400" size={12} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300">Video Gen</span>
          </div>
          <div className="w-full h-10 bg-gradient-to-br from-pink-900/30 to-orange-900/20 rounded-md border border-pink-500/10 flex items-center justify-center">
            <HiPlay className="text-pink-400/60" size={16} />
          </div>
        </div>
      </div>

      {/* Audio Node */}
      <div className="absolute left-[62%] top-[62%] animate-float" style={{ animationDelay: '1.2s' }}>
        <div className="w-28 bg-zinc-900/90 border border-amber-500/30 rounded-xl p-3 backdrop-blur-sm shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
              <HiMusicalNote className="text-amber-400" size={12} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300">Audio</span>
          </div>
          <div className="flex items-end gap-px h-6">
            {[40, 70, 50, 90, 60, 80, 45, 75, 55, 85, 65].map((h, i) => (
              <div key={i} className="flex-1 bg-amber-500/30 rounded-full" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Node Type Card ───────────────────────────────────────────────────── */
function NodeTypeRow({ icon: Icon, color, bgColor, borderColor, title, description, capabilities, outputs, isReversed }) {
  return (
    <div className={`flex flex-col md:flex-row ${isReversed ? 'md:flex-row-reverse' : ''} py-10 md:py-14 gap-8 md:gap-0 justify-between border-b border-white/5 last:border-0`}>
      <div className="md:w-3/12 flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
            <Icon className={color} size={22} />
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{title}</h3>
        </div>
      </div>
      <div className="md:w-5/12 md:px-8 flex flex-col justify-center">
        <p className="text-zinc-400 leading-relaxed">{description}</p>
      </div>
      <div className="md:w-2/12 flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Capabilities</span>
        <ul className="space-y-1.5">
          {capabilities.map((cap, i) => (
            <li key={i} className="text-xs text-zinc-400 flex items-center gap-1.5">
              <span className={`w-1 h-1 rounded-full ${color.replace('text-', 'bg-')}`} />
              {cap}
            </li>
          ))}
        </ul>
      </div>
      <div className="md:w-2/12 flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Outputs</span>
        <ul className="space-y-1.5">
          {outputs.map((out, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              {out}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Feature Card ─────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, gradient }) {
  return (
    <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 hover:-translate-y-1">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: gradient }} />
      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Icon className="text-zinc-300 group-hover:text-white transition-colors" size={22} />
        </div>
        <h3 className="text-white font-bold mb-2 text-lg">{title}</h3>
        <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors">{description}</p>
      </div>
    </div>
  );
}

/* ─── Step Card ────────────────────────────────────────────────────────── */
function StepCard({ number, title, description }) {
  return (
    <div className="relative flex flex-col items-center text-center group">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-b from-blue-400 to-purple-400">{number}</span>
      </div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">{description}</p>
    </div>
  );
}

/* ─── Why Card (Zigzag) ────────────────────────────────────────────────── */
function WhyBlock({ icon: Icon, color, title, description, features, isReversed, illustration }) {
  return (
    <div className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 md:gap-20 items-center`}>
      {/* Text */}
      <div className="w-full md:w-1/2">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 mb-6`}>
          <Icon className={color} size={20} />
        </div>
        <h3 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{title}</h3>
        <p className="text-zinc-400 text-lg leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full ${color.replace('text-', 'bg-')}/20 flex-shrink-0 flex items-center justify-center mt-0.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
              </div>
              <span className="text-zinc-300 text-sm">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Illustration */}
      <div className="w-full md:w-1/2">
        {illustration}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOME PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen w-full bg-[#030303] text-white overflow-hidden selection:bg-blue-500/30">
      {/* ── Background Effects ──────────────────────────────────────────── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-15%] w-[35%] h-[35%] bg-purple-600/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[30%] h-[30%] bg-pink-600/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <GoWorkflow className="text-white" size={20} />
          </div>
          <span>{t("landing.brandName", {}, "Vibe")}<span className="text-blue-400">{t("landing.brandSuffix", {}, "Flow")}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <AuthNav />
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══════════════════════════════════════════════ */}
      <section className="relative z-10 pt-16 md:pt-24 pb-10 md:pb-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
            {/* Hero Text */}
            <div className="w-full lg:w-1/2 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8 animate-fade-in-up">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                {t("landing.badge", {}, "New: AI-Powered Automations")}
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[0.95]">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-zinc-500">
                  {t("landing.heroTitle1", {}, "Build AI Workflows")}
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-shift">
                  {t("landing.heroTitle2", {}, "Visually.")}
                </span>
              </h1>

              <p className="text-base md:text-lg text-zinc-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t("landing.heroSubtitle", {}, "The all-in-one node-based platform to design, connect, and run AI pipelines. Combine image, video, audio, and text models in one visual editor — no coding required.")}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link
                  href="/workflow"
                  className="group relative flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold transition-all shadow-[0_20px_40px_-15px_rgba(37,99,235,0.4)] hover:shadow-[0_25px_50px_-12px_rgba(37,99,235,0.5)] active:scale-[0.97]"
                >
                  {t("landing.startBuilding", {}, "Start Building")}
                  <HiArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                </Link>
                <Link
                  href="/workflow"
                  className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-sm"
                >
                  <HiEye size={16} />
                  {t("landing.explorePublic", {}, "Explore Public Workflows")}
                </Link>
              </div>
            </div>

            {/* Hero Illustration */}
            <div className="w-full lg:w-1/2 lg:pl-8">
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
                  <WorkflowGraphIllustration />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted by bar ──────────────────────────────────────────────── */}
      <div className="relative z-10 border-t border-b border-white/5 py-8 mb-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          <span className="text-zinc-600 text-xs uppercase tracking-widest">{t("landing.trustedBy", {}, "Trusted by creative teams worldwide")}</span>
          <div className="flex items-center gap-10 opacity-30 grayscale">
            <span className="font-black text-lg tracking-tight">AURORA</span>
            <span className="font-black text-lg tracking-tight">NEXUS</span>
            <span className="font-black text-lg tracking-tight">METAVOX</span>
            <span className="font-black text-lg tracking-tight hidden sm:block">SYNTHWAVE</span>
            <span className="font-black text-lg tracking-tight hidden md:block">PIXEL·AI</span>
          </div>
        </div>
      </div>

      {/* ═══ WHY SECTION ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-20">
            <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-4 block">{t("landing.whyLabel", {}, "Why Vibe Flow")}</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t("landing.whyTitle", {}, "Everything you need to build AI pipelines")}
            </h2>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              {t("landing.whySubtitle", {}, "From simple image generation to complex multi-model workflows — all in one visual platform.")}
            </p>
          </div>

          <div className="space-y-24 md:space-y-32">
            {/* Block 1: Combine Models */}
            <WhyBlock
              icon={HiCpuChip}
              color="text-blue-400"
              title={t("landing.why1Title", {}, "Combine Multiple AI Models")}
              description={t("landing.why1Desc", {}, "Chain image, video, audio, text, and API nodes together in one workflow. Connect outputs to inputs and watch your creative pipeline run automatically.")}
              features={[
                t("landing.why1Feature1", {}, "Image generation with DALL·E, Stable Diffusion, Midjourney-style models"),
                t("landing.why1Feature2", {}, "Video generation from images or text prompts"),
                t("landing.why1Feature3", {}, "Audio and music generation nodes"),
                t("landing.why1Feature4", {}, "LLM text processing with any OpenAI-compatible API"),
              ]}
              isReversed={false}
              illustration={
                <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-blue-950/50 to-zinc-900/50 border border-blue-500/10 p-8 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:30px_30px]" />
                  {/* Mini node cards */}
                  <div className="relative space-y-4">
                    {[
                      { label: "Image Gen", color: "bg-blue-500/20 border-blue-500/30", icon: "🖼️" },
                      { label: "Text LLM", color: "bg-purple-500/20 border-purple-500/30", icon: "💬" },
                      { label: "Video Gen", color: "bg-pink-500/20 border-pink-500/30", icon: "🎬" },
                      { label: "Audio Gen", color: "bg-amber-500/20 border-amber-500/30", icon: "🎵" },
                    ].map((node, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${node.color} border backdrop-blur-sm animate-fade-in-up`} style={{ animationDelay: `${i * 0.15}s` }}>
                        <span className="text-lg">{node.icon}</span>
                        <span className="text-sm font-semibold text-zinc-200">{node.label}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                          <span className="text-[10px] text-zinc-500">Ready</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />

            {/* Block 2: Visual Editor */}
            <WhyBlock
              icon={HiSquares2X2}
              color="text-purple-400"
              title={t("landing.why2Title", {}, "Visual Drag & Drop Editor")}
              description={t("landing.why2Desc", {}, "Build workflows by dragging nodes onto a canvas and connecting them visually. No coding required — just connect, configure, and run.")}
              features={[
                t("landing.why2Feature1", {}, "Drag-and-drop node placement on an infinite canvas"),
                t("landing.why2Feature2", {}, "Real-time preview of generated outputs"),
                t("landing.why2Feature3", {}, "Save and reuse workflow templates"),
                t("landing.why2Feature4", {}, "Share workflows publicly or with your team"),
              ]}
              isReversed={true}
              illustration={
                <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-purple-950/50 to-zinc-900/50 border border-purple-500/10 p-6 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.05),transparent_70%)]" />
                  {/* Mini workflow canvas mockup */}
                  <div className="relative h-full flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 300 300" fill="none">
                      {/* Connections */}
                      <path d="M80 100 C 130 100, 130 80, 170 80" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
                      <path d="M80 100 C 130 100, 130 150, 170 150" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
                      <path d="M250 80 C 270 80, 270 120, 260 160" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
                      <path d="M250 150 C 270 150, 270 170, 260 180" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
                      {/* Nodes */}
                      <rect x="30" y="80" width="50" height="40" rx="8" fill="#18181B" stroke="#3F3F46" strokeWidth="1" />
                      <text x="55" y="105" textAnchor="middle" fill="#A1A1AA" fontSize="8">Input</text>
                      <rect x="170" y="60" width="80" height="40" rx="8" fill="#18181B" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.4" />
                      <text x="210" y="85" textAnchor="middle" fill="#C4B5FD" fontSize="8">Image Gen</text>
                      <rect x="170" y="130" width="80" height="40" rx="8" fill="#18181B" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.4" />
                      <text x="210" y="155" textAnchor="middle" fill="#C4B5FD" fontSize="8">Video Gen</text>
                      <rect x="220" y="200" width="60" height="35" rx="8" fill="#18181B" stroke="#22C55E" strokeWidth="1" strokeOpacity="0.4" />
                      <text x="250" y="222" textAnchor="middle" fill="#86EFAC" fontSize="8">Output</text>
                      {/* Dots */}
                      <circle cx="80" cy="100" r="3" fill="#8B5CF6" opacity="0.6" />
                      <circle cx="170" cy="80" r="3" fill="#8B5CF6" opacity="0.6" />
                      <circle cx="170" cy="150" r="3" fill="#8B5CF6" opacity="0.6" />
                      <circle cx="250" cy="80" r="3" fill="#22C55E" opacity="0.6" />
                      <circle cx="250" cy="150" r="3" fill="#22C55E" opacity="0.6" />
                    </svg>
                  </div>
                </div>
              }
            />

            {/* Block 3: Automate & Scale */}
            <WhyBlock
              icon={HiSparkles}
              color="text-emerald-400"
              title={t("landing.why3Title", {}, "Automate & Scale")}
              description={t("landing.why3Desc", {}, "Stop repeating the same steps manually. Build once, run unlimited times. Save your workflows as templates and scale your creative output effortlessly.")}
              features={[
                t("landing.why3Feature1", {}, "One-click execution of entire pipelines"),
                t("landing.why3Feature2", {}, "Save and reuse workflow templates"),
                t("landing.why3Feature3", {}, "Built-in media library for all generated assets"),
                t("landing.why3Feature4", {}, "Token-based billing with transparent pricing"),
              ]}
              isReversed={false}
              illustration={
                <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-emerald-950/50 to-zinc-900/50 border border-emerald-500/10 p-8 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_70%)]" />
                  <div className="relative h-full flex flex-col items-center justify-center gap-5">
                    {/* Stats mockup */}
                    <div className="w-full bg-zinc-900 rounded-xl border border-zinc-700/50 overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        <span className="ml-2 text-[10px] text-zinc-500">Dashboard</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Workflows run today</span>
                          <span className="text-sm font-bold text-emerald-400">147</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Images generated</span>
                          <span className="text-sm font-bold text-blue-400">1,204</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Videos created</span>
                          <span className="text-sm font-bold text-pink-400">89</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                          <div className="bg-gradient-to-r from-emerald-500 to-blue-500 h-1.5 rounded-full" style={{ width: '72%' }} />
                        </div>
                        <div className="text-[10px] text-zinc-600 text-right">72% of daily capacity</div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">Auto-save</div>
                      <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-semibold">Templates</div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* ═══ NODE TYPES SECTION ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-20 md:py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-4 block">{t("landing.nodesLabel", {}, "Node Types")}</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t("landing.nodesTitle", {}, "Build Your Own Workflow")}
            </h2>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              {t("landing.nodesSubtitle", {}, "Mix and match different node types to create any AI pipeline you need.")}
            </p>
          </div>

          <div className="border-t border-white/5">
            <NodeTypeRow
              icon={HiPhoto}
              color="text-blue-400"
              bgColor="bg-blue-500/15"
              borderColor="border-blue-500/20"
              title={t("landing.nodeImage", {}, "Image Nodes")}
              description={t("landing.nodeImageDesc", {}, "Generate stunning images using AI models. Configure prompts, styles, dimensions, and more — connect text or image inputs for maximum control.")}
              capabilities={[
                t("landing.nodeImageCap1", {}, "Text-to-image generation"),
                t("landing.nodeImageCap2", {}, "Image-to-image transformation"),
                t("landing.nodeImageCap3", {}, "Style transfer & upscaling"),
              ]}
              outputs={["Image", "Preview"]}
              isReversed={false}
            />
            <NodeTypeRow
              icon={HiVideoCamera}
              color="text-pink-400"
              bgColor="bg-pink-500/15"
              borderColor="border-pink-500/20"
              title={t("landing.nodeVideo", {}, "Video Nodes")}
              description={t("landing.nodeVideoDesc", {}, "Generate videos from images or text descriptions. Create animations, transitions, and full video clips using cutting-edge AI video models.")}
              capabilities={[
                t("landing.nodeVideoCap1", {}, "Image-to-video animation"),
                t("landing.nodeVideoCap2", {}, "Text-to-video generation"),
                t("landing.nodeVideoCap3", {}, "Video combining & editing"),
              ]}
              outputs={["Video", "Preview"]}
              isReversed={true}
            />
            <NodeTypeRow
              icon={HiMusicalNote}
              color="text-amber-400"
              bgColor="bg-amber-500/15"
              borderColor="border-amber-500/20"
              title={t("landing.nodeAudio", {}, "Audio Nodes")}
              description={t("landing.nodeAudioDesc", {}, "Generate music, sound effects, and voice from text descriptions. Perfect for adding soundtracks to your video workflows.")}
              capabilities={[
                t("landing.nodeAudioCap1", {}, "Text-to-music generation"),
                t("landing.nodeAudioCap2", {}, "Sound effect creation"),
                t("landing.nodeAudioCap3", {}, "Voice synthesis"),
              ]}
              outputs={["Audio", "Preview"]}
              isReversed={false}
            />
            <NodeTypeRow
              icon={HiChatBubbleLeftRight}
              color="text-purple-400"
              bgColor="bg-purple-500/15"
              borderColor="border-purple-500/20"
              title={t("landing.nodeText", {}, "Text / LLM Nodes")}
              description={t("landing.nodeTextDesc", {}, "Process and generate text with LLMs. Enhance prompts, analyze images, generate descriptions, and maintain consistent style across generations.")}
              capabilities={[
                t("landing.nodeTextCap1", {}, "Prompt enhancement & refinement"),
                t("landing.nodeTextCap2", {}, "Image analysis & captioning"),
                t("landing.nodeTextCap3", {}, "Custom instructions support"),
              ]}
              outputs={["Text"]}
              isReversed={true}
            />
            <NodeTypeRow
              icon={HiCommandLine}
              color="text-cyan-400"
              bgColor="bg-cyan-500/15"
              borderColor="border-cyan-500/20"
              title={t("landing.nodeApi", {}, "API Nodes")}
              description={t("landing.nodeApiDesc", {}, "Connect any external API to your workflow. Use custom endpoints, transform data, and integrate with third-party services.")}
              capabilities={[
                t("landing.nodeApiCap1", {}, "Custom HTTP endpoints"),
                t("landing.nodeApiCap2", {}, "Request/response mapping"),
                t("landing.nodeApiCap3", {}, "Authentication support"),
              ]}
              outputs={["Any"]}
              isReversed={false}
            />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 md:py-32 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="text-center mb-20">
            <span className="text-xs uppercase tracking-widest text-pink-400 font-semibold mb-4 block">{t("landing.howLabel", {}, "How It Works")}</span>
            <h2 className="text-4xl md:text-5xl font-bold">
              {t("landing.howTitle", {}, "Three steps to your first workflow")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20" />

            <StepCard
              number="1"
              title={t("landing.step1Title", {}, "Create a Workflow")}
              description={t("landing.step1Desc", {}, "Start from scratch or duplicate an existing public workflow as a starting point.")}
            />
            <StepCard
              number="2"
              title={t("landing.step2Title", {}, "Add & Connect Nodes")}
              description={t("landing.step2Desc", {}, "Drag AI nodes onto the canvas and connect them with visual edges to define the data flow.")}
            />
            <StepCard
              number="3"
              title={t("landing.step3Title", {}, "Run & Get Results")}
              description={t("landing.step3Desc", {}, "Hit run and watch the pipeline execute. View results in real-time and save to your media library.")}
            />
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 md:py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-4 block">{t("landing.featuresLabel", {}, "Features")}</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t("landing.featuresTitle", {}, "Everything included")}
            </h2>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              {t("landing.featuresSubtitle", {}, "A complete platform for building, running, and sharing AI workflows.")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={GoWorkflow}
              title={t("landing.featureEditor", {}, "Visual Node Editor")}
              description={t("landing.featureEditorDesc", {}, "Drag-and-drop interface with an infinite canvas. Connect nodes visually and see the data flow in real-time.")}
              gradient="radial-gradient(circle at 30% 30%, rgba(59,130,246,0.06), transparent 70%)"
            />
            <FeatureCard
              icon={HiEye}
              title={t("landing.featurePreview", {}, "Real-time Preview")}
              description={t("landing.featurePreviewDesc", {}, "See generated images, videos, and audio directly in each node as your workflow runs.")}
              gradient="radial-gradient(circle at 70% 30%, rgba(139,92,246,0.06), transparent 70%)"
            />
            <FeatureCard
              icon={HiCurrencyDollar}
              title={t("landing.featureTokens", {}, "Token Billing System")}
              description={t("landing.featureTokensDesc", {}, "Built-in token economy with transparent pricing per generation. Top up and track spending easily.")}
              gradient="radial-gradient(circle at 50% 70%, rgba(234,179,8,0.06), transparent 70%)"
            />
            <FeatureCard
              icon={HiPhoto}
              title={t("landing.featureMedia", {}, "Media Gallery")}
              description={t("landing.featureMediaDesc", {}, "All your generated images, videos, and audio stored in one organized library with search and filtering.")}
              gradient="radial-gradient(circle at 30% 70%, rgba(236,72,153,0.06), transparent 70%)"
            />
            <FeatureCard
              icon={HiShare}
              title={t("landing.featureShare", {}, "Workflow Sharing")}
              description={t("landing.featureShareDesc", {}, "Share workflows publicly, collaborate with team members, or keep them private. Fork any public workflow.")}
              gradient="radial-gradient(circle at 70% 70%, rgba(16,185,129,0.06), transparent 70%)"
            />
            <FeatureCard
              icon={HiGlobeAlt}
              title={t("landing.featureI18n", {}, "Multi-language")}
              description={t("landing.featureI18nDesc", {}, "Full interface localization with Russian and English supported out of the box.")}
              gradient="radial-gradient(circle at 50% 30%, rgba(6,182,212,0.06), transparent 70%)"
            />
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute top-[-50%] left-[-20%] w-[60%] h-[120%] bg-blue-600/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-[-30%] right-[-10%] w-[40%] h-[80%] bg-purple-600/10 rounded-full blur-[60px]" />

            <div className="relative py-16 md:py-24 px-8 md:px-16 text-center border border-white/[0.08] rounded-3xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                {t("landing.ctaTitle", {}, "Ready to build your first workflow?")}
              </h2>
              <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
                {t("landing.ctaSubtitle", {}, "Join thousands of creators who are already building AI pipelines visually. Start for free and scale as you grow.")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="group flex items-center gap-2.5 bg-white text-black px-8 py-4 rounded-full font-bold transition-all hover:bg-zinc-100 active:scale-[0.97] shadow-[0_20px_40px_-15px_rgba(255,255,255,0.15)]"
                >
                  {t("landing.ctaButton", {}, "Get Started for Free")}
                  <HiArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                </Link>
                <Link
                  href="/workflow"
                  className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all text-sm"
                >
                  <HiEye size={16} />
                  {t("landing.ctaExplore", {}, "Explore Workflows")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <GoWorkflow className="text-white" size={14} />
                </div>
                <span>Vibe<span className="text-blue-400">Flow</span></span>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed">
                {t("landing.footerDesc", {}, "AI workflow builder platform. Design, connect, and run AI pipelines visually.")}
              </p>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">{t("landing.footerProduct", {}, "Product")}</h4>
              <ul className="space-y-2.5">
                <li><Link href="/workflow" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerWorkflows", {}, "Workflows")}</Link></li>
                <li><Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerDashboard", {}, "Dashboard")}</Link></li>
                <li><Link href="/media" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerMedia", {}, "Media Library")}</Link></li>
                <li><Link href="/tokens" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerTokens", {}, "Tokens")}</Link></li>
              </ul>
            </div>
            {/* Resources */}
            <div>
              <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">{t("landing.footerResources", {}, "Resources")}</h4>
              <ul className="space-y-2.5">
                <li><Link href="/legal" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerDocs", {}, "Documentation")}</Link></li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">{t("landing.footerLegal", {}, "Legal")}</h4>
              <ul className="space-y-2.5">
                <li><Link href="/terms" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerTerms", {}, "Terms of Service")}</Link></li>
                <li><Link href="/legal" className="text-sm text-zinc-500 hover:text-white transition-colors">{t("landing.footerPrivacy", {}, "Privacy Policy")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-zinc-600 text-xs">© {new Date().getFullYear()} Vibe Workflow. {t("landing.footerRights", {}, "All rights reserved.")}</span>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500/60 animate-pulse" />
              {t("landing.footerStatus", {}, "All systems operational")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
