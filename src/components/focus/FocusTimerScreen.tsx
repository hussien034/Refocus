import React, { useEffect, useState } from "react";
import { Pause, Play, Square, Wind, Image as ImageIcon, CheckCircle2, Coffee } from "lucide-react";
import { MEDIA_ASSETS } from "../../assets/media";
import {
  computeBreakRemainingSeconds,
  computeTimerSnapshot,
  FOCUS_PRESETS,
} from "../../features/focus/timerEngine";
import { getCopy } from "../../i18n/translations";
import { Language, PersistedTimerState } from "../../types/refocus";

interface FocusTimerScreenProps {
  language: Language;
  timer: PersistedTimerState;
  todayTotalMinutes: number;
  restoredNotice: boolean;
  onSelectPreset: (minutes: number) => void;
  onChangeIntention: (intention: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndSession: (savePartial: boolean) => void;
  onStartBreak: (minutes: number) => void;
  onReset: () => void;
  onBackDashboard: () => void;
}

export const FocusTimerScreen: React.FC<FocusTimerScreenProps> = ({
  language,
  timer,
  todayTotalMinutes,
  restoredNotice,
  onSelectPreset,
  onChangeIntention,
  onStart,
  onPause,
  onResume,
  onEndSession,
  onStartBreak,
  onReset,
  onBackDashboard,
}) => {
  const t = getCopy(language);
  const [showBreathing, setShowBreathing] = useState(true);
  const [calmBackdrop, setCalmBackdrop] = useState(true);
  const [showEarlyEndModal, setShowEarlyEndModal] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Display tick (source of truth remains timestamps inside timerEngine)
  useEffect(() => {
    const isBreakRunning = timer.breakTimer?.status === "running";
    if (timer.status !== "running" && !isBreakRunning) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer.status, timer.breakTimer?.status]);

  useEffect(() => {
    if (!showEarlyEndModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEarlyEndModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEarlyEndModal]);

  const snap = computeTimerSnapshot(timer, nowMs);
  const selectedMinutes = Math.round(snap.intendedDurationSeconds / 60);

  const mins = Math.floor(snap.remainingSeconds / 60);
  const secs = snap.remainingSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (snap.progressPct / 100) * circumference;

  const elapsedMinutesRounded = Math.floor(snap.elapsedFocusedSeconds / 60);

  const handleEndClick = () => {
    if (timer.status === "running") {
      onPause();
    }
    setShowEarlyEndModal(true);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customInput);
    if (!Number.isFinite(val) || val < 1 || val > 180) return;
    onSelectPreset(Math.round(val));
    setCustomInput("");
  };

  if (timer.status === "completed") {
    const breakRemaining = computeBreakRemainingSeconds(timer, nowMs);
    const breakMins = Math.floor(breakRemaining / 60);
    const breakSecs = breakRemaining % 60;
    const breakFormatted = `${String(breakMins).padStart(2, "0")}:${String(breakSecs).padStart(2, "0")}`;
    const breakStatus = timer.breakTimer?.status || "idle";
    const breakFinished = breakStatus === "running" && breakRemaining <= 0;

    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-3xl border border-[#363B46] bg-[#222630] p-8 text-center shadow-sm dark:border-[#3A404C] dark:bg-[#222630]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.focus.doneTitle}
          </h1>
          <p className="mt-2 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
            {t.focus.doneSubtitle}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-[#151820] p-4 dark:bg-[#151820]">
            <div>
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.focus.loggedMinutes}</p>
              <p className="font-mono-tabular mt-1 text-xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {selectedMinutes} {t.dashboard.minutesShort}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.focus.todayTotal}</p>
              <p className="font-mono-tabular mt-1 text-xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {todayTotalMinutes} {t.dashboard.minutesShort}
              </p>
            </div>
          </div>

          {/* Optional Break Timer */}
          <div className="mt-6 rounded-2xl border border-[#363B46] bg-[#151820] p-4 text-start dark:border-[#3A404C] dark:bg-[#151820]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              <Coffee className="h-4 w-4 text-[#F4CE25]" />
              <span>{t.focus.breakTitle}</span>
            </div>
            <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.focus.breakSubtitle}
            </p>

            {breakStatus === "idle" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNowMs(Date.now());
                    onStartBreak(5);
                  }}
                  className="min-h-[40px] rounded-xl border border-[#363B46] bg-[#222630] px-3.5 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
                >
                  {t.focus.breakStart5}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNowMs(Date.now());
                    onStartBreak(10);
                  }}
                  className="min-h-[40px] rounded-xl border border-[#363B46] bg-[#222630] px-3.5 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
                >
                  {t.focus.breakStart10}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-mono-tabular text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {breakFinished ? t.focus.breakComplete : `${breakFormatted} · ${t.focus.breakRemaining}`}
                </p>
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-semibold text-[#F4CE25] hover:underline"
                >
                  {t.focus.skipBreak}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onReset}
              className="min-h-[48px] flex-1 rounded-2xl bg-[#F4CE25] px-5 py-3 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816] transition-colors"
            >
              {t.focus.startAnother}
            </button>
            <button
              type="button"
              onClick={() => {
                onReset();
                onBackDashboard();
              }}
              className="min-h-[48px] flex-1 rounded-2xl border border-[#363B46] bg-[#222630] px-5 py-3 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37] transition-colors dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
            >
              {t.focus.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Calm Options */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.focus.title}
          </h1>
          <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.focus.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showBreathing}
            onClick={() => setShowBreathing((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              showBreathing
                ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                : "border-[#363B46] bg-[#222630] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4]"
            }`}
          >
            <Wind className="h-4 w-4" />
            <span>{t.focus.breatheToggle}</span>
          </button>

          <button
            type="button"
            aria-pressed={calmBackdrop}
            onClick={() => setCalmBackdrop((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              calmBackdrop
                ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                : "border-[#363B46] bg-[#222630] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4]"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>{t.focus.sanctuaryToggle}</span>
          </button>
        </div>
      </div>

      {restoredNotice && (timer.status === "running" || timer.status === "paused") && (
        <div
          role="status"
          className="rounded-2xl border border-[#F4CE25]/40 bg-[#292D37] px-4 py-2.5 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
        >
          {t.focus.restoredNote}
        </div>
      )}

      {/* Main Focus Sanctuary Card */}
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#363B46] bg-[#222630] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.2)] sm:p-7 dark:border-[#3A404C] dark:bg-[#222630]">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* Presets & Custom Duration (locked once running or paused) */}
          <div className="w-full rounded-2xl border border-[#363B46] bg-[#1B1E26] p-4 sm:p-5 dark:border-[#3A404C] dark:bg-[#1B1E26]">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.focus.presetsLabel}
              </p>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap sm:justify-center">
              {FOCUS_PRESETS.map((p, index) => {
              const selected = selectedMinutes === p;
              const locked = timer.status === "running" || timer.status === "paused";
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={locked}
                    aria-pressed={selected}
                    onClick={() => onSelectPreset(p)}
                    className={`col-span-2 min-h-[44px] rounded-xl px-2 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                      index === 3 ? "col-start-2" : index === 4 ? "col-start-4" : ""
                    } sm:min-w-[88px] sm:px-4 ${
                      selected
                        ? "bg-[#F4CE25] text-[#191B20] shadow-[0_4px_14px_rgba(244,206,37,0.18)]"
                        : "border border-[#363B46] bg-[#252933] text-[#D5D7DD] hover:border-[#606675] hover:bg-[#2C303A] dark:border-[#3A404C] dark:bg-[#252933] dark:text-[#D5D7DD]"
                    } disabled:opacity-50`}
                  >
                    {p} {t.dashboard.minutesShort}
                  </button>
                );
              })}

              {timer.status === "idle" && (
                <form onSubmit={handleCustomSubmit} className="col-span-6 flex items-center gap-2 sm:col-span-1">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={t.focus.customLabel}
                    aria-label={t.focus.customLabel}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-[#363B46] bg-[#252933] px-3 text-xs text-[#F3F4F6] outline-none placeholder:text-[#858B97] focus:border-[#F4CE25] sm:w-28 sm:flex-none dark:border-[#3A404C] dark:bg-[#252933] dark:text-[#F3F4F6]"
                  />
                  {customInput.trim() && (
                    <button
                      type="submit"
                      className="min-h-[44px] shrink-0 rounded-xl bg-[#F4CE25] px-4 text-xs font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
                    >
                      {t.common.confirm}
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Timer display */}
          <div className="relative mt-4 w-full overflow-hidden rounded-[1.75rem] border border-[#363B46] bg-[#181B22] px-4 py-7 sm:mt-5 sm:py-8 dark:border-[#3A404C] dark:bg-[#181B22]">
            {calmBackdrop && (
              <>
                <div className="pointer-events-none absolute inset-0 opacity-20">
                  <img
                    src={MEDIA_ASSETS.focusSanctuaryBackdrop}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#181B22]/75 via-[#181B22]/55 to-[#181B22]/90" />
              </>
            )}
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative flex h-60 w-60 items-center justify-center">
                {showBreathing && timer.status === "running" && (
                  <div
                    aria-hidden="true"
                    className="animate-calm-breathe absolute inset-3 rounded-full bg-[#F4CE25]/10"
                  />
                )}

                <svg className="h-60 w-60 -rotate-90" viewBox="0 0 240 240" aria-hidden="true">
                  <circle
                    cx="120"
                    cy="120"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    className="text-[#454A55]"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r={radius}
                    fill="none"
                    stroke="#F4CE25"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-[stroke-dashoffset] duration-300"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    role="timer"
                    aria-live="off"
                    className="font-mono-tabular text-5xl font-bold tracking-tight text-white"
                  >
                    {formattedTime}
                  </span>
                  <span className="mt-2 rounded-full bg-black/20 px-3 py-1 text-xs font-medium text-[#D7DAE1]">
                    {snap.progressPct}% {t.focus.completedPct} · {t.focus.remaining}
                  </span>
                </div>
              </div>

              {showBreathing && (
                <p className="mt-4 flex max-w-sm items-center justify-center gap-2 text-center text-xs leading-relaxed text-[#D1D4DB]">
                  <Wind className="h-4 w-4 shrink-0 text-[#F4CE25]" />
                  <span>{t.focus.breatheCue}</span>
                </p>
              )}
              {timer.status === "paused" && (
                <p className="mt-3 rounded-full border border-white/10 bg-black/20 px-3.5 py-1.5 text-[11px] font-medium text-[#D1D4DB]">
                  {t.focus.pausedNote}
                </p>
              )}
            </div>
          </div>

          {/* Intention & Controls */}
          <div className="mt-5 w-full max-w-2xl border-t border-[#363B46] pt-5 dark:border-[#3A404C]">
            <div className="w-full">
              <label
                htmlFor="focus-intention"
                className="mb-2 block text-start text-xs font-semibold text-[#D5D7DD] dark:text-[#D5D7DD]"
              >
                {t.focus.intentionLabel}
              </label>
              <input
                id="focus-intention"
                type="text"
                value={timer.intention}
                onChange={(e) => onChangeIntention(e.target.value)}
                placeholder={t.focus.intentionPlaceholder}
                className="min-h-[48px] w-full rounded-xl border border-[#363B46] bg-[#181B22] px-4 text-sm text-[#F3F4F6] outline-none transition-colors placeholder:text-[#858B97] focus:border-[#F4CE25] focus:ring-2 focus:ring-[#F4CE25]/10 dark:border-[#3A404C] dark:bg-[#181B22] dark:text-[#F3F4F6]"
              />
            </div>
          </div>

          <div className="mt-4 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3">
            {timer.status === "idle" && (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-2xl bg-[#F4CE25] px-6 py-3 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816] transition-colors"
              >
                <Play className="h-4 w-4" />
                <span>{t.focus.start}</span>
              </button>
            )}

            {timer.status === "running" && (
              <>
                <button
                  type="button"
                  onClick={onPause}
                  className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#363B46] bg-[#222630] px-5 py-3 text-sm font-semibold text-[#F3F4F6] hover:bg-[#292D37] transition-colors dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                >
                  <Pause className="h-4 w-4" />
                  <span>{t.focus.pause}</span>
                </button>
                <button
                  type="button"
                  onClick={handleEndClick}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#363B46] bg-[#222630] px-5 py-3 text-sm font-medium text-[#A6AAB4] hover:bg-[#292D37] transition-colors dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                >
                  <Square className="h-4 w-4" />
                  <span>{t.focus.endSession}</span>
                </button>
              </>
            )}

            {timer.status === "paused" && (
              <>
                <button
                  type="button"
                  onClick={onResume}
                  className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F4CE25] px-5 py-3 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816] transition-colors"
                >
                  <Play className="h-4 w-4" />
                  <span>{t.focus.resume}</span>
                </button>
                <button
                  type="button"
                  onClick={handleEndClick}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#363B46] bg-[#222630] px-5 py-3 text-sm font-medium text-[#A6AAB4] hover:bg-[#292D37] transition-colors dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                >
                  <Square className="h-4 w-4" />
                  <span>{t.focus.endSession}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Gentle Early-End Modal */}
      {showEarlyEndModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="early-end-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]">
            <h2
              id="early-end-title"
              className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
            >
              {t.focus.earlyEndTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.focus.earlyEndBody}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {elapsedMinutesRounded >= 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowEarlyEndModal(false);
                    onEndSession(true);
                  }}
                  className="min-h-[48px] w-full rounded-2xl bg-[#F4CE25] px-4 py-2.5 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816]"
                >
                  {t.focus.savePartial} {elapsedMinutesRounded} {t.dashboard.minutesShort}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowEarlyEndModal(false);
                  onEndSession(false);
                }}
                className="min-h-[48px] w-full rounded-2xl border border-[#363B46] bg-[#222630] px-4 py-2.5 text-sm font-medium text-[#A6AAB4] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
              >
                {t.focus.discardPartial}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEarlyEndModal(false);
                  onResume();
                }}
                className="min-h-[44px] w-full rounded-2xl px-4 py-2 text-xs font-semibold text-[#F4CE25] hover:underline"
              >
                {t.focus.keepGoing}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
