import test from "node:test";
import assert from "node:assert/strict";
import {
  completeTimerSession,
  computeBreakRemainingSeconds,
  computeTimerSnapshot,
  createIdleTimerState,
  pauseTimerSession,
  resumeTimerSession,
  selectTimerDuration,
  startBreakTimer,
  startTimerSession,
} from "../src/features/focus/timerEngine";
import {
  addDaysISO,
  calculateHabitInsights,
  calculateOverallFocusStreak,
  computeAnalyticsSummary,
  computeDashboardMetrics,
  getDailyFocusMinutes,
} from "../src/services/analytics/metricsEngine";
import { idbClearUserQueue, idbListUserOperations } from "../src/services/storage/indexedDb";
import { OfflineSyncManager, SyncTransport } from "../src/services/sync/syncEngine";
import { mergeSyncOperationsIntoState, PersistedUserState } from "../server/userStore";
import { TRANSLATIONS } from "../src/i18n/translations";
import { AppState, Habit } from "../src/types/refocus";

function buildBaseAppState(todayISO: string = "2026-06-15"): AppState {
  return {
    isAuthenticated: true,
    user: {
      id: "usr_test_1",
      name: "Test User",
      email: "test@refocus.app",
      avatarUrl: "",
      plan: "free",
      authProvider: "email",
      createdAt: todayISO,
    },
    onboarding: {
      completed: true,
      dailySocialEstimate: "2-4h",
      distractionSources: ["Instagram"],
      challenges: ["Mindless scrolling"],
      goals: ["Deep focus"],
      dailyFocusTarget: 30,
    },
    language: "en",
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
    dailyChallengeCompletedDate: null,
    aiMessagesUsedToday: 0,
    aiQuotaDate: todayISO,
  };
}

// =========================================================================
// MODULE 1 TESTS: Timestamp-Backed Persistent Focus Timer
// =========================================================================

test("Focus timer calculates remaining/elapsed time from timestamps across refresh & pause/resume", () => {
  const t0 = 1_700_000_000_000;
  let timer = createIdleTimerState("usr_1", 25, "Read book", t0);
  timer = selectTimerDuration(timer, 30, t0 + 1000);
  timer = startTimerSession(timer, t0 + 2000);

  // Simulate 10 minutes elapsed cleanly via timestamps (no interval required)
  const after10Min = t0 + 2000 + 10 * 60 * 1000;
  const snap1 = computeTimerSnapshot(timer, after10Min);
  assert.equal(snap1.elapsedFocusedSeconds, 600);
  assert.equal(snap1.remainingSeconds, 1200);
  assert.equal(snap1.isCompleteNow, false);

  // Pause at 10m and leave paused for 5m
  timer = pauseTimerSession(timer, after10Min);
  const after5MinPause = after10Min + 5 * 60 * 1000;
  const snapPaused = computeTimerSnapshot(timer, after5MinPause);
  assert.equal(snapPaused.elapsedFocusedSeconds, 600);
  assert.equal(snapPaused.pausedSecondsTotal, 300);

  // Resume and run another 20 minutes to reach full 30m
  timer = resumeTimerSession(timer, after5MinPause);
  const afterFull = after5MinPause + 20 * 60 * 1000;
  const snapDone = computeTimerSnapshot(timer, afterFull);
  assert.equal(snapDone.isCompleteNow, true);
  assert.equal(snapDone.elapsedFocusedSeconds, 1800);
  assert.equal(snapDone.remainingSeconds, 0);

  // Complete session once — verify paused time did NOT inflate durationMinutes
  const { nextTimer, sessionToSave } = completeTimerSession(timer, afterFull, true, "2026-06-15");
  assert.ok(sessionToSave);
  assert.equal(sessionToSave.durationMinutes, 30);
  assert.equal(sessionToSave.pausedSeconds, 300);
  assert.equal(sessionToSave.completedFull, true);

  // Duplicate completion guard: second completion on same sessionId must NOT return another record
  const duplicate = completeTimerSession(nextTimer, afterFull + 1000, true, "2026-06-15");
  assert.equal(duplicate.sessionToSave, null);
});

