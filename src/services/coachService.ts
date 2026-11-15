import { CoachActionCard, CoachMessage, Language, ScreenTimePeriod } from "../types/refocus";
import { validateCoachActionCard } from "./coachActionValidator";

export interface CoachContextPayload {
  userName: string;
  language: Language;
  dailyFocusTarget: number;
  dailyScreenTimeGoalMinutes?: number;
  todayFocusMinutes: number;
  todayScreenTimeMinutes: number;
  completedHabitsCount: number;
  totalHabitsCount: number;
  streakDays: number;
  recentHabits: Array<{ title: string; streak: number; completedToday: boolean }>;
  recentScreenTime: Array<{
    appName: string;
    category: string;
    durationMinutes: number;
    date: string;
    periodOfDay?: ScreenTimePeriod;
  }>;
  latestCheckIn?: {
    focusRating: number;
    phoneCheckingFrequency: string;
    topDistraction: string;
    achievedGoal: string;
    note?: string;
  } | null;
  goals: string[];
  challenges: string[];
  habitInterests?: string[];
}

export async function sendCoachMessage(
  message: string,
  history: CoachMessage[],
  context: CoachContextPayload
): Promise<{ reply: string; source: "gemini" | "local-coach"; actionCard?: CoachActionCard }> {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Unable to connect to ReFocus AI Coach.");
  }

  const data = (await response.json()) as {
    reply: string;
    source: "gemini" | "local-coach";
    actionCard?: unknown;
  };
  const validCard = data.actionCard ? validateCoachActionCard(data.actionCard) : null;
  return {
    reply: data.reply,
    source: data.source,
    ...(validCard ? { actionCard: validCard } : {}),
  };
}

export async function fetchWeeklyInsight(
  context: CoachContextPayload
): Promise<{ report: string; source: "gemini" | "local-coach" }> {
  const response = await fetch("/api/coach/weekly-insight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Unable to generate weekly report.");
  }

  return response.json();
}
