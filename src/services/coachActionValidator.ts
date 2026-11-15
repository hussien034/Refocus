import {
  CoachActionCard,
  CoachActionStatus,
  CoachActionType,
  HabitCategory,
  HabitFrequencyType,
} from "../types/refocus";

const VALID_ACTION_TYPES: ReadonlySet<CoachActionType> = new Set([
  "focus_session",
  "new_habit",
  "daily_challenge",
  "screen_time_goal",
  "wellness_tip",
]);

const VALID_ACTION_STATUSES: ReadonlySet<CoachActionStatus> = new Set([
  "pending",
  "accepted",
  "dismissed",
]);

const VALID_HABIT_CATEGORIES: ReadonlySet<HabitCategory> = new Set([
  "reading",
  "movement",
  "mindfulness",
  "learning",
  "sleep",
  "digital_wellness",
  "personal_growth",
]);

const VALID_FREQUENCIES: ReadonlySet<HabitFrequencyType> = new Set([
  "daily",
  "weekdays",
  "days_per_week",
  "custom_weekly",
]);

function nonEmptyString(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

/**
 * Strictly validates an AI-suggested or locally constructed CoachActionCard.
 * Returns null for any malformed, incomplete, or out-of-bounds payload so the UI
 * safely renders text-only coaching without breaking or auto-applying invalid state.
 */
export function validateCoachActionCard(raw: unknown): CoachActionCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.type !== "string" || !VALID_ACTION_TYPES.has(obj.type as CoachActionType)) {
    return null;
  }
  const type = obj.type as CoachActionType;

  const title = nonEmptyString(obj.title, 120);
  const explanation = nonEmptyString(obj.explanation, 320);
  const relevanceReason = nonEmptyString(obj.relevanceReason, 220);
  if (!title || !explanation || !relevanceReason) return null;

  const status: CoachActionStatus =
    typeof obj.status === "string" && VALID_ACTION_STATUSES.has(obj.status as CoachActionStatus)
      ? (obj.status as CoachActionStatus)
      : "pending";

  const id =
    nonEmptyString(obj.id, 80) ||
    `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const base: CoachActionCard = {
    id,
    type,
    title,
    explanation,
    relevanceReason,
    status,
  };

  if (type === "focus_session") {
    const mins = Number(obj.durationMinutes);
    if (!Number.isFinite(mins) || mins < 5 || mins > 120) return null;
    const intention = nonEmptyString(obj.intention, 120);
    return {
      ...base,
      durationMinutes: Math.round(mins),
      ...(intention ? { intention } : {}),
    };
  }

  if (type === "new_habit") {
    const habitTitle = nonEmptyString(obj.habitTitle, 100);
    if (!habitTitle) return null;

    if (
      obj.habitCategory !== undefined &&
      (typeof obj.habitCategory !== "string" ||
        !VALID_HABIT_CATEGORIES.has(obj.habitCategory as HabitCategory))
    ) {
      return null;
    }
    const habitCategory: HabitCategory =
      (obj.habitCategory as HabitCategory | undefined) || "digital_wellness";

    if (
      obj.habitFrequencyType !== undefined &&
      (typeof obj.habitFrequencyType !== "string" ||
        !VALID_FREQUENCIES.has(obj.habitFrequencyType as HabitFrequencyType))
    ) {
      return null;
    }
    const habitFrequencyType: HabitFrequencyType =
      (obj.habitFrequencyType as HabitFrequencyType | undefined) || "days_per_week";

    const target = obj.habitTargetPerWeek !== undefined ? Number(obj.habitTargetPerWeek) : 4;
    if (!Number.isFinite(target) || target < 1 || target > 7) return null;

    return {
      ...base,
      habitTitle,
      habitCategory,
      habitFrequencyType,
      habitTargetPerWeek: Math.round(target),
    };
  }

  if (type === "daily_challenge") {
    const challengeTitle = nonEmptyString(obj.challengeTitle, 160);
    if (!challengeTitle) return null;
    return {
      ...base,
      challengeTitle,
    };
  }

  if (type === "screen_time_goal") {
    const goalMins = Number(obj.screenTimeGoalMinutes);
    if (!Number.isFinite(goalMins) || goalMins < 10 || goalMins > 480) return null;
    return {
      ...base,
      screenTimeGoalMinutes: Math.round(goalMins),
    };
  }

  // wellness_tip
  return base;
}

/**
 * Parses Gemini output that may either be plain conversational prose OR a JSON
 * envelope `{ "reply": string, "actionCard"?: CoachActionCard }`.
 */
export function parseCoachModelPayload(rawText: string): {
  reply: string;
  actionCard?: CoachActionCard;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    try {
      const parsed = JSON.parse(candidate) as {
        reply?: unknown;
        actionCard?: unknown;
      };
      if (typeof parsed.reply === "string" && parsed.reply.trim()) {
        const validCard = parsed.actionCard
          ? validateCoachActionCard(parsed.actionCard)
          : null;
        return {
          reply: parsed.reply.trim(),
          ...(validCard ? { actionCard: validCard } : {}),
        };
      }
    } catch {
      // Malformed JSON: fall through cleanly to plain-text coaching reply
    }
  }

  return { reply: trimmed };
}