test("Focus timer handles clock backward jumps and short discards safely", () => {
  const t0 = 1_700_000_000_000;
  let timer = createIdleTimerState("usr_1", 25, "Deep work", t0);
  timer = startTimerSession(timer, t0);

  // Simulated device clock backward jump
  const backwardSnap = computeTimerSnapshot(timer, t0 - 60_000);
  assert.equal(backwardSnap.elapsedFocusedSeconds, 0);
  assert.equal(backwardSnap.remainingSeconds, 1500);

  // Ending before 60 seconds returns null (no bogus 0-minute log)
  const early = completeTimerSession(timer, t0 + 30_000, false, "2026-06-15");
  assert.equal(early.sessionToSave, null);
  assert.equal(early.nextTimer.status, "interrupted");

  // Ending partial >= 120 seconds logs accurate partial minutes
  const partial = completeTimerSession(timer, t0 + 125_000, false, "2026-06-15");
  assert.ok(partial.sessionToSave);
  assert.equal(partial.sessionToSave.durationMinutes, 2);
  assert.equal(partial.sessionToSave.completedFull, false);
});

test("Break timer counts down accurately via timestamps", () => {
  const t0 = 1_700_000_000_000;
  const completed = {
    ...createIdleTimerState("usr_1", 10, "", t0),
    status: "completed" as const,
  };
  const withBreak = startBreakTimer(completed, 5, t0);
  assert.equal(computeBreakRemainingSeconds(withBreak, t0 + 120_000), 180);
  assert.equal(computeBreakRemainingSeconds(withBreak, t0 + 310_000), 0);
});

// =========================================================================
// MODULE 3 TESTS: Habit Manager, Frequency-Aware Streaks & Skip Today
// =========================================================================

test("Habits support daily, weekdays (skipping planned rest days), days_per_week, and Skip Today", () => {
  // 2026-06-15 is a Monday; 2026-06-12 was Friday (Sat 13 & Sun 14 are weekend rest days)
  const monday = "2026-06-15";

  const weekdayHabit: Habit = {
    id: "h_wd",
    title: "Morning planning",
    category: "personal_growth",
    frequencyType: "weekdays",
    selectedWeekdays: [1, 2, 3, 4, 5],
    targetPerWeek: 5,
    status: "active",
    archived: false,
    startDate: "2026-06-08",
    completedDates: ["2026-06-15", "2026-06-12", "2026-06-11"],
    skippedDates: [],
    createdAt: "2026-06-08",
  };
  const wdInsights = calculateHabitInsights(weekdayHabit, monday);
  assert.equal(wdInsights.currentStreak, 3); // Thu + Fri + Mon preserved across Sat/Sun rest days!
  assert.equal(wdInsights.bestStreak, 3);

  const dailyWithSkip: Habit = {
    id: "h_skip",
    title: "Evening walk",
    category: "movement",
    frequencyType: "daily",
    targetPerWeek: 7,
    status: "active",
    archived: false,
    startDate: "2026-06-10",
    completedDates: ["2026-06-12", "2026-06-13", "2026-06-15"],
    skippedDates: ["2026-06-14"], // Skipped yesterday deliberately -> does not break streak
    createdAt: "2026-06-10",
  };
  const skipInsights = calculateHabitInsights(dailyWithSkip, monday);
  assert.equal(skipInsights.currentStreak, 3);
  assert.equal(skipInsights.skippedToday, false);

  // Weekly target habit (3x/week)
  const weeklyTargetHabit: Habit = {
    id: "h_weekly",
    title: "Deep reading",
    category: "reading",
    frequencyType: "days_per_week",
    targetPerWeek: 3,
    status: "active",
    archived: false,
    startDate: "2026-06-01",
    completedDates: [
      // Current week starting Sun 2026-06-14: 2 completions so far (progress 67%)
      "2026-06-14",
      "2026-06-15",
      // Previous week Sun 2026-06-07..Sat 2026-06-13: 3 completions (met!)
      "2026-06-08",
      "2026-06-10",
      "2026-06-12",
      // Prior week Sun 2026-05-31..Sat 2026-06-06: 3 completions (met!)
      "2026-06-01",
      "2026-06-03",
      "2026-06-05",
    ],
    skippedDates: [],
    createdAt: "2026-06-01",
  };
  const weeklyInsights = calculateHabitInsights(weeklyTargetHabit, monday);
  assert.equal(weeklyInsights.streakUnit, "weeks");
  assert.equal(weeklyInsights.currentStreak, 2);
  assert.equal(weeklyInsights.weeklyCompletedCount, 2);
  assert.equal(weeklyInsights.weeklyProgressPct, 67);
});

// =========================================================================
// MODULE 4 & 5 TESTS: Dashboard & Analytics Parity + Edge Cases
// =========================================================================

