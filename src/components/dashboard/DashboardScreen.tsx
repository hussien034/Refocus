import React, { useMemo, useState } from "react";
import {
  Play,
  Flame,
  CheckCircle2,
  Clock,
  Smartphone,
  Sparkles,
  BarChart3,
  ClipboardCheck,
  CalendarRange,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  Check,
  Lightbulb,
  Compass,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  computeDashboardMetrics,
  getDailyFocusMinutes,
  getPastDateISO,
  getTodayISO,
  parseLocalDateISO,
} from "../../services/analytics/metricsEngine";
import { AppScreen, AppState, DashboardPreferences } from "../../types/refocus";
import { EmptyStateCard } from "../common/EmptyStateCard";

type WidgetKey = DashboardPreferences["hiddenWidgets"][number];

interface DashboardScreenProps {
  state: AppState;
  onNavigate: (screen: AppScreen) => void;
  onStartQuickFocus: (minutes: number, intention?: string) => void;
  onPrefillFocus?: (minutes: number, intention?: string) => void;
  onToggleDailyChallenge: () => void;
  onQuickCompleteHabit: (habitId: string) => void;
  onToggleDashboardWidget: (widget: WidgetKey) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  state,
  onNavigate,
  onStartQuickFocus,
  onPrefillFocus,
  onToggleDailyChallenge,
  onQuickCompleteHabit,
  onToggleDashboardWidget,
}) => {
  const t = getCopy(state.language);
  const isRtl = state.language === "ar";
  const DirectionalArrow = isRtl ? ArrowLeft : ArrowRight;
  const today = getTodayISO();
  const [showCustomize, setShowCustomize] = useState(false);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t.dashboard.greetingMorning
      : hour < 18
        ? t.dashboard.greetingAfternoon
        : t.dashboard.greetingEvening;

  const metrics = useMemo(() => computeDashboardMetrics(state, today), [state, today]);
  const hidden = new Set(state.dashboardPreferences?.hiddenWidgets || []);
  const challengeCompleted = state.dailyChallengeCompletedDate === today;
  const activeChallengeText =
    state.customDailyChallenge?.date === today
      ? state.customDailyChallenge.title
      : t.dashboard.challengeText;

  const isBrandNewUser = useMemo(() => {
    const activeSessions = state.sessions.filter((s) => !s.deletedAt && s.durationMinutes > 0);
    const activeHabits = state.habits.filter((h) => !h.deletedAt);
    const activeLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
    const activeCheckIns = state.checkIns.filter((c) => !c.deletedAt);
    return (
      activeSessions.length === 0 &&
      activeHabits.length === 0 &&
      activeLogs.length === 0 &&
      activeCheckIns.length === 0
    );
  }, [state.sessions, state.habits, state.screenTimeLogs, state.checkIns]);

  // Build consistent 7-day data using shared getDailyFocusMinutes
  const weeklyDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const offset = 6 - i;
        const iso = getPastDateISO(offset, today);
        const d = parseLocalDateISO(iso);
        const mins = getDailyFocusMinutes(state.sessions, iso);
        const label = d.toLocaleDateString(state.language === "ar" ? "ar-EG" : "en-US", {
          weekday: "short",
        });
        return { iso, label, mins, isToday: iso === today };
      }),
    [state.sessions, state.language, today]
  );

  const maxWeeklyMins = Math.max(60, ...weeklyDays.map((d) => d.mins));

  const coachPreview =
    state.language === "ar"
      ? metrics.todayFocusMinutes >= metrics.dailyFocusTarget
        ? `رائع يا ${state.user.name} — حققت هدفك اليومي (${metrics.todayFocusMinutes} د). حافظ على هدوء مسائك بعيداً عن الشاشات.`
        : `تبقى ${metrics.dailyFocusTarget - metrics.todayFocusMinutes} دقيقة للوصول إلى هدفك اليومي. جرّب جلسة هادئة لمدة 15 دقيقة الآن.`
      : metrics.todayFocusMinutes >= metrics.dailyFocusTarget
        ? `Well done, ${state.user.name} — you hit today's ${metrics.dailyFocusTarget}-minute target. Protect tonight's rest offline.`
        : `${metrics.dailyFocusTarget - metrics.todayFocusMinutes} minutes left to reach today's target. A calm 15-minute focus block can close the gap.`;

  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (metrics.focusProgressPct / 100) * ringCircumference;
  const remainingTarget = Math.max(
    10,
    Math.min(25, metrics.dailyFocusTarget - metrics.todayFocusMinutes || 15)
  );

  const handleSmartAction = () => {
    const act = metrics.smartInsight.recommendedAction;
    if (act.ctaType === "focus") {
      const mins = act.focusMinutes || 15;
      if (onPrefillFocus) {
        onPrefillFocus(mins, act.focusIntention);
      } else {
        onStartQuickFocus(mins, act.focusIntention);
      }
      return;
    }
    onNavigate(act.ctaType);
  };

  return (
    <div className="space-y-6">
      {/* Header: Greeting, Avatar, Streak, Customize */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#F4CE25]/20 bg-[#F4CE25] text-base font-bold text-[#191B20] shadow-[0_6px_18px_rgba(244,206,37,0.16)]">
            {state.user.avatarUrl ? (
              <img
                src={state.user.avatarUrl}
                alt={state.user.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{(state.user.name || "U").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
              {greeting}, {state.user.name}
            </p>
            <h1 className="font-display text-xl font-bold text-[#F3F4F6] sm:text-2xl dark:text-[#F3F4F6]">
              {t.dashboard.heroHeadline}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-[#F4CE25]/15 bg-[#F4CE25]/[0.07] px-3.5 py-2">
            <Flame className="h-4 w-4 text-[#F4CE25]" />
            <span className="font-mono-tabular text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {metrics.focusStreakDays}
            </span>
            <span className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.dashboard.streakLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            aria-expanded={showCustomize}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-[#363B46] bg-[#222630] px-3 py-2 text-xs font-medium text-[#A6AAB4] hover:text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4] dark:hover:text-[#F3F4F6]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {showCustomize ? t.dashboard.customizeDone : t.dashboard.customizeBtn}
            </span>
          </button>
        </div>
      </header>

      {/* Optional Widget Personalization Drawer */}
      {showCustomize && (
        <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
          <h2 className="text-xs font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.dashboard.customizeTitle}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                "priorities",
                "insight",
                "weekly_snapshot",
                "daily_challenge",
                "coach_preview",
              ] as const
            ).map((key) => {
              const visible = !hidden.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={visible}
                  onClick={() => onToggleDashboardWidget(key)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    visible
                      ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                      : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                  }`}
                >
                  {visible && <Check className="h-3.5 w-3.5 text-[#F4CE25]" />}
                  <span>{t.dashboard.widgetLabels[key]}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Hero Focus Card (Always above the fold) */}
      <section className="rf-score-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[#D6B71F]"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="#252A34"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-[stroke-dashoffset] duration-500"
                />
              </svg>
              <span className="font-mono-tabular absolute text-lg font-bold text-[#20232B]">
                {metrics.focusProgressPct}%
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#4E4A36]">
                {t.dashboard.focusToday}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-[#20232B]">
                <span className="font-mono-tabular">{metrics.todayFocusMinutes}</span>{" "}
                <span className="text-base font-medium text-[#514D3B]">
                  / {metrics.dailyFocusTarget} {t.dashboard.minutesShort}
                </span>
              </p>
              <p className="mt-1 text-xs text-[#514D3B]">
                {t.dashboard.dailyTarget}: {metrics.dailyFocusTarget} {t.dashboard.minutesShort}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("focus")}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-[#20232B] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(32,35,43,0.18)] transition-colors hover:bg-[#30343E]"
          >
            <Play className="h-4 w-4" />
            <span>{t.dashboard.startFocusCta}</span>
          </button>
        </div>
      </section>

      {/* Honest Empty First-Time State instead of empty charts */}
      {isBrandNewUser ? (
        <div className="space-y-5">
          <EmptyStateCard
            icon={<Compass className="h-6 w-6" />}
            title={t.dashboard.emptyTitle}
            description={t.dashboard.emptyDesc}
            className="!py-6 sm:!py-7"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigate("habits")}
              className="flex min-h-[52px] items-center justify-between rounded-2xl border border-[#363B46] bg-[#222630] px-4 py-3 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            >
              <span>{t.nav.habits}</span>
              <DirectionalArrow className="h-4 w-4 text-[#F4CE25]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("tracker")}
              className="flex min-h-[52px] items-center justify-between rounded-2xl border border-[#363B46] bg-[#222630] px-4 py-3 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            >
              <span>{t.dashboard.logScreenTime}</span>
              <DirectionalArrow className="h-4 w-4 text-[#F4CE25]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("checkin")}
              className="flex min-h-[52px] items-center justify-between rounded-2xl border border-[#363B46] bg-[#222630] px-4 py-3 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            >
              <span>{t.dashboard.dailyCheckIn}</span>
              <DirectionalArrow className="h-4 w-4 text-[#F4CE25]" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4 Consistent Statistics Cards */}
          <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onNavigate("tracker")}
              className="rf-stat-card rounded-2xl border border-[#363B46] p-4 text-start"
            >
              <div className="flex items-center justify-between text-[#A6AAB4] dark:text-[#A6AAB4]">
                <span className="text-xs font-medium">{t.dashboard.stats.screenTime}</span>
                <span className="rf-icon-tile rf-icon-tile--violet"><Smartphone className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {metrics.todayScreenTimeMinutes}{" "}
                <span className="text-xs font-normal text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.dashboard.minutesShort}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.dashboard.stats.selfReported}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("focus")}
              className="rf-stat-card rounded-2xl border border-[#363B46] p-4 text-start"
            >
              <div className="flex items-center justify-between text-[#A6AAB4] dark:text-[#A6AAB4]">
                <span className="text-xs font-medium">{t.dashboard.stats.sessions}</span>
                <span className="rf-icon-tile rf-icon-tile--orange"><Clock className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {metrics.todaySessionsCount}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {metrics.todayFocusMinutes} {t.dashboard.minutesShort}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("habits")}
              className="rf-stat-card rounded-2xl border border-[#363B46] p-4 text-start"
            >
              <div className="flex items-center justify-between text-[#A6AAB4] dark:text-[#A6AAB4]">
                <span className="text-xs font-medium">{t.dashboard.stats.habitsDone}</span>
                <span className="rf-icon-tile rf-icon-tile--mint"><CheckCircle2 className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {metrics.completedHabitsTodayCount}/{metrics.activeHabits.length}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.nav.habits}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("checkin")}
              className="rf-stat-card rounded-2xl border border-[#363B46] p-4 text-start"
            >
              <div className="flex items-center justify-between text-[#A6AAB4] dark:text-[#A6AAB4]">
                <span className="text-xs font-medium">{t.nav.checkin}</span>
                <span className="rf-icon-tile rf-icon-tile--violet"><ClipboardCheck className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="mt-2 text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {metrics.hasTodayCheckIn ? "✓" : "—"}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {metrics.hasTodayCheckIn ? t.dashboard.checkInDone : t.dashboard.pendingCheckIn}
              </p>
            </button>
          </section>

          {/* Today's Priorities + 3-Question Smart Daily Insight */}
          {(!hidden.has("priorities") || !hidden.has("insight")) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {!hidden.has("priorities") && (
                <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
                  <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.dashboard.prioritiesTitle}
                  </h2>

                  <div className="mt-4 space-y-2.5">
                    {metrics.scheduledHabitsDueToday.slice(0, 3).map((habit) => {
                      const label =
                        state.language === "ar" && habit.titleAr ? habit.titleAr : habit.title;
                      return (
                        <div
                          key={habit.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[#363B46] bg-[#151820] px-3.5 py-2.5 dark:border-[#3A404C] dark:bg-[#151820]"
                        >
                          <span className="truncate text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                            {label}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuickCompleteHabit(habit.id)}
                            className="min-h-[36px] shrink-0 rounded-xl bg-[#F4CE25] px-3 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                          >
                            {t.habits.markComplete}
                          </button>
                        </div>
                      );
                    })}

                    {metrics.todayFocusMinutes < metrics.dailyFocusTarget && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#363B46] bg-[#151820] px-3.5 py-2.5 dark:border-[#3A404C] dark:bg-[#151820]">
                        <span className="text-sm text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {t.dashboard.suggestedFocus} ({remainingTarget} {t.dashboard.minutesShort})
                        </span>
                        <button
                          type="button"
                          onClick={() => onStartQuickFocus(remainingTarget)}
                          className="min-h-[36px] shrink-0 rounded-xl border border-[#F4CE25] bg-[#222630] px-3 text-xs font-semibold text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#F4CE25] dark:bg-[#222630] dark:text-[#F3F4F6]"
                        >
                          {t.focus.start}
                        </button>
                      </div>
                    )}

                    {!metrics.hasTodayCheckIn && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#363B46] bg-[#151820] px-3.5 py-2.5 dark:border-[#3A404C] dark:bg-[#151820]">
                        <span className="text-sm text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {t.dashboard.pendingCheckIn}
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate("checkin")}
                          className="min-h-[36px] shrink-0 rounded-xl border border-[#363B46] bg-[#222630] px-3 text-xs font-semibold text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
                        >
                          {t.nav.checkin}
                        </button>
                      </div>
                    )}

                    {metrics.scheduledHabitsDueToday.length === 0 &&
                      metrics.todayFocusMinutes >= metrics.dailyFocusTarget &&
                      metrics.hasTodayCheckIn && (
                        <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.dashboard.prioritiesEmpty}
                        </p>
                      )}
                  </div>
                </section>
              )}

              {!hidden.has("insight") && (
                <section className="flex flex-col justify-between rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#F4CE25]">
                      <Lightbulb className="h-4 w-4" />
                      <h2>{t.dashboard.insightTitle}</h2>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.dashboard.insightQ1}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {metrics.smartInsight.whatIsHappening}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.dashboard.insightQ2}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {metrics.smartInsight.whatNeedsAttention}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#363B46] bg-[#151820] p-3.5 dark:border-[#3A404C] dark:bg-[#151820]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#F4CE25]">
                          {t.dashboard.insightQ3}
                        </p>
                        <p className="mt-0.5 font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {metrics.smartInsight.recommendedAction.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                          <span className="font-semibold">{t.dashboard.insightWhy}: </span>
                          {metrics.smartInsight.recommendedAction.why}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSmartAction}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#F4CE25] px-4 py-2 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                    >
                      <span>{metrics.smartInsight.recommendedAction.ctaLabel}</span>
                      <DirectionalArrow className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate("review")}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      >
                        <CalendarRange className="h-3.5 w-3.5 text-[#F4CE25]" />
                        <span>{t.dashboard.weeklyReviewBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate("analytics")}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-[#F4CE25]" />
                        <span>{t.dashboard.viewAnalytics}</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Weekly Snapshot + 7-day Rhythm */}
          {!hidden.has("weekly_snapshot") && (
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.dashboard.weeklySnapshotTitle}
                  </h2>
                  <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.dashboard.weeklySubtitle}
                  </p>
                </div>
                {metrics.focusWeekDeltaMinutes !== null && (
                  <p className="font-mono-tabular text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {metrics.focusWeekDeltaMinutes >= 0 ? "+" : ""}
                    {metrics.focusWeekDeltaMinutes} {t.dashboard.minutesShort}{" "}
                    {metrics.focusWeekDeltaPct !== null &&
                      `(${metrics.focusWeekDeltaPct >= 0 ? "+" : ""}${metrics.focusWeekDeltaPct}%)`}{" "}
                    {t.dashboard.vsPrevWeek}
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                  <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.dashboard.weeklyFocusLabel}
                  </p>
                  <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {metrics.weeklyFocusMinutes} {t.dashboard.minutesShort}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                  <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.dashboard.weeklySessionsLabel}
                  </p>
                  <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {metrics.weeklySessionsCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                  <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.dashboard.weeklyHabitLabel}
                  </p>
                  <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {metrics.weeklyHabitCompletionPct}%
                  </p>
                </div>
                <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                  <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.dashboard.weeklyScreenLabel}
                  </p>
                  <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {metrics.weeklyScreenTimeMinutes} {t.dashboard.minutesShort}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-7 items-end gap-2 sm:gap-4" style={{ height: 132 }}>
                {weeklyDays.map((day) => {
                  const barHeight = Math.max(6, Math.round((day.mins / maxWeeklyMins) * 92));
                  return (
                    <div key={day.iso} className="flex flex-col items-center gap-2">
                      <span className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                        {day.mins > 0 ? day.mins : "—"}
                      </span>
                      <div className="flex h-24 w-full items-end justify-center">
                        <div
                          style={{ height: `${barHeight}px` }}
                          className={`w-full max-w-[34px] rounded-xl transition-all ${
                            day.isToday
                              ? "bg-[#292D37] dark:bg-[#F4CE25]"
                              : day.mins > 0
                                ? "bg-[#F4CE25]/75"
                                : "bg-[#292D37] dark:bg-[#292D37]"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-medium ${
                          day.isToday
                            ? "font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]"
                            : "text-[#A6AAB4] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Daily Challenge & AI Coach Preview */}
          {(!hidden.has("daily_challenge") || !hidden.has("coach_preview")) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {!hidden.has("daily_challenge") && (
                <section className="flex flex-col justify-between rounded-3xl border border-[#363B46] bg-[#292D37]/70 p-6 dark:border-[#3A404C] dark:bg-[#292D37]">
                  <div>
                    <p className="text-xs font-semibold text-[#F4CE25]">
                      {t.dashboard.challengeKicker}
                    </p>
                    <p className="mt-2 font-display text-lg font-semibold leading-snug text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {activeChallengeText}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={onToggleDailyChallenge}
                      aria-pressed={challengeCompleted}
                      className={`min-h-[44px] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                        challengeCompleted
                          ? "bg-[#292D37] text-white dark:bg-[#F4CE25]"
                          : "border border-[#363B46] bg-[#222630] text-[#F3F4F6] hover:bg-[#151820] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
                      }`}
                    >
                      {challengeCompleted ? `✓ ${t.dashboard.challengeDone}` : t.dashboard.challengeMarkDone}
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartQuickFocus(15, activeChallengeText)}
                      className="min-h-[44px] whitespace-nowrap rounded-xl bg-[#F4CE25] px-4 py-2 text-xs font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
                    >
                      {t.dashboard.challengeStartTimer}
                    </button>
                  </div>
                </section>
              )}

              {!hidden.has("coach_preview") && (
                <section className="flex flex-col justify-between rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#F4CE25]">
                      <Sparkles className="h-4 w-4" />
                      <span>{t.dashboard.coachPreviewKicker}</span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {coachPreview}
                    </p>
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onNavigate("coach")}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#363B46] bg-[#151820] px-4 py-2 text-xs font-semibold text-[#F3F4F6] transition-colors hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                    >
                      <span>{t.dashboard.openCoach}</span>
                      <DirectionalArrow className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
