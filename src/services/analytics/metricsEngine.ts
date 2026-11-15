import {
  AppState,
  DailyCheckIn,
  FocusSession,
  Habit,
  HabitFrequencyType,
  Language,
  ScreenTimeEntry,
} from "../../types/refocus";

// --- Timezone-Safe Calendar Date Helpers ---

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayISO(now: Date = new Date()): string {
  return formatDateISO(now);
}

export function parseLocalDateISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso: string, deltaDays: number): string {
  const d = parseLocalDateISO(iso);
  d.setDate(d.getDate() + deltaDays);
  return formatDateISO(d);
}

export function getPastDateISO(daysAgo: number, todayISO: string = getTodayISO()): string {
  return addDaysISO(todayISO, -daysAgo);
}

export function getDateRangeISO(startISO: string, endISO: string): string[] {
  const dates: string[] = [];
  if (startISO > endISO) return dates;
  let curr = startISO;
  let guard = 0;
  while (curr <= endISO && guard < 400) {
    dates.push(curr);
    curr = addDaysISO(curr, 1);
    guard++;
  }
  return dates;
}

export function getWeekStartSundayISO(iso: string): string {
  const d = parseLocalDateISO(iso);
  const dow = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() - dow);
  return formatDateISO(d);
}

// --- Focus Calculations (Shared across Focus, Dashboard, Analytics) ---

export function getValidFocusSessions(sessions: FocusSession[]): FocusSession[] {
  return sessions.filter(
    (s) => !s.deletedAt && s.status !== "interrupted" && s.durationMinutes > 0
  );
}

export function getDailyFocusMinutes(sessions: FocusSession[], dateISO: string): number {
  return getValidFocusSessions(sessions)
    .filter((s) => s.date === dateISO)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

export function calculateOverallFocusStreak(
  sessions: FocusSession[],
  todayISO: string = getTodayISO()
): number {
  const valid = getValidFocusSessions(sessions);
  const dailyTotals = new Map<string, number>();
  for (const s of valid) {
    dailyTotals.set(s.date, (dailyTotals.get(s.date) || 0) + s.durationMinutes);
  }
  const activeDates = new Set(
    Array.from(dailyTotals.entries())
      .filter(([, mins]) => mins >= 5)
      .map(([d]) => d)
  );
  const startOffset = activeDates.has(todayISO) ? 0 : 1;
  let streak = 0;
  for (let i = startOffset; i < 365; i++) {
    const iso = getPastDateISO(i, todayISO);
    if (activeDates.has(iso)) streak++;
    else break;
  }
  return streak;
}

// --- Habit Frequency & Sustainable Streak Logic ---

export function getHabitFrequencyType(habit: Habit): HabitFrequencyType {
  if (habit.frequencyType) return habit.frequencyType;
  return habit.targetPerWeek >= 7 ? "daily" : "days_per_week";
}

export function getHabitStatus(habit: Habit): "active" | "paused" | "archived" {
  if (habit.deletedAt) return "archived";
  if (habit.status) return habit.status;
  return habit.archived ? "archived" : "active";
}

export function isHabitScheduledOnDate(habit: Habit, dateISO: string): boolean {
  if (habit.startDate && dateISO < habit.startDate) return false;
  if (habit.endDate && dateISO > habit.endDate) return false;
  const freq = getHabitFrequencyType(habit);
  if (freq === "weekdays") {
    const weekdays = habit.selectedWeekdays?.length ? habit.selectedWeekdays : [1, 2, 3, 4, 5];
    const dow = parseLocalDateISO(dateISO).getDay();
    return weekdays.includes(dow);
  }
  return true;
}

export function isDatePausedForHabit(habit: Habit, dateISO: string): boolean {
  if (!habit.pausedPeriods?.length) return false;
  return habit.pausedPeriods.some(
    (p) => dateISO >= p.start && (!p.end || dateISO <= p.end)
  );
}

export interface HabitInsights {
  currentStreak: number;
  bestStreak: number;
  completionRate: number; // 0..100
  weeklyCompletedCount: number;
  weeklyTarget: number;
  weeklyProgressPct: number;
  completedToday: boolean;
  skippedToday: boolean;
  pausedToday: boolean;
  isDueToday: boolean;
  streakUnit: "days" | "weeks";
}

export function calculateHabitInsights(
  habit: Habit,
  todayISO: string = getTodayISO()
): HabitInsights {
  const completedSet = new Set(habit.completedDates);
  const skippedSet = new Set(habit.skippedDates || []);
  const freq = getHabitFrequencyType(habit);
  const startDate = habit.startDate || habit.createdAt || todayISO;
  const habitStatus = getHabitStatus(habit);
  const pausedToday = habitStatus === "paused" || isDatePausedForHabit(habit, todayISO);
  const weeklyTarget =
    freq === "daily"
      ? 7
      : freq === "weekdays"
        ? Math.max(1, habit.selectedWeekdays?.length || 5)
        : Math.max(1, Math.min(7, habit.targetPerWeek || 3));

  const currentWeekStart = getWeekStartSundayISO(todayISO);
  const currentWeekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(currentWeekStart, i));
  const weeklyCompletedCount = currentWeekDates.filter((d) => completedSet.has(d)).length;
  const weeklyProgressPct = Math.min(100, Math.round((weeklyCompletedCount / weeklyTarget) * 100));

  const completedToday = completedSet.has(todayISO);
  const skippedToday = skippedSet.has(todayISO);
  const isDueToday =
    habitStatus === "active" &&
    !pausedToday &&
    isHabitScheduledOnDate(habit, todayISO) &&
    !completedToday &&
    !skippedToday;

  const isWeekMostlyPaused = (weekStartISO: string): boolean => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
    const pausedDays = days.filter((d) => isDatePausedForHabit(habit, d)).length;
    return pausedDays >= 4;
  };

  // Weekly-frequency habits measure streaks in consecutive weeks hitting targetPerWeek;
  // Daily & weekday habits measure streaks in scheduled consecutive days (never punishing planned rest, skipped, or paused days).
  if (freq === "days_per_week" || freq === "custom_weekly") {
    const weekCounts = new Map<string, number>();
    for (const d of completedSet) {
      const ws = getWeekStartSundayISO(d);
      weekCounts.set(ws, (weekCounts.get(ws) || 0) + 1);
    }

    const thisWeekMet = (weekCounts.get(currentWeekStart) || 0) >= weeklyTarget;
    let currentStreak = 0;
    let weekCursor = thisWeekMet ? currentWeekStart : addDaysISO(currentWeekStart, -7);
    const earliestWeek = getWeekStartSundayISO(startDate);
    let guard = 0;
    while (weekCursor >= earliestWeek && guard < 104) {
      if (isWeekMostlyPaused(weekCursor)) {
        weekCursor = addDaysISO(weekCursor, -7);
        guard++;
        continue;
      }
      if ((weekCounts.get(weekCursor) || 0) >= weeklyTarget) {
        currentStreak++;
        weekCursor = addDaysISO(weekCursor, -7);
      } else {
        break;
      }
      guard++;
    }

    let bestStreak = currentStreak;
    let running = 0;
    let scan = earliestWeek;
    let scanGuard = 0;
    while (scan <= currentWeekStart && scanGuard < 150) {
      if (isWeekMostlyPaused(scan)) {
        scan = addDaysISO(scan, 7);
        scanGuard++;
        continue;
      }
      if ((weekCounts.get(scan) || 0) >= weeklyTarget) {
        running++;
        if (running > bestStreak) bestStreak = running;
      } else if (scan !== currentWeekStart) {
        running = 0;
      }
      scan = addDaysISO(scan, 7);
      scanGuard++;
    }

    const startWeek = getWeekStartSundayISO(startDate);
    let activeWeeks = 0;
    let wScan = startWeek;
    let totalDone = 0;
    let wGuard = 0;
    while (wScan <= currentWeekStart && wGuard < 104) {
      if (!isWeekMostlyPaused(wScan)) {
        activeWeeks++;
        totalDone += Math.min(weeklyTarget, weekCounts.get(wScan) || 0);
      }
      wScan = addDaysISO(wScan, 7);
      wGuard++;
    }
    const denom = Math.max(1, activeWeeks * weeklyTarget);
    const completionRate = Math.min(100, Math.round((totalDone / denom) * 100));

    return {
      currentStreak,
      bestStreak,
      completionRate,
      weeklyCompletedCount,
      weeklyTarget,
      weeklyProgressPct,
      completedToday,
      skippedToday,
      pausedToday,
      isDueToday: isDueToday && weeklyCompletedCount < weeklyTarget,
      streakUnit: "weeks",
    };
  }

  // Daily or selected weekdays streak logic (paused periods & skipped/rest days preserve streak)
  let currentStreak = 0;
  const startFromToday =
    completedToday || skippedToday || pausedToday || !isHabitScheduledOnDate(habit, todayISO);
  let cursor = startFromToday ? todayISO : addDaysISO(todayISO, -1);
  let steps = 0;
  while (cursor >= startDate && steps < 365) {
    const scheduled = isHabitScheduledOnDate(habit, cursor);
    if (!scheduled || skippedSet.has(cursor) || isDatePausedForHabit(habit, cursor)) {
      cursor = addDaysISO(cursor, -1);
      steps++;
      continue;
    }
    if (completedSet.has(cursor)) {
      currentStreak++;
      cursor = addDaysISO(cursor, -1);
    } else {
      break;
    }
    steps++;
  }

  let bestStreak = currentStreak;
  let running = 0;
  let scan = startDate;
  let scanGuard = 0;
  while (scan <= todayISO && scanGuard < 400) {
    const scheduled = isHabitScheduledOnDate(habit, scan);
    if (!scheduled || skippedSet.has(scan) || isDatePausedForHabit(habit, scan)) {
      scan = addDaysISO(scan, 1);
      scanGuard++;
      continue;
    }
    if (completedSet.has(scan)) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else if (scan !== todayISO) {
      running = 0;
    }
    scan = addDaysISO(scan, 1);
    scanGuard++;
  }

  const rateStart = startDate > getPastDateISO(29, todayISO) ? startDate : getPastDateISO(29, todayISO);
  const windowDates = getDateRangeISO(rateStart, todayISO);
  const scheduledDays = windowDates.filter(
    (d) =>
      isHabitScheduledOnDate(habit, d) &&
      !skippedSet.has(d) &&
      !isDatePausedForHabit(habit, d)
  );
  const doneInWindow = scheduledDays.filter((d) => completedSet.has(d)).length;
  const completionRate =
    scheduledDays.length > 0 ? Math.min(100, Math.round((doneInWindow / scheduledDays.length) * 100)) : 0;

  return {
    currentStreak,
    bestStreak,
    completionRate,
    weeklyCompletedCount,
    weeklyTarget,
    weeklyProgressPct,
    completedToday,
    skippedToday,
    pausedToday,
    isDueToday,
    streakUnit: "days",
  };
}

