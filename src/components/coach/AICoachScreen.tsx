import React, { useRef, useState } from "react";
import {
  Send,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Lock,
  Globe,
  Check,
  X,
  Timer,
  CheckSquare,
  Target,
  Lightbulb,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import { CoachContextPayload, sendCoachMessage } from "../../services/coachService";
import {
  calculateHabitInsights,
  calculateOverallFocusStreak,
  getDailyFocusMinutes,
  getHabitStatus,
  getTodayISO,
} from "../../services/analytics/metricsEngine";
import { AppState, CoachActionCard, CoachMessage } from "../../types/refocus";

interface AICoachScreenProps {
  state: AppState;
  onAddMessages: (userMsg: CoachMessage, assistantMsg: CoachMessage) => void;
  onAcceptActionCard: (messageId: string, card: CoachActionCard) => void;
  onDismissActionCard: (messageId: string, cardId: string) => void;
  onClearChat: () => void;
  onOpenUpgrade: () => void;
  onToggleLanguage: () => void;
}

const FREE_DAILY_LIMIT = 5;

function renderActionIcon(type: CoachActionCard["type"]) {
  if (type === "focus_session") return <Timer className="h-4 w-4 text-[#F4CE25]" />;
  if (type === "new_habit") return <CheckSquare className="h-4 w-4 text-[#F4CE25]" />;
  if (type === "daily_challenge") return <Sparkles className="h-4 w-4 text-[#F4CE25]" />;
  if (type === "screen_time_goal") return <Target className="h-4 w-4 text-[#F4CE25]" />;
  return <Lightbulb className="h-4 w-4 text-[#F4CE25]" />;
}

export const AICoachScreen: React.FC<AICoachScreenProps> = ({
  state,
  onAddMessages,
  onAcceptActionCard,
  onDismissActionCard,
  onClearChat,
  onOpenUpgrade,
  onToggleLanguage,
}) => {
  const t = getCopy(state.language);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [confirmingChallengeMsgId, setConfirmingChallengeMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isPremium = state.user.plan === "premium";
  const quotaExceeded = !isPremium && state.aiMessagesUsedToday >= FREE_DAILY_LIMIT;

  const buildContext = (): CoachContextPayload => {
    const today = getTodayISO();
    const todayFocusMinutes = getDailyFocusMinutes(state.sessions, today);
    const activeLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
    const todayScreenTimeMinutes = activeLogs
      .filter((l) => l.date === today)
      .reduce((sum, l) => sum + l.durationMinutes, 0);
    const activeHabits = state.habits.filter((h) => !h.deletedAt && getHabitStatus(h) === "active");
    const completedHabitsCount = activeHabits.filter((h) => h.completedDates.includes(today)).length;
    const activeCheckIns = state.checkIns.filter((c) => !c.deletedAt);

    return {
      userName: state.user.name,
      language: state.language,
      dailyFocusTarget: state.onboarding.dailyFocusTarget,
      dailyScreenTimeGoalMinutes: state.onboarding.dailyScreenTimeGoalMinutes,
      todayFocusMinutes,
      todayScreenTimeMinutes,
      completedHabitsCount,
      totalHabitsCount: activeHabits.length,
      streakDays: calculateOverallFocusStreak(state.sessions, today),
      recentHabits: activeHabits.map((h) => ({
        title: h.title,
        streak: calculateHabitInsights(h, today).currentStreak,
        completedToday: h.completedDates.includes(today),
      })),
      recentScreenTime: activeLogs.slice(0, 6).map((l) => ({
        appName: l.appName,
        category: l.category,
        durationMinutes: l.durationMinutes,
        date: l.date,
        periodOfDay: l.periodOfDay,
      })),
      latestCheckIn: activeCheckIns[0] || null,
      goals: state.onboarding.goals,
      challenges: state.onboarding.challenges,
      habitInterests: state.onboarding.habitInterests,
    };
  };

  const submitPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading || quotaExceeded) return;

    setError(null);
    setLastFailedPrompt(null);
    setInput("");
    setPendingPrompt(trimmed);
    setLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

    const userMsg: CoachMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await sendCoachMessage(trimmed, state.coachMessages, buildContext());
      const assistantMsg: CoachMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toISOString(),
        source: res.source,
        ...(res.actionCard ? { actionCard: res.actionCard } : {}),
      };
      setPendingPrompt(null);
      onAddMessages(userMsg, assistantMsg);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setPendingPrompt(null);
      setError(err instanceof Error ? err.message : t.coach.errorGeneric);
      setLastFailedPrompt(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPrompt(input);
  };

  const handleAcceptClick = (msgId: string, card: CoachActionCard) => {
    if (card.status !== "pending") return;
    // Daily challenge cards use an explicit two-step confirmation so dashboard updates never happen silently
    if (card.type === "daily_challenge" && confirmingChallengeMsgId !== msgId) {
      setConfirmingChallengeMsgId(msgId);
      return;
    }
    setConfirmingChallengeMsgId(null);
    onAcceptActionCard(msgId, card);
  };

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[520px] flex-col gap-4 lg:h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#292D37] text-white dark:bg-[#F4CE25]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.coach.title}
            </h1>
            <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              {isPremium
                ? t.coach.premiumUnlimited
                : t.coach.freeQuotaLabel.replace("{used}", String(state.aiMessagesUsedToday))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
          >
            <Globe className="h-3.5 w-3.5 text-[#F4CE25]" />
            <span>{state.language === "en" ? "العربية" : "English"}</span>
          </button>

          <button
            type="button"
            onClick={onClearChat}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#A6AAB4] hover:bg-[#292D37] hover:text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4] dark:hover:text-[#F3F4F6]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.coach.clearChat}</span>
          </button>
        </div>
      </div>

      {/* Clear AI Safety / Source Disclaimer */}
      <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">{t.coach.aiLabel}</p>

      {/* Suggested Prompts */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {t.coach.prompts.map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading || quotaExceeded}
            onClick={() => submitPrompt(p)}
            className="min-h-[40px] shrink-0 rounded-xl border border-[#363B46] bg-[#222630] px-3.5 py-2 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] disabled:opacity-50 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Container */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl border border-[#363B46] bg-[#222630] p-4 sm:p-6 dark:border-[#3A404C] dark:bg-[#222630]">
        {state.coachMessages.length <= 1 && (
          <div className="rounded-2xl border border-[#363B46] bg-[#292D37]/60 p-4 text-xs dark:border-[#3A404C] dark:bg-[#292D37]">
            <p className="font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {t.coach.emptyStarterTitle}
            </p>
            <p className="mt-1 leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.coach.emptyStarterDesc}
            </p>
          </div>
        )}

        {state.coachMessages.map((msg) => {
          const isUser = msg.role === "user";
          const card = msg.actionCard;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[86%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                  isUser
                    ? "bg-[#F4CE25] text-[#191B20]"
                    : "border border-[#363B46] bg-[#151820] text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                }`}
              >
                {msg.content}
              </div>

              {/* Structured Coach Action Card (requires explicit user acceptance) */}
              {!isUser && card && (
                <div className="mt-2.5 w-full max-w-[86%] rounded-2xl border border-[#F4CE25]/40 bg-[#292D37]/55 p-4 sm:max-w-[75%] dark:border-[#F4CE25]/35 dark:bg-[#292D37]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                      {renderActionIcon(card.type)}
                      <span>{t.coach.actionTypes[card.type]}</span>
                    </span>

                    {card.status !== "pending" && (
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                          card.status === "accepted"
                            ? "bg-[#F4CE25] text-[#191B20]"
                            : "bg-[#363B46] text-[#A6AAB4] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {card.status === "accepted"
                          ? `✓ ${t.coach.acceptedBadge}`
                          : t.coach.dismissedBadge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 font-display text-sm font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {card.explanation}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                    <span className="font-semibold">{t.coach.whyRecommended}: </span>
                    {card.relevanceReason}
                  </p>

                  {card.status === "pending" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcceptClick(msg.id, card)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#F4CE25] px-3.5 py-1.5 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {card.type === "daily_challenge" && confirmingChallengeMsgId === msg.id
                            ? t.coach.confirmChallengeBtn
                            : t.coach.acceptAction}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingChallengeMsgId(null);
                          onDismissActionCard(msg.id, card.id);
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#A6AAB4] hover:text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#A6AAB4]"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>{t.coach.dismissAction}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isUser && (
                <span className="mt-1 px-1 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {msg.source === "gemini" ? "Gemini AI" : "ReFocus Coach"}
                </span>
              )}
            </div>
          );
        })}

        {pendingPrompt && (
          <div className="flex flex-col items-end">
            <div className="max-w-[86%] whitespace-pre-line rounded-2xl bg-[#F4CE25] px-4 py-3 text-sm leading-relaxed text-[#191B20] sm:max-w-[75%]">
              {pendingPrompt}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-[#363B46] bg-[#151820] px-4 py-3 text-xs text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]">
              {t.coach.thinking}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            {lastFailedPrompt && (
              <button
                type="button"
                onClick={() => submitPrompt(lastFailedPrompt)}
                className="shrink-0 font-semibold underline"
              >
                {t.coach.retry}
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quota Banner or Input Bar */}
      {quotaExceeded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F4CE25]/40 bg-[#292D37] p-4 dark:bg-[#292D37]">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#F4CE25]" />
            <div>
              <p className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                {t.coach.quotaReachedTitle}
              </p>
              <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                {t.coach.quotaReachedBody}
              </p>
            </div>
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
        <div className="space-y-2">
          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                submitPrompt(
                  state.language === "ar"
                    ? "ساعدني في بدء جلسة تركيز لمدة 20 دقيقة"
                    : "Help me start a 20-minute focus session"
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] disabled:opacity-50 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
            >
              <Timer className="h-3.5 w-3.5 text-[#F4CE25]" />
              <span>{t.coach.quickActions.focus}</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                submitPrompt(
                  state.language === "ar"
                    ? "اقترح لي عادة واقعية جديدة بناءً على أهدافي"
                    : "Suggest a realistic new habit based on my goals"
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] disabled:opacity-50 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
            >
              <CheckSquare className="h-3.5 w-3.5 text-[#F4CE25]" />
              <span>{t.coach.quickActions.habit}</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                submitPrompt(
                  state.language === "ar"
                    ? "حلل لي استهلاك وقت الشاشة واقترح حدوداً عملية"
                    : "Analyze my screen time usage and suggest practical boundaries"
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] disabled:opacity-50 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
            >
              <Target className="h-3.5 w-3.5 text-[#F4CE25]" />
              <span>{t.coach.quickActions.screenTime}</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                submitPrompt(
                  state.language === "ar"
                    ? "راجع معي تقدمي هذا الأسبوع"
                    : "Review my progress this week"
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#363B46] bg-[#222630] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] disabled:opacity-50 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#F4CE25]" />
              <span>{t.coach.quickActions.review}</span>
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.coach.inputPlaceholder}
              aria-label={t.coach.inputPlaceholder}
              disabled={loading}
              className="min-h-[48px] flex-1 rounded-2xl border border-[#363B46] bg-[#222630] px-4 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label={t.coach.send}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-2xl bg-[#F4CE25] px-4 text-sm font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">{t.coach.send}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
