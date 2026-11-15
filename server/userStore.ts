import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { CoachActionCard } from "../src/types/refocus";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "refocus-db.json");

// Secret used for HMAC session tokens; derived stably on disk if env secret not provided
const TOKEN_SECRET_FILE = path.join(DATA_DIR, ".session-secret");

export interface PersistedFocusSession {
  id: string;
  date: string;
  durationMinutes: number;
  actualFocusedSeconds?: number;
  plannedMinutes: number;
  intention: string;
  completedFull: boolean;
  status?: "completed" | "interrupted";
  startedAt?: string;
  completedAt?: string;
  pausedSeconds?: number;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export interface PersistedHabit {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  category:
    | "reading"
    | "movement"
    | "mindfulness"
    | "learning"
    | "sleep"
    | "digital_wellness"
    | "personal_growth";
  icon?: string;
  color?: string;
  frequencyType?: "daily" | "weekdays" | "days_per_week" | "custom_weekly";
  selectedWeekdays?: number[];
  targetPerWeek: number;
  reminderPreference?: "none" | "morning" | "afternoon" | "evening";
  startDate?: string;
  endDate?: string | null;
  status?: "active" | "paused" | "archived";
  completedDates: string[];
  skippedDates?: string[];
  pausedPeriods?: Array<{ start: string; end?: string | null }>;
  completionNotes?: Record<string, string>;
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export interface PersistedScreenTimeEntry {
  id: string;
  appName: string;
  category: "Social Media" | "Short Video" | "Messaging" | "News" | "Entertainment";
  durationMinutes: number;
  date: string;
  periodOfDay?: "morning" | "afternoon" | "evening" | "night";
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export interface PersistedCheckIn {
  id: string;
  date: string;
  focusRating: number;
  phoneCheckingFrequency: "rarely" | "few_times" | "often" | "frequently";
  topDistraction: string;
  achievedGoal: "yes" | "partially" | "not_today";
  note: string;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export interface PersistedUserState {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    plan: "free" | "premium";
    authProvider: "email";
    createdAt: string;
  };
  onboarding: {
    completed: boolean;
    dailySocialEstimate: string;
    distractionSources: string[];
    challenges: string[];
    goals: string[];
    habitInterests?: PersistedHabit["category"][];
    dailyFocusTarget: number;
    dailyScreenTimeGoalMinutes?: number;
  };
  language: "en" | "ar";
  theme: "light" | "dark";
  notifications: {
    focusReminders: boolean;
    eveningWindDown: boolean;
    habitNudges: boolean;
  };
  dashboardPreferences?: {
    hiddenWidgets: Array<
      "priorities" | "insight" | "weekly_snapshot" | "daily_challenge" | "coach_preview"
    >;
  };
  sessions: PersistedFocusSession[];
  habits: PersistedHabit[];
  screenTimeLogs: PersistedScreenTimeEntry[];
  checkIns: PersistedCheckIn[];
  coachMessages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    source?: "gemini" | "local-coach";
    actionCard?: CoachActionCard;
  }>;
  dailyChallengeCompletedDate: string | null;
  customDailyChallenge?: { title: string; date: string } | null;
  weeklyReflections?: Record<string, string>;
  aiMessagesUsedToday: number;
  aiQuotaDate: string;
  syncMeta?: {
    version: number;
    updatedAt: string;
  };
}

export interface ServerSyncOperation {
  id: string;
  userId?: string;
  entityType:
    | "focus_session"
    | "habit"
    | "screen_time"
    | "check_in"
    | "onboarding"
    | "preferences"
    | "daily_challenge"
    | "full_snapshot";
  operationType: "create" | "update" | "delete" | "complete";
  entityId: string;
  payload: unknown;
  createdAt: string;
  baseVersion?: number;
}

export interface ServerSyncConflict {
  operationId: string;
  entityType: ServerSyncOperation["entityType"];
  entityId: string;
  reason: string;
  serverUpdatedAt: string;
}

export interface StoredUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  state: PersistedUserState;
}

interface DatabaseSchema {
  version: number;
  users: Record<string, StoredUserRecord>;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getTokenSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(TOKEN_SECRET_FILE)) {
    return fs.readFileSync(TOKEN_SECRET_FILE, "utf8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

function readDb(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const empty: DatabaseSchema = { version: 1, users: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!parsed || typeof parsed !== "object" || !parsed.users) {
      return { version: 1, users: {} };
    }
    return parsed;
  } catch {
    return { version: 1, users: {} };
  }
}

function writeDb(db: DatabaseSchema): void {
  ensureDataDir();
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function signAuthToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payload)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
    };
    return decoded.sub || null;
  } catch {
    return null;
  }
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createUserAccount(params: {
  name: string;
  email: string;
  password: string;
  language: "en" | "ar";
}): { user: StoredUserRecord; token: string } | { error: string; status: number } {
  const normalizedEmail = params.email.trim().toLowerCase();
  const db = readDb();

  const existing = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );
  if (existing) {
    return {
      error:
        params.language === "ar"
          ? "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل."
          : "An account with this email already exists.",
      status: 409,
    };
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const today = todayISO();
  const cleanName = params.name.trim();

  const initialState: PersistedUserState = {
    user: {
      id: userId,
      name: cleanName,
      email: normalizedEmail,
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
    language: params.language,
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
    coachMessages: [
      {
        id: `msg_welcome_${Date.now()}`,
        role: "assistant",
        content:
          params.language === "ar"
            ? `أهلاً بك يا ${cleanName} في ReFocus. مساحتك الآن جاهزة وبياناتك محفوظة لك وحدك. كيف تحب أن نبدأ اليوم؟`
            : `Welcome to ReFocus, ${cleanName}. Your personal space is ready and your progress is saved privately to your account. How would you like to start today?`,
        timestamp: now,
        source: "local-coach",
      },
    ],
    dailyChallengeCompletedDate: null,
    aiMessagesUsedToday: 0,
    aiQuotaDate: today,
    syncMeta: {
      version: 1,
      updatedAt: now,
    },
  };

  const record: StoredUserRecord = {
    id: userId,
    email: normalizedEmail,
    passwordHash: hashPassword(params.password),
    createdAt: now,
    updatedAt: now,
    state: initialState,
  };

  db.users[userId] = record;
  writeDb(db);

  return {
    user: record,
    token: signAuthToken(userId),
  };
}

export function authenticateUser(params: {
  email: string;
  password: string;
  language: "en" | "ar";
}): { user: StoredUserRecord; token: string } | { error: string; status: number } {
  const normalizedEmail = params.email.trim().toLowerCase();
  const db = readDb();
  const record = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (!record || !verifyPassword(params.password, record.passwordHash)) {
    return {
      error:
        params.language === "ar"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : "Invalid email address or password.",
      status: 401,
    };
  }

  return {
    user: record,
    token: signAuthToken(record.id),
  };
}

export function resetUserPassword(params: {
  email: string;
  newPassword: string;
  language: "en" | "ar";
}): { ok: true } | { error: string; status: number } {
  const normalizedEmail = params.email.trim().toLowerCase();
  const db = readDb();
  const record = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (!record) {
    return {
      error:
        params.language === "ar"
          ? "لا يوجد حساب مسجل بهذا البريد الإلكتروني."
          : "No account found with this email address.",
      status: 404,
    };
  }

  record.passwordHash = hashPassword(params.newPassword);
  record.updatedAt = new Date().toISOString();
  db.users[record.id] = record;
  writeDb(db);
  return { ok: true };
}

export function getUserStateById(userId: string): PersistedUserState | null {
  const db = readDb();
  const record = db.users[userId];
  if (!record) return null;
  return {
    ...record.state,
    syncMeta: record.state.syncMeta || { version: 1, updatedAt: record.updatedAt },
  };
}

export function saveUserStateById(
  userId: string,
  nextState: PersistedUserState
): PersistedUserState | null {
  const db = readDb();
  const record = db.users[userId];
  if (!record) return null;

  const now = new Date().toISOString();
  const prevVersion = record.state.syncMeta?.version ?? 1;

  record.state = {
    ...nextState,
    user: {
      ...nextState.user,
      id: record.id,
      email: record.email,
      createdAt: record.state.user.createdAt,
    },
    syncMeta: {
      version: prevVersion + 1,
      updatedAt: now,
    },
  };
  record.updatedAt = now;
  db.users[userId] = record;
  writeDb(db);
  return record.state;
}

function isNewerOrEqualTimestamp(incoming?: string, existing?: string): boolean {
  if (!existing) return true;
  if (!incoming) return false;
  return Date.parse(incoming) >= Date.parse(existing);
}

/**
 * Pure conflict-resolving merge engine for offline sync operations.
 * Exported directly so automated unit tests can verify idempotency and conflict resolution.
 */
export function mergeSyncOperationsIntoState(
  currentState: PersistedUserState,
  operations: ServerSyncOperation[],
  nowISO: string = new Date().toISOString()
): {
  nextState: PersistedUserState;
  appliedOpIds: string[];
  conflicts: ServerSyncConflict[];
} {
  let state: PersistedUserState = {
    ...currentState,
    sessions: [...currentState.sessions],
    habits: [...currentState.habits],
    screenTimeLogs: [...currentState.screenTimeLogs],
    checkIns: [...currentState.checkIns],
    syncMeta: currentState.syncMeta || { version: 1, updatedAt: nowISO },
  };

  const appliedOpIds: string[] = [];
  const conflicts: ServerSyncConflict[] = [];

  for (const op of operations) {
    if (op.entityType === "focus_session") {
      if (op.operationType === "create" || op.operationType === "complete") {
        const incoming = op.payload as PersistedFocusSession;
        if (!incoming?.id) {
          appliedOpIds.push(op.id);
          continue;
        }
        const existingIdx = state.sessions.findIndex((s) => s.id === incoming.id);
        if (existingIdx === -1) {
          state.sessions = [
            { ...incoming, version: incoming.version ?? 1, updatedAt: incoming.updatedAt || nowISO },
            ...state.sessions,
          ];
        } else {
          // Idempotent duplicate protection: only update if newer
          const existing = state.sessions[existingIdx];
          if (isNewerOrEqualTimestamp(incoming.updatedAt || incoming.createdAt, existing.updatedAt || existing.createdAt)) {
            state.sessions[existingIdx] = {
              ...existing,
              ...incoming,
              version: Math.max(existing.version ?? 1, incoming.version ?? 1),
            };
          }
        }
        appliedOpIds.push(op.id);
      } else if (op.operationType === "delete") {
        state.sessions = state.sessions.map((s) =>
          s.id === op.entityId ? { ...s, deletedAt: nowISO, updatedAt: nowISO, version: (s.version ?? 1) + 1 } : s
        );
        appliedOpIds.push(op.id);
      }
      continue;
    }

    if (op.entityType === "habit") {
      if (op.operationType === "create") {
        const incoming = op.payload as PersistedHabit;
        if (!incoming?.id) {
          appliedOpIds.push(op.id);
          continue;
        }
        const exists = state.habits.some((h) => h.id === incoming.id);
        if (!exists) {
          state.habits = [
            { ...incoming, version: incoming.version ?? 1, updatedAt: incoming.updatedAt || nowISO },
            ...state.habits,
          ];
        }
        appliedOpIds.push(op.id);
      } else if (op.operationType === "update") {
        const incoming = op.payload as Partial<PersistedHabit> & { updatedAt?: string; version?: number };
        const idx = state.habits.findIndex((h) => h.id === op.entityId);
        if (idx === -1) {
          appliedOpIds.push(op.id);
          continue;
        }
        const existing = state.habits[idx];
        const existingVer = existing.version ?? 1;
        if (
          typeof op.baseVersion === "number" &&
          existingVer > op.baseVersion &&
          !isNewerOrEqualTimestamp(incoming.updatedAt || op.createdAt, existing.updatedAt)
        ) {
          conflicts.push({
            operationId: op.id,
            entityType: op.entityType,
            entityId: op.entityId,
            reason: "Server holds a newer habit version.",
            serverUpdatedAt: existing.updatedAt || nowISO,
          });
          continue;
        }
        state.habits[idx] = {
          ...existing,
          ...incoming,
          id: existing.id,
          updatedAt: incoming.updatedAt || nowISO,
          version: existingVer + 1,
        };
        appliedOpIds.push(op.id);
      } else if (op.operationType === "complete") {
        const payload = op.payload as {
          date: string;
          completed: boolean;
          skipped?: boolean;
          note?: string;
        };
        const idx = state.habits.findIndex((h) => h.id === op.entityId);
        if (idx !== -1 && payload?.date) {
          const h = state.habits[idx];
          const completedSet = new Set(h.completedDates);
          const skippedSet = new Set(h.skippedDates || []);
          if (payload.skipped) {
            skippedSet.add(payload.date);
            completedSet.delete(payload.date);
          } else if (payload.completed) {
            completedSet.add(payload.date);
            skippedSet.delete(payload.date);
          } else {
            completedSet.delete(payload.date);
            skippedSet.delete(payload.date);
          }
          const nextNotes = { ...(h.completionNotes || {}) };
          if (typeof payload.note === "string") {
            if (payload.note.trim()) nextNotes[payload.date] = payload.note.trim();
            else delete nextNotes[payload.date];
          }
          state.habits[idx] = {
            ...h,
            completedDates: Array.from(completedSet),
            skippedDates: Array.from(skippedSet),
            completionNotes: nextNotes,
            updatedAt: op.createdAt || nowISO,
            version: (h.version ?? 1) + 1,
          };
        }
        appliedOpIds.push(op.id);
      } else if (op.operationType === "delete") {
        state.habits = state.habits.map((h) =>
          h.id === op.entityId
            ? { ...h, deletedAt: nowISO, archived: true, status: "archived", updatedAt: nowISO, version: (h.version ?? 1) + 1 }
            : h
        );
        appliedOpIds.push(op.id);
      }
      continue;
    }

    if (op.entityType === "screen_time") {
      if (op.operationType === "create") {
        const incoming = op.payload as PersistedScreenTimeEntry;
        if (incoming?.id && !state.screenTimeLogs.some((l) => l.id === incoming.id)) {
          state.screenTimeLogs = [
            { ...incoming, version: incoming.version ?? 1, updatedAt: incoming.updatedAt || nowISO },
            ...state.screenTimeLogs,
          ];
        }
        appliedOpIds.push(op.id);
      } else if (op.operationType === "delete") {
        state.screenTimeLogs = state.screenTimeLogs.map((l) =>
          l.id === op.entityId ? { ...l, deletedAt: nowISO, updatedAt: nowISO, version: (l.version ?? 1) + 1 } : l
        );
        appliedOpIds.push(op.id);
      }
      continue;
    }

    if (op.entityType === "check_in") {
      if (op.operationType === "create") {
        const incoming = op.payload as PersistedCheckIn;
        if (incoming?.id && !state.checkIns.some((c) => c.id === incoming.id)) {
          state.checkIns = [
            { ...incoming, version: incoming.version ?? 1, updatedAt: incoming.updatedAt || nowISO },
            ...state.checkIns,
          ];
        }
        appliedOpIds.push(op.id);
      } else if (op.operationType === "update") {
        const incoming = op.payload as Partial<PersistedCheckIn>;
        const idx = state.checkIns.findIndex((c) => c.id === op.entityId);
        if (idx !== -1) {
          const existing = state.checkIns[idx];
          state.checkIns[idx] = {
            ...existing,
            ...incoming,
            id: existing.id,
            updatedAt: incoming.updatedAt || nowISO,
            version: (existing.version ?? 1) + 1,
          };
        }
        appliedOpIds.push(op.id);
      }
      continue;
    }

    if (op.entityType === "daily_challenge") {
      const payload = op.payload as {
        date?: string | null;
        customDailyChallenge?: { title: string; date: string } | null;
      };
      if ("date" in (payload || {})) {
        state.dailyChallengeCompletedDate = payload?.date ?? null;
      }
      if ("customDailyChallenge" in (payload || {})) {
        state.customDailyChallenge = payload?.customDailyChallenge ?? null;
      }
      appliedOpIds.push(op.id);
      continue;
    }

    if (op.entityType === "onboarding") {
      const payload = op.payload as {
        name?: string;
        onboarding: PersistedUserState["onboarding"];
      };
      if (payload?.onboarding) {
        state.onboarding = { ...state.onboarding, ...payload.onboarding };
      }
      if (payload?.name) {
        state.user = { ...state.user, name: payload.name };
      }
      appliedOpIds.push(op.id);
      continue;
    }

    if (op.entityType === "preferences") {
      const payload = op.payload as Partial<
        Pick<
          PersistedUserState,
          | "language"
          | "theme"
          | "notifications"
          | "dashboardPreferences"
          | "coachMessages"
          | "aiMessagesUsedToday"
          | "aiQuotaDate"
          | "weeklyReflections"
        >
      > & { plan?: "free" | "premium" };
      if (payload.language) state.language = payload.language;
      if (payload.theme) state.theme = payload.theme;
      if (payload.notifications) state.notifications = payload.notifications;
      if (payload.dashboardPreferences) state.dashboardPreferences = payload.dashboardPreferences;
      if (payload.coachMessages) state.coachMessages = payload.coachMessages;
      if (payload.weeklyReflections) {
        state.weeklyReflections = {
          ...(state.weeklyReflections || {}),
          ...payload.weeklyReflections,
        };
      }
      if (typeof payload.aiMessagesUsedToday === "number") {
        state.aiMessagesUsedToday = payload.aiMessagesUsedToday;
      }
      if (payload.aiQuotaDate) state.aiQuotaDate = payload.aiQuotaDate;
      if (payload.plan) state.user = { ...state.user, plan: payload.plan };
      appliedOpIds.push(op.id);
      continue;
    }

    if (op.entityType === "full_snapshot") {
      const incoming = op.payload as PersistedUserState;
      if (incoming && typeof incoming === "object") {
        state = {
          ...incoming,
          user: {
            ...incoming.user,
            id: currentState.user.id,
            email: currentState.user.email,
            createdAt: currentState.user.createdAt,
          },
        };
      }
      appliedOpIds.push(op.id);
    }
  }

  const nextVersion = (state.syncMeta?.version ?? 1) + (appliedOpIds.length > 0 ? 1 : 0);
  state.syncMeta = {
    version: nextVersion,
    updatedAt: nowISO,
  };

  return { nextState: state, appliedOpIds, conflicts };
}

export function applyUserSyncOperations(
  userId: string,
  operations: ServerSyncOperation[]
): {
  state: PersistedUserState;
  serverVersion: number;
  syncedAt: string;
  appliedOpIds: string[];
  conflicts: ServerSyncConflict[];
} | null {
  const db = readDb();
  const record = db.users[userId];
  if (!record) return null;

  const nowISO = new Date().toISOString();
  const merged = mergeSyncOperationsIntoState(record.state, operations, nowISO);

  record.state = merged.nextState;
  record.updatedAt = nowISO;
  db.users[userId] = record;
  writeDb(db);

  return {
    state: record.state,
    serverVersion: record.state.syncMeta?.version ?? 1,
    syncedAt: nowISO,
    appliedOpIds: merged.appliedOpIds,
    conflicts: merged.conflicts,
  };
}

export function deleteUserAccountById(userId: string): boolean {
  const db = readDb();
  if (!db.users[userId]) return false;
  delete db.users[userId];
  writeDb(db);
  return true;
}