// --- Dashboard Summary & Honest 3-Question Smart Insights ---

export interface SmartDailyInsight {
  hasSufficientData: boolean;
  whatIsHappening: string;
  whatNeedsAttention: string;
  recommendedAction: {
    title: string;
    why: string;
    ctaLabel: string;
    ctaType: "focus" | "habits" | "tracker" | "checkin" | "review";
    focusMinutes?: number;
    focusIntention?: string;
  };
}

export interface DashboardMetrics {
  todayISO: string;
  todayFocusMinutes: number;
  dailyFocusTarget: number;
  focusProgressPct: number;
  todaySessionsCount: number;
  todayScreenTimeMinutes: number;
  activeHabits: Habit[];
  completedHabitsTodayCount: number;
  scheduledHabitsDueToday: Habit[];
  hasTodayCheckIn: boolean;
  focusStreakDays: number;
  weeklyFocusMinutes: number;
  weeklySessionsCount: number;
  weeklyHabitCompletionPct: number;
  weeklyScreenTimeMinutes: number;
  prevWeekFocusMinutes: number;
  focusWeekDeltaMinutes: number | null;
  focusWeekDeltaPct: number | null;
  dailyInsight: string;
  smartInsight: SmartDailyInsight;
}

export function generateSmartDashboardInsight(
  state: AppState,
  todayISO: string = getTodayISO()
): SmartDailyInsight {
  const ar = state.language === "ar";
  const validSessions = getValidFocusSessions(state.sessions);
  const activeHabits = state.habits.filter((h) => !h.deletedAt && getHabitStatus(h) === "active");
  const activeLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
  const activeCheckIns = state.checkIns.filter((c) => !c.deletedAt);
  const dailyFocusTarget = Math.max(10, state.onboarding.dailyFocusTarget || 25);

  const thisWeekDates = new Set(Array.from({ length: 7 }, (_, i) => getPastDateISO(i, todayISO)));
  const prevWeekDates = new Set(Array.from({ length: 7 }, (_, i) => getPastDateISO(i + 7, todayISO)));

  const thisWeekSessions = validSessions.filter((s) => thisWeekDates.has(s.date));
  const prevWeekSessions = validSessions.filter((s) => prevWeekDates.has(s.date));
  const todayFocusMinutes = thisWeekSessions
    .filter((s) => s.date === todayISO)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const thisWeekFocusTotal = thisWeekSessions.reduce((s, x) => s + x.durationMinutes, 0);
  const prevWeekFocusTotal = prevWeekSessions.reduce((s, x) => s + x.durationMinutes, 0);

  const thisWeekLogs = activeLogs.filter((l) => thisWeekDates.has(l.date));
  const prevWeekLogs = activeLogs.filter((l) => prevWeekDates.has(l.date));
  const thisWeekScreenTotal = thisWeekLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const prevWeekScreenTotal = prevWeekLogs.reduce((s, l) => s + l.durationMinutes, 0);

  const eveningOrNightLogs = thisWeekLogs.filter(
    (l) => l.periodOfDay === "evening" || l.periodOfDay === "night"
  );
  const eveningOrNightMins = eveningOrNightLogs.reduce((s, l) => s + l.durationMinutes, 0);

  const hasEnoughRecords =
    validSessions.length + activeLogs.length + activeCheckIns.length >= 2 ||
    activeHabits.some((h) => h.completedDates.length >= 2);

  if (!hasEnoughRecords) {
    return {
      hasSufficientData: false,
      whatIsHappening: ar
        ? "مساحتك هادئة وجاهزة — لم تتراكم بيانات كافية بعد لقراءة أنماط أسبوعك بدقة."
        : "Your space is ready — there are not enough logged days yet to detect reliable behavioral patterns.",
      whatNeedsAttention: ar
        ? "الخطوة الأولى هي بناء خط أساس صادق من جلسة تركيز قصيرة أو تسجيل استخدامك للشاشة اليوم."
        : "Starting with one small focus block or logging today's self-reported screen time builds your baseline.",
      recommendedAction: {
        title: ar ? "ابدأ بجلسة تركيز هادئة لمدة 15 دقيقة" : "Start a calm 15-minute focus session",
        why: ar
          ? "البيانات القصيرة والمستمرة أفضل من الخطط المثالية."
          : "Short, steady sessions establish realistic baseline data without pressure.",
        ctaLabel: ar ? "ابدأ 15 دقيقة" : "Start 15m focus",
        ctaType: "focus",
        focusMinutes: Math.min(20, dailyFocusTarget),
        focusIntention: ar ? "بناء خط الأساس اليومي" : "Build today's baseline",
      },
    };
  }

  // Pattern 1: Focus is strong / improved while evening screen time is elevated
  const focusImproved =
    prevWeekSessions.length > 0 && prevWeekFocusTotal > 0 && thisWeekFocusTotal > prevWeekFocusTotal;
  const screenIncreased =
    prevWeekLogs.length > 0 && prevWeekScreenTotal > 0 && thisWeekScreenTotal > prevWeekScreenTotal;
  const eveningScreenSpike =
    eveningOrNightLogs.length >= 2 && thisWeekScreenTotal > 0 && eveningOrNightMins / thisWeekScreenTotal >= 0.45;

  const latestCheckIn = activeCheckIns[0] || null;
  const dueHabits = activeHabits.filter((h) => calculateHabitInsights(h, todayISO).isDueToday);
  const lowFocusCheckIn = latestCheckIn && latestCheckIn.focusRating <= 2;

  // Build "What is happening"
  let whatIsHappening = "";
  if (focusImproved && (screenIncreased || eveningScreenSpike)) {
    whatIsHappening = ar
      ? `جلسات تركيزك تحسنت هذا الأسبوع (${thisWeekFocusTotal} دقيقة مقابل ${prevWeekFocusTotal} د)، لكن وقت الشاشة المسائي ارتفع أيضاً.`
      : `Your focus sessions grew more consistent this week (${thisWeekFocusTotal}m vs ${prevWeekFocusTotal}m), while evening screen time also crept up.`;
  } else if (focusImproved) {
    whatIsHappening = ar
      ? `تركيزك في مسار تصاعدي هذا الأسبوع (${thisWeekFocusTotal} دقيقة عبر ${thisWeekSessions.length} جلسات).`
      : `Your focus time is trending higher this week (${thisWeekFocusTotal}m across ${thisWeekSessions.length} sessions).`;
  } else if (todayFocusMinutes >= dailyFocusTarget) {
    whatIsHappening = ar
      ? `أتممت هدف التركيز اليومي (${todayFocusMinutes}/${dailyFocusTarget} دقيقة) مع الحفاظ على استقرار إيقاعك.`
      : `You already hit today's ${dailyFocusTarget}-minute focus target (${todayFocusMinutes}m logged) with calm consistency.`;
  } else if (activeHabits.length > 0) {
    const doneToday = activeHabits.filter((h) => h.completedDates.includes(todayISO)).length;
    whatIsHappening = ar
      ? `أتممت ${doneToday} من ${activeHabits.length} عادات اليوم وسجّلت ${todayFocusMinutes} دقيقة تركيز.`
      : `You have completed ${doneToday} of ${activeHabits.length} active habits today with ${todayFocusMinutes}m of focus logged.`;
  } else {
    whatIsHappening = ar
      ? `سجّلت ${thisWeekFocusTotal} دقيقة تركيز خلال آخر 7 أيام.`
      : `You have logged ${thisWeekFocusTotal} minutes of intentional focus over the last 7 days.`;
  }

  // Build "What needs attention" & "One realistic action"
  let whatNeedsAttention = "";
  let recommendedAction: SmartDailyInsight["recommendedAction"];

  if (eveningScreenSpike || (screenIncreased && latestCheckIn?.topDistraction)) {
    const topApp = thisWeekLogs[0]?.appName || (ar ? "تطبيقات التواصل" : "social feeds");
    whatNeedsAttention = ar
      ? `الجزء الأكبر من التصفح المسجّل يتركز في المساء أو الليل (${eveningOrNightMins} دقيقة)، وغالباً عبر ${topApp}.`
      : `A large share of your logged scrolling happens in the evening or night (${eveningOrNightMins}m), often around ${topApp}.`;
    recommendedAction = {
      title: ar
        ? "جرّب جلسة تركيز 20 دقيقة قبل فتح السوشيال ميديا الليلة"
        : "Try a 20-minute offline or focus block before opening social apps tonight",
      why: ar
        ? "إنشاء حاجز هادئ قبل التصفح المسائي يقلل الانجرار التلقائي دون حرمان صارم."
        : "Adding one calm intentional block first lowers automatic late-evening scrolling.",
      ctaLabel: ar ? "جهّز جلسة 20 دقيقة" : "Set up 20m focus",
      ctaType: "focus",
      focusMinutes: 20,
      focusIntention: ar ? "حماية وقت المساء قبل التصفح" : "Evening wind-down before feeds",
    };
  } else if (dueHabits.length > 0 && todayFocusMinutes >= dailyFocusTarget) {
    const firstHabit = dueHabits[0];
    const hTitle = ar && firstHabit.titleAr ? firstHabit.titleAr : firstHabit.title;
    whatNeedsAttention = ar
      ? `تركيزك ممتاز اليوم، لكن لا تزال لديك عادة "${hTitle}" بانتظارك (أو يمكنك تخطيها دون أي خصم إن احتجت راحة).`
      : `Your focus target is met today, and "${hTitle}" is still scheduled (you can complete it or deliberately Skip Today).`;
    recommendedAction = {
      title: ar ? `أتمم "${hTitle}" بخطوة صغيرة` : `Complete "${hTitle}" with a small step`,
      why: ar
        ? "الاستمرارية الهادئة أهم من إطالة الجلسة؛ 5 دقائق تحافظ على الإيقاع."
        : "Gentle continuity matters more than intensity — even 5 minutes keeps momentum alive.",
      ctaLabel: ar ? "افتح العادات" : "Open Habits",
      ctaType: "habits",
    };
  } else if (lowFocusCheckIn) {
    whatNeedsAttention = ar
      ? `أشار آخر تسجيل يومي لديك إلى صعوبة التركيز (${latestCheckIn.focusRating}/5) وتشتت بسبب "${latestCheckIn.topDistraction}".`
      : `Your latest check-in noted lower focus (${latestCheckIn.focusRating}/5) with "${latestCheckIn.topDistraction}" pulling attention.`;
    recommendedAction = {
      title: ar
        ? "خفّف العبء بجلسة قصيرة لمدة 10 دقائق فقط"
        : "Lower the activation barrier with a single 10-minute focus session",
      why: ar
        ? "في الأيام المشتتة، البدء بـ 10 دقائق أسهل من انتظار طاقة مثالية."
        : "On high-distraction days, starting a 10-minute block avoids overwhelm.",
      ctaLabel: ar ? "ابدأ 10 دقائق" : "Start 10m block",
      ctaType: "focus",
      focusMinutes: 10,
      focusIntention: ar ? "خطوة هادئة في يوم مشتت" : "Gentle reset block",
    };
  } else if (!activeCheckIns.some((c) => c.date === todayISO)) {
    whatNeedsAttention = ar
      ? "لم تسجّل متابعة اليوم بعد — رصد شعورك وأكبر مشتت يستغرق أقل من 30 ثانية."
      : "Today's quick check-in is still open — capturing focus feel and top distraction takes under 30 seconds.";
    recommendedAction = {
      title: ar ? "سجّل متابعتك اليومية السريعة" : "Complete today's 30-second check-in",
      why: ar
        ? "ربط شعورك الذاتي بساعات التركيز يجعل مراجعتك الأسبوعية أدق."
        : "Pairing subjective energy with focus logs makes your Weekly Review far more accurate.",
      ctaLabel: ar ? "سجّل الآن" : "Quick check-in",
      ctaType: "checkin",
    };
  } else if (thisWeekLogs.length < 2) {
    whatNeedsAttention = ar
      ? "بيانات وقت الشاشة لهذا الأسبوع ما زالت قليلة لمقارنة الأنماط."
      : "Self-reported screen-time entries are still sparse this week to compare usage trends.";
    recommendedAction = {
      title: ar ? "أضف سجل وقت شاشة صادقاً لليوم" : "Add an honest screen-time entry for today",
      why: ar
        ? "الوعي بالأرقام الحقيقية يكشف التطبيقات التي تستهلك وقتك دون انتباه."
        : "Logging real minutes reveals which apps absorb attention unintentionally.",
      ctaLabel: ar ? "سجّل وقت الشاشة" : "Log screen time",
      ctaType: "tracker",
    };
  } else {
    const suggestedMins = Math.max(10, Math.min(25, dailyFocusTarget - todayFocusMinutes || 15));
    whatNeedsAttention = ar
      ? todayFocusMinutes < dailyFocusTarget
        ? `تتبقى ${dailyFocusTarget - todayFocusMinutes} دقيقة فقط للوصول لهدفك اليومي.`
        : "مستوى بياناتك متوازن — يمكنك استعراض تحسن الأسبوع في المراجعة الأسبوعية."
      : todayFocusMinutes < dailyFocusTarget
        ? `${dailyFocusTarget - todayFocusMinutes} minutes remain to complete today's focus goal.`
        : "Your daily signals look balanced — check how this week compares in your Weekly Review.";
    recommendedAction = {
      title:
        todayFocusMinutes < dailyFocusTarget
          ? ar
            ? `أكمل هدفك اليوم بجلسة ${suggestedMins} دقيقة`
            : `Close today's gap with a ${suggestedMins}-minute session`
          : ar
            ? "تصفح المراجعة الأسبوعية بهدوء"
            : "Review your weekly momentum calmly",
      why:
        todayFocusMinutes < dailyFocusTarget
          ? ar
            ? "تقسيم المتبقي لجلسة واحدة مركّزة يحمي طاقتك دون إرهاق."
            : "Finishing in one realistic block protects energy without burnout."
          : ar
            ? "مراجعة الأنماط أسبوعياً تساعدك على تعديل أهداف الأسبوع القادم بواقعية."
            : "A quick weekly reflection keeps next week's targets realistic.",
      ctaLabel:
        todayFocusMinutes < dailyFocusTarget
          ? ar
            ? `ابدأ ${suggestedMins} د`
            : `Start ${suggestedMins}m`
          : ar
            ? "عرض المراجعة"
            : "Open Review",
      ctaType: todayFocusMinutes < dailyFocusTarget ? "focus" : "review",
      focusMinutes: todayFocusMinutes < dailyFocusTarget ? suggestedMins : undefined,
    };
  }

  return {
    hasSufficientData: true,
    whatIsHappening,
    whatNeedsAttention,
    recommendedAction,
  };
}

