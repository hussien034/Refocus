import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Info,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  Target,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  computeScreenTimeInsights,
  getPastDateISO,
  getTodayISO,
  parseLocalDateISO,
} from "../../services/analytics/metricsEngine";
import { Language, ScreenTimeEntry, ScreenTimePeriod } from "../../types/refocus";
import { EmptyStateCard } from "../common/EmptyStateCard";

interface ScreenTimeScreenProps {
  language: Language;
  logs: ScreenTimeEntry[];
  dailyGoalMinutes?: number;
  prefillGoalMinutes?: number | null;
  onClearPrefillGoal?: () => void;
  onUpdateDailyGoal: (goalMinutes: number | undefined) => void;
  onAddLog: (entry: Omit<ScreenTimeEntry, "id" | "createdAt">) => void;
  onDeleteLog: (id: string) => void;
  onBackDashboard: () => void;
}

const QUICK_APPS = ["Instagram", "TikTok", "YouTube", "X", "Reddit", "Facebook"];

export const ScreenTimeScreen: React.FC<ScreenTimeScreenProps> = ({
  language,
  logs,
  dailyGoalMinutes,
  prefillGoalMinutes,
  onClearPrefillGoal,
  onUpdateDailyGoal,
  onAddLog,
  onDeleteLog,
  onBackDashboard,
}) => {
  const t = getCopy(language);
  const isRtl = language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const today = getTodayISO();
  const appInputRef = useRef<HTMLInputElement>(null);

  const [appName, setAppName] = useState("Instagram");
  const [category, setCategory] = useState<ScreenTimeEntry["category"]>("Social Media");
  const [duration, setDuration] = useState("25");
  const [date, setDate] = useState(today);
  const [periodOfDay, setPeriodOfDay] = useState<ScreenTimePeriod | "">("");

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(
    dailyGoalMinutes ? String(dailyGoalMinutes) : "60"
  );

  useEffect(() => {
    if (prefillGoalMinutes && Number.isFinite(prefillGoalMinutes)) {
      setGoalDraft(String(prefillGoalMinutes));
      setEditingGoal(true);
      onClearPrefillGoal?.();
    }
  }, [prefillGoalMinutes, onClearPrefillGoal]);

  const activeLogs = useMemo(() => logs.filter((l) => !l.deletedAt), [logs]);
  const insights = useMemo(
    () => computeScreenTimeInsights(activeLogs, today),
    [activeLogs, today]
  );

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const offset = 6 - i;
        const iso = getPastDateISO(offset, today);
        const d = parseLocalDateISO(iso);
        const dayLogs = activeLogs.filter((l) => l.date === iso);
        const mins =
          dayLogs.length > 0
            ? dayLogs.reduce((s, l) => s + l.durationMinutes, 0)
            : null;
        const label = d.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
          weekday: "short",
        });
        return { iso, label, mins };
      }),
    [activeLogs, language, today]
  );

  const maxTrend = Math.max(60, ...last7Days.map((d) => d.mins ?? 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Number(duration);
    if (!appName.trim() || !Number.isFinite(mins) || mins <= 0) return;

    onAddLog({
      appName: appName.trim(),
      category,
      durationMinutes: Math.round(mins),
      date,
      ...(periodOfDay ? { periodOfDay } : {}),
    });
    setDuration("20");
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(goalDraft);
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 480) {
      onUpdateDailyGoal(Math.round(parsed));
    }
    setEditingGoal(false);
  };

  const goalPct =
    dailyGoalMinutes && dailyGoalMinutes > 0
      ? Math.min(100, Math.round((insights.todayTotalMinutes / dailyGoalMinutes) * 100))
      : null;

  return (
    <div className="space-y-6">
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
            {t.tracker.title}
          </h1>
          <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.tracker.subtitle}</p>
        </div>
      </div>

      {/* Honest Self-Reported Disclosure */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#363B46] bg-[#292D37] p-4 text-sm dark:border-[#3A404C] dark:bg-[#292D37]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#F4CE25]" />
        <div>
          <p className="font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.tracker.disclosureTitle}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
            {t.tracker.disclosureBody}
          </p>
        </div>
      </div>

      {/* Summary KPIs + Daily Goal + 7-Day Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
            <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.tracker.todayTotal}</p>
            <p className="font-mono-tabular mt-2 text-3xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {insights.todayTotalMinutes}
              <span className="ms-1 text-xs font-normal text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.dashboard.minutesShort}
              </span>
            </p>
            {dailyGoalMinutes && goalPct !== null && (
              <div className="mt-3">
                <p className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.tracker.goalProgress
                    .replace("{today}", String(insights.todayTotalMinutes))
                    .replace("{goal}", String(dailyGoalMinutes))}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#292D37] dark:bg-[#292D37]">
                  <div
                    style={{ width: `${goalPct}%` }}
                    className={`h-full rounded-full ${
                      insights.todayTotalMinutes > dailyGoalMinutes
                        ? "bg-amber-600 dark:bg-amber-400"
                        : "bg-[#F4CE25]"
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
            <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.tracker.weeklyAvg}</p>
            <p className="font-mono-tabular mt-2 text-3xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {insights.averagePerLoggedDayMinutes !== null
                ? insights.averagePerLoggedDayMinutes
                : "—"}
              {insights.averagePerLoggedDayMinutes !== null && (
                <span className="ms-1 text-xs font-normal text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.dashboard.minutesShort}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.tracker.dailyAvgAcrossLogged.replace(
                "{days}",
                String(insights.loggedDaysCount)
              )}
            </p>
          </div>

          {/* Daily Screen-Time Goal Editor */}
          <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 sm:col-span-2 dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <Target className="h-4 w-4 text-[#F4CE25]" />
                <span>{t.tracker.goalLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingGoal((v) => !v)}
                className="text-xs font-semibold text-[#F4CE25] hover:underline"
              >
                {editingGoal ? t.common.cancel : t.tracker.goalEditBtn}
              </button>
            </div>
            {editingGoal ? (
              <form onSubmit={handleSaveGoal} className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={480}
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  aria-label={t.tracker.goalLabel}
                  className="font-mono-tabular min-h-[40px] w-28 rounded-xl border border-[#363B46] bg-[#151820] px-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl bg-[#F4CE25] px-4 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                >
                  {t.tracker.goalSaveBtn}
                </button>
              </form>
            ) : (
              <p className="mt-1.5 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {dailyGoalMinutes
                  ? `${dailyGoalMinutes} ${t.dashboard.minutesShort}`
                  : t.tracker.goalNotSet}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-5 lg:col-span-7 dark:border-[#3A404C] dark:bg-[#222630]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.tracker.weeklyTrendTitle}
            </h2>
            <span className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.tracker.missingDaysNote}
            </span>
          </div>
          <div className="mt-4 grid h-32 grid-cols-7 items-end gap-2">
            {last7Days.map((d) => {
              const val = d.mins ?? 0;
              const hPct =
                d.mins !== null ? Math.max(8, Math.round((val / maxTrend) * 100)) : 5;
              return (
                <div key={d.iso} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <span className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {d.mins !== null ? d.mins : "—"}
                  </span>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg ${
                        d.mins !== null
                          ? "bg-[#F4CE25]/80"
                          : "bg-[#292D37] dark:bg-[#292D37]"
                      }`}
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly Comparison, App Breakdown & Period Usage Patterns */}
      {activeLogs.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Weekly Comparison */}
          <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
            <h2 className="font-display text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.tracker.weeklyCompTitle}
            </h2>
            {!insights.weeklyComparison.hasValidBaseline ? (
              <p className="mt-3 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.tracker.weeklyCompNeedBaseline}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  {insights.weeklyComparison.absoluteDiff > 0 ? (
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-[#F4CE25]" />
                  )}
                  <span className="text-xs font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {insights.weeklyComparison.absoluteDiff > 10
                      ? t.tracker.weeklyIncreased
                      : insights.weeklyComparison.absoluteDiff < -10
                        ? t.tracker.weeklyDecreased
                        : t.tracker.weeklySteady}
                  </span>
                </div>
                <p className="font-mono-tabular text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {insights.weeklyComparison.absoluteDiff >= 0 ? "+" : ""}
                  {insights.weeklyComparison.absoluteDiff} {t.dashboard.minutesShort}
                  {insights.weeklyComparison.percentChange !== null &&
                    ` (${insights.weeklyComparison.percentChange >= 0 ? "+" : ""}${insights.weeklyComparison.percentChange}%)`}
                </p>
                <p className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {insights.currentWeekTotalMinutes}m vs {insights.previousWeekTotalMinutes}m
                </p>
              </div>
            )}
          </section>

          {/* App Usage Breakdown */}
          <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
            <h2 className="font-display text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.tracker.appBreakdownTitle}
            </h2>
            {insights.topApps.length === 0 ? (
              <p className="mt-3 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.tracker.emptyLogs}
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {insights.topApps.slice(0, 4).map((app) => (
                  <div key={app.appName}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                        {app.appName}
                      </span>
                      <span className="font-mono-tabular text-[#A6AAB4] dark:text-[#A6AAB4]">
                        {app.weeklyMinutes} {t.dashboard.minutesShort} ({app.sharePct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#292D37] dark:bg-[#292D37]">
                      <div
                        style={{ width: `${app.sharePct}%` }}
                        className="h-full rounded-full bg-[#F4CE25]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Usage Time Patterns (strictly gated on >= 3 period-tagged entries) */}
          <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-5 dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              <Clock className="h-4 w-4 text-[#F4CE25]" />
              <h2>{t.tracker.periodPatternTitle}</h2>
            </div>

            {!insights.hasSufficientPeriodData ? (
              <p className="mt-3 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.tracker.periodPatternInsufficient}
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {insights.dominantPeriod && (
                  <p className="text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.tracker.periodPatternDominant
                      .replace("{period}", t.tracker.periods[insights.dominantPeriod])
                      .replace(
                        "{pct}",
                        String(
                          insights.periodBreakdown.find(
                            (p) => p.period === insights.dominantPeriod
                          )?.pct || 0
                        )
                      )}
                  </p>
                )}
                {insights.periodBreakdown.map((p) => (
                  <div key={p.period} className="flex items-center justify-between text-xs">
                    <span className="text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {t.tracker.periods[p.period]}
                    </span>
                    <span className="font-mono-tabular font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {p.minutes} {t.dashboard.minutesShort} ({p.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Add Usage Form + Recent Logs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-[#363B46] bg-[#222630] p-6 lg:col-span-5 dark:border-[#3A404C] dark:bg-[#222630]"
        >
          <h2 className="font-display text-base font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.tracker.addRecord}
          </h2>

          <div>
            <label
              htmlFor="tracker-app-name"
              className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
            >
              {t.tracker.appLabel}
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_APPS.map((app) => (
                <button
                  key={app}
                  type="button"
                  aria-pressed={appName === app}
                  onClick={() => setAppName(app)}
                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-medium transition-colors ${
                    appName === app
                      ? "bg-[#F4CE25] text-[#191B20]"
                      : "bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>
            <input
              id="tracker-app-name"
              ref={appInputRef}
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder={t.tracker.appPlaceholder}
              className="min-h-[46px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tracker-category"
                className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
              >
                {t.tracker.categoryLabel}
              </label>
              <select
                id="tracker-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ScreenTimeEntry["category"])}
                className="min-h-[46px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              >
                {t.tracker.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t.tracker.categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tracker-duration"
                className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
              >
                {t.tracker.durationLabel}
              </label>
              <input
                id="tracker-duration"
                type="number"
                min={1}
                max={720}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="font-mono-tabular min-h-[46px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tracker-date"
                className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
              >
                {t.tracker.dateLabel}
              </label>
              <input
                id="tracker-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="font-mono-tabular min-h-[46px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              />
            </div>

            <div>
              <label
                htmlFor="tracker-period"
                className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
              >
                {t.tracker.periodLabel}
              </label>
              <select
                id="tracker-period"
                value={periodOfDay}
                onChange={(e) => setPeriodOfDay(e.target.value as ScreenTimePeriod | "")}
                className="min-h-[46px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              >
                <option value="">{t.tracker.periods.unspecified}</option>
                {(["morning", "afternoon", "evening", "night"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t.tracker.periods[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#F4CE25] px-4 py-2.5 text-sm font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
          >
            <Plus className="h-4 w-4" />
            <span>{t.tracker.saveRecord}</span>
          </button>
        </form>

        {/* Entries list or contextual empty state */}
        <div className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 lg:col-span-7 dark:border-[#3A404C] dark:bg-[#222630]">
          <h2 className="font-display text-base font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.tracker.recentLogsTitle}
          </h2>

          {activeLogs.length === 0 ? (
            <div className="mt-4">
              <EmptyStateCard
                icon={<Smartphone className="h-6 w-6" />}
                title={t.tracker.emptyTitle}
                description={t.tracker.emptyDesc}
                actionLabel={t.tracker.emptyCta}
                onAction={() => appInputRef.current?.focus()}
              />
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#363B46] dark:divide-[#3A404C]">
              {activeLogs.slice(0, 12).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {entry.appName}
                    </p>
                    <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {t.tracker.categoryLabels[entry.category]} <span aria-hidden="true">·</span>{" "}
                      <span className="font-mono-tabular">{entry.date}</span>
                      {entry.periodOfDay && (
                        <>
                          {" "}
                          <span aria-hidden="true">·</span>{" "}
                          <span>{t.tracker.periods[entry.periodOfDay]}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono-tabular text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {entry.durationMinutes} {t.dashboard.minutesShort}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteLog(entry.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-[#A6AAB4] hover:bg-red-50 hover:text-red-600 dark:text-[#A6AAB4] dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      aria-label={t.tracker.deleteEntryLabel}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
