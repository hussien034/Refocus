import { useCallback, useEffect, useRef, useState } from "react";
import { AuthMode, AuthScreen } from "./components/auth/AuthScreen";
import { WelcomeScreen } from "./components/auth/WelcomeScreen";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { AppShell } from "./components/layout/AppShell";
import { DashboardScreen } from "./components/dashboard/DashboardScreen";
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
} from "./features/focus/timerEngine";
import { getCopy } from "./i18n/translations";
import { addDaysISO, getDailyFocusMinutes, getTodayISO } from "./services/analytics/metricsEngine";
import {
  idbListUserOperations,
  idbLoadActiveTimer,
  idbSaveActiveTimer,
  idbSaveUserState,
} from "./services/storage/indexedDb";
import {
  createEmptyUnauthenticatedState,
  deleteServerAccount,
  fetchServerUserState,
  getActiveSession,
  loadGuestLanguage,
  loadUserIndexedDbState,
  loadUserLocalCache,
  normalizeAppState,
  saveGuestLanguage,
  setActiveSession,
} from "./services/storageService";
import { syncManager } from "./services/sync/syncEngine";
import type { HabitPrefillDraft } from "./components/habits/HabitsScreen";
import {
  AppScreen,
  AppState,
  CoachActionCard,
  CoachMessage,
  DailyCheckIn,
  DashboardPreferences,
  Habit,
  Language,
  NotificationPreferences,
  OnboardingProfile,
  PersistedTimerState,
  PlanTier,
  ScreenTimeEntry,
  SyncStatusSnapshot,
} from "./types/refocus";