test("Dashboard and Analytics share identical focus calculations and guard zero-denominators & missing days", () => {
  const today = "2026-06-15";
  const state = buildBaseAppState(today);
  state.sessions = [
    {
      id: "s1",
      date: today,
      durationMinutes: 25,
      plannedMinutes: 25,
      intention: "Deep work",
      completedFull: true,
      status: "completed",
      createdAt: `${today}T10:00:00Z`,
    },
    {
      // Interrupted session must NEVER count toward completed focus totals
      id: "s_interrupted",
      date: today,
      durationMinutes: 10,
      plannedMinutes: 25,
      intention: "Interrupted",
      completedFull: false,
      status: "interrupted",
      createdAt: `${today}T11:00:00Z`,
    },
    {
      id: "s2",
      date: addDaysISO(today, -1),
      durationMinutes: 45,
      plannedMinutes: 45,
      intention: "Study",
      completedFull: true,
      status: "completed",
      createdAt: `${addDaysISO(today, -1)}T09:00:00Z`,
    },
  ];
  state.screenTimeLogs = [
    {
      id: "st1",
      appName: "Instagram",
      category: "Social Media",
      durationMinutes: 40,
      date: today,
      createdAt: `${today}T12:00:00Z`,
    },
    {
      id: "st_deleted",
      appName: "TikTok",
      category: "Short Video",
      durationMinutes: 99,
      date: today,
      createdAt: `${today}T12:10:00Z`,
      deletedAt: `${today}T12:15:00Z`,
    },
  ];

  const dash = computeDashboardMetrics(state, today);
  const analytics7d = computeAnalyticsSummary(state, addDaysISO(today, -6), today, "en");

  // Shared consistency: today focus is strictly 25 (interrupted ignored)
  assert.equal(getDailyFocusMinutes(state.sessions, today), 25);
  assert.equal(dash.todayFocusMinutes, 25);
  assert.equal(dash.todayScreenTimeMinutes, 40); // soft-deleted log ignored
  assert.equal(dash.focusStreakDays, calculateOverallFocusStreak(state.sessions, today));

  // Total 7d focus = 25 + 45 = 70
  assert.equal(analytics7d.totalFocusMinutes, 70);
  assert.equal(analytics7d.completedSessionsCount, 2);
  assert.equal(analytics7d.mostProductiveDay?.date, addDaysISO(today, -1));
  assert.equal(analytics7d.mostProductiveDay?.minutes, 45);

  // Zero-denominator period comparison safety (previous period had 0 sessions -> null %, not Infinity/NaN)
  assert.equal(analytics7d.focusComparison.hasValidBaseline, false);
  assert.equal(analytics7d.focusComparison.percentChange, null);

  // Missing screen-time days NOT treated as 0 usage: 1 logged day with 40m -> averagePerLoggedDayMinutes === 40
  assert.equal(analytics7d.loggedScreenDaysCount, 1);
  assert.equal(analytics7d.averagePerLoggedDayMinutes, 40);
  const missingDayBucket = analytics7d.chartBuckets.find((b) => b.key === addDaysISO(today, -2));
  assert.equal(missingDayBucket?.screen, null);
});

// =========================================================================
// MODULE 2 TESTS: Offline Sync Queue, Retry, Idempotency & Conflict Resolution
// =========================================================================

