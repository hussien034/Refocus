import { FocusSession, PersistedTimerState } from "../../types/refocus";

export const FOCUS_PRESETS = [10, 15, 25, 45, 60] as const;

export interface TimerSnapshot {
  status: PersistedTimerState["status"];
  intendedDurationSeconds: number;
  elapsedFocusedSeconds: number;
  remainingSeconds: number;
  progressPct: number;
  pausedSecondsTotal: number;
  isCompleteNow: boolean;
}

export function createIdleTimerState(
  userId: string,
  minutes: number = 25,
  intention: string = "",
  nowMs: number = Date.now()
): PersistedTimerState {
  const safeMinutes = Math.max(1, Math.min(180, Math.round(minutes || 25)));
  return {
    sessionId: "",
    userId,
    status: "idle",
    intendedDurationSeconds: safeMinutes * 60,
    actualFocusedSeconds: 0,
    startedAtMs: null,
    pausedAtMs: null,
    accumulatedPausedMs: 0,
    intention,
    lastUpdatedAtMs: nowMs,
    completedSavedSessionId: null,
    breakTimer: { status: "idle", durationSeconds: 5 * 60, startedAtMs: null },
  };
}

export function selectTimerDuration(
  prev: PersistedTimerState,
  minutes: number,
  nowMs: number = Date.now()
): PersistedTimerState {
  if (prev.status === "running" || prev.status === "paused") {
    return prev;
  }
  const safeMinutes = Math.max(1, Math.min(180, Math.round(minutes || 25)));
  return {
    ...prev,
    status: "idle",
    intendedDurationSeconds: safeMinutes * 60,
    actualFocusedSeconds: 0,
    startedAtMs: null,
    pausedAtMs: null,
    accumulatedPausedMs: 0,
    completedSavedSessionId: null,
    lastUpdatedAtMs: nowMs,
  };
}

