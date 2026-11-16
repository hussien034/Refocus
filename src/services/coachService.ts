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

interface CoachApiError {
  error?: string;
}

export function resolveCoachApiUrl(
  path: string,
  apiBaseUrl?: string,
  hostname?: string,
  language: Language = "en"
): string {
  const baseUrl = apiBaseUrl?.trim().replace(/\/+$/, "");
  if (baseUrl) return `${baseUrl}${path}`;
  if (hostname?.endsWith(".github.io")) {
    throw new Error(
      language === "ar"
        ? "لم يتم ربط مدرب Gemini بعد. أضف متغير VITE_API_BASE_URL في GitHub Actions بعنوان خادم ReFocus المنشور."
        : "Gemini AI Coach is not connected yet. Set the VITE_API_BASE_URL GitHub Actions variable to the deployed ReFocus API URL."
    );
  }
  return path;
}

function coachApiUrl(path: string, language: Language): string {
  return resolveCoachApiUrl(
    path,
    import.meta.env?.VITE_API_BASE_URL,
    typeof window === "undefined" ? undefined : window.location.hostname,
    language
  );
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      const body = (await response.json()) as CoachApiError;
      if (body.error) return body.error;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function sendCoachMessage(
  message: string,
  history: CoachMessage[],
  context: CoachContextPayload
): Promise<{ reply: string; source: "gemini" | "local-coach"; actionCard?: CoachActionCard }> {
  const url = coachApiUrl("/api/coach", context.language);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-8).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        context,
      }),
    });
  } catch {
    throw new Error(
      context.language === "ar"
        ? "تعذّر الاتصال بخادم مدرب الذكاء الاصطناعي. تحقق من نشر الخادم وإعدادات الاتصال."
        : "Could not connect to the AI Coach server. Check that the backend is deployed and configured."
    );
  }

  if (!response.ok) {
    const fallback =
      context.language === "ar"
        ? `تعذّر إنشاء الرد من Gemini (رمز ${response.status}). تحقق من إعداد مفتاح Gemini في الخادم.`
        : `Gemini could not generate a reply (status ${response.status}). Check the Gemini key configured on the backend.`;
    throw new Error(await readApiError(response, fallback));
  }

  let data: { reply?: unknown; source?: unknown; actionCard?: unknown };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new Error(
      context.language === "ar"
        ? "أعاد خادم المدرب استجابة غير صالحة."
        : "The AI Coach server returned an invalid response."
    );
  }
  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error(
      context.language === "ar"
        ? "لم يُرجع Gemini رداً صالحاً. حاول مرة أخرى."
        : "Gemini returned an empty reply. Please try again."
    );
  }

  const actionCard = data.actionCard ? validateCoachActionCard(data.actionCard) : null;
  return {
    reply: data.reply,
    source: data.source === "local-coach" ? "local-coach" : "gemini",
    ...(actionCard ? { actionCard } : {}),
  };
}

export async function fetchWeeklyInsight(
  context: CoachContextPayload
): Promise<{ report: string; source: "gemini" | "local-coach" }> {
  const url = coachApiUrl("/api/coach/weekly-insight", context.language);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
  } catch {
    throw new Error(
      context.language === "ar"
        ? "تعذّر الاتصال بخادم المدرب لإنشاء التقرير الأسبوعي."
        : "Could not connect to the AI Coach server to generate the weekly report."
    );
  }

  if (!response.ok) {
    const fallback =
      context.language === "ar"
        ? `تعذّر إنشاء التقرير من Gemini (رمز ${response.status}). تحقق من إعداد مفتاح Gemini في الخادم.`
        : `Gemini could not generate the weekly report (status ${response.status}). Check the Gemini key configured on the backend.`;
    throw new Error(await readApiError(response, fallback));
  }

  try {
    const data = (await response.json()) as { report?: unknown; source?: unknown };
    if (typeof data.report !== "string" || !data.report.trim()) {
      throw new Error("empty report");
    }
    return {
      report: data.report,
      source: data.source === "local-coach" ? "local-coach" : "gemini",
    };
  } catch {
    throw new Error(
      context.language === "ar"
        ? "أعاد خادم المدرب تقريراً غير صالح."
        : "The AI Coach server returned an invalid report."
    );
  }
}