export function computeDashboardMetrics(
  state: AppState,
  todayISO: string = getTodayISO()
): DashboardMetrics {
  const validSessions = getValidFocusSessions(state.sessions);
  const activeScreenLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
  const activeHabits = state.habits.filter((h) => !h.deletedAt && getHabitStatus(h) === "active");

  const todaySessions = validSessions.filter((s) => s.date === todayISO);
  const todayFocusMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const dailyFocusTarget = Math.max(10, state.onboarding.dailyFocusTarget || 25);
  const focusProgressPct = Math.min(100, Math.round((todayFocusMinutes / dailyFocusTarget) * 100));

  const todayScreenTimeMinutes = activeScreenLogs
    .filter((l) => l.date === todayISO)
    .reduce((sum, l) => sum + l.durationMinutes, 0);

  const completedHabitsTodayCount = activeHabits.filter((h) =>
    h.completedDates.includes(todayISO)
  ).length;

  const scheduledHabitsDueToday = activeHabits.filter((h) => {
    const ins = calculateHabitInsights(h, todayISO);
    return ins.isDueToday;
  });

  const hasTodayCheckIn = state.checkIns.some((c) => !c.deletedAt && c.date === todayISO);
  const focusStreakDays = calculateOverallFocusStreak(validSessions, todayISO);

  const thisWeekDates = new Set(Array.from({ length: 7 }, (_, i) => getPastDateISO(i, todayISO)));
  const prevWeekDates = new Set(Array.from({ length: 7 }, (_, i) => getPastDateISO(i + 7, todayISO)));

  const thisWeekSessions = validSessions.filter((s) => thisWeekDates.has(s.date));
  const prevWeekSessions = validSessions.filter((s) => prevWeekDates.has(s.date));

  const weeklyFocusMinutes = thisWeekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const prevWeekFocusMinutes = prevWeekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const weeklySessionsCount = thisWeekSessions.length;

  const weeklyScreenTimeMinutes = activeScreenLogs
    .filter((l) => thisWeekDates.has(l.date))
    .reduce((sum, l) => sum + l.durationMinutes, 0);

  const weeklyHabitCompletionPct =
    activeHabits.length > 0
      ? Math.round(
          activeHabits.reduce((sum, h) => sum + calculateHabitInsights(h, todayISO).weeklyProgressPct, 0) /
            activeHabits.length
        )
      : 0;

  const hasEnoughPrevData = prevWeekSessions.length > 0 && prevWeekFocusMinutes > 0;
  const focusWeekDeltaMinutes = hasEnoughPrevData ? weeklyFocusMinutes - prevWeekFocusMinutes : null;
  const focusWeekDeltaPct =
    hasEnoughPrevData && prevWeekFocusMinutes > 0
      ? Math.round(((weeklyFocusMinutes - prevWeekFocusMinutes) / prevWeekFocusMinutes) * 100)
      : null;

  const smartInsight = generateSmartDashboardInsight(state, todayISO);

  return {
    todayISO,
    todayFocusMinutes,
    dailyFocusTarget,
    focusProgressPct,
    todaySessionsCount: todaySessions.length,
    todayScreenTimeMinutes,
    activeHabits,
    completedHabitsTodayCount,
    scheduledHabitsDueToday,
    hasTodayCheckIn,
    focusStreakDays,
    weeklyFocusMinutes,
    weeklySessionsCount,
    weeklyHabitCompletionPct,
    weeklyScreenTimeMinutes,
    prevWeekFocusMinutes,
    focusWeekDeltaMinutes,
    focusWeekDeltaPct,
    dailyInsight: smartInsight.whatIsHappening,
    smartInsight,
  };
}