test("OfflineSyncManager queues offline, rejects cross-user ops, retries failures, and syncs on reconnect", async () => {
  await idbClearUserQueue("usr_sync_a");

  let failOnce = true;
  const serverBase = buildBaseAppState("2026-06-15");
  serverBase.user.id = "usr_sync_a";

  const mockTransport: SyncTransport = {
    async syncOperations(_token, operations) {
      if (failOnce) {
        failOnce = false;
        throw new Error("Network temporarily unavailable");
      }
      const persisted: PersistedUserState = {
        ...serverBase,
        syncMeta: { version: 1, updatedAt: "2026-06-15T10:00:00Z" },
      };
      const merged = mergeSyncOperationsIntoState(persisted, operations, "2026-06-15T10:05:00Z");
      return {
        state: { ...merged.nextState, isAuthenticated: true },
        serverVersion: merged.nextState.syncMeta?.version || 2,
        syncedAt: "2026-06-15T10:05:00Z",
        appliedOpIds: merged.appliedOpIds,
        conflicts: merged.conflicts,
      };
    },
  };

  const manager = new OfflineSyncManager(mockTransport);
  await manager.setSession("usr_sync_a", "tok_a", null);

  // Security check: cross-user operation enqueue rejected
  await assert.rejects(
    manager.enqueueOperation({
      userId: "usr_other",
      entityType: "habit",
      operationType: "create",
      entityId: "hab_bad",
      payload: {},
    }),
    /Cross-user operation enqueue rejected/
  );

  // Enqueue operation for active user (first attempt fails -> retained with retryCount 1)
  await manager.enqueueOperation({
    userId: "usr_sync_a",
    entityType: "habit",
    operationType: "create",
    entityId: "hab_1",
    payload: {
      id: "hab_1",
      title: "Offline Habit",
      category: "reading",
      targetPerWeek: 7,
      completedDates: [],
      archived: false,
      createdAt: "2026-06-15",
    },
  });

  // Wait briefly for the async flush fired by enqueueOperation to finish its failed attempt
  await new Promise((r) => setTimeout(r, 25));
  const pendingAfterFail = await idbListUserOperations("usr_sync_a");
  assert.equal(pendingAfterFail.length, 1);
  assert.equal(pendingAfterFail[0].retryCount, 1);
  assert.equal(manager.getSnapshot().state, "error");

  // Retry succeeds -> queue drains & state transitions to synced
  const flushRes = await manager.flushQueue();
  assert.equal(flushRes.ok, true);
  assert.equal(flushRes.syncedCount, 1);
  const pendingAfterSuccess = await idbListUserOperations("usr_sync_a");
  assert.equal(pendingAfterSuccess.length, 0);
  assert.equal(manager.getSnapshot().state, "synced");
});

test("Server merge handles idempotency, tombstones, and optimistic concurrency conflicts", () => {
  const baseState = buildBaseAppState("2026-06-15");
  const initialServer: PersistedUserState = {
    ...baseState,
    habits: [
      {
        id: "h1",
        title: "Server Habit v2",
        category: "reading",
        targetPerWeek: 7,
        completedDates: [],
        archived: false,
        createdAt: "2026-06-10",
        updatedAt: "2026-06-15T12:00:00.000Z",
        version: 2,
      },
    ],
    syncMeta: { version: 2, updatedAt: "2026-06-15T12:00:00.000Z" },
  };

  // Duplicate session create + stale habit update (baseVersion 1 < server version 2 with older timestamp -> conflict!)
  const merge1 = mergeSyncOperationsIntoState(
    initialServer,
    [
      {
        id: "op_sess_1",
        entityType: "focus_session",
        operationType: "complete",
        entityId: "sess_dup",
        createdAt: "2026-06-15T12:05:00.000Z",
        payload: {
          id: "sess_dup",
          date: "2026-06-15",
          durationMinutes: 25,
          plannedMinutes: 25,
          intention: "Focus",
          completedFull: true,
          status: "completed",
          createdAt: "2026-06-15T12:05:00.000Z",
        },
      },
      {
        id: "op_sess_dup",
        entityType: "focus_session",
        operationType: "complete",
        entityId: "sess_dup",
        createdAt: "2026-06-15T12:05:00.000Z",
        payload: {
          id: "sess_dup",
          date: "2026-06-15",
          durationMinutes: 25,
          plannedMinutes: 25,
          intention: "Focus",
          completedFull: true,
          status: "completed",
          createdAt: "2026-06-15T12:05:00.000Z",
        },
      },
      {
        id: "op_hab_conflict",
        entityType: "habit",
        operationType: "update",
        entityId: "h1",
        baseVersion: 1,
        createdAt: "2026-06-15T11:00:00.000Z",
        payload: { title: "Stale Client Edit", updatedAt: "2026-06-15T11:00:00.000Z" },
      },
    ],
    "2026-06-15T12:10:00.000Z"
  );

  assert.equal(merge1.nextState.sessions.length, 1); // deduplicated!
  assert.equal(merge1.conflicts.length, 1);
  assert.equal(merge1.conflicts[0].operationId, "op_hab_conflict");
  assert.equal(merge1.nextState.habits[0].title, "Server Habit v2");
});

// =========================================================================
// BILINGUAL EN / AR TRANSLATION PARITY TEST
// =========================================================================

test("TRANSLATIONS.en and TRANSLATIONS.ar maintain structural parity for all Phase 2 sections", () => {
  const sections = ["dashboard", "focus", "habits", "analytics", "sync"] as const;
  for (const sec of sections) {
    const enKeys = Object.keys(TRANSLATIONS.en[sec]).sort();
    const arKeys = Object.keys(TRANSLATIONS.ar[sec]).sort();
    assert.deepEqual(arKeys, enKeys, `Key mismatch in TRANSLATIONS.${sec}`);
  }
});
