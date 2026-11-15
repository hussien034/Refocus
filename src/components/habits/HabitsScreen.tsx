import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Check,
  Flame,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  X,
  Search,
  PauseCircle,
  PlayCircle,
  SkipForward,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Footprints,
  Wind,
  GraduationCap,
  Moon,
  Smartphone,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { getCopy } from "../../i18n/translations";
import {
  calculateHabitInsights,
  getHabitFrequencyType,
  getHabitStatus,
  getPastDateISO,
  getTodayISO,
  isDatePausedForHabit,
} from "../../services/analytics/metricsEngine";
import {
  Habit,
  HabitCategory,
  HabitFrequencyType,
  HabitReminderPref,
  Language,
} from "../../types/refocus";
import { EmptyStateCard } from "../common/EmptyStateCard";

export interface HabitPrefillDraft {
  title: string;
  category: HabitCategory;
  frequencyType?: HabitFrequencyType;
  targetPerWeek?: number;
}

interface HabitsScreenProps {
  language: Language;
  habits: Habit[];
  prefillDraft?: HabitPrefillDraft | null;
  onClearPrefillDraft?: () => void;
  onCompleteHabit: (habitId: string, dateISO: string, completed: boolean, note?: string) => void;
  onSkipHabitToday: (habitId: string, dateISO: string, skip: boolean) => void;
  onAddHabit: (
    habit: Omit<Habit, "id" | "completedDates" | "archived" | "createdAt">
  ) => void;
  onUpdateHabit: (habitId: string, updates: Partial<Habit>) => void;
  onSetHabitStatus: (habitId: string, status: "active" | "paused" | "archived") => void;
  onDeleteHabit: (habitId: string) => void;
}

const HABIT_CATEGORIES: HabitCategory[] = [
  "reading",
  "learning",
  "movement",
  "mindfulness",
  "sleep",
  "digital_wellness",
  "personal_growth",
];

const HABIT_ICONS: Array<{ id: string; Icon: React.FC<{ className?: string }> }> = [
  { id: "book", Icon: BookOpen },
  { id: "footprints", Icon: Footprints },
  { id: "wind", Icon: Wind },
  { id: "graduation", Icon: GraduationCap },
  { id: "moon", Icon: Moon },
  { id: "phone", Icon: Smartphone },
  { id: "sparkles", Icon: Sparkles },
];

const HABIT_COLORS = ["#F4CE25", "#69717F", "#8274C9", "#B98645", "#8B7CE1"];

function renderHabitIcon(iconId: string | undefined, className: string) {
  const found = HABIT_ICONS.find((i) => i.id === iconId);
  const Icon = found ? found.Icon : Sparkles;
  return <Icon className={className} />;
}

