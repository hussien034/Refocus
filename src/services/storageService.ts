import { AppState, Habit, Language } from "../types/refocus";
import {
  calculateOverallFocusStreak as metricsFocusStreak,
  formatDateISO,
  getPastDateISO,
  getTodayISO,
} from "./analytics/metricsEngine";
import {
  idbLoadUserState,
  idbRemoveUserState,
  idbSaveUserState,
} from "./storage/indexedDb";

export { formatDateISO, getPastDateISO, getTodayISO };

const ACTIVE_SESSION_KEY = "refocus_active_session_v1";
const USER_STORAGE_PREFIX = "refocus_user_data_v1_";
const GUEST_PREFS_KEY = "refocus_guest_prefs_v1";

export interface ActiveSessionMeta {
  token: string;
  userId: string;
}

export function calculateHabitStreak(completedDates: string[]): number {
  const set = new Set(completedDates);
  let streak = 0;
  const today = getTodayISO();
  const startOffset = set.has(today) ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const iso = getPastDateISO(i);
    if (set.has(iso)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateOverallFocusStreak(sessions: AppState["sessions"]): number {
  return metricsFocusStreak(sessions);
}

/**
 * Safely normalize legacy habits into Phase 2 schema without altering existing user data.
 */
export function normalizeHabitRecord(habit: Habit): Habit {
  const status = habit.status || (habit.archived ? "archived" : "active");
  return {
    ...habit,
    status,
    archived: status === "archived",
    frequencyType:
      habit.frequencyType || (habit.targetPerWeek >= 7 ? "daily" : "days_per_week"),
    skippedDates: habit.skippedDates || [],
    pausedPeriods: habit.pausedPeriods || [],
    completionNotes: habit.completionNotes || {},
    startDate: habit.startDate || habit.createdAt || getTodayISO(),
  };
}

export function normalizeAppState(state: AppState): AppState {
  const today = getTodayISO();
  return {
    ...state,
    onboarding: {
      ...state.onboarding,
      habitInterests: state.onboarding?.habitInterests || [],
    },
    dashboardPreferences: state.dashboardPreferences || { hiddenWidgets: [] },
    weeklyReflections: state.weeklyReflections || {},
    customDailyChallenge: state.customDailyChallenge || null,
    habits: (state.habits || []).map(normalizeHabitRecord),
    sessions: state.sessions || [],
    screenTimeLogs: state.screenTimeLogs || [],
    checkIns: state.checkIns || [],
    coachMessages: state.coachMessages || [],
    bookmarkedPodcastIds: state.bookmarkedPodcastIds || [],
    aiMessagesUsedToday: state.aiQuotaDate === today ? (state.aiMessagesUsedToday ?? 0) : 0,
    aiQuotaDate: today,
  };
}

export function createEmptyUnauthenticatedState(language: Language = "en"): AppState {
  const today = getTodayISO();
  return {
    isAuthenticated: false,
    user: {
      id: "",
      name: "",
      email: "",
      avatarUrl: "",
      plan: "free",
      authProvider: "email",
      createdAt: today,
    },
    onboarding: {
      completed: false,
      dailySocialEstimate: "2-4h",
      distractionSources: [],
      challenges: [],
      goals: [],
      dailyFocusTarget: 25,
    },
    language,
    theme: "light",
    notifications: {
      focusReminders: true,
      eveningWindDown: true,
      habitNudges: false,
    },
    dashboardPreferences: {
      hiddenWidgets: [],
    },
    sessions: [],
    habits: [],
    screenTimeLogs: [],
    checkIns: [],
    coachMessages: [],
    bookmarkedPodcastIds: [],
    dailyChallengeCompletedDate: null,
    aiMessagesUsedToday: 0,
    aiQuotaDate: today,
  };
}

export function getActiveSession(): ActiveSessionMeta | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionMeta;
    if (parsed?.token && parsed?.userId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setActiveSession(session: ActiveSessionMeta | null): void {
  try {
    if (!session) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

export function saveUserLocalCache(userId: string, state: AppState): void {
  if (!userId) return;
  void idbSaveUserState(userId, state);
}

export function loadUserLocalCache(userId: string): AppState | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${USER_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return normalizeAppState({ ...parsed, isAuthenticated: true });
  } catch {
    return null;
  }
}

export async function loadUserIndexedDbState(userId: string): Promise<{
  state: AppState;
  lastSyncedAt: string | null;
} | null> {
  const res = await idbLoadUserState(userId);
  if (!res) return null;
  return {
    state: normalizeAppState({ ...res.state, isAuthenticated: true }),
    lastSyncedAt: res.lastSyncedAt,
  };
}

export function removeUserLocalCache(userId: string): void {
  if (!userId) return;
  void idbRemoveUserState(userId);
}

export function loadGuestLanguage(): Language {
  try {
    const raw = localStorage.getItem(GUEST_PREFS_KEY);
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { language?: Language };
    return parsed.language === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function saveGuestLanguage(language: Language): void {
  try {
    localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify({ language }));
  } catch {
    // ignore
  }
}

// --- Real Backend API Calls ---

export async function signupAccount(params: {
  name: string;
  email: string;
  password: string;
  language: Language;
}): Promise<{ token: string; state: AppState }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Sign up failed.");
  }
  const fullState = normalizeAppState({ ...data.state, isAuthenticated: true });
  setActiveSession({ token: data.token, userId: fullState.user.id });
  await idbSaveUserState(fullState.user.id, fullState, new Date().toISOString());
  return { token: data.token, state: fullState };
}

export async function loginAccount(params: {
  email: string;
  password: string;
  language: Language;
}): Promise<{ token: string; state: AppState }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Log in failed.");
  }
  const fullState = normalizeAppState({ ...data.state, isAuthenticated: true });
  setActiveSession({ token: data.token, userId: fullState.user.id });
  await idbSaveUserState(fullState.user.id, fullState, new Date().toISOString());
  return { token: data.token, state: fullState };
}

export async function resetAccountPassword(params: {
  email: string;
  newPassword: string;
  language: Language;
}): Promise<void> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Password reset failed.");
  }
}

export async function fetchServerUserState(token: string): Promise<AppState | null> {
  try {
    const res = await fetch("/api/user/state", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.state) return null;
    const fullState = normalizeAppState({ ...data.state, isAuthenticated: true });
    await idbSaveUserState(fullState.user.id, fullState, new Date().toISOString());
    return fullState;
  } catch {
    return null;
  }
}

export async function syncServerUserState(token: string, state: AppState): Promise<boolean> {
  if (!token || !state.user.id) return false;
  await idbSaveUserState(state.user.id, state);
  const { isAuthenticated: _ignored, ...persisted } = state;
  try {
    const res = await fetch("/api/user/state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ state: persisted }),
    });
    if (res.ok) {
      await idbSaveUserState(state.user.id, state, new Date().toISOString());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function deleteServerAccount(token: string, userId: string): Promise<void> {
  await fetch("/api/user/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
  await idbRemoveUserState(userId);
  setActiveSession(null);
}
