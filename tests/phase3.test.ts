import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO,
  calculateHabitInsights,
  computeScreenTimeInsights,
  computeWeeklyReview,
  generateSmartDashboardInsight,
  getAvailableReviewWeeks,
  isDatePausedForHabit,
} from "../src/services/analytics/metricsEngine";
import {
  parseCoachModelPayload,
  validateCoachActionCard,
} from "../src/services/coachActionValidator";
import { buildSmartLocalReply, CoachContextPayload } from "../server/coachEngine";
import { mergeSyncOperationsIntoState, PersistedUserState } from "../server/userStore";
import { TRANSLATIONS } from "../src/i18n/translations";
import {
  getActiveSession,
  loginAccount,
  resetAccountPassword,
  signupAccount,
} from "../src/services/storageService";
import { idbSaveUserState } from "../src/services/storage/indexedDb";
import { AppState, Habit } from "../src/types/refocus";

function buildBaseAppState(todayISO: string = "2026-06-17"): AppState {
  return {
    isAuthenticated: true,
    user: {
      id: "usr_phase3",
      name: "Nadia",
      email: "nadia@refocus.app",
      avatarUrl: "",
      plan: "free",
      authProvider: "email",
      createdAt: todayISO,
    },
    onboarding: {
      completed: true,
      dailySocialEstimate: "2-4h",
      distractionSources: ["Instagram", "TikTok"],
      challenges: ["Unintentional scrolling"],
      goals: ["Improve focus"],
      habitInterests: ["reading", "movement"],
      dailyFocusTarget: 30,
      dailyScreenTimeGoalMinutes: 60,
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
    weeklyReflections: {},
    aiMessagesUsedToday: 0,
    aiQuotaDate: todayISO,
  };
}

// =========================================================================
// 1. HABIT PAUSE/RESUME & UNDO SKIP PRODUCT LOGIC
// =========================================================================

test("Habit pausedPeriods preserve streaks/history and exclude paused dates from consistency rate", () => {
  const today = "2026-06-17";
  const habit: Habit = {
    id: "hab_pause_1",
    title: "Evening reading",
    category: "reading",
    frequencyType: "daily",
    targetPerWeek: 7,
    status: "active",
    startDate: addDaysISO(today, -9), // 10 days window
    completedDates: [
      addDaysISO(today, -9),
      addDaysISO(today, -8),
      addDaysISO(today, -7),
      // -6, -5, -4 were paused
      addDaysISO(today, -3),
      addDaysISO(today, -2),
      addDaysISO(today, -1),
      today,
    ],
    skippedDates: [],
    pausedPeriods: [
      {
        start: addDaysISO(today, -6),
        end: addDaysISO(today, -4),
      },
    ],
    archived: false,
    createdAt: addDaysISO(today, -9),
  };

  assert.equal(isDatePausedForHabit(habit, addDaysISO(today, -5)), true);
  assert.equal(isDatePausedForHabit(habit, addDaysISO(today, -3)), false);

  const insights = calculateHabitInsights(habit, today);
  // 7 active non-paused days, all 7 completed -> 100% completion & unbroken 7-day streak
  assert.equal(insights.currentStreak, 7);
  assert.equal(insights.completionRate, 100);
});

test("Undoing skip today cleanly restores skipped status and updates scheduled metrics", () => {
  const today = "2026-06-17";
  const baseHabit: Habit = {
    id: "hab_skip_undo",
    title: "Morning walk",
    category: "movement",
    frequencyType: "daily",
    targetPerWeek: 7,
    status: "active",
    startDate: addDaysISO(today, -2),
    completedDates: [addDaysISO(today, -2), addDaysISO(today, -1)],
    skippedDates: [today],
    archived: false,
    createdAt: addDaysISO(today, -2),
  };

  const withSkip = calculateHabitInsights(baseHabit, today);
  assert.equal(withSkip.skippedToday, true);
  assert.equal(withSkip.currentStreak, 2);

  const withoutSkip: Habit = { ...baseHabit, skippedDates: [] };
  const afterUndo = calculateHabitInsights(withoutSkip, today);
  assert.equal(afterUndo.skippedToday, false);
  assert.equal(afterUndo.currentStreak, 2);
});

// =========================================================================
// 2. SMART DASHBOARD INSIGHT (3 QUESTIONS + INSUFFICIENT DATA)
// =========================================================================

test("Smart dashboard insight handles insufficient data gracefully without fabricating trends", () => {
  const today = "2026-06-17";
  const state = buildBaseAppState(today);
  const insight = generateSmartDashboardInsight(state, today);

  assert.equal(insight.hasSufficientData, false);
  assert.ok(insight.whatIsHappening.length > 10);
  assert.ok(insight.whatNeedsAttention.length > 10);
  assert.ok(insight.recommendedAction.title.length > 5);
  assert.ok(insight.recommendedAction.why.length > 10);
  assert.equal(insight.recommendedAction.ctaType, "focus");
});

test("Smart dashboard insight identifies real evening screen-time increase alongside steady focus", () => {
  const today = "2026-06-17";
  const state = buildBaseAppState(today);
  state.sessions = [
    {
      id: "s1",
      date: today,
      durationMinutes: 25,
      plannedMinutes: 25,
      intention: "Deep work",
      completedFull: true,
      createdAt: today,
    },
    {
      id: "s2",
      date: addDaysISO(today, -1),
      durationMinutes: 25,
      plannedMinutes: 25,
      intention: "Study",
      completedFull: true,
      createdAt: addDaysISO(today, -1),
    },
    {
      id: "s3",
      date: addDaysISO(today, -8),
      durationMinutes: 20,
      plannedMinutes: 25,
      intention: "Reading",
      completedFull: false,
      createdAt: addDaysISO(today, -8),
    },
  ];
  state.screenTimeLogs = [
    {
      id: "st1",
      appName: "TikTok",
      category: "Short Video",
      durationMinutes: 55,
      date: today,
      periodOfDay: "evening",
      createdAt: today,
    },
    {
      id: "st2",
      appName: "Instagram",
      category: "Social Media",
      durationMinutes: 45,
      date: addDaysISO(today, -1),
      periodOfDay: "night",
      createdAt: addDaysISO(today, -1),
    },
    {
      id: "st3",
      appName: "Instagram",
      category: "Social Media",
      durationMinutes: 40,
      date: addDaysISO(today, -8),
      periodOfDay: "afternoon",
      createdAt: addDaysISO(today, -8),
    },
  ];

  const insight = generateSmartDashboardInsight(state, today);
  assert.equal(insight.hasSufficientData, true);
  assert.ok(insight.whatIsHappening.toLowerCase().includes("evening"));
  assert.ok(insight.recommendedAction.why.length > 10);
});

// =========================================================================
// 3. ADVANCED SCREEN-TIME INSIGHTS (MISSING DAYS + >=3 PERIOD GATE)
// =========================================================================

test("Screen-time insights compute missing days honestly and strictly gate period patterns on >=3 entries", () => {
  const today = "2026-06-17";
  const twoTagged = computeScreenTimeInsights(
    [
      {
        id: "1",
        appName: "Instagram",
        category: "Social Media",
        durationMinutes: 40,
        date: today,
        periodOfDay: "evening",
        createdAt: today,
      },
      {
        id: "2",
        appName: "TikTok",
        category: "Short Video",
        durationMinutes: 30,
        date: addDaysISO(today, -1),
        periodOfDay: "evening",
        createdAt: addDaysISO(today, -1),
      },
    ],
    today
  );

  assert.equal(twoTagged.loggedDaysCount, 2);
  assert.equal(twoTagged.missingDaysCount, 5);
  assert.equal(twoTagged.averagePerLoggedDayMinutes, 35); // 70 / 2 logged days (not / 7)
  assert.equal(twoTagged.hasSufficientPeriodData, false);
  assert.equal(twoTagged.dominantPeriod, null);

  const threeTagged = computeScreenTimeInsights(
    [
      {
        id: "1",
        appName: "Instagram",
        category: "Social Media",
        durationMinutes: 40,
        date: today,
        periodOfDay: "evening",
        createdAt: today,
      },
      {
        id: "2",
        appName: "TikTok",
        category: "Short Video",
        durationMinutes: 50,
        date: addDaysISO(today, -1),
        periodOfDay: "evening",
        createdAt: addDaysISO(today, -1),
      },
      {
        id: "3",
        appName: "YouTube",
        category: "Entertainment",
        durationMinutes: 10,
        date: addDaysISO(today, -2),
        periodOfDay: "morning",
        createdAt: addDaysISO(today, -2),
      },
    ],
    today
  );

  assert.equal(threeTagged.hasSufficientPeriodData, true);
  assert.equal(threeTagged.dominantPeriod, "evening");
  assert.equal(threeTagged.topApps[0]?.appName, "TikTok");
  assert.equal(threeTagged.topApps[0]?.sharePct, 50);
  assert.equal(threeTagged.weeklyComparison.percentChange, null); // no prior week baseline
});

// =========================================================================
// 4. AI COACH ACTION CARD VALIDATOR & LOCAL BILINGUAL COACH
// =========================================================================

test("validateCoachActionCard accepts valid payloads and rejects malformed/out-of-bounds payloads", () => {
  const valid = validateCoachActionCard({
    type: "focus_session",
    title: "20-minute calm reading sprint",
    explanation: "Sets up a 20m focus block without forcing auto-start.",
    relevanceReason: "Matches your evening reading goal.",
    durationMinutes: 20,
    intention: "Read 15 pages",
  });
  assert.ok(valid);
  assert.equal(valid?.status, "pending");
  assert.equal(valid?.durationMinutes, 20);

  // Reject out-of-range duration
  assert.equal(
    validateCoachActionCard({
      type: "focus_session",
      title: "Too short",
      explanation: "Bad duration",
      relevanceReason: "Test",
      durationMinutes: 2,
    }),
    null
  );

  // Reject unknown card type
  assert.equal(
    validateCoachActionCard({
      type: "auto_delete_all",
      title: "Bad",
      explanation: "Bad",
      relevanceReason: "Bad",
    }),
    null
  );

  // Malformed JSON from model degrades cleanly to plain-text coaching reply
  const fallback = parseCoachModelPayload("Take a 10-minute walk before bed tonight.");
  assert.equal(fallback?.reply, "Take a 10-minute walk before bed tonight.");
  assert.equal(fallback?.actionCard, undefined);

  // JSON envelope with invalid actionCard still preserves reply cleanly
  const badCardEnvelope = parseCoachModelPayload(
    JSON.stringify({
      reply: "Try a short break away from screens.",
      actionCard: { type: "new_habit", title: "Missing habitTitle" },
    })
  );
  assert.equal(badCardEnvelope?.reply, "Try a short break away from screens.");
  assert.equal(badCardEnvelope?.actionCard, undefined);
});

test("buildSmartLocalReply produces contextual Arabic & English replies with valid Action Cards", () => {
  const ctx: CoachContextPayload = {
    userName: "Omar",
    language: "ar",
    dailyFocusTarget: 30,
    dailyScreenTimeGoalMinutes: 60,
    todayFocusMinutes: 15,
    todayScreenTimeMinutes: 75,
    completedHabitsCount: 1,
    totalHabitsCount: 2,
    streakDays: 3,
    recentHabits: [
      { title: "قراءة 10 صفحات", streak: 3, completedToday: false },
      { title: "المشي 20 دقيقة", streak: 2, completedToday: true },
    ],
    recentScreenTime: [
      {
        appName: "TikTok",
        category: "Short Video",
        durationMinutes: 50,
        date: "2026-06-17",
        periodOfDay: "night",
      },
    ],
    latestCheckIn: {
      focusRating: 3,
      phoneCheckingFrequency: "often",
      topDistraction: "التصفح التلقائي",
      achievedGoal: "partially",
      note: "Scroll before bed",
    },
    goals: ["تقليل استخدام التواصل الاجتماعي"],
    challenges: ["التصفح غير المقصود"],
    habitInterests: ["reading", "sleep"],
  };

  const arRes = buildSmartLocalReply("كيف أتوقف عن التصفح قبل النوم؟", [], ctx, true);
  assert.ok(/[\u0600-\u06FF]/.test(arRes.reply));
  assert.ok(arRes.actionCard);
  assert.equal(arRes.actionCard?.status, "pending");

  const enRes = buildSmartLocalReply(
    "Help me build a daily focus routine.",
    [],
    { ...ctx, language: "en", userName: "Sam" },
    false
  );
  assert.ok(enRes.reply.length > 25);
  assert.ok(enRes.actionCard);
  assert.equal(enRes.actionCard?.status, "pending");
});

// =========================================================================
// 5. WEEKLY REVIEW (COMPLETE WEEK, INCOMPLETE WEEK, INSUFFICIENT DATA)
// =========================================================================

test("computeWeeklyReview compares incomplete current week against equivalent prior-week days", () => {
  // 2026-06-17 is Wednesday -> Sun 2026-06-14 .. Wed 2026-06-17 (4 days elapsed)
  // Previous equivalent window should be Sun 2026-06-07 .. Wed 2026-06-10 (4 days)
  const today = "2026-06-17";
  const state = buildBaseAppState(today);
  state.sessions = [
    {
      id: "cur_1",
      date: "2026-06-15",
      durationMinutes: 35,
      plannedMinutes: 35,
      intention: "Code",
      completedFull: true,
      createdAt: "2026-06-15",
    },
    {
      id: "cur_2",
      date: "2026-06-17",
      durationMinutes: 25,
      plannedMinutes: 25,
      intention: "Read",
      completedFull: true,
      createdAt: "2026-06-17",
    },
    {
      id: "prev_early",
      date: "2026-06-08", // Monday in equivalent 4-day window -> counted (40m)
      durationMinutes: 40,
      plannedMinutes: 40,
      intention: "Study",
      completedFull: true,
      createdAt: "2026-06-08",
    },
    {
      id: "prev_late",
      date: "2026-06-12", // Friday in prior week -> excluded from 4-day equivalent comparison
      durationMinutes: 90,
      plannedMinutes: 90,
      intention: "Deep block",
      completedFull: true,
      createdAt: "2026-06-12",
    },
  ];

  const weeks = getAvailableReviewWeeks(state, today, 6);
  assert.equal(weeks[0], "2026-06-14");
  assert.ok(weeks.includes("2026-06-07"));

  const report = computeWeeklyReview(state, "2026-06-14", today);
  assert.equal(report.isCurrentWeek, true);
  assert.equal(report.isIncompleteWeek, true);
  assert.equal(report.daysElapsedInWeek, 4);
  assert.equal(report.focusMinutes, 60);
  // Prior equivalent 4 days had 40m -> +50% improvement (NOT dragged down by Friday's 90m)
  assert.equal(report.focusComparison.previousValue, 40);
  assert.equal(report.focusComparison.percentChange, 50);
  assert.equal(report.hasSufficientData, true);
});

test("computeWeeklyReview returns honest insufficient-data state for empty weeks", () => {
  const today = "2026-06-17";
  const state = buildBaseAppState(today);
  const report = computeWeeklyReview(state, "2026-06-14", today);
  assert.equal(report.hasSufficientData, false);
});

// =========================================================================
// 6. CHECK-IN SAME-DAY UPDATE & PREFERENCE UPDATES PRESERVE HISTORY
// =========================================================================

test("Server sync preserves existing sessions/habits on onboarding preference update & updates check-ins in place", () => {
  const today = "2026-06-17";
  const initial: PersistedUserState = {
    ...buildBaseAppState(today),
    sessions: [
      {
        id: "sess_keep",
        date: today,
        durationMinutes: 25,
        plannedMinutes: 25,
        intention: "Keep me",
        completedFull: true,
        createdAt: today,
      },
    ],
    checkIns: [
      {
        id: "chk_today",
        date: today,
        focusRating: 3,
        phoneCheckingFrequency: "often",
        topDistraction: "Notifications",
        achievedGoal: "partially",
        note: "Initial thought",
        createdAt: "2026-06-17T10:00:00.000Z",
        version: 1,
      },
    ],
  };

  const { nextState: merged } = mergeSyncOperationsIntoState(initial, [
    {
      id: "op_1",
      entityType: "check_in",
      operationType: "update",
      entityId: "chk_today",
      payload: {
        focusRating: 5,
        achievedGoal: "yes",
        note: "Edited evening reflection",
      },
      createdAt: "2026-06-17T20:00:00.000Z",
    },
    {
      id: "op_2",
      entityType: "onboarding",
      operationType: "update",
      entityId: "onboarding",
      payload: {
        name: "Nadia Updated",
        onboarding: {
          ...initial.onboarding,
          dailyFocusTarget: 45,
          dailyScreenTimeGoalMinutes: 45,
          habitInterests: ["reading", "mindfulness"],
        },
      },
      createdAt: "2026-06-17T20:05:00.000Z",
    },
    {
      id: "op_3",
      entityType: "preferences",
      operationType: "update",
      entityId: "weeklyReflections",
      payload: {
        weeklyReflections: {
          "2026-06-14": "Kept evenings phone-free.",
        },
      },
      createdAt: "2026-06-17T20:06:00.000Z",
    },
  ]);

  assert.equal(merged.checkIns.length, 1);
  assert.equal(merged.checkIns[0].focusRating, 5);
  assert.equal(merged.checkIns[0].note, "Edited evening reflection");
  assert.equal(merged.sessions.length, 1);
  assert.equal(merged.sessions[0].id, "sess_keep");
  assert.equal(merged.user.name, "Nadia Updated");
  assert.equal(merged.onboarding.dailyFocusTarget, 45);
  assert.equal(merged.onboarding.dailyScreenTimeGoalMinutes, 45);
  assert.equal(merged.weeklyReflections?.["2026-06-14"], "Kept evenings phone-free.");
});

// =========================================================================
// 7. EN vs AR TRANSLATION KEY PARITY AUDIT
// =========================================================================

test("local accounts support signup, isolated login, and password reset without an API", async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });

  try {
    const created = await signupAccount({
      name: "Local User",
      email: "local@example.com",
      password: "passphrase",
      language: "en",
    });
    const accountId = created.state.user.id;
    assert.ok(accountId);
    assert.equal(created.token, "local");
    assert.equal(getActiveSession()?.userId, accountId);

    const accounts = JSON.parse(storage.get("refocus_local_accounts_v1") || "[]") as Array<{
      passwordHash: string;
      passwordSalt: string;
    }>;
    assert.equal(accounts.length, 1);
    assert.notEqual(accounts[0].passwordHash, "passphrase");
    assert.ok(accounts[0].passwordSalt);

    await idbSaveUserState(accountId, {
      ...created.state,
      onboarding: { ...created.state.onboarding, dailyFocusTarget: 60 },
    });

    await assert.rejects(
      signupAccount({
        name: "Duplicate",
        email: "LOCAL@example.com",
        password: "passphrase",
        language: "en",
      }),
      /already exists/
    );
    await assert.rejects(
      loginAccount({ email: "local@example.com", password: "wrongpass", language: "en" }),
      new RegExp(TRANSLATIONS.en.auth.errors.invalidCredentials)
    );

    const secondAccount = await signupAccount({
      name: "Another User",
      email: "another@example.com",
      password: "passphrase",
      language: "en",
    });
    assert.notEqual(secondAccount.state.user.id, accountId);
    assert.equal(secondAccount.state.onboarding.dailyFocusTarget, 25);

    const loggedIn = await loginAccount({
      email: "LOCAL@example.com",
      password: "passphrase",
      language: "en",
    });
    assert.equal(loggedIn.state.user.id, accountId);
    assert.equal(loggedIn.state.onboarding.dailyFocusTarget, 60);

    await resetAccountPassword({
      email: "local@example.com",
      newPassword: "newpassphrase",
      language: "en",
    });
    await assert.rejects(
      loginAccount({ email: "local@example.com", password: "passphrase", language: "en" }),
      new RegExp(TRANSLATIONS.en.auth.errors.invalidCredentials)
    );
    assert.equal(
      (await loginAccount({
        email: "local@example.com",
        password: "newpassphrase",
        language: "en",
      })).state.user.id,
      accountId
    );
  } finally {
    if (originalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
});

function collectTranslationPaths(obj: unknown, prefix: string = ""): string[] {
  if (Array.isArray(obj)) {
    return [`${prefix}[]`];
  }
  if (obj && typeof obj === "object") {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const nextPrefix = prefix ? `${prefix}.${k}` : k;
      keys.push(...collectTranslationPaths(v, nextPrefix));
    }
    return keys.sort();
  }
  return [prefix];
}

test("English and Arabic translation trees have 100% matching keys across all Phase 3 screens", () => {
  const enKeys = collectTranslationPaths(TRANSLATIONS.en);
  const arKeys = collectTranslationPaths(TRANSLATIONS.ar);
  assert.deepEqual(enKeys, arKeys);
});
