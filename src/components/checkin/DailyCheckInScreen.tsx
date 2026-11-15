import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { getCopy } from "../../i18n/translations";
import { getTodayISO } from "../../services/analytics/metricsEngine";
import { DailyCheckIn, Language } from "../../types/refocus";

interface DailyCheckInScreenProps {
  language: Language;
  checkIns: DailyCheckIn[];
  onSaveCheckIn: (entry: Omit<DailyCheckIn, "id" | "createdAt">, existingId?: string) => void;
  onBackDashboard: () => void;
}

export const DailyCheckInScreen: React.FC<DailyCheckInScreenProps> = ({
  language,
  checkIns,
  onSaveCheckIn,
  onBackDashboard,
}) => {
  const t = getCopy(language);
  const isRtl = language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const today = getTodayISO();

  const existingToday = checkIns.find((c) => !c.deletedAt && c.date === today) || null;

  const [focusRating, setFocusRating] = useState(existingToday?.focusRating ?? 4);
  const [phoneChecking, setPhoneChecking] =
    useState<DailyCheckIn["phoneCheckingFrequency"]>(
      existingToday?.phoneCheckingFrequency ?? "few_times"
    );
  const [topDistraction, setTopDistraction] = useState<string>(
    existingToday?.topDistraction ?? t.checkin.distractions[1]
  );
  const [achievedGoal, setAchievedGoal] = useState<DailyCheckIn["achievedGoal"]>(
    existingToday?.achievedGoal ?? "yes"
  );
  const [note, setNote] = useState(existingToday?.note ?? "");
  const [savedBannerMsg, setSavedBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    if (existingToday) {
      setFocusRating(existingToday.focusRating);
      setPhoneChecking(existingToday.phoneCheckingFrequency);
      setTopDistraction(existingToday.topDistraction);
      setAchievedGoal(existingToday.achievedGoal);
      setNote(existingToday.note || "");
    }
  }, [existingToday?.id, existingToday?.updatedAt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isUpdate = Boolean(existingToday);
    onSaveCheckIn(
      {
        date: today,
        focusRating,
        phoneCheckingFrequency: phoneChecking,
        topDistraction,
        achievedGoal,
        note: note.trim(),
      },
      existingToday?.id
    );
    setSavedBannerMsg(isUpdate ? t.checkin.updatedToast : t.checkin.savedToast);
    setTimeout(() => setSavedBannerMsg(null), 3500);
  };

  return (
    <div className="space-y-6">
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
              {t.checkin.title}
            </h1>
            <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.checkin.subtitle}</p>
          </div>
        </div>

        {existingToday && (
          <span className="rounded-xl border border-[#F4CE25]/40 bg-[#292D37] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]">
            {t.checkin.editingTodayBadge}
          </span>
        )}
      </div>

      {savedBannerMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-[#F4CE25]/40 bg-[#292D37] px-4 py-3 text-sm font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F4CE25]" />
          <span>{savedBannerMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-[#363B46] bg-[#222630] p-6 lg:col-span-7 dark:border-[#3A404C] dark:bg-[#222630]"
        >
          {/* Q1: Focus Rating Slider */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="checkin-focus-rating"
                className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]"
              >
                {t.checkin.q1}
              </label>
              <span className="font-mono-tabular text-sm font-bold text-[#F4CE25]">
                {focusRating} / 5
              </span>
            </div>
            <input
              id="checkin-focus-rating"
              type="range"
              min={1}
              max={5}
              value={focusRating}
              onChange={(e) => setFocusRating(Number(e.target.value))}
              className="mt-3 w-full accent-[#F4CE25]"
            />
            <div className="mt-1 flex justify-between text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              <span>{t.checkin.q1Low}</span>
              <span>{t.checkin.q1High}</span>
            </div>
          </div>

          {/* Q2: Phone checking frequency */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.checkin.q2}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(t.checkin.q2Options) as Array<DailyCheckIn["phoneCheckingFrequency"]>).map(
                (key) => {
                  const active = phoneChecking === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPhoneChecking(key)}
                      className={`min-h-[46px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      {t.checkin.q2Options[key]}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Q3: Top distraction */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.checkin.q3}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {t.checkin.distractions.map((item) => {
                const active = topDistraction === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTopDistraction(item)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-[#F4CE25] bg-[#F4CE25] text-[#191B20]"
                        : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Q4: Goal achievement */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.checkin.q4}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(t.checkin.q4Options) as Array<DailyCheckIn["achievedGoal"]>).map(
                (key) => {
                  const active = achievedGoal === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAchievedGoal(key)}
                      className={`min-h-[46px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      {t.checkin.q4Options[key]}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Optional Note (never required) */}
          <div>
            <label
              htmlFor="checkin-optional-note"
              className="mb-1.5 block text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]"
            >
              {t.checkin.noteLabel}
            </label>
            <textarea
              id="checkin-optional-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.checkin.notePlaceholder}
              className="w-full rounded-xl border border-[#363B46] bg-[#151820] p-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            />
          </div>

          <button
            type="submit"
            className="min-h-[48px] w-full rounded-2xl bg-[#F4CE25] px-5 py-3 text-sm font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
          >
            {existingToday ? t.checkin.updateButton : t.checkin.saveButton}
          </button>
        </form>

        {/* Recent Reflections */}
        <div className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 lg:col-span-5 dark:border-[#3A404C] dark:bg-[#222630]">
          <h2 className="font-display text-base font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.checkin.historyTitle}
          </h2>
          {checkIns.length === 0 ? (
            <p className="mt-6 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.checkin.emptyHistory}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {checkIns.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#363B46] bg-[#151820] p-4 dark:border-[#3A404C] dark:bg-[#151820]"
                >
                  <div className="flex items-center justify-between text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    <span className="font-mono-tabular">{item.date}</span>
                    <span className="font-mono-tabular font-semibold text-[#F4CE25]">
                      {item.focusRating}/5
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {item.topDistraction}
                  </p>
                  {item.note && (
                    <p className="mt-1 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {item.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