// --- Advanced Analytics Engine (7d, 30d, 90d, Custom) ---

export interface PeriodComparison {
  currentValue: number;
  previousValue: number;
  absoluteDiff: number;
  percentChange: number | null; // null when denominator is 0 or insufficient previous data
  hasValidBaseline: boolean;
}

export interface AnalyticsSummary {
  startISO: string;
  endISO: string;
  daysCount: number;
  // Focus
  totalFocusMinutes: number;
  averageDailyFocusMinutes: number;
  completedSessionsCount: number;
  averageSessionMinutes: number;
  targetAchievementRate: number; // % of days in window meeting dailyFocusTarget
  mostProductiveDay: { date: string; minutes: number } | null;
  focusComparison: PeriodComparison;
  // Habits
  overallHabitRate: number;
  perHabitMetrics: Array<{
    habit: Habit;
    completionRate: number;
    currentStreak: number;
    bestStreak: number;
    completedInWindow: number;
    scheduledInWindow: number;
  }>;
  bestHabits: Habit[];
  attentionHabits: Habit[];
  // Screen Time (Self-Reported)
  totalScreenMinutes: number;
  loggedScreenDaysCount: number;
  averagePerLoggedDayMinutes: number | null;
  topApps: Array<{ appName: string; minutes: number }>;
  categoryDistribution: Array<{ category: ScreenTimeEntry["category"]; minutes: number; pct: number }>;
  screenComparison: PeriodComparison;
  // Chart Buckets
  chartBuckets: Array<{ key: string; label: string; focus: number; screen: number | null }>;
}

