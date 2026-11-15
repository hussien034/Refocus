export type Language = "en" | "ar";
export type ThemeMode = "light" | "dark";
export type PlanTier = "free" | "premium";

export type AppScreen =
  | "welcome"
  | "auth"
  | "onboarding"
  | "home"
  | "focus"
  | "habits"
  | "coach"
  | "profile"
  | "tracker"
  | "checkin"
  | "analytics"
  | "review"
  | "library";

export interface OnboardingProfile {
  completed: boolean;
  dailySocialEstimate: string;
  distractionSources: string[];
  challenges: string[];
  goals: string[];
  habitInterests?: HabitCategory[];
  dailyFocusTarget: number; // minutes
  dailyScreenTimeGoalMinutes?: number; // optional self-set daily social/screen goal
}

export interface NotificationPreferences {
  focusReminders: boolean;
  eveningWindDown: boolean;
  habitNudges: boolean;
}

export interface DashboardPreferences {
  hiddenWidgets: Array<
    "priorities" | "insight" | "weekly_snapshot" | "daily_challenge" | "coach_preview"
  >;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: PlanTier;
  authProvider: "email";
  createdAt: string;
}

export interface FocusSession {
  id: string;
  date: string; // YYYY-MM-DD (local calendar date)
  durationMinutes: number; // actual focused minutes (never paused time)
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

export type TimerStatus = "idle" | "running" | "paused" | "completed" | "interrupted";

export interface BreakTimerState {
  status: "idle" | "running" | "completed";
  durationSeconds: number;
  startedAtMs: number | null;
}

export interface PersistedTimerState {
  sessionId: string;
  userId: string;
  status: TimerStatus;
  intendedDurationSeconds: number;
  actualFocusedSeconds: number;
  startedAtMs: number | null;
  pausedAtMs: number | null;
  accumulatedPausedMs: number;
  intention: string;
  lastUpdatedAtMs: number;
  completedSavedSessionId: string | null;
  breakTimer?: BreakTimerState;
}

export type HabitCategory =
  | "reading"
  | "movement"
  | "mindfulness"
  | "learning"
  | "sleep"
  | "digital_wellness"
  | "personal_growth";

export type HabitFrequencyType =
  | "daily"
  | "weekdays"
  | "days_per_week"
  | "custom_weekly";

export type HabitStatus = "active" | "paused" | "archived";
export type HabitReminderPref = "none" | "morning" | "afternoon" | "evening";

export interface HabitPausedPeriod {
  start: string; // YYYY-MM-DD
  end?: string | null; // YYYY-MM-DD when resumed, null while still paused
}

export interface Habit {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  category: HabitCategory;
  icon?: string;
  color?: string;
  frequencyType?: HabitFrequencyType;
  selectedWeekdays?: number[]; // 0 (Sun) .. 6 (Sat)
  targetPerWeek: number;
  reminderPreference?: HabitReminderPref;
  startDate?: string; // YYYY-MM-DD
  endDate?: string | null;
  status?: HabitStatus;
  completedDates: string[]; // YYYY-MM-DD[]
  skippedDates?: string[]; // YYYY-MM-DD[]
  pausedPeriods?: HabitPausedPeriod[];
  completionNotes?: Record<string, string>; // YYYY-MM-DD -> note
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export type ScreenTimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface ScreenTimeEntry {
  id: string;
  appName: string;
  category: "Social Media" | "Short Video" | "Messaging" | "News" | "Entertainment";
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  periodOfDay?: ScreenTimePeriod;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export interface DailyCheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  focusRating: number; // 1..5
  phoneCheckingFrequency: "rarely" | "few_times" | "often" | "frequently";
  topDistraction: string;
  achievedGoal: "yes" | "partially" | "not_today";
  note: string;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  deletedAt?: string | null;
}

export type CoachActionType =
  | "focus_session"
  | "new_habit"
  | "daily_challenge"
  | "screen_time_goal"
  | "wellness_tip";

export type CoachActionStatus = "pending" | "accepted" | "dismissed";

export interface CoachActionCard {
  id: string;
  type: CoachActionType;
  title: string;
  explanation: string;
  relevanceReason: string;
  status: CoachActionStatus;
  durationMinutes?: number;
  intention?: string;
  habitTitle?: string;
  habitCategory?: HabitCategory;
  habitFrequencyType?: HabitFrequencyType;
  habitTargetPerWeek?: number;
  challengeTitle?: string;
  screenTimeGoalMinutes?: number;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: "gemini" | "local-coach";
  actionCard?: CoachActionCard;
}

export interface CustomDailyChallenge {
  title: string;
  date: string; // YYYY-MM-DD
}

export interface SyncMeta {
  version: number;
  updatedAt: string;
}

export interface AppState {
  isAuthenticated: boolean;
  user: UserProfile;
  onboarding: OnboardingProfile;
  language: Language;
  theme: ThemeMode;
  notifications: NotificationPreferences;
  dashboardPreferences?: DashboardPreferences;
  sessions: FocusSession[];
  habits: Habit[];
  screenTimeLogs: ScreenTimeEntry[];
  checkIns: DailyCheckIn[];
  coachMessages: CoachMessage[];
  dailyChallengeCompletedDate: string | null;
  customDailyChallenge?: CustomDailyChallenge | null;
  weeklyReflections?: Record<string, string>; // weekStartISO -> note
  aiMessagesUsedToday: number;
  aiQuotaDate: string;
  bookmarkedPodcastIds?: string[];
  syncMeta?: SyncMeta;
}

export type PodcastCategory =
  | "brain_rot"
  | "focus_attention"
  | "social_media_overuse"
  | "dopamine"
  | "digital_wellness"
  | "deep_work_reading"
  | "digital_habits";

export interface PodcastEpisode {
  id: string;
  title: string;
  titleAr?: string;
  channelName: string;
  description: string;
  descriptionAr?: string;
  youtubeVideoId: string;
  categories: PodcastCategory[];
  thumbnailUrl?: string;
  duration?: string;
  publishedAt?: string;
  featured?: boolean;
}

export type SyncEntityType =
  | "focus_session"
  | "habit"
  | "screen_time"
  | "check_in"
  | "onboarding"
  | "preferences"
  | "daily_challenge"
  | "full_snapshot";

export type SyncOperationType = "create" | "update" | "delete" | "complete";
export type SyncOperationStatus = "pending" | "syncing" | "failed" | "conflict";
export type SyncConnectionState = "online" | "offline" | "syncing" | "synced" | "error";

export interface SyncOperation {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  payload: unknown;
  createdAt: string;
  baseVersion?: number;
  retryCount: number;
  status: SyncOperationStatus;
  errorMessage?: string;
}

export interface SyncConflict {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  reason: string;
  serverUpdatedAt: string;
}

export interface SyncStatusSnapshot {
  state: SyncConnectionState;
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  conflicts: SyncConflict[];
}