export function startTimerSession(
  prev: PersistedTimerState,
  nowMs: number = Date.now(),
  overrideMinutes?: number,
  overrideIntention?: string
): PersistedTimerState {
  const durationMinutes =
    typeof overrideMinutes === "number"
      ? Math.max(1, Math.min(180, Math.round(overrideMinutes)))
      : Math.max(1, Math.round(prev.intendedDurationSeconds / 60));

  const sessionId = `sess_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    sessionId,
    userId: prev.userId,
    status: "running",
    intendedDurationSeconds: durationMinutes * 60,
    actualFocusedSeconds: 0,
    startedAtMs: nowMs,
    pausedAtMs: null,
    accumulatedPausedMs: 0,
    intention: typeof overrideIntention === "string" ? overrideIntention : prev.intention,
    lastUpdatedAtMs: nowMs,
    completedSavedSessionId: null,
    breakTimer: { status: "idle", durationSeconds: 5 * 60, startedAtMs: null },
  };
}

export function computeTimerSnapshot(
  timer: PersistedTimerState,
  nowMs: number = Date.now()
): TimerSnapshot {
  const intended = Math.max(60, timer.intendedDurationSeconds);

  if (timer.status === "idle" || timer.startedAtMs === null) {
    return {
      status: timer.status,
      intendedDurationSeconds: intended,
      elapsedFocusedSeconds: 0,
      remainingSeconds: intended,
      progressPct: 0,
      pausedSecondsTotal: 0,
      isCompleteNow: false,
    };
  }

  if (timer.status === "completed") {
    const focused = Math.min(intended, Math.max(0, timer.actualFocusedSeconds || intended));
    return {
      status: "completed",
      intendedDurationSeconds: intended,
      elapsedFocusedSeconds: focused,
      remainingSeconds: 0,
      progressPct: 100,
      pausedSecondsTotal: Math.max(0, Math.round(timer.accumulatedPausedMs / 1000)),
      isCompleteNow: false,
    };
  }

  if (timer.status === "interrupted") {
    const focused = Math.min(intended, Math.max(0, timer.actualFocusedSeconds));
    const progressPct = Math.min(100, Math.round((focused / intended) * 100));
    return {
      status: "interrupted",
      intendedDurationSeconds: intended,
      elapsedFocusedSeconds: focused,
      remainingSeconds: Math.max(0, intended - focused),
      progressPct,
      pausedSecondsTotal: Math.max(0, Math.round(timer.accumulatedPausedMs / 1000)),
      isCompleteNow: false,
    };
  }

  // Handle clock backward jumps safely by clamping effectiveNow >= startedAtMs
  const referenceNowMs =
    timer.status === "paused" && timer.pausedAtMs !== null
      ? Math.max(timer.startedAtMs, timer.pausedAtMs)
      : Math.max(timer.startedAtMs, nowMs);

  const liveExtraPauseMs =
    timer.status === "paused" && timer.pausedAtMs !== null
      ? Math.max(0, nowMs - timer.pausedAtMs)
      : 0;

  const rawElapsedMs = Math.max(0, referenceNowMs - timer.startedAtMs - timer.accumulatedPausedMs);
  const elapsedFocusedSeconds = Math.min(intended, Math.floor(rawElapsedMs / 1000));
  const remainingSeconds = Math.max(0, intended - elapsedFocusedSeconds);
  const progressPct = Math.min(100, Math.round((elapsedFocusedSeconds / intended) * 100));
  const isCompleteNow = timer.status === "running" && remainingSeconds <= 0;

  return {
    status: timer.status,
    intendedDurationSeconds: intended,
    elapsedFocusedSeconds,
    remainingSeconds,
    progressPct,
    pausedSecondsTotal: Math.max(
      0,
      Math.round((timer.accumulatedPausedMs + liveExtraPauseMs) / 1000)
    ),
    isCompleteNow,
  };
}

export function pauseTimerSession(
  timer: PersistedTimerState,
  nowMs: number = Date.now()
): PersistedTimerState {
  if (timer.status !== "running" || timer.startedAtMs === null) return timer;
  const safeNow = Math.max(timer.startedAtMs, nowMs);
  const snap = computeTimerSnapshot(timer, safeNow);
  return {
    ...timer,
    status: "paused",
    pausedAtMs: safeNow,
    actualFocusedSeconds: snap.elapsedFocusedSeconds,
    lastUpdatedAtMs: safeNow,
  };
}

export function resumeTimerSession(
  timer: PersistedTimerState,
  nowMs: number = Date.now()
): PersistedTimerState {
  if (timer.status !== "paused" || timer.pausedAtMs === null) return timer;
  const safeNow = Math.max(timer.pausedAtMs, nowMs);
  const pauseDelta = Math.max(0, safeNow - timer.pausedAtMs);
  return {
    ...timer,
    status: "running",
    pausedAtMs: null,
    accumulatedPausedMs: timer.accumulatedPausedMs + pauseDelta,
    lastUpdatedAtMs: safeNow,
  };
}

export function completeTimerSession(
  timer: PersistedTimerState,
  nowMs: number = Date.now(),
  completedFull: boolean = true,
  localDateISO?: string
): {
  nextTimer: PersistedTimerState;
  sessionToSave: FocusSession | null;
} {
  // Duplicate completion guard: never save a second FocusSession for the same sessionId
  if (
    !timer.sessionId ||
    (timer.completedSavedSessionId && timer.completedSavedSessionId === timer.sessionId)
  ) {
    return {
      nextTimer: {
        ...timer,
        status: completedFull ? "completed" : "interrupted",
        lastUpdatedAtMs: nowMs,
      },
      sessionToSave: null,
    };
  }

  const snap = computeTimerSnapshot(timer, nowMs);
  const focusedSeconds = completedFull
    ? Math.max(snap.elapsedFocusedSeconds, timer.intendedDurationSeconds)
    : snap.elapsedFocusedSeconds;
  const focusedMinutes = completedFull
    ? Math.round(timer.intendedDurationSeconds / 60)
    : Math.floor(focusedSeconds / 60);

  // If user ends early before logging at least 1 minute, mark interrupted and do NOT add a completed session
  if (!completedFull && focusedSeconds < 60) {
    return {
      nextTimer: {
        ...timer,
        status: "interrupted",
        actualFocusedSeconds: focusedSeconds,
        completedSavedSessionId: timer.sessionId,
        lastUpdatedAtMs: nowMs,
      },
      sessionToSave: null,
    };
  }

  const d = new Date(nowMs);
  const dateISO =
    localDateISO ||
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const sessionRecord: FocusSession = {
    id: timer.sessionId,
    date: dateISO,
    durationMinutes: Math.max(1, focusedMinutes),
    actualFocusedSeconds: focusedSeconds,
    plannedMinutes: Math.max(1, Math.round(timer.intendedDurationSeconds / 60)),
    intention: timer.intention.trim() || "Focused session",
    completedFull,
    status: completedFull ? "completed" : "interrupted",
    startedAt: timer.startedAtMs ? new Date(timer.startedAtMs).toISOString() : new Date(nowMs).toISOString(),
    completedAt: new Date(nowMs).toISOString(),
    pausedSeconds: snap.pausedSecondsTotal,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString(),
    version: 1,
  };

  return {
    nextTimer: {
      ...timer,
      status: completedFull ? "completed" : "idle",
      actualFocusedSeconds: focusedSeconds,
      pausedAtMs: null,
      completedSavedSessionId: timer.sessionId,
      lastUpdatedAtMs: nowMs,
      breakTimer: completedFull
        ? { status: "idle", durationSeconds: 5 * 60, startedAtMs: null }
        : undefined,
    },
    sessionToSave: sessionRecord,
  };
}

export function startBreakTimer(
  timer: PersistedTimerState,
  minutes: number = 5,
  nowMs: number = Date.now()
): PersistedTimerState {
  const safeSeconds = Math.max(60, Math.min(30 * 60, Math.round(minutes) * 60));
  return {
    ...timer,
    lastUpdatedAtMs: nowMs,
    breakTimer: {
      status: "running",
      durationSeconds: safeSeconds,
      startedAtMs: nowMs,
    },
  };
}

export function computeBreakRemainingSeconds(
  timer: PersistedTimerState,
  nowMs: number = Date.now()
): number {
  const br = timer.breakTimer;
  if (!br || br.status === "idle") return br?.durationSeconds ?? 300;
  if (br.status === "completed" || br.startedAtMs === null) return 0;
  const elapsed = Math.max(0, Math.floor((nowMs - br.startedAtMs) / 1000));
  return Math.max(0, br.durationSeconds - elapsed);
}