function comparePeriods(current: number, previous: number, hasPrevBaseline: boolean): PeriodComparison {
  const absoluteDiff = current - previous;
  if (!hasPrevBaseline || previous <= 0) {
    return {
      currentValue: current,
      previousValue: previous,
      absoluteDiff,
      percentChange: null,
      hasValidBaseline: false,
    };
  }
  return {
    currentValue: current,
    previousValue: previous,
    absoluteDiff,
    percentChange: Math.round((absoluteDiff / previous) * 100),
    hasValidBaseline: true,
  };
}

export function computeAnalyticsSummary(
  state: AppState,
  startISO: string,
  endISO: string,
  language: Language
): AnalyticsSummary {
  const dateWindow = getDateRangeISO(startISO, endISO);
  const daysCount = Math.max(1, dateWindow.length);
  const dateSet = new Set(dateWindow);

  const prevEndISO = addDaysISO(startISO, -1);
  const prevStartISO = addDaysISO(startISO, -daysCount);
  const prevWindow = getDateRangeISO(prevStartISO, prevEndISO);
  const prevSet = new Set(prevWindow);

  // Focus
  const validSessions = getValidFocusSessions(state.sessions);
  const currentSessions = validSessions.filter((s) => dateSet.has(s.date));
  const previousSessions = validSessions.filter((s) => prevSet.has(s.date));

  const totalFocusMinutes = currentSessions.reduce((s, x) => s + x.durationMinutes, 0);
  const prevFocusMinutes = previousSessions.reduce((s, x) => s + x.durationMinutes, 0);
  const completedSessionsCount = currentSessions.length;
  const averageDailyFocusMinutes = Math.round(totalFocusMinutes / daysCount);
  const averageSessionMinutes =
    completedSessionsCount > 0 ? Math.round(totalFocusMinutes / completedSessionsCount) : 0;

  const dailyFocusMap = new Map<string, number>();
  for (const s of currentSessions) {
    dailyFocusMap.set(s.date, (dailyFocusMap.get(s.date) || 0) + s.durationMinutes);
  }
  const target = Math.max(10, state.onboarding.dailyFocusTarget || 25);
  const daysMeetingTarget = dateWindow.filter((d) => (dailyFocusMap.get(d) || 0) >= target).length;
  const targetAchievementRate = Math.round((daysMeetingTarget / daysCount) * 100);

  let mostProductiveDay: { date: string; minutes: number } | null = null;
  for (const [d, mins] of dailyFocusMap.entries()) {
    if (!mostProductiveDay || mins > mostProductiveDay.minutes) {
      mostProductiveDay = { date: d, minutes: mins };
    }
  }
  if (mostProductiveDay && mostProductiveDay.minutes <= 0) {
    mostProductiveDay = null;
  }

  const focusComparison = comparePeriods(
    totalFocusMinutes,
    prevFocusMinutes,
    previousSessions.length > 0
  );

  // Habits
  const nonDeletedHabits = state.habits.filter((h) => !h.deletedAt && getHabitStatus(h) !== "archived");
  const perHabitMetrics = nonDeletedHabits.map((h) => {
    const ins = calculateHabitInsights(h, endISO);
    const completedSet = new Set(h.completedDates);
    const skippedSet = new Set(h.skippedDates || []);
    const scheduled = dateWindow.filter((d) => isHabitScheduledOnDate(h, d) && !skippedSet.has(d));
    const done = scheduled.filter((d) => completedSet.has(d));
    const windowRate =
      scheduled.length > 0 ? Math.min(100, Math.round((done.length / scheduled.length) * 100)) : 0;

    return {
      habit: h,
      completionRate: windowRate,
      currentStreak: ins.currentStreak,
      bestStreak: ins.bestStreak,
      completedInWindow: done.length,
      scheduledInWindow: scheduled.length,
    };
  });

  const overallHabitRate =
    perHabitMetrics.length > 0
      ? Math.round(
          perHabitMetrics.reduce((s, m) => s + m.completionRate, 0) / perHabitMetrics.length
        )
      : 0;

  const sortedByRate = [...perHabitMetrics].sort((a, b) => b.completionRate - a.completionRate);
  const bestHabits = sortedByRate.filter((m) => m.completionRate >= 60).slice(0, 3).map((m) => m.habit);
  const attentionHabits = [...sortedByRate]
    .reverse()
    .filter((m) => m.scheduledInWindow > 0 && m.completionRate < 50)
    .slice(0, 3)
    .map((m) => m.habit);

  // Screen-time (Self-reported; missing days are NOT treated as 0 usage in daily averages!)
  const activeLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
  const currentLogs = activeLogs.filter((l) => dateSet.has(l.date));
  const previousLogs = activeLogs.filter((l) => prevSet.has(l.date));

  const totalScreenMinutes = currentLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const prevScreenMinutes = previousLogs.reduce((s, l) => s + l.durationMinutes, 0);

  const loggedDaysSet = new Set(currentLogs.map((l) => l.date));
  const loggedScreenDaysCount = loggedDaysSet.size;
  const averagePerLoggedDayMinutes =
    loggedScreenDaysCount > 0 ? Math.round(totalScreenMinutes / loggedScreenDaysCount) : null;

  const appTotals = new Map<string, number>();
  const catTotals = new Map<ScreenTimeEntry["category"], number>();
  for (const log of currentLogs) {
    appTotals.set(log.appName, (appTotals.get(log.appName) || 0) + log.durationMinutes);
    catTotals.set(log.category, (catTotals.get(log.category) || 0) + log.durationMinutes);
  }

  const topApps = Array.from(appTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([appName, minutes]) => ({ appName, minutes }));

  const categoryDistribution = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, minutes]) => ({
      category,
      minutes,
      pct: totalScreenMinutes > 0 ? Math.round((minutes / totalScreenMinutes) * 100) : 0,
    }));

  const screenComparison = comparePeriods(
    totalScreenMinutes,
    prevScreenMinutes,
    previousLogs.length > 0
  );

  // Chart buckets: 1 bar per day if <= 10 days, otherwise evenly grouped into ~6-9 buckets
  const bucketSize = daysCount <= 10 ? 1 : Math.ceil(daysCount / 8);
  const chartBuckets: AnalyticsSummary["chartBuckets"] = [];
  for (let i = 0; i < dateWindow.length; i += bucketSize) {
    const slice = dateWindow.slice(i, i + bucketSize);
    const sliceSet = new Set(slice);
    const focus = currentSessions
      .filter((s) => sliceSet.has(s.date))
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const sliceLogs = currentLogs.filter((l) => sliceSet.has(l.date));
    const screen =
      sliceLogs.length > 0
        ? sliceLogs.reduce((sum, l) => sum + l.durationMinutes, 0)
        : null; // Preserve missing data distinction

    const d = parseLocalDateISO(slice[0]);
    const label =
      daysCount <= 7
        ? d.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { weekday: "short" })
        : `${d.getMonth() + 1}/${d.getDate()}`;

    chartBuckets.push({ key: slice[0], label, focus, screen });
  }

  return {
    startISO,
    endISO,
    daysCount,
    totalFocusMinutes,
    averageDailyFocusMinutes,
    completedSessionsCount,
    averageSessionMinutes,
    targetAchievementRate,
    mostProductiveDay,
    focusComparison,
    overallHabitRate,
    perHabitMetrics,
    bestHabits,
    attentionHabits,
    totalScreenMinutes,
    loggedScreenDaysCount,
    averagePerLoggedDayMinutes,
    topApps,
    categoryDistribution,
    screenComparison,
    chartBuckets,
  };
}

