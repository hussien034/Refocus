import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Lock, Loader2, BarChart3, CalendarRange } from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  computeAnalyticsSummary,
  getPastDateISO,
  getTodayISO,
} from "../../services/analytics/metricsEngine";
import { fetchWeeklyInsight } from "../../services/coachService";
import { calculateHabitStreak, calculateOverallFocusStreak } from "../../services/storageService";
import { AppState, ScreenTimeEntry } from "../../types/refocus";
import { EmptyStateCard } from "../common/EmptyStateCard";

interface AnalyticsScreenProps {
  state: AppState;
  onBackDashboard: () => void;
  onOpenWeeklyReview: () => void;
  onOpenUpgrade: () => void;
}

type RangeMode = "7" | "30" | "90" | "custom";

const DONUT_COLORS: Record<ScreenTimeEntry["category"], string> = {
  "Social Media": "#F4CE25",
  "Short Video": "#F3F4F6",
  Messaging: "#69717F",
  News: "#B98645",
  Entertainment: "#8274C9",
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({
  state,
  onBackDashboard,
  onOpenWeeklyReview,
  onOpenUpgrade,
}) => {
  const t = getCopy(state.language);
  const isRtl = state.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const today = getTodayISO();

  const [rangeMode, setRangeMode] = useState<RangeMode>("7");
  const [customStart, setCustomStart] = useState(() => getPastDateISO(13, today));
  const [customEnd, setCustomEnd] = useState(today);
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [weeklyReportError, setWeeklyReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const isPremium = state.user.plan === "premium";

  const { startISO, endISO } = useMemo(() => {
    if (rangeMode === "custom") {
      const s = customStart <= customEnd ? customStart : customEnd;
      const e = customEnd >= customStart ? customEnd : customStart;
      return { startISO: s, endISO: e };
    }
    const days = Number(rangeMode);
    return {
      startISO: getPastDateISO(days - 1, today),
      endISO: today,
    };
  }, [rangeMode, customStart, customEnd, today]);

  const analytics = useMemo(
    () => computeAnalyticsSummary(state, startISO, endISO, state.language),
    [state, startISO, endISO]
  );

  const hasAnyWindowData =
    analytics.completedSessionsCount > 0 ||
    analytics.totalScreenMinutes > 0 ||
    analytics.perHabitMetrics.length > 0;

  const maxFocusBar = Math.max(30, ...analytics.chartBuckets.map((b) => b.focus));
  const maxScreenBar = Math.max(
    30,
    ...analytics.chartBuckets.map((b) => b.screen ?? 0)
  );

  const handleGenerateWeeklyReport = async () => {
    setReportLoading(true);
    setWeeklyReportError(null);
    try {
      const todayFocusMinutes = state.sessions
        .filter((s) => !s.deletedAt && s.status !== "interrupted" && s.date === today)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      const todayScreenTimeMinutes = state.screenTimeLogs
        .filter((l) => !l.deletedAt && l.date === today)
        .reduce((sum, l) => sum + l.durationMinutes, 0);
      const activeHabits = state.habits.filter((h) => !h.deletedAt && !h.archived);

      const res = await fetchWeeklyInsight({
        userName: state.user.name,
        language: state.language,
        dailyFocusTarget: state.onboarding.dailyFocusTarget,
        dailyScreenTimeGoalMinutes: state.onboarding.dailyScreenTimeGoalMinutes,
        todayFocusMinutes,
        todayScreenTimeMinutes,
        completedHabitsCount: activeHabits.filter((h) => h.completedDates.includes(today)).length,
        totalHabitsCount: activeHabits.length,
        streakDays: calculateOverallFocusStreak(state.sessions),
        recentHabits: activeHabits.map((h) => ({
          title: h.title,
          streak: calculateHabitStreak(h.completedDates),
          completedToday: h.completedDates.includes(today),
        })),
        recentScreenTime: state.screenTimeLogs.filter((l) => !l.deletedAt).slice(0, 6),
        latestCheckIn: state.checkIns[0] || null,
        goals: state.onboarding.goals,
        challenges: state.onboarding.challenges,
        habitInterests: state.onboarding.habitInterests,
      });
      setWeeklyReport(res.report);
    } catch (error) {
      setWeeklyReportError(
        error instanceof Error ? error.message : t.analytics.weeklyAiError
      );
    } finally {
      setReportLoading(false);
    }
  };

  // Donut arc computation
  const donutSegments = useMemo(() => {
    const r = 42;
    const c = 2 * Math.PI * r;
    let offset = 0;
    return analytics.categoryDistribution.map((item) => {
      const frac = analytics.totalScreenMinutes > 0 ? item.minutes / analytics.totalScreenMinutes : 0;
      const len = frac * c;
      const seg = {
        ...item,
        dashArray: `${len} ${c - len}`,
        dashOffset: -offset,
        color: DONUT_COLORS[item.category] || "#F4CE25",
      };
      offset += len;
      return seg;
    });
  }, [analytics.categoryDistribution, analytics.totalScreenMinutes]);

  return (
    <div className="space-y-6">
      {/* Header + Time Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackDashboard}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#363B46] bg-[#222630] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            aria-label={t.nav.home}
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.analytics.title}
            </h1>
            <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.analytics.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenWeeklyReview}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#F4CE25]/50 bg-[#292D37] px-3.5 py-2 text-xs font-semibold text-[#F3F4F6] hover:bg-[#dfe8dc] dark:bg-[#292D37] dark:text-[#F3F4F6]"
          >
            <CalendarRange className="h-3.5 w-3.5 text-[#F4CE25]" />
            <span>{t.analytics.openWeeklyReview}</span>
          </button>

          <div className="inline-flex flex-wrap rounded-xl border border-[#363B46] bg-[#222630] p-1 dark:border-[#3A404C] dark:bg-[#222630]">
            {(
              [
                { id: "7" as const, label: t.analytics.filters.d7 },
                { id: "30" as const, label: t.analytics.filters.d30 },
                { id: "90" as const, label: t.analytics.filters.d90 },
                { id: "custom" as const, label: t.analytics.filters.custom },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={rangeMode === r.id}
                onClick={() => setRangeMode(r.id)}
                className={`min-h-[40px] whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                  rangeMode === r.id
                    ? "bg-[#292D37] font-semibold text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                    : "text-[#A6AAB4] dark:text-[#A6AAB4]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {rangeMode === "custom" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
          <label className="flex items-center gap-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
            <span>{t.analytics.fromLabel}</span>
            <input
              type="date"
              value={customStart}
              max={today}
              onChange={(e) => setCustomStart(e.target.value)}
              className="min-h-[38px] rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
            <span>{t.analytics.toLabel}</span>
            <input
              type="date"
              value={customEnd}
              max={today}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="min-h-[38px] rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            />
          </label>
        </div>
      )}

      {!hasAnyWindowData ? (
        <EmptyStateCard
          icon={<BarChart3 className="h-6 w-6" />}
          title={t.analytics.emptyTitle}
          description={t.analytics.emptyDesc}
          actionLabel={t.analytics.emptyCta}
          onAction={onOpenWeeklyReview}
        />
      ) : (
        <>
          {/* Primary KPI Grid */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.analytics.kpis.focusMinutes}</p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {analytics.totalFocusMinutes} {t.dashboard.minutesShort}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.avgDailyFocus}: {analytics.averageDailyFocusMinutes} {t.dashboard.minutesShort}
              </p>
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.sessionsCompleted}
              </p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {analytics.completedSessionsCount}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.avgSession}: {analytics.averageSessionMinutes} {t.dashboard.minutesShort} ·{" "}
                {t.analytics.kpis.targetRate}: {analytics.targetAchievementRate}%
              </p>
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.analytics.kpis.habitRate}</p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {analytics.overallHabitRate}%
              </p>
              {analytics.mostProductiveDay && (
                <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.analytics.mostProductiveLabel}: {analytics.mostProductiveDay.date} (
                  {analytics.mostProductiveDay.minutes} {t.dashboard.minutesShort})
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.analytics.kpis.avgScreenTime}</p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {analytics.averagePerLoggedDayMinutes !== null
                  ? `${analytics.averagePerLoggedDayMinutes} ${t.dashboard.minutesShort}`
                  : "—"}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.totalScreenTime}: {analytics.totalScreenMinutes} {t.dashboard.minutesShort} ·{" "}
                {t.dashboard.stats.selfReported}
              </p>
            </div>
          </div>

          {/* Period Comparison Cards */}
          <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
            <h2 className="font-display text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.analytics.comparisonTitle}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#151820] p-4 dark:bg-[#151820]">
                <p className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.analytics.kpis.focusMinutes}
                </p>
                {analytics.focusComparison.hasValidBaseline ? (
                  <p className="font-mono-tabular mt-1 text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {analytics.focusComparison.absoluteDiff >= 0 ? "+" : ""}
                    {analytics.focusComparison.absoluteDiff} {t.dashboard.minutesShort}
                    {analytics.focusComparison.percentChange !== null &&
                      ` (${analytics.focusComparison.percentChange >= 0 ? "+" : ""}${analytics.focusComparison.percentChange}%)`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.analytics.insufficientBaseline}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#151820] p-4 dark:bg-[#151820]">
                <p className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.analytics.kpis.totalScreenTime} ({t.dashboard.stats.selfReported})
                </p>
                {analytics.screenComparison.hasValidBaseline ? (
                  <p className="font-mono-tabular mt-1 text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {analytics.screenComparison.absoluteDiff >= 0 ? "+" : ""}
                    {analytics.screenComparison.absoluteDiff} {t.dashboard.minutesShort}
                    {analytics.screenComparison.percentChange !== null &&
                      ` (${analytics.screenComparison.percentChange >= 0 ? "+" : ""}${analytics.screenComparison.percentChange}%)`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.analytics.insufficientBaseline}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Dual Charts: Focus Trend + Self-Reported Screen Time */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.analytics.focusChartTitle}
              </h2>
              <div className="mt-5 flex items-end gap-2 sm:gap-3" style={{ height: 150 }}>
                {analytics.chartBuckets.map((b) => {
                  const h = Math.max(6, Math.round((b.focus / maxFocusBar) * 110));
                  return (
                    <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                        {b.focus > 0 ? b.focus : "—"}
                      </span>
                      <div className="flex h-28 w-full items-end justify-center">
                        <div
                          style={{ height: `${h}px` }}
                          className={`w-full max-w-[32px] rounded-xl ${
                            b.focus > 0 ? "bg-[#F4CE25]" : "bg-[#292D37] dark:bg-[#292D37]"
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.analytics.screenChartTitle}
                </h2>
                <span className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.dashboard.stats.selfReported}
                </span>
              </div>
              <div className="mt-5 flex items-end gap-2 sm:gap-3" style={{ height: 150 }}>
                {analytics.chartBuckets.map((b) => {
                  const val = b.screen ?? 0;
                  const h =
                    b.screen !== null ? Math.max(6, Math.round((val / maxScreenBar) * 110)) : 4;
                  return (
                    <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                        {b.screen !== null ? b.screen : "—"}
                      </span>
                      <div className="flex h-28 w-full items-end justify-center">
                        <div
                          style={{ height: `${h}px` }}
                          className={`w-full max-w-[32px] rounded-xl ${
                            b.screen !== null
                              ? "bg-[#292D37]/80 dark:bg-[#A6AAB4]"
                              : "bg-[#292D37] dark:bg-[#292D37]"
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">{b.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.missingDaysNote}
              </p>
            </section>
          </div>

          {/* Screen-Time Category Donut Chart + Top Apps */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.analytics.categoryDonutTitle}
              </h2>
              {donutSegments.length === 0 ? (
                <p className="mt-4 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.tracker.emptyLogs}
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <svg className="h-28 w-28 shrink-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-[#292D37] dark:text-[#292D37]"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.category}
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="12"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                      />
                    ))}
                  </svg>
                  <div className="flex-1 space-y-2 text-xs">
                    {donutSegments.map((seg) => (
                      <div key={seg.category} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[#F3F4F6] dark:text-[#F3F4F6]">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span>{t.tracker.categoryLabels[seg.category]}</span>
                        </span>
                        <span className="font-mono-tabular text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {seg.minutes} {t.dashboard.minutesShort} ({seg.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.analytics.topAppsTitle}
              </h2>
              {analytics.topApps.length === 0 ? (
                <p className="mt-4 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.tracker.emptyLogs}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.topApps.map((app) => {
                    const pct =
                      analytics.totalScreenMinutes > 0
                        ? Math.round((app.minutes / analytics.totalScreenMinutes) * 100)
                        : 0;
                    return (
                      <div key={app.appName}>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#F3F4F6] dark:text-[#F3F4F6]">{app.appName}</span>
                          <span className="font-mono-tabular text-[#A6AAB4] dark:text-[#A6AAB4]">
                            {app.minutes} {t.dashboard.minutesShort} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#292D37] dark:bg-[#292D37]">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-[#292D37] dark:bg-[#F4CE25]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Habit Consistency & Weekly AI Report */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.analytics.habitBreakdownTitle}
              </h2>
              {analytics.perHabitMetrics.length === 0 ? (
                <p className="mt-4 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.habits.emptyActive}</p>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {analytics.perHabitMetrics.map((m) => {
                    const label =
                      state.language === "ar" && m.habit.titleAr ? m.habit.titleAr : m.habit.title;
                    return (
                      <div key={m.habit.id}>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#F3F4F6] dark:text-[#F3F4F6]">{label}</span>
                          <span className="font-mono-tabular text-[#A6AAB4] dark:text-[#A6AAB4]">
                            {m.completionRate}% ({m.completedInWindow}/{m.scheduledInWindow})
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#292D37] dark:bg-[#292D37]">
                          <div
                            style={{ width: `${m.completionRate}%` }}
                            className="h-full rounded-full bg-[#F4CE25]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F4CE25]">
                <Sparkles className="h-4 w-4" />
                <span>{t.analytics.weeklyAiTitle}</span>
              </div>

              {!isPremium ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-2.5 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#F4CE25]" />
                    <p>{t.analytics.weeklyAiLocked}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenUpgrade}
                    className="min-h-[44px] rounded-xl bg-[#292D37] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1b2c25] dark:bg-[#F4CE25]"
                  >
                    {t.coach.upgradeCta}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {weeklyReport && (
                    <div className="whitespace-pre-line rounded-2xl bg-[#151820] p-4 text-sm leading-relaxed text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]">
                      {weeklyReport}
                    </div>
                  )}
                  {weeklyReportError && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200"
                    >
                      {weeklyReportError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={reportLoading}
                    onClick={handleGenerateWeeklyReport}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F4CE25] px-4 py-2 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816] disabled:opacity-60"
                  >
                    {reportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>
                      {reportLoading ? t.analytics.weeklyAiGenerating : t.analytics.weeklyAiGenerate}
                    </span>
                  </button>
                </div>
              )}

              <p className="mt-5 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.noteNoScore}
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
