import { AppState, Habit, Language } from "../types/refocus";
import {
  calculateOverallFocusStreak as metricsFocusStreak,
  formatDateISO,
  getPastDateISO,
  getTodayISO,
} from "./analytics/metricsEngine";
import {
  idbClearUserQueue,
  idbLoadUserState,
  idbRemoveUserState,
  idbSaveUserState,
} from "./storage/indexedDb";
import { getCopy } from "../i18n/translations";

export { formatDateISO, getPastDateISO, getTodayISO };

const ACTIVE_SESSION_KEY = "refocus_active_session_v1";
const USER_STORAGE_PREFIX = "refocus_user_data_v1_";
const GUEST_PREFS_KEY = "refocus_guest_prefs_v1";
const LOCAL_ACCOUNTS_KEY = "refocus_local_accounts_v1";
export const LOCAL_SESSION_TOKEN = "local";
const PASSWORD_HASH_ITERATIONS = 120_000;

interface LocalAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  passwordSalt: string;
  passwordHash: string;
}

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
    if (parsed?.userId) return { token: LOCAL_SESSION_TOKEN, userId: parsed.userId };
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

// --- Browser-local accounts ---

function readLocalAccounts(language: Language): LocalAccount[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
  } catch {
    throw new Error(getCopy(language).auth.errors.localStorageUnavailable);
  }
  if (!raw) return [];

  try {
    const accounts = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(accounts) ||
      accounts.some(
        (account) =>
          !account ||
          typeof account.id !== "string" ||
          typeof account.email !== "string" ||
          typeof account.passwordSalt !== "string" ||
          typeof account.passwordHash !== "string"
      )
    ) {
      throw new Error("Invalid account data");
    }
    return accounts as LocalAccount[];
  } catch {
    throw new Error(getCopy(language).auth.errors.localAccountDataInvalid);
  }
}

function saveLocalAccounts(accounts: LocalAccount[], language: Language): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    throw new Error(getCopy(language).auth.errors.localStorageUnavailable);
  }
}

function getCrypto(language: Language): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error(getCopy(language).auth.errors.localCryptoUnavailable);
  }
  return globalThis.crypto;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: Uint8Array, language: Language): Promise<string> {
  const cryptoApi = getCrypto(language);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function passwordsMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) {
    difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

function createSalt(language: Language): Uint8Array {
  const salt = new Uint8Array(16);
  getCrypto(language).getRandomValues(salt);
  return salt;
}

function createLocalUserState(account: LocalAccount, language: Language): AppState {
  const emptyState = createEmptyUnauthenticatedState(language);
  return normalizeAppState({
    ...emptyState,
    isAuthenticated: true,
    user: {
      ...emptyState.user,
      id: account.id,
      name: account.name,
      email: account.email,
      createdAt: account.createdAt,
    },
  });
}

async function activateLocalAccount(
  account: LocalAccount,
  language: Language
): Promise<{ token: string; state: AppState }> {
  const storedState = await loadUserIndexedDbState(account.id);
  const state = storedState?.state || createLocalUserState(account, language);
  setActiveSession({ token: LOCAL_SESSION_TOKEN, userId: account.id });
  if (getActiveSession()?.userId !== account.id) {
    throw new Error(getCopy(language).auth.errors.localStorageUnavailable);
  }
  await idbSaveUserState(account.id, { ...state, isAuthenticated: true });
  return { token: LOCAL_SESSION_TOKEN, state: { ...state, isAuthenticated: true } };
}

export async function signupAccount(params: {
  name: string;
  email: string;
  password: string;
  language: Language;
}): Promise<{ token: string; state: AppState }> {
  const accounts = readLocalAccounts(params.language);
  const email = params.email.trim().toLowerCase();
  if (accounts.some((account) => account.email.toLowerCase() === email)) {
    throw new Error(getCopy(params.language).auth.errors.accountAlreadyExists);
  }

  const salt = createSalt(params.language);
  const account: LocalAccount = {
    id: `user_${getCrypto(params.language).randomUUID()}`,
    name: params.name.trim(),
    email,
    createdAt: getTodayISO(),
    passwordSalt: bytesToHex(salt),
    passwordHash: await hashPassword(params.password, salt, params.language),
  };
  accounts.push(account);
  saveLocalAccounts(accounts, params.language);
  return activateLocalAccount(account, params.language);
}

export async function loginAccount(params: {
  email: string;
  password: string;
  language: Language;
}): Promise<{ token: string; state: AppState }> {
  const email = params.email.trim().toLowerCase();
  const account = readLocalAccounts(params.language).find(
    (candidate) => candidate.email.toLowerCase() === email
  );
  if (!account) {
    throw new Error(getCopy(params.language).auth.errors.invalidCredentials);
  }

  const hash = await hashPassword(
    params.password,
    hexToBytes(account.passwordSalt),
    params.language
  );
  if (!passwordsMatch(hash, account.passwordHash)) {
    throw new Error(getCopy(params.language).auth.errors.invalidCredentials);
  }
  return activateLocalAccount(account, params.language);
}

export async function resetAccountPassword(params: {
  email: string;
  newPassword: string;
  language: Language;
}): Promise<void> {
  const accounts = readLocalAccounts(params.language);
  const accountIndex = accounts.findIndex(
    (candidate) => candidate.email.toLowerCase() === params.email.trim().toLowerCase()
  );
  if (accountIndex < 0) {
    throw new Error(getCopy(params.language).auth.errors.accountNotFound);
  }

  const salt = createSalt(params.language);
  accounts[accountIndex] = {
    ...accounts[accountIndex],
    passwordSalt: bytesToHex(salt),
    passwordHash: await hashPassword(params.newPassword, salt, params.language),
  };
  saveLocalAccounts(accounts, params.language);
}

export async function deleteLocalAccount(userId: string, language: Language): Promise<void> {
  const accounts = readLocalAccounts(language).filter((account) => account.id !== userId);
  saveLocalAccounts(accounts, language);
  await idbClearUserQueue(userId);
  await idbRemoveUserState(userId);
  setActiveSession(null);
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