// --- Advanced Screen-Time Insights (Weekly Comparison, Apps, Period Patterns) ---

export interface ScreenTimeInsights {
  todayTotalMinutes: number;
  currentWeekTotalMinutes: number;
  previousWeekTotalMinutes: number;
  weeklyComparison: PeriodComparison;
  loggedDaysCount: number;
  missingDaysCount: number;
  averagePerLoggedDayMinutes: number | null;
  topApps: Array<{
    appName: string;
    weeklyMinutes: number;
    todayMinutes: number;
    sharePct: number;
  }>;
  periodTaggedCount: number;
  hasSufficientPeriodData: boolean;
  dominantPeriod: "morning" | "afternoon" | "evening" | "night" | null;
  periodBreakdown: Array<{
    period: "morning" | "afternoon" | "evening" | "night";
    minutes: number;
    pct: number;
  }>;
}

export function computeScreenTimeInsights(
  logs: ScreenTimeEntry[],
  todayISO: string = getTodayISO()
): ScreenTimeInsights {
  const activeLogs = logs.filter((l) => !l.deletedAt);
  const weekDates = Array.from({ length: 7 }, (_, i) => getPastDateISO(i, todayISO));
  const weekSet = new Set(weekDates);
  const prevWeekSet = new Set(Array.from({ length: 7 }, (_, i) => getPastDateISO(i + 7, todayISO)));

  const todayLogs = activeLogs.filter((l) => l.date === todayISO);
  const currentWeekLogs = activeLogs.filter((l) => weekSet.has(l.date));
  const previousWeekLogs = activeLogs.filter((l) => prevWeekSet.has(l.date));

  const todayTotalMinutes = todayLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const currentWeekTotalMinutes = currentWeekLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const previousWeekTotalMinutes = previousWeekLogs.reduce((s, l) => s + l.durationMinutes, 0);

  const weeklyComparison = comparePeriods(
    currentWeekTotalMinutes,
    previousWeekTotalMinutes,
    previousWeekLogs.length > 0 && currentWeekLogs.length > 0
  );

  const loggedDaysSet = new Set(currentWeekLogs.map((l) => l.date));
  const loggedDaysCount = loggedDaysSet.size;
  const missingDaysCount = 7 - loggedDaysCount;
  const averagePerLoggedDayMinutes =
    loggedDaysCount > 0 ? Math.round(currentWeekTotalMinutes / loggedDaysCount) : null;

  const appWeeklyMap = new Map<string, number>();
  const appTodayMap = new Map<string, number>();
  for (const l of currentWeekLogs) {
    appWeeklyMap.set(l.appName, (appWeeklyMap.get(l.appName) || 0) + l.durationMinutes);
  }
  for (const l of todayLogs) {
    appTodayMap.set(l.appName, (appTodayMap.get(l.appName) || 0) + l.durationMinutes);
  }

  const topApps = Array.from(appWeeklyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([appName, weeklyMinutes]) => ({
      appName,
      weeklyMinutes,
      todayMinutes: appTodayMap.get(appName) || 0,
      sharePct:
        currentWeekTotalMinutes > 0
          ? Math.round((weeklyMinutes / currentWeekTotalMinutes) * 100)
          : 0,
    }));

  // Period-of-day usage pattern strictly requires explicit user-tagged periods (never invented)
  const taggedLogs = currentWeekLogs.filter((l) => Boolean(l.periodOfDay));
  const periodTotals = new Map<"morning" | "afternoon" | "evening" | "night", number>([
    ["morning", 0],
    ["afternoon", 0],
    ["evening", 0],
    ["night", 0],
  ]);
  for (const l of taggedLogs) {
    if (l.periodOfDay) {
      periodTotals.set(l.periodOfDay, (periodTotals.get(l.periodOfDay) || 0) + l.durationMinutes);
    }
  }
  const totalTaggedMins = Array.from(periodTotals.values()).reduce((s, v) => s + v, 0);
  const periodBreakdown = (["morning", "afternoon", "evening", "night"] as const).map((period) => {
    const minutes = periodTotals.get(period) || 0;
    return {
      period,
      minutes,
      pct: totalTaggedMins > 0 ? Math.round((minutes / totalTaggedMins) * 100) : 0,
    };
  });

  const hasSufficientPeriodData = taggedLogs.length >= 3 && totalTaggedMins > 0;
  let dominantPeriod: ScreenTimeInsights["dominantPeriod"] = null;
  if (hasSufficientPeriodData) {
    const top = [...periodBreakdown].sort((a, b) => b.minutes - a.minutes)[0];
    if (top && top.minutes > 0) dominantPeriod = top.period;
  }

  return {
    todayTotalMinutes,
    currentWeekTotalMinutes,
    previousWeekTotalMinutes,
    weeklyComparison,
    loggedDaysCount,
    missingDaysCount,
    averagePerLoggedDayMinutes,
    topApps,
    periodTaggedCount: taggedLogs.length,
    hasSufficientPeriodData,
    dominantPeriod,
    periodBreakdown,
  };
}

// --- Weekly Review Engine (Honest, Comparable, Non-Judgmental) ---

export interface WeeklyReviewReport {
  weekStartISO: string;
  weekEndISO: string;
  prevWeekStartISO: string;
  prevWeekEndISO: string;
  isCurrentWeek: boolean;
  isIncompleteWeek: boolean;
  daysElapsedInWeek: number;
  activeDaysCount: number;
  hasSufficientData: boolean;
  focusMinutes: number;
  focusSessionsCount: number;
  focusComparison: PeriodComparison;
  habitCompletionPct: number;
  prevHabitCompletionPct: number | null;
  screenTimeMinutes: number;
  screenLoggedDaysCount: number;
  screenComparison: PeriodComparison;
  checkInsCount: number;
  improvedItems: string[];
  attentionItems: string[];
  nextWeekGoals: Array<{ title: string; reason: string }>;
  closingReflection: string;
  dailyBreakdown: Array<{ iso: string; focusMinutes: number; screenMinutes: number | null }>;
}

