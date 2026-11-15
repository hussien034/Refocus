import React, { useEffect, useRef, useState } from "react";
import {
  Globe,
  Download,
  Upload,
  Trash2,
  LogOut,
  Crown,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Bell,
} from "lucide-react";
import { useBrowserNotifications } from "../../hooks/useBrowserNotifications";
import { getCopy } from "../../i18n/translations";
import {
  AppState,
  HabitCategory,
  Language,
  NotificationPreferences,
  OnboardingProfile,
  PlanTier,
} from "../../types/refocus";
import { PWAInstallButton } from "../common/PWAWidgets";

const HABIT_INTEREST_CATEGORIES: HabitCategory[] = [
  "reading",
  "movement",
  "mindfulness",
  "learning",
  "sleep",
  "digital_wellness",
  "personal_growth",
];

interface ProfileScreenProps {
  state: AppState;
  showUpgradeModal: boolean;
  onCloseUpgradeModal: () => void;
  onOpenUpgradeModal: () => void;
  onSetLanguage: (lang: Language) => void;
  onUpdateNotifications: (prefs: NotificationPreferences) => void;
  onUpdateOnboardingPreferences: (name: string, onboarding: OnboardingProfile) => void;
  onSetPlan: (plan: PlanTier) => void;
  onExportData: () => void;
  onImportData: (jsonText: string) => boolean;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  state,
  showUpgradeModal,
  onCloseUpgradeModal,
  onOpenUpgradeModal,
  onSetLanguage,
  onUpdateNotifications,
  onUpdateOnboardingPreferences,
  onSetPlan,
  onExportData,
  onImportData,
  onDeleteAccount,
  onLogout,
}) => {
  const t = getCopy(state.language);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [prefsSavedNotice, setPrefsSavedNotice] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { permission, requestPermission, sendInSessionAlert } = useBrowserNotifications();
  const [testAlertStatus, setTestAlertStatus] = useState<string | null>(null);

  // Edit Preferences Modal State
  const [prefName, setPrefName] = useState(state.user.name);
  const [prefFocusTarget, setPrefFocusTarget] = useState(state.onboarding.dailyFocusTarget || 25);
  const [prefScreenGoal, setPrefScreenGoal] = useState(
    state.onboarding.dailyScreenTimeGoalMinutes
      ? String(state.onboarding.dailyScreenTimeGoalMinutes)
      : ""
  );
  const [prefGoals, setPrefGoals] = useState<string[]>(state.onboarding.goals);
  const [prefChallenges, setPrefChallenges] = useState<string[]>(state.onboarding.challenges);
  const [prefSources, setPrefSources] = useState<string[]>(state.onboarding.distractionSources);
  const [prefInterests, setPrefInterests] = useState<HabitCategory[]>(
    state.onboarding.habitInterests || []
  );

  const openEditPrefs = () => {
    setPrefName(state.user.name);
    setPrefFocusTarget(state.onboarding.dailyFocusTarget || 25);
    setPrefScreenGoal(
      state.onboarding.dailyScreenTimeGoalMinutes
        ? String(state.onboarding.dailyScreenTimeGoalMinutes)
        : ""
    );
    setPrefGoals(state.onboarding.goals);
    setPrefChallenges(state.onboarding.challenges);
    setPrefSources(state.onboarding.distractionSources);
    setPrefInterests(state.onboarding.habitInterests || []);
    setShowPrefsModal(true);
  };

  useEffect(() => {
    const anyOpen = showUpgradeModal || confirmDelete || showPrefsModal;
    if (!anyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDelete) setConfirmDelete(false);
        else if (showPrefsModal) setShowPrefsModal(false);
        else if (showUpgradeModal) onCloseUpgradeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showUpgradeModal, confirmDelete, showPrefsModal, onCloseUpgradeModal]);

  const isPremium = state.user.plan === "premium";

  const toggleNotif = (key: keyof NotificationPreferences) => {
    onUpdateNotifications({
      ...state.notifications,
      [key]: !state.notifications[key],
    });
  };

  const toggleStringItem = (list: string[], setter: (v: string[]) => void, item: string) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const toggleInterest = (cat: HabitCategory) => {
    setPrefInterests((prev) =>
      prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
    );
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    const safeFocusTarget = Math.max(10, Math.min(180, Math.round(prefFocusTarget || 25)));
    const parsedGoal = Number(prefScreenGoal.trim());
    const validGoal =
      prefScreenGoal.trim() && Number.isFinite(parsedGoal) && parsedGoal >= 15 && parsedGoal <= 480
        ? Math.round(parsedGoal)
        : undefined;

    const updatedOnboarding: OnboardingProfile = {
      ...state.onboarding,
      completed: true,
      dailyFocusTarget: safeFocusTarget,
      dailyScreenTimeGoalMinutes: validGoal,
      goals: prefGoals,
      challenges: prefChallenges,
      distractionSources: prefSources,
      habitInterests: prefInterests,
    };

    onUpdateOnboardingPreferences(prefName.trim() || state.user.name, updatedOnboarding);
    setShowPrefsModal(false);
    setPrefsSavedNotice(true);
    setTimeout(() => setPrefsSavedNotice(false), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportData(String(reader.result || ""));
      setImportFeedback({
        ok,
        msg: ok ? t.profile.importSuccess : t.profile.importError,
      });
      setTimeout(() => setImportFeedback(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
          {t.profile.title}
        </h1>
        <p className="text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">{t.profile.subtitle}</p>
      </div>

      {/* User Card + Plan */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#F4CE25]/20 bg-[#F4CE25] text-xl font-bold text-[#191B20] shadow-[0_6px_18px_rgba(244,206,37,0.12)]">
            {state.user.avatarUrl ? (
              <img
                src={state.user.avatarUrl}
                alt={state.user.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{(state.user.name || "U").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]">
              {state.user.name}
            </h2>
            <p className="text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
              {state.user.email} <span aria-hidden="true">·</span>{" "}
              {isPremium ? t.profile.planPremium : t.profile.planFree}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PWAInstallButton language={state.language} />
          <button
            type="button"
            onClick={isPremium ? () => onSetPlan("free") : onOpenUpgradeModal}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              isPremium
                ? "border border-[#363B46] bg-[#151820] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                : "bg-[#292D37] text-white hover:bg-[#1b2c25] dark:bg-[#F4CE25]"
            }`}
          >
            <Crown className="h-4 w-4" />
            <span>{isPremium ? t.profile.manageDemoPlan : t.profile.upgradeButton}</span>
          </button>
        </div>
      </div>

      {/* Edit Wellness Preferences Card */}
      <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              <SlidersHorizontal className="h-4 w-4 text-[#F4CE25]" />
              <h2>{t.profile.editPreferencesTitle}</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.profile.editPreferencesDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={openEditPrefs}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#F4CE25] bg-[#292D37] px-4 py-2 text-sm font-semibold text-[#F3F4F6] hover:bg-[#dfe8dc] transition-colors dark:bg-[#292D37] dark:text-[#F3F4F6]"
          >
            <span>{t.profile.editPreferencesBtn}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-xl bg-[#151820] px-3 py-1.5 font-medium text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]">
            {t.dashboard.dailyTarget}:{" "}
            <strong className="font-mono-tabular">
              {state.onboarding.dailyFocusTarget} {t.dashboard.minutesShort}
            </strong>
          </span>
          {state.onboarding.dailyScreenTimeGoalMinutes && (
            <span className="rounded-xl bg-[#151820] px-3 py-1.5 font-medium text-[#F3F4F6] dark:bg-[#151820] dark:text-[#F3F4F6]">
              {t.tracker.goalLabel}:{" "}
              <strong className="font-mono-tabular">
                {state.onboarding.dailyScreenTimeGoalMinutes} {t.dashboard.minutesShort}
              </strong>
            </span>
          )}
          {(state.onboarding.habitInterests || []).map((cat) => (
            <span
              key={cat}
              className="rounded-xl bg-[#292D37] px-3 py-1.5 font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
            >
              {t.habits.categories[cat]}
            </span>
          ))}
        </div>

        {prefsSavedNotice && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-[#F4CE25]/40 bg-[#292D37] px-3.5 py-2.5 text-xs font-medium text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F4CE25]" />
            <span>{t.profile.editPreferencesSaved}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Language */}
        <section className="space-y-5 rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
              <Globe className="h-4 w-4 text-[#F4CE25]" />
              <h2>{t.profile.languageTitle}</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={state.language === "en"}
                onClick={() => onSetLanguage("en")}
                className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  state.language === "en"
                    ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                    : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                }`}
              >
                English (LTR)
              </button>
              <button
                type="button"
                aria-pressed={state.language === "ar"}
                onClick={() => onSetLanguage("ar")}
                className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  state.language === "ar"
                    ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                    : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                }`}
              >
                العربية (RTL)
              </button>
            </div>
          </div>

        </section>

        {/* Notifications + Optional Browser Alerts */}
        <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
          <h2 className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
            {t.profile.notificationsTitle}
          </h2>
          <div className="mt-4 divide-y divide-[#363B46] dark:divide-[#3A404C]">
            {(
              [
                { key: "focusReminders", label: t.profile.notifFocus },
                { key: "eveningWindDown", label: t.profile.notifEvening },
                { key: "habitNudges", label: t.profile.notifHabits },
              ] as const
            ).map((item) => {
              const active = state.notifications[item.key];
              return (
                <div key={item.key} className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-[#F3F4F6] dark:text-[#F3F4F6]">{item.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={item.label}
                    onClick={() => toggleNotif(item.key)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                      active ? "bg-[#F4CE25]" : "bg-[#363B46] dark:bg-[#3A404C]"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-[#222630] shadow transition-transform ${
                        active
                          ? "ltr:translate-x-6 rtl:-translate-x-6"
                          : "ltr:translate-x-1 rtl:-translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Optional Browser Notification Permission UX (Never prompted on launch) */}
          <div className="mt-4 border-t border-[#363B46] pt-4 dark:border-[#3A404C]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                <Bell className="h-3.5 w-3.5 text-[#F4CE25]" />
                <h3>{t.profile.browserNotifTitle}</h3>
              </div>
              <span className="rounded-lg bg-[#151820] px-2 py-0.5 text-[11px] font-medium text-[#A6AAB4] dark:bg-[#151820] dark:text-[#A6AAB4]">
                {t.profile.browserNotifStatus[permission]}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.profile.browserNotifExplain}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.profile.browserNotifScopeNote}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {permission !== "granted" && permission !== "unsupported" && (
                <button
                  type="button"
                  onClick={() => void requestPermission()}
                  className="min-h-[40px] rounded-xl border border-[#F4CE25] bg-[#292D37] px-3.5 py-1.5 text-xs font-semibold text-[#F3F4F6] hover:bg-[#dfe8dc] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                >
                  {t.profile.browserNotifEnableBtn}
                </button>
              )}
              {permission === "granted" && (
                <button
                  type="button"
                  onClick={() => {
                    const sent = sendInSessionAlert(t.brand, t.profile.browserNotifTestBody);
                    setTestAlertStatus(sent ? t.profile.browserNotifTestBody : null);
                    setTimeout(() => setTestAlertStatus(null), 3500);
                  }}
                  className="min-h-[40px] rounded-xl border border-[#363B46] bg-[#151820] px-3.5 py-1.5 text-xs font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                >
                  {t.profile.browserNotifTestBtn}
                </button>
              )}
            </div>
            {testAlertStatus && (
              <p role="status" className="mt-2 text-[11px] text-[#F4CE25]">
                {testAlertStatus}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Privacy, JSON Export/Import & Account Actions */}
      <section className="rounded-3xl border border-[#363B46] bg-[#222630] p-6 dark:border-[#3A404C] dark:bg-[#222630]">
        <h2 className="text-sm font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
          {t.profile.privacyTitle}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[#A6AAB4] dark:text-[#A6AAB4]">
          {t.profile.privacyNote}
        </p>

        {importFeedback && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              importFeedback.ok
                ? "border-[#F4CE25]/40 bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
            }`}
          >
            {importFeedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F4CE25]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{importFeedback.msg}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onExportData}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#363B46] bg-[#151820] px-4 py-2 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
          >
            <Download className="h-4 w-4 text-[#F4CE25]" />
            <span>{t.profile.exportData}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#363B46] bg-[#151820] px-4 py-2 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
          >
            <Upload className="h-4 w-4 text-[#F4CE25]" />
            <span>{t.profile.importData}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            <span>{t.profile.deleteAccount}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#363B46] px-4 py-2 text-sm font-medium text-[#A6AAB4] hover:bg-[#292D37] hover:text-[#F3F4F6] dark:border-[#3A404C] dark:text-[#A6AAB4]"
          >
            <LogOut className="h-4 w-4" />
            <span>{t.profile.logout}</span>
          </button>
        </div>
      </section>

      {/* Edit Wellness Preferences Modal */}
      {showPrefsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-prefs-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={handleSavePreferences}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="edit-prefs-title"
                className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
              >
                {t.profile.editPreferencesTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowPrefsModal(false)}
                aria-label={t.common.close}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="pref-display-name"
                  className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
                >
                  {t.auth.nameLabel}
                </label>
                <input
                  id="pref-display-name"
                  type="text"
                  required
                  value={prefName}
                  onChange={(e) => setPrefName(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pref-focus-target"
                    className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
                  >
                    {t.dashboard.dailyTarget} ({t.dashboard.minutesShort})
                  </label>
                  <input
                    id="pref-focus-target"
                    type="number"
                    min={10}
                    max={180}
                    required
                    value={prefFocusTarget}
                    onChange={(e) => setPrefFocusTarget(Number(e.target.value))}
                    className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pref-screen-goal"
                    className="mb-1.5 block text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]"
                  >
                    {t.onboarding.screenTimeGoalLabel}
                  </label>
                  <input
                    id="pref-screen-goal"
                    type="number"
                    min={15}
                    max={480}
                    value={prefScreenGoal}
                    onChange={(e) => setPrefScreenGoal(e.target.value)}
                    placeholder="60"
                    className="min-h-[44px] w-full rounded-xl border border-[#363B46] bg-[#151820] px-3.5 text-sm text-[#F3F4F6] outline-none focus:border-[#F4CE25] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.habitInterestsTitle}
                </p>
                <div className="flex flex-wrap gap-2">
                  {HABIT_INTEREST_CATEGORIES.map((cat) => {
                    const active = prefInterests.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleInterest(cat)}
                        className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#292D37] text-white dark:bg-[#F4CE25]"
                            : "border-[#363B46] bg-[#151820] text-[#F3F4F6] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#F3F4F6]"
                        }`}
                      >
                        {t.habits.categories[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.steps.s5Title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.onboarding.goals.map((g) => {
                    const active = prefGoals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleStringItem(prefGoals, setPrefGoals, g)}
                        className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.steps.s4Title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.onboarding.challenges.map((ch) => {
                    const active = prefChallenges.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleStringItem(prefChallenges, setPrefChallenges, ch)}
                        className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.onboarding.steps.s3Title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.onboarding.sources.map((src) => {
                    const active = prefSources.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleStringItem(prefSources, setPrefSources, src)}
                        className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-[#F4CE25] bg-[#292D37] text-[#F3F4F6] dark:bg-[#292D37] dark:text-[#F3F4F6]"
                            : "border-[#363B46] bg-[#151820] text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
                        }`}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPrefsModal(false)}
                className="min-h-[44px] rounded-xl border border-[#363B46] px-4 py-2 text-sm font-medium text-[#A6AAB4] dark:border-[#3A404C] dark:text-[#A6AAB4]"
              >
                {t.profile.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#F4CE25] px-5 py-2 text-sm font-semibold text-[#191B20] hover:bg-[#DDB816]"
              >
                {t.profile.editPreferencesSave}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Premium Upgrade Modal */}
      {showUpgradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl sm:p-8 dark:border-[#3A404C] dark:bg-[#222630]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#F4CE25]">{t.profile.premiumModal.badge}</p>
                <h2
                  id="upgrade-modal-title"
                  className="mt-1 font-display text-2xl font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
                >
                  {t.profile.premiumModal.title}
                </h2>
                <p className="mt-1 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.profile.premiumModal.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseUpgradeModal}
                aria-label={t.common.close}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#363B46] bg-[#151820] p-5 dark:border-[#3A404C] dark:bg-[#151820]">
                <h3 className="font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.profile.premiumModal.freeTitle}
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-[#A6AAB4] dark:text-[#A6AAB4]">
                  {t.profile.premiumModal.freeItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F4CE25]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#F4CE25] bg-[#292D37] p-5 dark:bg-[#292D37]">
                <h3 className="font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.profile.premiumModal.premTitle}
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-[#F3F4F6] dark:text-[#F3F4F6]">
                  {t.profile.premiumModal.premItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F4CE25]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    onSetPlan("premium");
                    onCloseUpgradeModal();
                  }}
                  className="mt-5 min-h-[44px] w-full rounded-xl bg-[#292D37] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c2e26] dark:bg-[#F4CE25]"
                >
                  {isPremium ? t.profile.premiumModal.alreadyPremium : t.profile.premiumModal.activateDemo}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Dialog */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]">
            <h2
              id="delete-account-title"
              className="font-display text-lg font-bold text-[#F3F4F6] dark:text-[#F3F4F6]"
            >
              {t.profile.confirmDeleteTitle}
            </h2>
            <p className="mt-2 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
              {t.profile.confirmDeleteBody}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] rounded-xl border border-[#363B46] px-4 py-2 text-sm font-medium text-[#A6AAB4] dark:border-[#3A404C] dark:text-[#A6AAB4]"
              >
                {t.profile.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  onDeleteAccount();
                }}
                className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                {t.profile.confirmAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
