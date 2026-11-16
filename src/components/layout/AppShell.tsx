import React from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  Home,
  Timer,
  CheckSquare,
  MessageCircleHeart,
  BookOpen,
  User,
  Smartphone,
  ClipboardCheck,
  BarChart3,
  CalendarRange,
  Crown,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import { AppScreen, AppState } from "../../types/refocus";
import { OfflineIndicator, PWAInstallButton } from "../common/PWAWidgets";
import { ReFocusLogo } from "../common/ReFocusLogo";

interface AppShellProps {
  state: AppState;
  activeScreen: AppScreen;
  timerRunning: boolean;
  onNavigate: (screen: AppScreen) => void;
  onOpenUpgrade: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  state,
  activeScreen,
  timerRunning,
  onNavigate,
  onOpenUpgrade,
  children,
}) => {
  const t = getCopy(state.language);

  const primaryTabs: Array<{ id: AppScreen; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: "home", label: t.nav.home, icon: Home },
    { id: "focus", label: t.nav.focus, icon: Timer },
    { id: "habits", label: t.nav.habits, icon: CheckSquare },
    { id: "coach", label: t.nav.coach, icon: MessageCircleHeart },
    { id: "library", label: t.nav.library, icon: BookOpen },
    { id: "profile", label: t.nav.profile, icon: User },
  ];

  const secondaryTools: Array<{ id: AppScreen; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: "tracker", label: t.nav.tracker, icon: Smartphone },
    { id: "checkin", label: t.nav.checkin, icon: ClipboardCheck },
    { id: "analytics", label: t.nav.analytics, icon: BarChart3 },
    { id: "review", label: t.nav.review, icon: CalendarRange },
  ];

  return (
    <div className="rf-app-shell min-h-screen text-[#F3F4F6]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[#F4CE25] focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-[#191B20] focus:shadow-lg"
      >
        {t.common.skipToContent}
      </a>

      <OfflineIndicator language={state.language} />

      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4 px-3 py-3 sm:px-5 lg:gap-6 lg:px-6 lg:py-5">
        {/* Desktop Sidebar */}
        <aside className="rf-surface sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[248px] shrink-0 flex-col justify-between overflow-y-auto rounded-[24px] p-4 xl:w-[264px] xl:p-5 lg:flex">
          <div className="space-y-7">
            <div className="flex items-center justify-between px-2 py-1">
              <ReFocusLogo variant="horizontal" size={32} />
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#F4CE25]/20 bg-[#F4CE25]/10 text-[#F4CE25]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            <nav className="space-y-1" aria-label={t.nav.home}>
              {primaryTabs.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate(item.id)}
                    className={`group relative flex min-h-12 w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-[#F4CE25]/10 font-semibold text-[#F3F4F6] shadow-[inset_0_0_0_1px_rgba(244,206,37,0.16)]"
                        : "text-[#A6AAB4] hover:bg-white/[0.04] hover:text-[#F3F4F6]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-[#F4CE25] text-[#191B20] shadow-[0_4px_14px_rgba(244,206,37,0.2)]" : "bg-white/[0.035] text-[#9299A8] group-hover:text-[#F3F4F6]"}`}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span>{item.label}</span>
                    </span>
                    {item.id === "focus" && timerRunning && (
                      <span
                        aria-hidden="true"
                        className="font-mono-tabular text-[11px] font-semibold text-[#F4CE25]"
                      >
                        ●
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-[#363B46] pt-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#727987]">
                {t.dashboard.quickActionsTitle}
              </p>
              <nav className="space-y-1" aria-label={t.dashboard.quickActionsTitle}>
                {secondaryTools.map((item) => {
                  const Icon = item.icon;
                  const active = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => onNavigate(item.id)}
                      className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-white/[0.06] font-semibold text-[#F3F4F6]"
                          : "text-[#9299A8] hover:bg-white/[0.04] hover:text-[#F3F4F6]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-[#F4CE25]" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#363B46] bg-[#151820] px-3 py-2.5 text-xs font-medium text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]">
              <HardDrive className="h-3.5 w-3.5 text-[#F4CE25]" />
              <span>{t.profile.localOnlyStorage}</span>
            </div>
            <PWAInstallButton language={state.language} />
            {state.user.plan === "free" && (
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#F4CE25] to-[#DDB816] px-4 py-2.5 text-xs font-semibold text-[#191B20] shadow-[0_12px_28px_rgba(244,206,37,0.18)] transition-transform hover:-translate-y-0.5"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>{t.profile.upgradeButton}</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Scrollable Canvas */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 rounded-[24px] border border-[#363B46]/80 bg-[#1B1E27]/80 px-4 pb-24 pt-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] outline-none backdrop-blur-sm sm:px-6 lg:px-8 lg:pb-10 lg:pt-8"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between border-b border-[#363B46]/70 pb-4 lg:hidden">
              <ReFocusLogo variant="horizontal" size={28} />
              <span className="inline-flex items-center gap-1.5 text-xs text-[#A6AAB4]">
                <HardDrive className="h-3.5 w-3.5 text-[#F4CE25]" />
                {t.profile.localOnlyStorage}
              </span>
            </div>
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeScreen}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </MotionConfig>
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation (5 primary tabs, <= 15% mobile height) */}
      <nav
        aria-label={t.nav.home}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#363B46] bg-[#1B1E27]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_36px_rgba(0,0,0,0.22)] backdrop-blur-2xl lg:hidden"
      >
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-6 items-center px-2">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const active =
              activeScreen === item.id ||
              (item.id === "home" &&
                (activeScreen === "tracker" ||
                  activeScreen === "checkin" ||
                  activeScreen === "analytics" ||
                  activeScreen === "review"));

            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-[#F4CE25]/10 text-[#F3F4F6] shadow-[inset_0_0_0_1px_rgba(244,206,37,0.12)]"
                    : "text-[#A6AAB4] dark:text-[#A6AAB4]"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-[#F4CE25]" : ""}`} />
                <span className="max-w-16 truncate text-[10px] font-medium tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