import { FocusTimerScreen } from "./components/focus/FocusTimerScreen";
import { HabitsScreen } from "./components/habits/HabitsScreen";
import { ScreenTimeScreen } from "./components/tracker/ScreenTimeScreen";
import { DailyCheckInScreen } from "./components/checkin/DailyCheckInScreen";
import { AICoachScreen } from "./components/coach/AICoachScreen";
import { AnalyticsScreen } from "./components/analytics/AnalyticsScreen";
import { WeeklyReviewScreen } from "./components/review/WeeklyReviewScreen";
import { ProfileScreen } from "./components/profile/ProfileScreen";
import { LibraryScreen } from "./components/library/LibraryScreen";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export default function App() {
  const initialSession = getActiveSession();
  const initialCached = initialSession ? loadUserLocalCache(initialSession.userId) : null;

  const [authToken, setAuthToken] = useState<string | null>(() => initialSession?.token || null);
  const [state, setState] = useState<AppState>(
    () => initialCached || createEmptyUnauthenticatedState(loadGuestLanguage())
  );
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (!initialSession) return "welcome";
    if (!initialCached) return "home";
    return initialCached.onboarding.completed ? "home" : "onboarding";
  });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [habitPrefillDraft, setHabitPrefillDraft] = useState<HabitPrefillDraft | null>(null);
  const [screenTimeGoalPrefill, setScreenTimeGoalPrefill] = useState<number | null>(null);

  const [timer, setTimer] = useState<PersistedTimerState>(() =>
    createIdleTimerState(
      initialSession?.userId || "",
      initialCached?.onboarding.dailyFocusTarget || 25
    )
  );
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() => syncManager.getSnapshot());

  // Refs for atomic access inside timers, visibility handlers, and async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const completedSessionIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to offline-first sync engine & connectivity listeners
  useEffect(() => {
    const unsubscribe = syncManager.subscribe(setSyncStatus);
    syncManager.setOnServerStateApplied((userId, serverState) => {
      if (stateRef.current.user.id !== userId) return;
      const normalized = normalizeAppState({ ...serverState, isAuthenticated: true });
      setState(normalized);
    });

    const onOnline = () => void syncManager.handleConnectivityChange(true);
    const onOffline = () => void syncManager.handleConnectivityChange(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Hydrate user state from IndexedDB + server reconciliation when session is active
  useEffect(() => {
    const activeMeta = getActiveSession();
    if (!authToken || !activeMeta?.userId) {
      void syncManager.setSession(null, null, null);
      return;
    }

    let cancelled = false;
    const userId = activeMeta.userId;

    const hydrate = async () => {
      // 1. Hydrate state immediately from IndexedDB so offline reloads work cleanly
      const idbStateRes = await loadUserIndexedDbState(userId);
      if (cancelled) return;

      if (idbStateRes?.state) {
        setState(idbStateRes.state);
        setScreen((curr) =>
          curr === "welcome" || curr === "auth"
            ? idbStateRes.state.onboarding.completed
              ? "home"
              : "onboarding"
            : curr
        );
      }

      // 2. Attach user session to sync manager
      await syncManager.setSession(userId, authToken, idbStateRes?.lastSyncedAt || null);
      if (cancelled) return;

      // 3. Reconcile with server: flush pending offline ops first if any, else pull fresh server state
      const pendingOps = await idbListUserOperations(userId);
      if (cancelled) return;

      if (pendingOps.length > 0 && navigator.onLine) {
        await syncManager.flushQueue();
      } else if (navigator.onLine) {
        const serverState = await fetchServerUserState(authToken);
        if (cancelled) return;
        if (serverState) {
          setState(serverState);
          await syncManager.setSession(userId, authToken, new Date().toISOString());
          setScreen((curr) =>
            curr === "welcome" || curr === "auth"
              ? serverState.onboarding.completed
                ? "home"
                : "onboarding"
              : curr
          );
        } else if (!idbStateRes?.state && !initialCached) {
          setActiveSession(null);
          setAuthToken(null);
          setScreen("welcome");
        }
      }

      // 4. Restore persisted Focus Timer from IndexedDB for this user
      const savedTimer = await idbLoadActiveTimer(userId);
      if (cancelled) return;

      if (savedTimer && savedTimer.userId === userId) {
        const nowMs = Date.now();
        const snap = computeTimerSnapshot(savedTimer, nowMs);

        if (savedTimer.status === "running" && snap.isCompleteNow) {
          // Session finished while PWA was closed / tab was away — finalize once safely
          const { nextTimer, sessionToSave } = completeTimerSession(
            savedTimer,
            nowMs,
            true,
            getTodayISO()
          );
          setTimer(nextTimer);
          await idbSaveActiveTimer(nextTimer);

          if (
            sessionToSave &&
            !completedSessionIdsRef.current.has(sessionToSave.id) &&
            !stateRef.current.sessions.some((s) => s.id === sessionToSave.id)
          ) {
            completedSessionIdsRef.current.add(sessionToSave.id);
            const nextAppState: AppState = {
              ...stateRef.current,
              sessions: [sessionToSave, ...stateRef.current.sessions],
            };
            setState(nextAppState);
            await syncManager.enqueueOperation({
              userId,
              entityType: "focus_session",
              operationType: "complete",
              entityId: sessionToSave.id,
              payload: sessionToSave,
              latestState: nextAppState,
            });
          }
        } else if (savedTimer.status === "running" || savedTimer.status === "paused") {
          setTimer(savedTimer);
          setRestoredNotice(true);
        } else {
          const defaultMins =
            idbStateRes?.state?.onboarding.dailyFocusTarget ||
            stateRef.current.onboarding.dailyFocusTarget ||
            25;
          setTimer(
            savedTimer.status === "completed"
              ? savedTimer
              : createIdleTimerState(userId, defaultMins)
          );
        }
      } else {
        const defaultMins =
          idbStateRes?.state?.onboarding.dailyFocusTarget ||
          stateRef.current.onboarding.dailyFocusTarget ||
          25;
        setTimer(createIdleTimerState(userId, defaultMins));
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Persist local IndexedDB snapshot + guest language whenever state changes
  useEffect(() => {
    if (!state.isAuthenticated || !state.user.id || !authToken) {
      saveGuestLanguage(state.language);
      return;
    }
    void idbSaveUserState(state.user.id, state);
  }, [state, authToken]);

  // Keep the app's single dark visual style and sync the selected language.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = state.language;
    root.dir = state.language === "ar" ? "rtl" : "ltr";
    root.classList.add("dark");
  }, [state.language]);

  // Atomic helper to persist timer transitions cleanly
  const commitTimerTransition = useCallback((next: PersistedTimerState) => {
    timerRef.current = next;
    setTimer(next);
    if (next.userId) {
      void idbSaveActiveTimer(next);
    }
  }, []);

  // Deduplicated session completion handler driven by timestamps
  const finalizeFocusCompletion = useCallback(
    (sourceTimer: PersistedTimerState, mode: "complete" | "save_partial" | "discard") => {
      const nowMs = Date.now();
      const resetMinutes = Math.max(1, Math.round(sourceTimer.intendedDurationSeconds / 60));

      if (mode === "discard") {
        commitTimerTransition(createIdleTimerState(sourceTimer.userId, resetMinutes, "", nowMs));
        setRestoredNotice(false);
        return;
      }

      const completedFull = mode === "complete";
      const { nextTimer, sessionToSave } = completeTimerSession(
        sourceTimer,
        nowMs,
        completedFull,
        getTodayISO()
      );

      if (!completedFull) {
        // After partial save (or <1m early stop), reset cleanly back to idle
        commitTimerTransition(createIdleTimerState(sourceTimer.userId, resetMinutes, "", nowMs));
        setRestoredNotice(false);
      } else {
        commitTimerTransition(nextTimer);
        setRestoredNotice(false);
        if (
          stateRef.current.notifications.focusReminders &&
          typeof window !== "undefined" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            const copy = getCopy(stateRef.current.language);
            new Notification(copy.brand, {
              body: copy.focus.doneSubtitle,
              tag: "refocus-session-complete",
            });
          } catch {
            // Browser notifications may be disallowed in certain contexts
          }
        }
      }

      const userId = stateRef.current.user.id;
      if (
        sessionToSave &&
        userId &&
        !completedSessionIdsRef.current.has(sessionToSave.id) &&
        !stateRef.current.sessions.some((s) => s.id === sessionToSave.id)
      ) {
        completedSessionIdsRef.current.add(sessionToSave.id);
        setState((prev) => {
          const updated: AppState = {
            ...prev,
            sessions: [sessionToSave, ...prev.sessions],
          };
          if (authToken) {
            void syncManager.enqueueOperation({
              userId,
              entityType: "focus_session",
              operationType: completedFull ? "complete" : "create",
              entityId: sessionToSave.id,
              payload: sessionToSave,
              latestState: updated,
            });
          }
          return updated;
        });
      }
    },
    [authToken, commitTimerTransition]
  );

  // Timestamp-driven timer monitoring + page visibility / browser wake recalculation
  useEffect(() => {
    const checkTimerAndBreak = () => {
      const curr = timerRef.current;
      const nowMs = Date.now();

      if (curr.status === "running") {
        const snap = computeTimerSnapshot(curr, nowMs);
        if (snap.isCompleteNow) {
          finalizeFocusCompletion(curr, "complete");
        }
      }

      if (curr.status === "completed" && curr.breakTimer?.status === "running") {
        const rem = computeBreakRemainingSeconds(curr, nowMs);
        if (rem <= 0) {
          commitTimerTransition({
            ...curr,
            lastUpdatedAtMs: nowMs,
            breakTimer: {
              ...curr.breakTimer,
              status: "completed",
            },
          });
        }
      }
    };

    const isTimerOrBreakRunning =
      timer.status === "running" ||
      (timer.status === "completed" && timer.breakTimer?.status === "running");

    let intervalId: number | null = null;
    if (isTimerOrBreakRunning) {
      checkTimerAndBreak();
      intervalId = window.setInterval(checkTimerAndBreak, 500);
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkTimerAndBreak();
      }
    };

    const handlePageHide = () => {
      if (timerRef.current.userId) {
        void idbSaveActiveTimer({
          ...timerRef.current,
          lastUpdatedAtMs: Date.now(),
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [timer.status, timer.breakTimer?.status, finalizeFocusCompletion, commitTimerTransition]);

  const queuePrefUpdate = useCallback(
    (
      partialPayload: Record<string, unknown>,
      nextAppState: AppState,
      entityId: string = "prefs"
    ) => {
      if (!authToken || !nextAppState.user.id) return;
      void syncManager.enqueueOperation({
        userId: nextAppState.user.id,
        entityType: "preferences",
        operationType: "update",
        entityId,
        payload: partialPayload,
        latestState: nextAppState,
      });
    },
    [authToken]
  );

  const toggleLanguage = () => {
    setState((prev) => {
      const language: Language = prev.language === "en" ? "ar" : "en";
      const next = { ...prev, language };
      queuePrefUpdate({ language }, next, "language");
      return next;
    });
  };

  const handleAuthSuccess = ({
    token,
    state: userState,
    isNewUser,
  }: {
    token: string;
    state: AppState;
    isNewUser: boolean;
  }) => {
    const normalized = normalizeAppState({ ...userState, isAuthenticated: true });
    setAuthToken(token);
    setState(normalized);
    setTimer(
      createIdleTimerState(normalized.user.id, normalized.onboarding.dailyFocusTarget || 25)
    );
    setRestoredNotice(false);
    setScreen(isNewUser || !normalized.onboarding.completed ? "onboarding" : "home");
  };

  const handleOnboardingComplete = (name: string, onboarding: OnboardingProfile) => {
    setState((prev) => {
      const next: AppState = {
        ...prev,
        user: { ...prev.user, name },
        onboarding,
      };
      if (authToken && next.user.id) {
        void syncManager.enqueueOperation({
          userId: next.user.id,
          entityType: "onboarding",
          operationType: "update",
          entityId: "onboarding",
          payload: { name, onboarding },
          latestState: next,
        });
      }
      return next;
    });
    commitTimerTransition(
      createIdleTimerState(state.user.id, onboarding.dailyFocusTarget || 25, timer.intention)
    );
    setScreen("home");
  };

  const handleStartQuickFocus = (minutes: number, intention?: string) => {
    const base = createIdleTimerState(state.user.id, minutes, intention || "");
    const started = startTimerSession(base, Date.now(), minutes, intention || "");
    commitTimerTransition(started);
    setRestoredNotice(false);
    setScreen("focus");
  };

  const handlePrefillFocus = (minutes: number, intention?: string) => {
    if (timerRef.current.status !== "running" && timerRef.current.status !== "paused") {
      commitTimerTransition(
        createIdleTimerState(stateRef.current.user.id, minutes, intention || "")
      );
      setRestoredNotice(false);
    }
    setScreen("focus");
  };

  const handleCompleteHabit = (
    habitId: string,
    dateISO: string,
    completed: boolean,
    note?: string
  ) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      const nextHabits = prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        const completedSet = new Set(h.completedDates);
        const skippedSet = new Set(h.skippedDates || []);
        if (completed) {
          completedSet.add(dateISO);
          skippedSet.delete(dateISO);
        } else {
          completedSet.delete(dateISO);
        }
        const nextNotes = { ...(h.completionNotes || {}) };
        if (typeof note === "string") {
          if (note.trim()) nextNotes[dateISO] = note.trim();
          else delete nextNotes[dateISO];
        }
        return {
          ...h,
          completedDates: Array.from(completedSet),
          skippedDates: Array.from(skippedSet),
          completionNotes: nextNotes,
          updatedAt: nowISO,
          version: (h.version ?? 1) + 1,
        };
      });
      const next = { ...prev, habits: nextHabits };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "habit",
          operationType: "complete",
          entityId: habitId,
          payload: { date: dateISO, completed, skipped: false, note },
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleSkipHabitToday = (habitId: string, dateISO: string, skip: boolean) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      const nextHabits = prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        const completedSet = new Set(h.completedDates);
        const skippedSet = new Set(h.skippedDates || []);
        if (skip) {
          completedSet.delete(dateISO);
          skippedSet.add(dateISO);
        } else {
          skippedSet.delete(dateISO);
        }
        return {
          ...h,
          completedDates: Array.from(completedSet),
          skippedDates: Array.from(skippedSet),
          updatedAt: nowISO,
          version: (h.version ?? 1) + 1,
        };
      });
      const next = { ...prev, habits: nextHabits };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "habit",
          operationType: "complete",
          entityId: habitId,
          payload: { date: dateISO, completed: false, skipped: skip },
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleAddHabit = (
    habit: Omit<Habit, "id" | "completedDates" | "archived" | "createdAt">
  ) => {
    const nowISO = new Date().toISOString();
    const newHabit: Habit = {
      ...habit,
      id: `hab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      completedDates: [],
      skippedDates: [],
      completionNotes: {},
      status: habit.status || "active",
      archived: habit.status === "archived",
      createdAt: getTodayISO(),
      updatedAt: nowISO,
      version: 1,
    };
    setState((prev) => {
      const next = { ...prev, habits: [newHabit, ...prev.habits] };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "habit",
          operationType: "create",
          entityId: newHabit.id,
          payload: newHabit,
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleUpdateHabit = (habitId: string, updates: Partial<Habit>) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      let baseVersion = 1;
      const nextHabits = prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        baseVersion = h.version ?? 1;
        return {
          ...h,
          ...updates,
          updatedAt: nowISO,
          version: baseVersion + 1,
        };
      });
      const next = { ...prev, habits: nextHabits };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "habit",
          operationType: "update",
          entityId: habitId,
          payload: { ...updates, updatedAt: nowISO },
          baseVersion,
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleSetHabitStatus = (
    habitId: string,
    status: "active" | "paused" | "archived"
  ) => {
    const todayISO = getTodayISO();
    const target = stateRef.current.habits.find((h) => h.id === habitId);
    const existingPeriods = [...(target?.pausedPeriods || [])];
    let nextPeriods = existingPeriods;

    if (status === "paused") {
      const hasOpen = existingPeriods.some((p) => p.end === null || p.end === undefined);
      if (!hasOpen) {
        nextPeriods = [...existingPeriods, { start: todayISO, end: null }];
      }
    } else if (status === "active" && target?.status === "paused") {
      nextPeriods = existingPeriods.flatMap((p) => {
        if (p.end !== null && p.end !== undefined) return [p];
        if (p.start >= todayISO) {
          return [];
        }
        return [{ ...p, end: addDaysISO(todayISO, -1) }];
      });
    }

    handleUpdateHabit(habitId, {
      status,
      archived: status === "archived",
      pausedPeriods: nextPeriods,
    });
  };

  const handleDeleteHabit = (habitId: string) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      const nextHabits = prev.habits.map((h) =>
        h.id === habitId
          ? {
              ...h,
              deletedAt: nowISO,
              archived: true,
              status: "archived" as const,
              updatedAt: nowISO,
              version: (h.version ?? 1) + 1,
            }
          : h
      );
      const next = { ...prev, habits: nextHabits };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "habit",
          operationType: "delete",
          entityId: habitId,
          payload: { deletedAt: nowISO },
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleAddScreenTime = (entry: Omit<ScreenTimeEntry, "id" | "createdAt">) => {
    const nowISO = new Date().toISOString();
    const newLog: ScreenTimeEntry = {
      ...entry,
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowISO,
      updatedAt: nowISO,
      version: 1,
    };
    setState((prev) => {
      const next = { ...prev, screenTimeLogs: [newLog, ...prev.screenTimeLogs] };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "screen_time",
          operationType: "create",
          entityId: newLog.id,
          payload: newLog,
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleDeleteScreenTime = (id: string) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      const nextLogs = prev.screenTimeLogs.map((l) =>
        l.id === id
          ? { ...l, deletedAt: nowISO, updatedAt: nowISO, version: (l.version ?? 1) + 1 }
          : l
      );
      const next = { ...prev, screenTimeLogs: nextLogs };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "screen_time",
          operationType: "delete",
          entityId: id,
          payload: { deletedAt: nowISO },
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleSaveCheckIn = (
    entry: Omit<DailyCheckIn, "id" | "createdAt">,
    existingId?: string
  ) => {
    const nowISO = new Date().toISOString();
    setState((prev) => {
      const target = prev.checkIns.find(
        (c) => !c.deletedAt && ((existingId && c.id === existingId) || c.date === entry.date)
      );
      if (target) {
        const baseVersion = target.version ?? 1;
        const updatedCheckIn: DailyCheckIn = {
          ...target,
          ...entry,
          updatedAt: nowISO,
          version: baseVersion + 1,
        };
        const next: AppState = {
          ...prev,
          checkIns: prev.checkIns.map((c) => (c.id === target.id ? updatedCheckIn : c)),
        };
        if (authToken && prev.user.id) {
          void syncManager.enqueueOperation({
            userId: prev.user.id,
            entityType: "check_in",
            operationType: "update",
            entityId: target.id,
            payload: { ...entry, updatedAt: nowISO },
            baseVersion,
            latestState: next,
          });
        }
        return next;
      }

      const newCheckIn: DailyCheckIn = {
        ...entry,
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: nowISO,
        updatedAt: nowISO,
        version: 1,
      };
      const next = { ...prev, checkIns: [newCheckIn, ...prev.checkIns] };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "check_in",
          operationType: "create",
          entityId: newCheckIn.id,
          payload: newCheckIn,
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleUpdateOnboardingPreferences = (name: string, onboarding: OnboardingProfile) => {
    setState((prev) => {
      const next: AppState = {
        ...prev,
        user: { ...prev.user, name },
        onboarding,
      };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "onboarding",
          operationType: "update",
          entityId: "onboarding",
          payload: { name, onboarding },
          latestState: next,
        });
      }
      return next;
    });
    if (timerRef.current.status === "idle") {
      commitTimerTransition(
        selectTimerDuration(timerRef.current, onboarding.dailyFocusTarget || 25)
      );
    }
  };

  const handleUpdateScreenTimeGoal = (goalMinutes: number | undefined) => {
    setState((prev) => {
      const onboarding: OnboardingProfile = {
        ...prev.onboarding,
        dailyScreenTimeGoalMinutes: goalMinutes,
      };
      const next: AppState = { ...prev, onboarding };
      if (authToken && prev.user.id) {
        void syncManager.enqueueOperation({
          userId: prev.user.id,
          entityType: "onboarding",
          operationType: "update",
          entityId: "onboarding",
          payload: { onboarding },
          latestState: next,
        });
      }
      return next;
    });
  };

  const handleSaveWeeklyReflection = (weekStartISO: string, note: string) => {
    setState((prev) => {
      const weeklyReflections = { ...(prev.weeklyReflections || {}) };
      if (note.trim()) {
        weeklyReflections[weekStartISO] = note.trim();
      } else {
        delete weeklyReflections[weekStartISO];
      }
      const next: AppState = { ...prev, weeklyReflections };
      queuePrefUpdate({ weeklyReflections }, next, "weeklyReflections");
      return next;
    });
  };

  const handleAddCoachMessages = (userMsg: CoachMessage, assistantMsg: CoachMessage) => {
    const today = getTodayISO();
    setState((prev) => {
      const coachMessages = [...prev.coachMessages, userMsg, assistantMsg];
      const aiMessagesUsedToday =
        prev.aiQuotaDate === today ? prev.aiMessagesUsedToday + 1 : 1;
      const next: AppState = {
        ...prev,
        coachMessages,
        aiMessagesUsedToday,
        aiQuotaDate: today,
      };
      queuePrefUpdate(
        { coachMessages, aiMessagesUsedToday, aiQuotaDate: today },
        next,
        "coachMessages"
      );
      return next;
    });
  };

  const handleDismissActionCard = (messageId: string, cardId: string) => {
    setState((prev) => {
      let changed = false;
      const coachMessages = prev.coachMessages.map((m) => {
        if (m.id === messageId && m.actionCard && m.actionCard.id === cardId && m.actionCard.status === "pending") {
          changed = true;
          return {
            ...m,
            actionCard: { ...m.actionCard, status: "dismissed" as const },
          };
        }
        return m;
      });
      if (!changed) return prev;
      const next: AppState = { ...prev, coachMessages };
      queuePrefUpdate({ coachMessages }, next, "coachMessages");
      return next;
    });
  };

  const handleAcceptActionCard = (messageId: string, card: CoachActionCard) => {
    if (card.status !== "pending") return;

    const today = getTodayISO();
    setState((prev) => {
      let changed = false;
      const coachMessages = prev.coachMessages.map((m) => {
        if (m.id === messageId && m.actionCard && m.actionCard.id === card.id && m.actionCard.status === "pending") {
          changed = true;
          return {
            ...m,
            actionCard: { ...m.actionCard, status: "accepted" as const },
          };
        }
        return m;
      });
      if (!changed) return prev;

      const customDailyChallenge =
        card.type === "daily_challenge"
          ? { title: card.challengeTitle || card.title, date: today }
          : prev.customDailyChallenge;

      const next: AppState = {
        ...prev,
        coachMessages,
        ...(customDailyChallenge ? { customDailyChallenge } : {}),
      };
      queuePrefUpdate(
        {
          coachMessages,
          ...(card.type === "daily_challenge" ? { customDailyChallenge } : {}),
        },
        next,
        "coachMessages"
      );
      return next;
    });

    if (card.type === "focus_session") {
      handlePrefillFocus(card.durationMinutes || 15, card.intention || card.title);
    } else if (card.type === "new_habit") {
      setHabitPrefillDraft({
        title: card.habitTitle || card.title,
        category: card.habitCategory || "digital_wellness",
        frequencyType: card.habitFrequencyType,
        targetPerWeek: card.habitTargetPerWeek,
      });
      setScreen("habits");
    } else if (card.type === "daily_challenge") {
      setScreen("home");
    } else if (card.type === "screen_time_goal") {
      setScreenTimeGoalPrefill(card.screenTimeGoalMinutes || 60);
      setScreen("tracker");
    }
  };

  const handleClearChat = () => {
    setState((prev) => {
      const coachMessages: CoachMessage[] = [
        {
          id: `msg-reset-${Date.now()}`,
          role: "assistant",
          content:
            prev.language === "ar"
              ? `بداية جديدة يا ${prev.user.name}، كيف يمكنني دعم تركيزك وعاداتك اليوم؟`
              : `Fresh start, ${prev.user.name}. What would you like to focus on or untangle today?`,
          timestamp: new Date().toISOString(),
          source: "local-coach",
        },
      ];
      const next: AppState = { ...prev, coachMessages };
      queuePrefUpdate({ coachMessages }, next, "coachMessages");
      return next;
    });
  };

  const handleToggleDashboardWidget = (
    widget: DashboardPreferences["hiddenWidgets"][number]
  ) => {
    setState((prev) => {
      const current = prev.dashboardPreferences?.hiddenWidgets || [];
      const exists = current.includes(widget);
      const hiddenWidgets = exists
        ? current.filter((w) => w !== widget)
        : [...current, widget];
      const dashboardPreferences: DashboardPreferences = { hiddenWidgets };
      const next = { ...prev, dashboardPreferences };
      queuePrefUpdate({ dashboardPreferences }, next, "dashboardPreferences");
      return next;
    });
  };

  const handleExportData = () => {
    const { isAuthenticated: _ignored, ...exportPayload } = state;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeEmail = (state.user.email || "user").replace(/[^a-z0-9]/gi, "-");
    a.download = `refocus-${safeEmail}-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (jsonText: string): boolean => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<AppState>;
      if (!parsed || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.habits)) {
        return false;
      }
      setState((prev) => {
        const merged = normalizeAppState({
          ...prev,
          onboarding: parsed.onboarding
            ? { ...prev.onboarding, ...parsed.onboarding }
            : prev.onboarding,
          sessions: parsed.sessions || prev.sessions,
          habits: parsed.habits || prev.habits,
          screenTimeLogs: Array.isArray(parsed.screenTimeLogs)
            ? parsed.screenTimeLogs
            : prev.screenTimeLogs,
          checkIns: Array.isArray(parsed.checkIns) ? parsed.checkIns : prev.checkIns,
          coachMessages: Array.isArray(parsed.coachMessages)
            ? parsed.coachMessages
            : prev.coachMessages,
          notifications: parsed.notifications
            ? { ...prev.notifications, ...parsed.notifications }
            : prev.notifications,
          dashboardPreferences: parsed.dashboardPreferences || prev.dashboardPreferences,
          weeklyReflections: parsed.weeklyReflections || prev.weeklyReflections,
          customDailyChallenge:
            parsed.customDailyChallenge !== undefined
              ? parsed.customDailyChallenge
              : prev.customDailyChallenge,
        });
        if (authToken && prev.user.id) {
          const { isAuthenticated: _ignored, ...persisted } = merged;
          void syncManager.enqueueOperation({
            userId: prev.user.id,
            entityType: "full_snapshot",
            operationType: "update",
            entityId: "import",
            payload: persisted,
            latestState: merged,
          });
        }
        return merged;
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteAccount = async () => {
    if (authToken && state.user.id) {
      await deleteServerAccount(authToken, state.user.id);
    }
    await syncManager.setSession(null, null, null);
    setAuthToken(null);
    setState(createEmptyUnauthenticatedState(state.language));
    setTimer(createIdleTimerState(""));
    setRestoredNotice(false);
    setScreen("welcome");
  };

  const handleLogout = () => {
    setActiveSession(null);
    void syncManager.setSession(null, null, null);
    setAuthToken(null);
    setState(createEmptyUnauthenticatedState(state.language));
    setTimer(createIdleTimerState(""));
    setRestoredNotice(false);
    setScreen("welcome");
  };

  if (screen === "welcome") {
    return (
      <WelcomeScreen
        language={state.language}
        onToggleLanguage={toggleLanguage}
        onGetStarted={() => {
          setAuthMode("signup");
          setScreen("auth");
        }}
        onLogin={() => {
          setAuthMode("login");
          setScreen("auth");
        }}
      />
    );
  }

  if (screen === "auth") {
    return (
      <AuthScreen
        language={state.language}
        initialMode={authMode}
        onToggleLanguage={toggleLanguage}
        onBack={() => setScreen("welcome")}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  if (screen === "onboarding") {
    return (
      <OnboardingScreen
        language={state.language}
        initialName={state.user.name}
        initialOnboarding={state.onboarding}
        onComplete={handleOnboardingComplete}
        onSkip={() => {
          setState((prev) => {
            const onboarding = { ...prev.onboarding, completed: true };
            const next = { ...prev, onboarding };
            if (authToken && prev.user.id) {
              void syncManager.enqueueOperation({
                userId: prev.user.id,
                entityType: "onboarding",
                operationType: "update",
                entityId: "onboarding",
                payload: { onboarding },
                latestState: next,
              });
            }
            return next;
          });
          setScreen("home");
        }}
      />
    );
  }

  const today = getTodayISO();
  const todayTotalFocus = getDailyFocusMinutes(state.sessions, today);

  return (
    <AppShell
      state={state}
      activeScreen={screen}
      timerRunning={timer.status === "running"}
      syncStatus={syncStatus}
      onRetrySync={() => void syncManager.flushQueue()}
      onResolveConflict={(operationId) => void syncManager.resolveConflictKeepServer(operationId)}
      onNavigate={(s) => setScreen(s)}
      onOpenUpgrade={() => {
        setScreen("profile");
        setShowUpgradeModal(true);
      }}
    >
      <ErrorBoundary language={state.language}>
        {screen === "home" && (
          <DashboardScreen
            state={state}
            onNavigate={(s) => setScreen(s)}
            onStartQuickFocus={handleStartQuickFocus}
            onPrefillFocus={handlePrefillFocus}
            onToggleDailyChallenge={() =>
              setState((prev) => {
                const date = prev.dailyChallengeCompletedDate === today ? null : today;
                const next = { ...prev, dailyChallengeCompletedDate: date };
                if (authToken && prev.user.id) {
                  void syncManager.enqueueOperation({
                    userId: prev.user.id,
                    entityType: "daily_challenge",
                    operationType: "update",
                    entityId: "daily_challenge",
                    payload: { date },
                    latestState: next,
                  });
                }
                return next;
              })
            }
            onQuickCompleteHabit={(habitId) => handleCompleteHabit(habitId, today, true)}
            onToggleDashboardWidget={handleToggleDashboardWidget}
          />
        )}

        {screen === "focus" && (
          <FocusTimerScreen
            language={state.language}
            timer={timer}
            todayTotalMinutes={todayTotalFocus}
            restoredNotice={restoredNotice}
            onSelectPreset={(minutes) =>
              commitTimerTransition(selectTimerDuration(timerRef.current, minutes))
            }
            onChangeIntention={(intention) =>
              commitTimerTransition({
                ...timerRef.current,
                intention,
                lastUpdatedAtMs: Date.now(),
              })
            }
            onStart={() => {
              setRestoredNotice(false);
              commitTimerTransition(startTimerSession(timerRef.current, Date.now()));
            }}
            onPause={() => commitTimerTransition(pauseTimerSession(timerRef.current, Date.now()))}
            onResume={() =>
              commitTimerTransition(resumeTimerSession(timerRef.current, Date.now()))
            }
            onEndSession={(savePartial) =>
              finalizeFocusCompletion(timerRef.current, savePartial ? "save_partial" : "discard")
            }
            onStartBreak={(minutes) =>
              commitTimerTransition(startBreakTimer(timerRef.current, minutes, Date.now()))
            }
            onReset={() => {
              setRestoredNotice(false);
              commitTimerTransition(
                createIdleTimerState(
                  state.user.id,
                  Math.max(1, Math.round(timerRef.current.intendedDurationSeconds / 60)),
                  ""
                )
              );
            }}
            onBackDashboard={() => setScreen("home")}
          />
        )}

        {screen === "habits" && (
          <HabitsScreen
            language={state.language}
            habits={state.habits}
            prefillDraft={habitPrefillDraft}
            onClearPrefillDraft={() => setHabitPrefillDraft(null)}
            onCompleteHabit={handleCompleteHabit}
            onSkipHabitToday={handleSkipHabitToday}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onSetHabitStatus={handleSetHabitStatus}
            onDeleteHabit={handleDeleteHabit}
          />
        )}

        {screen === "tracker" && (
          <ScreenTimeScreen
            language={state.language}
            logs={state.screenTimeLogs}
            dailyGoalMinutes={state.onboarding.dailyScreenTimeGoalMinutes}
            prefillGoalMinutes={screenTimeGoalPrefill}
            onClearPrefillGoal={() => setScreenTimeGoalPrefill(null)}
            onUpdateDailyGoal={handleUpdateScreenTimeGoal}
            onAddLog={handleAddScreenTime}
            onDeleteLog={handleDeleteScreenTime}
            onBackDashboard={() => setScreen("home")}
          />
        )}

        {screen === "checkin" && (
          <DailyCheckInScreen
            language={state.language}
            checkIns={state.checkIns.filter((c) => !c.deletedAt)}
            onSaveCheckIn={handleSaveCheckIn}
            onBackDashboard={() => setScreen("home")}
          />
        )}

        {screen === "coach" && (
          <AICoachScreen
            state={state}
            onAddMessages={handleAddCoachMessages}
            onAcceptActionCard={handleAcceptActionCard}
            onDismissActionCard={handleDismissActionCard}
            onClearChat={handleClearChat}
            onToggleLanguage={toggleLanguage}
            onOpenUpgrade={() => {
              setScreen("profile");
              setShowUpgradeModal(true);
            }}
          />
        )}

        {screen === "analytics" && (
          <AnalyticsScreen
            state={state}
            onBackDashboard={() => setScreen("home")}
            onOpenWeeklyReview={() => setScreen("review")}
            onOpenUpgrade={() => {
              setScreen("profile");
              setShowUpgradeModal(true);
            }}
          />
        )}

        {screen === "review" && (
          <WeeklyReviewScreen
            state={state}
            onNavigate={(s) => setScreen(s)}
            onSaveWeeklyReflection={handleSaveWeeklyReflection}
          />
        )}

        {screen === "library" && (
          <LibraryScreen
            state={state}
            onUpdateState={(updates, nextState, desc) => {
              setState(nextState);
              queuePrefUpdate(updates, nextState, desc);
            }}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen
            state={state}
            showUpgradeModal={showUpgradeModal}
            onCloseUpgradeModal={() => setShowUpgradeModal(false)}
            onOpenUpgradeModal={() => setShowUpgradeModal(true)}
            onSetLanguage={(language: Language) =>
              setState((prev) => {
                const next = { ...prev, language };
                queuePrefUpdate({ language }, next, "language");
                return next;
              })
            }
            onUpdateNotifications={(notifications: NotificationPreferences) =>
              setState((prev) => {
                const next = { ...prev, notifications };
                queuePrefUpdate({ notifications }, next, "notifications");
                return next;
              })
            }
            onUpdateOnboardingPreferences={handleUpdateOnboardingPreferences}
            onSetPlan={(plan: PlanTier) =>
              setState((prev) => {
                const next = { ...prev, user: { ...prev.user, plan } };
                queuePrefUpdate({ plan }, next, "plan");
                return next;
              })
            }
            onExportData={handleExportData}
            onImportData={handleImportData}
            onDeleteAccount={handleDeleteAccount}
            onLogout={handleLogout}
          />
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