export const HabitsScreen: React.FC<HabitsScreenProps> = ({
  language,
  habits,
  prefillDraft,
  onClearPrefillDraft,
  onCompleteHabit,
  onSkipHabitToday,
  onAddHabit,
  onUpdateHabit,
  onSetHabitStatus,
  onDeleteHabit,
}) => {
  const t = getCopy(language);
  const today = getTodayISO();

  const [tab, setTab] = useState<"active" | "paused" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<HabitCategory | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Create / Edit Form Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HabitCategory>("reading");
  const [icon, setIcon] = useState("book");
  const [color, setColor] = useState("#F4CE25");
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>("daily");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetPerWeek, setTargetPerWeek] = useState(5);
  const [reminderPref, setReminderPref] = useState<HabitReminderPref>("none");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((curr) => (curr === msg ? null : curr));
    }, 3600);
  };

  // Prefill Create Modal when opened from an AI Coach Action Card
  useEffect(() => {
    if (!prefillDraft) return;
    setEditingHabit(null);
    setTitle(prefillDraft.title);
    setDescription("");
    setCategory(prefillDraft.category || "digital_wellness");
    setIcon("sparkles");
    setColor("#F4CE25");
    setFrequencyType(prefillDraft.frequencyType || "days_per_week");
    setSelectedWeekdays([1, 2, 3, 4, 5]);
    setTargetPerWeek(prefillDraft.targetPerWeek || 4);
    setReminderPref("none");
    setStartDate(today);
    setEndDate("");
    setModalOpen(true);
    onClearPrefillDraft?.();
  }, [prefillDraft, onClearPrefillDraft, today]);

  // Escape key closes open dialogs cleanly
  useEffect(() => {
    if (!modalOpen && !deleteTargetId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setDeleteTargetId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, deleteTargetId]);

  const visibleHabits = useMemo(() => {
    const nonDeleted = habits.filter((h) => !h.deletedAt);
    return nonDeleted.filter((h) => {
      const status = getHabitStatus(h);
      if (status !== tab) return false;
      if (categoryFilter !== "all" && h.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const label = (language === "ar" && h.titleAr ? h.titleAr : h.title).toLowerCase();
        const desc = (h.description || "").toLowerCase();
        if (!label.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [habits, tab, categoryFilter, searchQuery, language]);

  const counts = useMemo(() => {
    const nonDeleted = habits.filter((h) => !h.deletedAt);
    return {
      active: nonDeleted.filter((h) => getHabitStatus(h) === "active").length,
      paused: nonDeleted.filter((h) => getHabitStatus(h) === "paused").length,
      archived: nonDeleted.filter((h) => getHabitStatus(h) === "archived").length,
    };
  }, [habits]);

  const last30Days = useMemo(
    () => Array.from({ length: 30 }, (_, i) => getPastDateISO(29 - i, today)),
    [today]
  );
  const last7Days = last30Days.slice(-7);

  const openCreateModal = () => {
    setEditingHabit(null);
    setTitle("");
    setDescription("");
    setCategory("reading");
    setIcon("book");
    setColor("#F4CE25");
    setFrequencyType("daily");
    setSelectedWeekdays([1, 2, 3, 4, 5]);
    setTargetPerWeek(7);
    setReminderPref("none");
    setStartDate(today);
    setEndDate("");
    setModalOpen(true);
  };

  const openEditModal = (h: Habit) => {
    const freq = getHabitFrequencyType(h);
    setEditingHabit(h);
    setTitle(language === "ar" && h.titleAr ? h.titleAr : h.title);
    setDescription(h.description || "");
    setCategory(h.category);
    setIcon(h.icon || "book");
    setColor(h.color || "#F4CE25");
    setFrequencyType(freq);
    setSelectedWeekdays(h.selectedWeekdays?.length ? h.selectedWeekdays : [1, 2, 3, 4, 5]);
    setTargetPerWeek(h.targetPerWeek);
    setReminderPref(h.reminderPreference || "none");
    setStartDate(h.startDate || h.createdAt || today);
    setEndDate(h.endDate || "");
    setModalOpen(true);
  };

  const toggleWeekday = (dow: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(dow)
        ? prev.length > 1
          ? prev.filter((d) => d !== dow)
          : prev
        : [...prev, dow].sort((a, b) => a - b)
    );
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const computedTarget =
      frequencyType === "daily"
        ? 7
        : frequencyType === "weekdays"
          ? Math.max(1, selectedWeekdays.length)
          : Math.max(1, Math.min(7, targetPerWeek));

    const commonFields: Partial<Habit> = {
      description: description.trim() || undefined,
      category,
      icon,
      color,
      frequencyType,
      selectedWeekdays: frequencyType === "weekdays" ? selectedWeekdays : undefined,
      targetPerWeek: computedTarget,
      reminderPreference: reminderPref,
      startDate: startDate || today,
      endDate: endDate.trim() || null,
    };

    if (editingHabit) {
      onUpdateHabit(editingHabit.id, {
        ...commonFields,
        title: language === "en" ? title.trim() : editingHabit.title,
        titleAr: language === "ar" ? title.trim() : editingHabit.titleAr,
      });
    } else {
      onAddHabit({
        ...commonFields,
        title: title.trim(),
        titleAr: language === "ar" ? title.trim() : undefined,
        category,
        targetPerWeek: computedTarget,
        status: "active",
      });
    }
    setModalOpen(false);
  };

  const isSuggestionAdded = (suggestionTitle: string) =>
    habits.some(
      (h) =>
        !h.deletedAt &&
        getHabitStatus(h) !== "archived" &&
        h.title.toLowerCase() === suggestionTitle.toLowerCase()
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.habits.title}
          </h1>
          <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.habits.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-[#F4CE25] px-4 py-2 text-sm font-semibold text-[#191B20] transition-colors hover:bg-[#DDB816]"
        >
          <Plus className="h-4 w-4" />
          <span>{t.habits.addHabit}</span>
        </button>
      </div>

      {/* Inline Status Feedback Banner for Reversible Actions */}
      {feedbackMsg && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-2xl border border-[#F4CE25]/40 bg-[#292D37] px-4 py-3 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F4CE25]" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Tabs + Search + Category Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#363B46] bg-[#222630] p-1 dark:border-[#3A404C] dark:bg-[#222630]">
          {(
            [
              { id: "active" as const, label: `${t.habits.todayTab} (${counts.active})` },
              { id: "paused" as const, label: `${t.habits.pausedTab} (${counts.paused})` },
              { id: "archived" as const, label: `${t.habits.archivedTab} (${counts.archived})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tab === item.id
                  ? "bg-[#292D37] font-semibold text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                  : "text-[#A6AAB4] dark:text-[#A6AAB4]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A6AAB4] dark:text-[#A6AAB4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.habits.searchPlaceholder}
              aria-label={t.habits.searchPlaceholder}
              className="min-h-[40px] w-full rounded-xl border border-[#363B46] bg-[#222630] ps-9 pe-3 text-xs text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as HabitCategory | "all")}
            aria-label={t.habits.form.categoryLabel}
            className="min-h-[40px] rounded-xl border border-[#363B46] bg-[#222630] px-3 text-xs text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6]"
          >
            <option value="all">{t.habits.allCategories}</option>
            {HABIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.habits.categories[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Habit Cards or EmptyStateCard */}
      {visibleHabits.length === 0 ? (
        <EmptyStateCard
          icon={<Sparkles className="h-6 w-6" />}
          title={t.habits.emptyTitle}
          description={
            tab === "active"
              ? t.habits.emptyActive
              : tab === "paused"
                ? t.habits.emptyPaused
                : t.habits.emptyArchived
          }
          actionLabel={tab === "active" ? t.habits.emptyCta : undefined}
          onAction={tab === "active" ? openCreateModal : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visibleHabits.map((h) => {
            const insights = calculateHabitInsights(h, today);
            const status = getHabitStatus(h);
            const label = language === "ar" && h.titleAr ? h.titleAr : h.title;
            const catLabel = t.habits.categories[h.category] || h.category;
            const expanded = expandedId === h.id;
            const accentColor = h.color || "#F4CE25";
            const unitLabel =
              insights.streakUnit === "weeks" ? t.habits.weeksShort : t.habits.daysShort;
            const noteVal = noteDrafts[h.id] ?? (h.completionNotes?.[today] || "");

            return (
              <div
                key={h.id}
                className="rounded-3xl border border-[#363B46] bg-[#222630] p-5 transition-colors dark:border-[#3A404C] dark:bg-[#222630]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    {status === "active" ? (
                      <button
                        type="button"
                        aria-pressed={insights.completedToday}
                        onClick={() => {
                          const nextDone = !insights.completedToday;
                          onCompleteHabit(h.id, today, nextDone);
                          showToast(
                            nextDone
                              ? t.habits.statusFeedback.completed
                              : t.habits.statusFeedback.undone
                          );
                        }}
                        aria-label={
                          insights.completedToday ? t.habits.undoComplete : t.habits.markComplete
                        }
                        style={{
                          backgroundColor: insights.completedToday ? accentColor : undefined,
                          borderColor: insights.completedToday ? accentColor : undefined,
                        }}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                          insights.completedToday
                            ? "text-white"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] hover:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {insights.completedToday ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          renderHabitIcon(h.icon, "h-4 w-4")
                        )}
                      </button>
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]">
                        {renderHabitIcon(h.icon, "h-4 w-4")}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-sm font-semibold ${
                            insights.completedToday
                              ? "text-[#A6AAB4] line-through dark:text-[#A6AAB4]"
                              : "text-[#F3F4F6] dark:text-[#F3F4F6]"
                          }`}
                        >
                          {label}
                        </p>
                        {status !== "active" && (
                          <span className="rounded-lg border border-[#363B46] bg-[#151820] px-2 py-0.5 text-[11px] font-medium text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]">
                            {status === "paused" ? "⏸ " : ""}
                            {t.habits.statusBadge[status]}
                          </span>
                        )}
                      </div>
                      {h.description && (
                        <p className="mt-0.5 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {h.description}
                        </p>
                      )}
                      {status === "paused" && (
                        <p className="mt-1 text-xs text-[#F4CE25]">
                          {t.habits.pausedNote}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                        <span>{catLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.habits.form.frequencies[getHabitFrequencyType(h)]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono-tabular">
                          <Flame className="h-3.5 w-3.5 text-[#F4CE25]" />
                          {insights.currentStreak}
                          {unitLabel} {t.habits.streak}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {insights.weeklyCompletedCount}/{insights.weeklyTarget} {t.habits.perWeek}
                        </span>
                        {insights.skippedToday && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-amber-700 dark:text-amber-300">
                              ⏭ {t.habits.skippedBadge}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick 7-day non-color symbols + action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden items-center gap-1 sm:flex" aria-hidden="true">
                      {last7Days.map((iso) => {
                        const done = h.completedDates.includes(iso);
                        const skipped = h.skippedDates?.includes(iso);
                        const paused = isDatePausedForHabit(h, iso);
                        return (
                          <span
                            key={iso}
                            title={iso}
                            style={{ backgroundColor: done ? accentColor : undefined }}
                            className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                              done
                                ? "text-white"
                                : skipped
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                                  : paused
                                    ? "bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]"
                                    : "bg-[#151820] text-[#A6AAB4] dark:bg-[#151820] dark:text-[#A6AAB4]"
                            }`}
                          >
                            {done ? "✓" : skipped ? "⏭" : paused ? "⏸" : "·"}
                          </span>
                        );
                      })}
                    </div>

                    {status === "active" && !insights.completedToday && (
                      <button
                        type="button"
                        aria-pressed={insights.skippedToday}
                        onClick={() => {
                          const nextSkip = !insights.skippedToday;
                          onSkipHabitToday(h.id, today, nextSkip);
                          showToast(
                            nextSkip
                              ? t.habits.statusFeedback.skipped
                              : t.habits.statusFeedback.unskipped
                          );
                        }}
                        title={insights.skippedToday ? t.habits.undoSkipToday : t.habits.skipToday}
                        aria-label={
                          insights.skippedToday ? t.habits.undoSkipToday : t.habits.skipToday
                        }
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                          insights.skippedToday
                            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] hover:text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4] dark:hover:text-[#F3F4F6]"
                        }`}
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                        <span>
                          {insights.skippedToday ? t.habits.undoSkipToday : t.habits.skipToday}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : h.id)}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                    >
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      <span>{expanded ? t.habits.hideInsights : t.habits.viewInsights}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(h)}
                      aria-label={t.habits.editHabit}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A6AAB4] hover:bg-[#292D37] hover:text-[#F3F4F6] dark:text-[#A6AAB4] dark:hover:bg-[#292D37] dark:hover:text-[#F3F4F6]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {status === "active" && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetHabitStatus(h.id, "paused");
                          showToast(t.habits.statusFeedback.paused);
                        }}
                        aria-label={t.habits.pause}
                        title={t.habits.pause}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A6AAB4] hover:bg-[#292D37] hover:text-[#F3F4F6] dark:text-[#A6AAB4] dark:hover:bg-[#292D37] dark:hover:text-[#F3F4F6]"
                      >
                        <PauseCircle className="h-4 w-4" />
                      </button>
                    )}

                    {status === "paused" && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetHabitStatus(h.id, "active");
                          showToast(t.habits.statusFeedback.resumed);
                        }}
                        aria-label={t.habits.resume}
                        title={t.habits.resume}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#F4CE25] hover:bg-[#292D37] dark:hover:bg-[#292D37]"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus = status === "archived" ? "active" : "archived";
                        onSetHabitStatus(h.id, nextStatus);
                        showToast(
                          nextStatus === "archived"
                            ? t.habits.statusFeedback.archived
                            : t.habits.statusFeedback.restored
                        );
                      }}
                      aria-label={status === "archived" ? t.habits.restore : t.habits.archive}
                      title={status === "archived" ? t.habits.restore : t.habits.archive}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A6AAB4] hover:bg-[#292D37] hover:text-[#F3F4F6] dark:text-[#A6AAB4] dark:hover:bg-[#292D37] dark:hover:text-[#F3F4F6]"
                    >
                      {status === "archived" ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(h.id)}
                      aria-label={t.habits.delete}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A6AAB4] hover:bg-red-50 hover:text-red-700 dark:text-[#A6AAB4] dark:hover:bg-red-950/50 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Habit Insights, Notes & Monthly 30-day Calendar */}
                {expanded && (
                  <div className="mt-5 space-y-4 border-t border-[#363B46] pt-4 dark:border-[#3A404C]">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                        <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.habits.completionRateLabel}
                        </p>
                        <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {insights.completionRate}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                        <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.habits.streak}
                        </p>
                        <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {insights.currentStreak}
                          {unitLabel}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                        <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.habits.bestStreakLabel}
                        </p>
                        <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {insights.bestStreak}
                          {unitLabel}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#151820] p-3 dark:bg-[#151820]">
                        <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.habits.weeklyProgressLabel}
                        </p>
                        <p className="font-mono-tabular mt-1 text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
                          {insights.weeklyCompletedCount}/{insights.weeklyTarget}
                        </p>
                      </div>
                    </div>

                    {/* 30-day calendar strip with non-color symbols + legend */}
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                          {t.habits.monthlyCalendarLabel}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
                          <span>{t.habits.legendDone}</span>
                          <span>{t.habits.legendSkipped}</span>
                          <span>{t.habits.legendPaused}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15">
                        {last30Days.map((iso) => {
                          const done = h.completedDates.includes(iso);
                          const skipped = h.skippedDates?.includes(iso);
                          const paused = isDatePausedForHabit(h, iso);
                          return (
                            <button
                              key={iso}
                              type="button"
                              aria-pressed={done}
                              onClick={() => onCompleteHabit(h.id, iso, !done)}
                              title={iso}
                              style={{ backgroundColor: done ? accentColor : undefined }}
                              className={`font-mono-tabular flex h-7 items-center justify-center rounded-lg text-[10px] transition-colors ${
                                done
                                  ? "font-semibold text-white"
                                  : skipped
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                                    : paused
                                      ? "bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]"
                                      : "bg-[#151820] text-[#A6AAB4] hover:bg-[#292D37] dark:bg-[#151820] dark:text-[#A6AAB4]"
                              }`}
                            >
                              {done
                                ? `✓`
                                : skipped
                                  ? `⏭`
                                  : paused
                                    ? `⏸`
                                    : Number(iso.slice(-2))}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional Today Note */}
                    {status === "active" && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={noteVal}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [h.id]: e.target.value }))
                          }
                          placeholder={t.habits.notePlaceholder}
                          aria-label={t.habits.notePlaceholder}
                          className="min-h-[40px] flex-1 rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onCompleteHabit(h.id, today, true, noteVal);
                            showToast(t.habits.statusFeedback.completed);
                          }}
                          className="min-h-[40px] rounded-xl bg-[#F4CE25] px-4 text-xs font-semibold text-[#191B20] hover:bg-[#DDB816]"
                        >
                          {t.habits.saveNote}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested Offline Habits */}
      <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
        <h2 className="font-display text-base font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
          {t.habits.suggestedTitle}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {t.habits.suggestions.map((s) => {
            const added = isSuggestionAdded(s.title);
            const displayLabel = language === "ar" ? s.titleAr : s.title;
            return (
              <div
                key={s.title}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#363B46] bg-[#151820] p-3.5 dark:border-[#3A404C] dark:bg-[#151820]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {displayLabel}
                  </p>
                  <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                    {t.habits.categories[s.category]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() =>
                    onAddHabit({
                      title: s.title,
                      titleAr: s.titleAr,
                      category: s.category,
                      frequencyType: "days_per_week",
                      targetPerWeek: 5,
                      status: "active",
                    })
                  }
                  className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    added
                      ? "bg-[#292D37] text-[#F4CE25] dark:bg-[#292D37]"
                      : "bg-[#F4CE25] text-[#191B20] hover:bg-[#DDB816]"
                  }`}
                >
                  {added ? t.habits.alreadyAdded : t.habits.addSuggested}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-habit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]">
            <h2
              id="delete-habit-title"
              className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
            >
              {t.habits.confirmDeleteTitle}
            </h2>
            <p className="mt-2 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.habits.confirmDeleteBody}
            </p>
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onDeleteHabit(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="min-h-[44px] flex-1 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                {t.habits.confirmDeleteBtn}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-[#363B46] bg-[#222630] px-4 text-sm font-medium text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
              >
                {t.habits.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Habit Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="habit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="my-6 w-full max-w-lg rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="flex items-center justify-between">
              <h2
                id="habit-modal-title"
                className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
              >
                {editingHabit ? t.habits.editHabit : t.habits.addHabit}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
                aria-label={t.habits.form.cancel}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="habit-form-title"
                  className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                >
                  {t.habits.form.titleLabel}
                </label>
                <input
                  id="habit-form-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.habits.form.titlePlaceholder}
                  className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
              </div>

              <div>
                <label
                  htmlFor="habit-form-desc"
                  className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                >
                  {t.habits.form.descriptionLabel}
                </label>
                <input
                  id="habit-form-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.habits.form.descriptionPlaceholder}
                  className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="habit-form-category"
                    className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                  >
                    {t.habits.form.categoryLabel}
                  </label>
                  <select
                    id="habit-form-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HabitCategory)}
                    className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  >
                    {HABIT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t.habits.categories[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="habit-form-reminder"
                    className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                  >
                    {t.habits.form.reminderLabel}
                  </label>
                  <select
                    id="habit-form-reminder"
                    value={reminderPref}
                    onChange={(e) => setReminderPref(e.target.value as HabitReminderPref)}
                    className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  >
                    {(["none", "morning", "afternoon", "evening"] as const).map((r) => (
                      <option key={r} value={r}>
                        {t.habits.form.reminders[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Icon & Color */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.habits.form.iconLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {HABIT_ICONS.map(({ id, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        aria-label={id}
                        aria-pressed={icon === id}
                        onClick={() => setIcon(id)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                          icon === id
                            ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.habits.form.colorLabel}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {HABIT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                        aria-pressed={color === c}
                        className={`h-7 w-7 rounded-full transition-transform ${
                          color === c
                            ? "scale-110 ring-2 ring-[#F3F4F6] ring-offset-2 dark:ring-[#292D37]"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Frequency Selector */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.habits.form.frequencyLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["daily", "weekdays", "days_per_week", "custom_weekly"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={frequencyType === f}
                      onClick={() => {
                        setFrequencyType(f);
                        if (f === "daily") setTargetPerWeek(7);
                        else if (f === "days_per_week" && targetPerWeek === 7) setTargetPerWeek(4);
                      }}
                      className={`min-h-[40px] rounded-xl border px-3 text-xs font-medium transition-colors ${
                        frequencyType === f
                          ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                          : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                      }`}
                    >
                      {t.habits.form.frequencies[f]}
                    </button>
                  ))}
                </div>
              </div>

              {frequencyType === "weekdays" && (
                <div className="grid grid-cols-7 gap-1.5">
                  {t.habits.form.weekdaysShort.map((lbl, idx) => {
                    const active = selectedWeekdays.includes(idx);
                    return (
                      <button
                        key={lbl}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleWeekday(idx)}
                        className={`min-h-[40px] rounded-lg border text-[11px] font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#F4CE25] text-[#191B20]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}

              {(frequencyType === "days_per_week" || frequencyType === "custom_weekly") && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
                    {t.habits.form.targetLabel} ({targetPerWeek})
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={targetPerWeek === n}
                        onClick={() => setTargetPerWeek(n)}
                        className={`min-h-[40px] rounded-lg border text-xs font-semibold ${
                          targetPerWeek === n
                            ? "border-[#F4CE25] bg-[#F4CE25] text-[#191B20]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Date & Optional End Date */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="habit-form-start"
                    className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                  >
                    {t.habits.form.startDateLabel}
                  </label>
                  <input
                    id="habit-form-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="habit-form-end"
                    className="mb-1.5 block text-xs font-medium text-[#F3F4F6] dark:text-[#F3F4F6]"
                  >
                    {t.habits.form.endDateLabel}
                  </label>
                  <input
                    id="habit-form-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3 text-xs text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="min-h-[46px] flex-1 rounded-2xl bg-[#F4CE25] px-4 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816]"
                >
                  {t.habits.form.save}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[46px] rounded-2xl border border-[#363B46] bg-[#222630] px-5 text-sm font-medium text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                >
                  {t.habits.form.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
