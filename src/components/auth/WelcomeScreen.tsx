import React from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowRight, ArrowLeft, BookOpen, Clock, MessageCircleHeart, Globe, Timer, Bell, Play } from "lucide-react";
import { MEDIA_ASSETS } from "../../assets/media";
import focusWorkspace from "../../assets/images/focus_workspace.jpg";
import { getCopy } from "../../i18n/translations";
import { Language } from "../../types/refocus";
import { PWAInstallButton } from "../common/PWAWidgets";
import { ReFocusLogo } from "../common/ReFocusLogo";

interface WelcomeScreenProps {
  language: Language;
  onToggleLanguage: () => void;
  onGetStarted: () => void;
  onLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  language,
  onToggleLanguage,
  onGetStarted,
  onLogin,
}) => {
  const t = getCopy(language);
  const isRtl = language === "ar";
  const DirectionalArrow = isRtl ? ArrowLeft : ArrowRight;
  const entrance = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };
  const pillars = [
    {
      title: t.welcome.pillar1Title,
      description: t.welcome.pillar1Desc,
      image: focusWorkspace,
      imageAlt: isRtl ? "مساحة عمل هادئة تساعد على التركيز" : "A calm workspace set up for focused work",
      label: isRtl ? "جلسة تركيز" : "FOCUS SESSION",
      detail: isRtl ? "٢٥ دقيقة من التركيز" : "25 MIN FOCUS",
      Icon: Clock,
      imagePosition: "object-center",
    },
    {
      title: t.welcome.pillar2Title,
      description: t.welcome.pillar2Desc,
      image: MEDIA_ASSETS.welcomeCalmBotanical,
      imageAlt: isRtl ? "كتاب وقهوة ونبات في لحظة هادئة بعيدًا عن الشاشة" : "A book, coffee, and greenery for a screen-free moment",
      label: isRtl ? "لحظة بلا شاشة" : "OFFLINE MOMENT",
      detail: isRtl ? "اقرأ • تحرك • استرح" : "READ · MOVE · REST",
      Icon: BookOpen,
      imagePosition: "object-center",
    },
    {
      title: t.welcome.pillar3Title,
      description: t.welcome.pillar3Desc,
      image: MEDIA_ASSETS.userAvatarPortrait,
      imageAlt: isRtl ? "صورة رمزية ودودة لمساعد التركيز" : "A friendly portrait representing the supportive focus coach",
      label: isRtl ? "مدربك الذكي" : "YOUR AI COACH",
      detail: isRtl ? "خطوة واحدة في كل مرة" : "One step at a time",
      Icon: MessageCircleHeart,
      imagePosition: "object-[center_38%]",
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(ellipse_at_8%_0%,rgba(244,206,37,0.09),transparent_30%),radial-gradient(ellipse_at_92%_45%,rgba(130,116,201,0.08),transparent_30%),#151820] text-[#F3F4F6]">
      {/* Compact Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-6 sm:px-8 sm:py-5"
      >
        <div className="flex min-w-0 shrink items-center whitespace-nowrap">
          <ReFocusLogo variant="horizontal" size={30} />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-2.5 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:bg-[#292D37] sm:min-h-11 sm:px-3.5 sm:text-sm"
          >
            <Globe className="h-3.5 w-3.5 text-[#F4CE25] sm:h-4 sm:w-4" />
            <span>{language === "en" ? "العربية" : "English"}</span>
          </button>

          <button
            type="button"
            onClick={onLogin}
            className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#F4CE25] px-3 py-2 text-xs font-semibold text-[#191B20] shadow-[0_8px_20px_rgba(244,206,37,0.14)] transition-colors hover:bg-[#DDB816] sm:min-h-11 sm:px-4 sm:text-sm"
          >
            {t.welcome.login}
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-8 sm:pb-16 sm:pt-8 lg:pt-10">
        <section className="grid grid-cols-1 items-center gap-7 sm:gap-9 md:grid-cols-2 md:gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Copy Column */}
          <motion.div
            variants={entrance}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 flex-col justify-center text-center md:col-span-1 lg:col-span-6 lg:text-start"
          >
            <div>
              <p className="mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[#3A404C] bg-[#222630]/80 px-3 py-2 text-[11px] font-medium leading-relaxed text-[#F4CE25] sm:text-xs lg:mx-0">
                <span className="h-2 w-2 rounded-full bg-[#F4CE25]" aria-hidden="true" />
                <span>{t.welcome.badge}</span>
                <span aria-hidden="true">·</span>
                <span>{t.coreMessage}</span>
              </p>

              <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.2] tracking-tight text-[#F3F4F6] text-balance sm:mt-6 sm:text-5xl lg:mx-0 lg:text-6xl">
                {t.tagline}
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#B9BEC8] sm:mt-5 sm:text-base sm:leading-8 lg:mx-0 lg:text-lg">
                {t.welcome.description}
              </p>

              <div className="mx-auto mt-6 grid w-full max-w-md grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 lg:mx-0 lg:justify-start">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#F4CE25] px-3 py-3 text-sm font-semibold text-[#191B20] shadow-[0_12px_24px_rgba(244,206,37,0.16)] transition-colors hover:bg-[#DDB816] active:scale-[0.99] sm:min-h-13 sm:rounded-2xl sm:px-6 sm:text-base"
                >
                  <span>{t.welcome.getStarted}</span>
                  <DirectionalArrow className="h-4 w-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={onLogin}
                  className="inline-flex min-h-12 min-w-0 items-center justify-center whitespace-nowrap rounded-xl border border-[#3A404C] bg-[#222630] px-3 py-3 text-sm font-medium text-[#F3F4F6] transition-colors hover:bg-[#292D37] sm:min-h-13 sm:rounded-2xl sm:px-5"
                >
                  {t.welcome.login}
                </button>

                <div className="col-span-2 flex justify-center sm:col-span-1">
                  <PWAInstallButton language={language} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Digital Wellness Visual Column */}
          <motion.div
            variants={entrance}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 md:col-span-1 lg:col-span-6"
          >
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="relative overflow-hidden rounded-3xl border border-[#363B46] bg-[#222630] shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:rounded-[30px]"
            >
              <div className="pointer-events-none absolute inset-0 z-1 bg-linear-to-t from-[#101319]/65 via-transparent to-[#101319]/10" />
              <img
                src={`${import.meta.env.BASE_URL}digital-overload-brain.jpg`}
                alt={isRtl ? "تصوير ثلاثي الأبعاد لدماغ بشبكة عصبية مضيئة على خلفية داكنة، يرمز إلى الإرهاق الرقمي" : "A detailed 3D wireframe brain on a dark background, symbolizing digital overload"}
                className="aspect-[1.35/1] w-full object-cover sm:aspect-[1.45/1] lg:aspect-[1.15/1]"
              />
              <div className="pointer-events-none absolute left-3 top-3 z-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#17191F]/80 px-2.5 py-2 shadow-lg backdrop-blur-md sm:left-5 sm:top-5 sm:px-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E96767]/15 text-[#F1847D]">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[10px] font-medium text-[#B9BEC8] sm:text-[11px]">
                    {isRtl ? "تنبيهات متواصلة" : "Notifications"}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-white sm:text-sm">
                    {isRtl ? "١٢+" : "12+"}
                  </span>
                </span>
              </div>
              <div className="pointer-events-none absolute right-3 top-3 z-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#17191F]/80 px-2.5 py-2 shadow-lg backdrop-blur-md sm:right-5 sm:top-5 sm:px-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4CE25]/15 text-[#F4CE25]">
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-semibold text-white sm:text-xs">
                  {isRtl ? "تشغيل تلقائي" : "Auto-play"}
                </span>
              </div>
              <div className="absolute inset-x-3 bottom-3 z-2 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#17191F]/85 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:gap-4 sm:p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4CE25] text-[#191B20] sm:h-12 sm:w-12">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white sm:text-sm">
                    {isRtl ? "جلسة تركيز" : "Focus session"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#C2C6CF] sm:text-xs">
                    {isRtl ? "ابدأ بمهمة واحدة، وخذ وقتك" : "One task at a time"}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-2/5 rounded-full bg-[#F4CE25]" />
                  </div>
                </div>
                <span className="font-mono-tabular text-sm font-semibold text-[#F4CE25] sm:text-base">25:00</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Three Calm Pillars */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09 } } }}
          className="mt-10 border-t border-[#363B46] pt-7 sm:mt-14 sm:pt-10"
        >
          <h2 className="font-display text-lg font-semibold text-[#F3F4F6] sm:text-xl">
            {t.welcome.pillarsTitle}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-3 sm:gap-4">
            {pillars.map(({ title, description, image, imageAlt, label, detail, Icon, imagePosition }) => (
              <motion.article
                key={title}
                variants={entrance}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="rf-card group overflow-hidden rounded-2xl sm:rounded-3xl"
              >
                <div className="relative aspect-[1.9/1] overflow-hidden bg-[#222630] sm:aspect-[1.35/1]">
                  <img
                    src={image}
                    alt={imageAlt}
                    loading="lazy"
                    className={`h-full w-full object-cover ${imagePosition} brightness-[0.78] saturate-[0.82] transition-transform duration-500 group-hover:scale-[1.04]`}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#101319]/80 via-[#101319]/10 to-[#101319]/20" />
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#151820]/70 px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.08em] text-white backdrop-blur-md sm:text-[10px]">
                      <Icon className="h-3 w-3 text-[#F4CE25]" aria-hidden="true" />
                      {label}
                    </span>
                    <span className="rounded-full border border-white/15 bg-[#151820]/65 px-2.5 py-1.5 text-[9px] font-medium text-white/90 backdrop-blur-md sm:text-[10px]">
                      {detail}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-[#F3F4F6]">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#A6AAB4]">
                    {description}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>
      </main>
    </div>
    </MotionConfig>
  );
};