export function getAvailableReviewWeeks(
  state: AppState,
  todayISO: string = getTodayISO(),
  maxWeeks: number = 6
): string[] {
  const currentWeekStart = getWeekStartSundayISO(todayISO);
  const weeks: string[] = [currentWeekStart];

  const allDates: string[] = [
    ...getValidFocusSessions(state.sessions).map((s) => s.date),
    ...state.screenTimeLogs.filter((l) => !l.deletedAt).map((l) => l.date),
    ...state.checkIns.filter((c) => !c.deletedAt).map((c) => c.date),
    ...state.habits.filter((h) => !h.deletedAt).flatMap((h) => h.completedDates),
  ];

  const earliestDate = allDates.length ? allDates.sort()[0] : currentWeekStart;
  const earliestWeek = getWeekStartSundayISO(earliestDate);

  let cursor = addDaysISO(currentWeekStart, -7);
  while (cursor >= earliestWeek && weeks.length < maxWeeks) {
    weeks.push(cursor);
    cursor = addDaysISO(cursor, -7);
  }
  return weeks;
}

export function computeWeeklyReview(
  state: AppState,
  weekStartISO: string,
  todayISO: string = getTodayISO()
): WeeklyReviewReport {
  const ar = state.language === "ar";
  const currentWeekStart = getWeekStartSundayISO(todayISO);
  const isCurrentWeek = weekStartISO === currentWeekStart;
  const fullWeekEnd = addDaysISO(weekStartISO, 6);
  const effectiveEndISO = isCurrentWeek && todayISO < fullWeekEnd ? todayISO : fullWeekEnd;
  const windowDates = getDateRangeISO(weekStartISO, effectiveEndISO);
  const daysElapsedInWeek = Math.max(1, windowDates.length);
  const isIncompleteWeek = isCurrentWeek && daysElapsedInWeek < 7;

  // Equivalent comparison length for incomplete current week (compare N days vs same N days prior week)
  const prevWeekStartISO = addDaysISO(weekStartISO, -7);
  const prevWeekEndISO = addDaysISO(prevWeekStartISO, daysElapsedInWeek - 1);
  const prevWindowDates = getDateRangeISO(prevWeekStartISO, prevWeekEndISO);

  const curSet = new Set(windowDates);
  const prevSet = new Set(prevWindowDates);

  const validSessions = getValidFocusSessions(state.sessions);
  const curSessions = validSessions.filter((s) => curSet.has(s.date));
  const prevSessions = validSessions.filter((s) => prevSet.has(s.date));
  const focusMinutes = curSessions.reduce((s, x) => s + x.durationMinutes, 0);
  const prevFocusMinutes = prevSessions.reduce((s, x) => s + x.durationMinutes, 0);
  const focusComparison = comparePeriods(
    focusMinutes,
    prevFocusMinutes,
    prevSessions.length > 0 && curSessions.length > 0
  );

  const activeLogs = state.screenTimeLogs.filter((l) => !l.deletedAt);
  const curLogs = activeLogs.filter((l) => curSet.has(l.date));
  const prevLogs = activeLogs.filter((l) => prevSet.has(l.date));
  const screenTimeMinutes = curLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const prevScreenMinutes = prevLogs.reduce((s, l) => s + l.durationMinutes, 0);
  const screenLoggedDaysCount = new Set(curLogs.map((l) => l.date)).size;
  const screenComparison = comparePeriods(
    screenTimeMinutes,
    prevScreenMinutes,
    prevLogs.length > 0 && curLogs.length > 0
  );

  const curCheckIns = state.checkIns.filter((c) => !c.deletedAt && curSet.has(c.date));
  const nonArchivedHabits = state.habits.filter(
    (h) => !h.deletedAt && getHabitStatus(h) !== "archived"
  );

  const computeWindowHabitRate = (dates: string[]): { pct: number | null; weakHabits: Habit[]; strongHabits: Habit[] } => {
    if (nonArchivedHabits.length === 0) return { pct: null, weakHabits: [], strongHabits: [] };
    let totalScheduled = 0;
    let totalDone = 0;
    const weakHabits: Habit[] = [];
    const strongHabits: Habit[] = [];

    for (const h of nonArchivedHabits) {
      const doneSet = new Set(h.completedDates);
      const skipSet = new Set(h.skippedDates || []);
      const scheduled = dates.filter(
        (d) =>
          isHabitScheduledOnDate(h, d) &&
          !skipSet.has(d) &&
          !isDatePausedForHabit(h, d)
      );
      if (scheduled.length === 0) continue;
      const done = scheduled.filter((d) => doneSet.has(d)).length;
      const rate = Math.round((done / scheduled.length) * 100);
      totalScheduled += scheduled.length;
      totalDone += done;
      if (rate >= 70) strongHabits.push(h);
      else if (rate < 50) weakHabits.push(h);
    }

    if (totalScheduled === 0) return { pct: null, weakHabits: [], strongHabits: [] };
    return { pct: Math.round((totalDone / totalScheduled) * 100), weakHabits, strongHabits };
  };

  const curHab = computeWindowHabitRate(windowDates);
  const prevHab = computeWindowHabitRate(prevWindowDates);
  const habitCompletionPct = curHab.pct ?? 0;
  const prevHabitCompletionPct = prevHab.pct;

  const activeDaySet = new Set<string>([
    ...curSessions.map((s) => s.date),
    ...curLogs.map((l) => l.date),
    ...curCheckIns.map((c) => c.date),
    ...nonArchivedHabits.flatMap((h) => h.completedDates.filter((d) => curSet.has(d))),
  ]);
  const activeDaysCount = activeDaySet.size;
  const totalSignalCount =
    curSessions.length +
    curLogs.length +
    curCheckIns.length +
    nonArchivedHabits.reduce(
      (s, h) => s + h.completedDates.filter((d) => curSet.has(d)).length,
      0
    );

  const hasSufficientData = activeDaysCount >= 2 || totalSignalCount >= 3;

  const improvedItems: string[] = [];
  const attentionItems: string[] = [];
  const nextWeekGoals: Array<{ title: string; reason: string }> = [];

  if (hasSufficientData) {
    if (focusComparison.hasValidBaseline && focusComparison.absoluteDiff > 0) {
      improvedItems.push(
        ar
          ? `ارتفع إجمالي التركيز بمقدار +${focusComparison.absoluteDiff} دقيقة مقارنة بالفترة المماثلة السابقة (${focusMinutes} د مقابل ${prevFocusMinutes} د).`
          : `Focus time increased by +${focusComparison.absoluteDiff}m vs the equivalent prior period (${focusMinutes}m vs ${prevFocusMinutes}m).`
      );
    } else if (curSessions.length >= 2) {
      improvedItems.push(
        ar
          ? `أكملت ${curSessions.length} جلسات تركيز بمجموع ${focusMinutes} دقيقة.`
          : `You completed ${curSessions.length} focus sessions totaling ${focusMinutes} minutes.`
      );
    }

    if (prevHabitCompletionPct !== null && curHab.pct !== null && curHab.pct > prevHabitCompletionPct) {
      improvedItems.push(
        ar
          ? `ارتفع الالتزام بالعادات من ${prevHabitCompletionPct}% إلى ${curHab.pct}%.`
          : `Habit consistency rose from ${prevHabitCompletionPct}% to ${curHab.pct}%.`
      );
    } else if (curHab.strongHabits.length > 0) {
      const hTitle =
        ar && curHab.strongHabits[0].titleAr
          ? curHab.strongHabits[0].titleAr
          : curHab.strongHabits[0].title;
      improvedItems.push(
        ar
          ? `حافظت على انتظام ممتاز في "${hTitle}".`
          : `Steady follow-through on "${hTitle}".`
      );
    }

    if (screenComparison.hasValidBaseline && screenComparison.absoluteDiff < 0) {
      improvedItems.push(
        ar
          ? `انخفض وقت الشاشة المسجل بمقدار ${Math.abs(screenComparison.absoluteDiff)} دقيقة (${screenComparison.percentChange ?? 0}%).`
          : `Self-reported screen time decreased by ${Math.abs(screenComparison.absoluteDiff)} minutes (${screenComparison.percentChange ?? 0}%).`
      );
    }

    // What needs attention
    if (focusComparison.hasValidBaseline && focusComparison.absoluteDiff < -15) {
      attentionItems.push(
        ar
          ? `تراجع وقت التركيز بمقدار ${Math.abs(focusComparison.absoluteDiff)} دقيقة مقارنة بالفترة السابقة.`
          : `Focus minutes were ${Math.abs(focusComparison.absoluteDiff)}m lower than the prior comparison window.`
      );
    }

    if (curHab.weakHabits.length > 0) {
      const hTitle =
        ar && curHab.weakHabits[0].titleAr
          ? curHab.weakHabits[0].titleAr
          : curHab.weakHabits[0].title;
      attentionItems.push(
        ar
          ? `عادة "${hTitle}" شهدت تذبذباً هذا الأسبوع — ربما تحتاج لتقليل التكرار أو ربطها بوقت ثابت.`
          : `"${hTitle}" was harder to sustain this week — consider a lighter frequency or pausing if needed.`
      );
    }

    if (screenComparison.hasValidBaseline && screenComparison.absoluteDiff > 20) {
      attentionItems.push(
        ar
          ? `ارتفع وقت الشاشة المسجل بمقدار +${screenComparison.absoluteDiff} دقيقة عن الأسبوع السابق.`
          : `Logged screen time increased by +${screenComparison.absoluteDiff}m vs the prior period.`
      );
    }

    const eveningLogs = curLogs.filter((l) => l.periodOfDay === "evening" || l.periodOfDay === "night");
    if (eveningLogs.length >= 2) {
      const evMins = eveningLogs.reduce((s, l) => s + l.durationMinutes, 0);
      attentionItems.push(
        ar
          ? `سجّلت ${evMins} دقيقة من استخدام الشاشة في المساء أو الليل.`
          : `${evMins}m of logged screen usage clustered in evening/night periods.`
      );
    }

    if (curCheckIns.length === 0 && daysElapsedInWeek >= 3) {
      attentionItems.push(
        ar
          ? "لم تُسجّل أي متابعة يومية في هذا الأسبوع — تسجيل سريع يكشف مسببات التشتت مبكراً."
          : "No daily check-ins recorded this week — a 30-second check-in helps link energy and distractions."
      );
    }

    // Realistic Next-Week Goals (1-2 concrete suggestions)
    const dailyTarget = Math.max(10, state.onboarding.dailyFocusTarget || 25);
    const avgSession = curSessions.length > 0 ? Math.round(focusMinutes / curSessions.length) : Math.min(20, dailyTarget);
    const realisticSessionsGoal = Math.min(7, Math.max(3, curSessions.length + 1));

    nextWeekGoals.push({
      title: ar
        ? `إتمام ${realisticSessionsGoal} جلسات تركيز هادئة (${Math.max(15, Math.min(25, avgSession))} دقيقة لكل جلسة)`
        : `Complete ${realisticSessionsGoal} calm focus blocks (~${Math.max(15, Math.min(25, avgSession))}m each)`,
      reason: ar
        ? "مبني على وتيرة جلساتك الفعلية هذا الأسبوع ليكون قابلًا للتحقيق دون ضغط."
        : "Scaled directly from your current week's session pace so it stays realistic.",
    });

    if (curHab.weakHabits.length > 0) {
      const hTitle =
        ar && curHab.weakHabits[0].titleAr
          ? curHab.weakHabits[0].titleAr
          : curHab.weakHabits[0].title;
      nextWeekGoals.push({
        title: ar
          ? `تبسيط "${hTitle}" إلى 3–4 أيام واضحة أو 5 دقائق فقط`
          : `Simplify "${hTitle}" to 3–4 clear days or a 5-minute baseline`,
        reason: ar
          ? "تقليص حجم العادة في الأسابيع المزدحمة يحمي الاستمرارية أفضل من الإجهاد."
          : "Right-sizing a tricky habit keeps continuity alive during busy weeks.",
      });
    } else if (curLogs.length > 0) {
      nextWeekGoals.push({
        title: ar
          ? "بدء أول 15 دقيقة تركيز قبل فتح أكثر تطبيق مسجل مساءً"
          : "Run one 15-minute focus or offline ritual before evening feeds",
        reason: ar
          ? "إدخال لحظة وعي واحدة يقلل التصفح التلقائي دون حظر متشدد."
          : "A short buffer creates breathing room before automatic scrolling begins.",
      });
    }
  }

  const closingReflection = !hasSufficientData
    ? ar
      ? "لا توجد بيانات كافية في هذا الأسبوع لبناء خلاصة متوازنة — أي خطوة صغيرة اليوم تفتح القراءة الأسبوعية."
      : "There are not enough logged records in this week yet for a balanced review — one small entry begins the picture."
    : improvedItems.length > 0
      ? ar
        ? "التقدّم الهادئ يُبنى من خطوات صغيرة متكررة، وليس من الكمال. حافظ على ما نجح وعدّل نقطة واحدة فقط الأسبوع القادم."
        : "Sustainable progress grows from small repeatable steps, not perfection. Keep what worked and adjust just one friction point next week."
      : ar
        ? "كل أسبوع تسجّل فيه بصدق هو خطوة وعي مهمة. اختر هدفاً واحداً بسيطاً للأسبوع القادم وابدأ بهدوء."
        : "Every week you observe honestly builds awareness. Pick one small, kind adjustment for next week and begin steadily.";

  const dailyBreakdown = windowDates.map((iso) => {
    const focus = curSessions
      .filter((s) => s.date === iso)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const dayLogs = curLogs.filter((l) => l.date === iso);
    const screen = dayLogs.length > 0 ? dayLogs.reduce((sum, l) => sum + l.durationMinutes, 0) : null;
    return { iso, focusMinutes: focus, screenMinutes: screen };
  });

  return {
    weekStartISO,
    weekEndISO: effectiveEndISO,
    prevWeekStartISO,
    prevWeekEndISO,
    isCurrentWeek,
    isIncompleteWeek,
    daysElapsedInWeek,
    activeDaysCount,
    hasSufficientData,
    focusMinutes,
    focusSessionsCount: curSessions.length,
    focusComparison,
    habitCompletionPct,
    prevHabitCompletionPct,
    screenTimeMinutes,
    screenLoggedDaysCount,
    screenComparison,
    checkInsCount: curCheckIns.length,
    improvedItems,
    attentionItems,
    nextWeekGoals,
    closingReflection,
    dailyBreakdown,
  };
}

