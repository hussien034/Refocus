import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { getCopy } from "../../i18n/translations";
import { HabitCategory, Language, OnboardingProfile } from "../../types/refocus";
import { ReFocusMark } from "../common/PWAWidgets";

const HABIT_INTEREST_CATEGORIES: HabitCategory[] = [
  "reading",
  "movement",
  "mindfulness",
  "learning",
  "sleep",
  "digital_wellness",
  "personal_growth",
];

interface OnboardingScreenProps {
  language: Language;
  initialName: string;
  initialOnboarding: OnboardingProfile;
  onComplete: (name: string, onboarding: OnboardingProfile) => void;
  onSkip: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  language,
  initialName,
  initialOnboarding,
  onComplete,
  onSkip,
}) => {
  const t = getCopy(language);
  const isRtl = language === "ar";
  const NextIcon = isRtl ? ArrowLeft : ArrowRight;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [step, setStep] = useState(1); // 1..7 (7 = personalized completion summary)
  const [name, setName] = useState(initialName || "");
  const [estimate, setEstimate] = useState(initialOnboarding.dailySocialEstimate || "2-4h");
  const [sources, setSources] = useState<string[]>(initialOnboarding.distractionSources);
  const [challenges, setChallenges] = useState<string[]>(initialOnboarding.challenges);
  const [goals, setGoals] = useState<string[]>(initialOnboarding.goals);
  const [habitInterests, setHabitInterests] = useState<HabitCategory[]>(
    initialOnboarding.habitInterests || []
  );
  const [commitment, setCommitment] = useState(initialOnboarding.dailyFocusTarget || 25);
  const [screenTimeGoalInput, setScreenTimeGoalInput] = useState(
    initialOnboarding.dailyScreenTimeGoalMinutes
      ? String(initialOnboarding.dailyScreenTimeGoalMinutes)
      : ""
  );

  const toggleItem = (list: string[], setter: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const toggleInterest = (cat: HabitCategory) => {
    setHabitInterests((prev) =>
      prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
    );
  };

  const parsedGoal = Number(screenTimeGoalInput.trim());
  const validScreenGoal =
    screenTimeGoalInput.trim() && Number.isFinite(parsedGoal) && parsedGoal >= 15 && parsedGoal <= 480
      ? Math.round(parsedGoal)
      : undefined;

  const finishOnboarding = () => {
    onComplete(name.trim() || (language === "ar" ? "صديقنا" : "Friend"), {
      completed: true,
      dailySocialEstimate: estimate,
      distractionSources: sources,
      challenges,
      goals,
      habitInterests,
      dailyFocusTarget: commitment,
      ...(validScreenGoal ? { dailyScreenTimeGoalMinutes: validScreenGoal } : {}),
    });
  };

  const totalSteps = 6;
  const progressPct = Math.min(100, Math.round((Math.min(step, totalSteps) / totalSteps) * 100));

  return (
    <div className="flex min-h-screen flex-col bg-[#151820] px-4 py-6 text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between">
        {/* Top Progress Header */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ReFocusMark size={28} />
              <span className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                {step <= 6 ? `${t.onboarding.stepOf} ${step} ${t.onboarding.of} ${totalSteps}` : t.brand}
              </span>
            </div>
            {step <= 6 && (
              <button
                type="button"
                onClick={onSkip}
                className="min-h-[44px] px-2 text-xs font-medium text-[#A6AAB4] hover:text-[#F3F4F6] dark:text-[#A6AAB4] dark:hover:text-[#F3F4F6]"
              >
                {t.onboarding.skip}
              </button>
            )}
          </div>

          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#363B46] dark:bg-[#3A404C]"
          >
            <div
              className="h-full rounded-full bg-[#F4CE25] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step Content Card */}
        <div className="my-6 rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-sm sm:p-8 dark:border-[#3A404C] dark:bg-[#222630]">
          {step === 1 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s1Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s1Subtitle}
              </p>
              <label
                htmlFor="onboarding-name-input"
                className="mt-6 block text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
              >
                {t.onboarding.steps.s1Prompt}
              </label>
              <input
                id="onboarding-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-4 text-base text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s2Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s2Subtitle}
              </p>
              <div className="mt-6 space-y-2.5">
                {t.onboarding.estimates.map((opt) => {
                  const active = estimate === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setEstimate(opt.value)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && <Check className="h-4 w-4 text-[#F4CE25]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s3Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s3Subtitle}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {t.onboarding.sources.map((src) => {
                  const active = sources.includes(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleItem(sources, setSources, src)}
                      className={`flex min-h-[48px] items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      <span className="truncate">{src}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#F4CE25]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s4Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s4Subtitle}
              </p>
              <div className="mt-6 space-y-2.5">
                {t.onboarding.challenges.map((ch) => {
                  const active = challenges.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleItem(challenges, setChallenges, ch)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      <span>{ch}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#F4CE25]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s5Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s5Subtitle}
              </p>
              <div className="mt-6 space-y-2.5">
                {t.onboarding.goals.map((g) => {
                  const active = goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleItem(goals, setGoals, g)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      <span>{g}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#F4CE25]" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-[#363B46] pt-5 dark:border-[#3A404C]">
                <h2 className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.onboarding.habitInterestsTitle}
                </h2>
                <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.habitInterestsSubtitle}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HABIT_INTEREST_CATEGORIES.map((cat) => {
                    const active = habitInterests.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleInterest(cat)}
                        className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#292D37] text-white dark:bg-[#F4CE25]"
                            : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                        }`}
                      >
                        {t.habits.categories[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.s6Title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.s6Subtitle}
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {t.onboarding.commitments.map((c) => {
                  const active = commitment === c.mins;
                  return (
                    <button
                      key={c.mins}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCommitment(c.mins)}
                      className={`flex min-h-[68px] flex-col items-start justify-center rounded-2xl border p-4 text-start transition-colors ${
                        active
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37]/60 dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                      }`}
                    >
                      <span className="font-mono-tabular text-base font-bold">{c.label}</span>
                      <span className="mt-0.5 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{c.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-[#363B46] pt-5 dark:border-[#3A404C]">
                <label
                  htmlFor="onboarding-screentime-goal"
                  className="block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                >
                  {t.onboarding.screenTimeGoalLabel}
                </label>
                <input
                  id="onboarding-screentime-goal"
                  type="number"
                  min={15}
                  max={480}
                  value={screenTimeGoalInput}
                  onChange={(e) => setScreenTimeGoalInput(e.target.value)}
                  placeholder="60"
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
                <p className="mt-1.5 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.screenTimeGoalHint}
                </p>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.onboarding.steps.completeTitle}, {name.trim() || (language === "ar" ? "صديقنا" : "Friend")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.onboarding.steps.completeBody}
              </p>

              <div className="mt-6 space-y-2 rounded-2xl bg-[#151820] p-4 text-start text-sm dark:bg-[#151820]">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#A6AAB4] dark:text-[#A6AAB4]">{t.dashboard.dailyTarget}</span>
                  <span className="font-mono-tabular font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {commitment} {t.dashboard.minutesShort}
                  </span>
                </div>
                {validScreenGoal && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#A6AAB4] dark:text-[#A6AAB4]">{t.tracker.goalLabel}</span>
                    <span className="font-mono-tabular font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {validScreenGoal} {t.dashboard.minutesShort}
                    </span>
                  </div>
                )}
                {goals.length > 0 && (
                  <div className="border-t border-[#363B46] pt-2 dark:border-[#3A404C]">
                    <span className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {goals.join(" · ")}
                    </span>
                  </div>
                )}
                {habitInterests.length > 0 && (
                  <div className="border-t border-[#363B46] pt-2 dark:border-[#3A404C]">
                    <span className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                      {habitInterests.map((c) => t.habits.categories[c]).join(" · ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Controls */}
        <div className="flex items-center justify-between gap-3 pb-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#363B46] bg-[#222630] px-5 py-3 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37] transition-colors dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
            >
              <BackIcon className="h-4 w-4" />
              <span>{t.onboarding.back}</span>
            </button>
          ) : (
            <div />
          )}

          {step <= 6 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F4CE25] px-6 py-3 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816] transition-colors sm:flex-none"
            >
              <span>{t.onboarding.next}</span>
              <NextIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishOnboarding}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#292D37] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1b2c25] transition-colors dark:bg-[#F4CE25]"
            >
              <span>{t.onboarding.finish}</span>
              <NextIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
