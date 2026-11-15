import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Target,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  computeWeeklyReview,
  getAvailableReviewWeeks,
  getTodayISO,
  parseLocalDateISO,
} from "../../services/analytics/metricsEngine";
import { AppScreen, AppState } from "../../types/refocus";
import { EmptyStateCard } from "../common/EmptyStateCard";

interface WeeklyReviewScreenProps {
  state: AppState;
  onNavigate: (screen: AppScreen) => void;
  onSaveWeeklyReflection: (weekStartISO: string, note: string) => void;
}

export const WeeklyReviewScreen: React.FC<WeeklyReviewScreenProps> = ({
  state,
  onNavigate,
  onSaveWeeklyReflection,
}) => {
  const t = getCopy(state.language);
  const isRtl = state.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const locale = state.language === "ar" ? "ar-EG" : "en-US";
  const today = getTodayISO();

  const availableWeeks = useMemo(
    () => getAvailableReviewWeeks(state, today, 8),
    [state, today]
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(availableWeeks[0]);

  useEffect(() => {
    if (!availableWeeks.includes(selectedWeekStart)) {
      setSelectedWeekStart(availableWeeks[0]);
    }
  }, [availableWeeks, selectedWeekStart]);

  const report = useMemo(
    () => computeWeeklyReview(state, selectedWeekStart, today),
    [state, selectedWeekStart, today]
  );

  const savedNote = state.weeklyReflections?.[selectedWeekStart] || "";
  const [noteDraft, setNoteDraft] = useState(savedNote);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setNoteDraft(state.weeklyReflections?.[selectedWeekStart] || "");
  }, [selectedWeekStart, state.weeklyReflections]);

  const formatWeekRange = (startISO: string, endISO: string) => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const s = parseLocalDateISO(startISO).toLocaleDateString(locale, opts);
    const e = parseLocalDateISO(endISO).toLocaleDateString(locale, opts);
    return `${s} – ${e}`;
  };

  const maxFocusDay = Math.max(30, ...report.dailyBreakdown.map((d) => d.focusMinutes));
  const maxScreenDay = Math.max(
    30,
    ...report.dailyBreakdown.map((d) => d.screenMinutes ?? 0)
  );

  const handleSaveReflection = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWeeklyReflection(selectedWeekStart, noteDraft.trim());
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#363B46] bg-[#222630] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            aria-label={t.nav.home}
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.review.title}
            </h1>
            <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.review.subtitle}</p>
          </div>
        </div>

        {/* Week Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="weekly-review-selector"
            className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
          >
            {t.review.weekSwitcherLabel}
          </label>
          <select
            id="weekly-review-selector"
            value={selectedWeekStart}
            onChange={(e) => setSelectedWeekStart(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#363B46] bg-[#222630] px-3 text-xs font-medium text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
          >
            {availableWeeks.map((ws, idx) => {
              const r = computeWeeklyReview(state, ws, today);
              const badge =
                idx === 0 ? ` · ${t.review.currentWeekBadge}` : "";
              return (
                <option key={ws} value={ws}>
                  {formatWeekRange(r.weekStartISO, r.weekEndISO)}
                  {badge}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Incomplete week indicator */}
      {report.isIncompleteWeek && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-[#F4CE25]/40 bg-[#292D37] px-4 py-3 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-[#F4CE25]" />
          <span>
            {t.review.inProgressNote.replaceAll("{days}", String(report.daysElapsedInWeek))}
          </span>
        </div>
      )}

      {!report.hasSufficientData ? (
        <EmptyStateCard
          icon={<CalendarRange className="h-6 w-6" />}
          title={t.review.emptyTitle}
          description={t.review.emptyDesc}
          actionLabel={t.review.emptyCta}
          onAction={() => onNavigate("focus")}
        />
      ) : (
        <>
          {/* Summary KPI Strip */}
          <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.focusMinutes}
              </p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {report.focusMinutes} {t.dashboard.minutesShort}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {report.focusSessionsCount} {t.dashboard.stats.sessions}
                {report.focusComparison.hasValidBaseline
                  ? ` · ${report.focusComparison.absoluteDiff >= 0 ? "+" : ""}${report.focusComparison.absoluteDiff} ${t.dashboard.minutesShort}`
                  : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.analytics.kpis.habitRate}
              </p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {report.habitCompletionPct}%
              </p>
              {report.prevHabitCompletionPct !== null && (
                <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.dashboard.vsPrevWeek}: {report.prevHabitCompletionPct}%
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.dashboard.stats.screenTime}
              </p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {report.screenTimeMinutes} {t.dashboard.minutesShort}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.dashboard.stats.selfReported} ({report.screenLoggedDaysCount}d)
              </p>
            </div>

            <div className="rounded-2xl border border-[#363B46] bg-[#222630] p-4 dark:border-[#3A404C] dark:bg-[#222630]">
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.review.activeDaysLabel}
              </p>
              <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {report.activeDaysCount}/{report.daysElapsedInWeek}
              </p>
              <p className="mt-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.review.checkInsLabel}: {report.checkInsCount}
              </p>
            </div>
          </section>

          {/* What improved & What needs gentle attention */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <TrendingUp className="h-4 w-4 text-[#F4CE25]" />
                <h2>{t.review.improvedTitle}</h2>
              </div>
              {report.improvedItems.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.review.noImprovedItems}
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {report.improvedItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 rounded-2xl bg-[#151820] p-3.5 text-sm leading-relaxed text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F4CE25]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2>{t.review.attentionTitle}</h2>
              </div>
              {report.attentionItems.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.review.noAttentionItems}
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {report.attentionItems.map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-[#363B46] bg-[#151820] p-3.5 text-sm leading-relaxed text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Daily Focus & Screen-Time Breakdown */}
          <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.review.dailyBreakdownTitle}
              </h2>
              <div className="flex items-center gap-4 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#F4CE25]" />
                  <span>{t.review.focusLegend}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#292D37] dark:bg-[#A6AAB4]" />
                  <span>{t.review.screenLegend}</span>
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 items-end gap-2 sm:gap-4" style={{ height: 148 }}>
              {report.dailyBreakdown.map((day) => {
                const label = parseLocalDateISO(day.iso).toLocaleDateString(locale, {
                  weekday: "short",
                });
                const fH = Math.max(4, Math.round((day.focusMinutes / maxFocusDay) * 96));
                const sH =
                  day.screenMinutes !== null
                    ? Math.max(4, Math.round((day.screenMinutes / maxScreenDay) * 96))
                    : 4;
                return (
                  <div key={day.iso} className="flex flex-col items-center gap-1.5">
                    <span className="font-mono-tabular text-[10px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {day.focusMinutes > 0 ? `${day.focusMinutes}m` : "—"}
                    </span>
                    <div className="flex h-24 w-full items-end justify-center gap-1">
                      <div
                        style={{ height: `${fH}px` }}
                        title={`${t.review.focusLegend}: ${day.focusMinutes}`}
                        className={`w-3 rounded-t-md ${
                          day.focusMinutes > 0
                            ? "bg-[#F4CE25]"
                            : "bg-[#292D37] dark:bg-[#292D37]"
                        }`}
                      />
                      <div
                        style={{ height: `${sH}px` }}
                        title={`${t.review.screenLegend}: ${day.screenMinutes ?? "—"}`}
                        className={`w-3 rounded-t-md ${
                          day.screenMinutes !== null
                            ? "bg-[#292D37]/80 dark:bg-[#A6AAB4]"
                            : "bg-[#292D37] dark:bg-[#292D37]"
                        }`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.analytics.missingDaysNote}
            </p>
          </section>

          {/* Next Week's Realistic Goals + Closing Reflection */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <Target className="h-4 w-4 text-[#F4CE25]" />
                <h2>{t.review.goalsTitle}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {report.nextWeekGoals.map((g) => (
                  <div
                    key={g.title}
                    className="rounded-2xl border border-[#363B46] bg-[#151820] p-4 dark:border-[#3A404C] dark:bg-[#151820]"
                  >
                    <p className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {g.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {g.reason}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <Sparkles className="h-4 w-4 text-[#F4CE25]" />
                <h2>{t.review.closingTitle}</h2>
              </div>
              <p className="mt-3 rounded-2xl bg-[#292D37]/70 p-4 text-sm leading-relaxed text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]">
                {report.closingReflection}
              </p>

              <form onSubmit={handleSaveReflection} className="mt-4 space-y-3">
                <label
                  htmlFor="weekly-reflection-note"
                  className="block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
                >
                  {t.review.reflectionLabel}
                </label>
                <textarea
                  id="weekly-reflection-note"
                  rows={3}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder={t.review.reflectionPlaceholder}
                  className="w-full rounded-xl border border-[#363B46] bg-[#151820] p-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    className="min-h-[42px] rounded-xl bg-[#F4CE25] px-4 py-2 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                  >
                    {t.review.saveReflection}
                  </button>
                  {savedToast && (
                    <span role="status" className="text-xs font-medium text-[#F4CE25]">
                      {t.review.reflectionSaved}
                    </span>
                  )}
                </div>
              </form>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
