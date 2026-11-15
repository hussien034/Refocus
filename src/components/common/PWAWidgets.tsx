import React, { useEffect, useState } from "react";
import { Download, WifiOff, X, RefreshCw, Check, AlertCircle, Cloud } from "lucide-react";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { Language, SyncStatusSnapshot } from "../../types/refocus";
import { getCopy } from "../../i18n/translations";

import { ReFocusMark } from "./ReFocusLogo";
export { ReFocusMark };

export const PWAInstallButton: React.FC<{ language: Language; variant?: "solid" | "subtle" }> = ({
  language,
  variant = "subtle",
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const t = getCopy(language);

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowIOSGuide(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showIOSGuide]);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
          variant === "solid"
            ? "bg-[#292D37] text-white hover:bg-[#1c2e27] dark:bg-[#F4CE25] dark:text-[#191B20]"
            : "border border-[#363B46] bg-[#222630] text-[#F3F4F6] hover:bg-[#292D37] dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
        }`}
      >
        <Download className="h-4 w-4" />
        <span>{t.pwa.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#363B46] bg-[#222630] px-4 py-2 text-sm font-medium text-[#F3F4F6] hover:bg-[#292D37] transition-colors whitespace-nowrap shrink-0 dark:border-[#3A404C] dark:bg-[#222630] dark:text-[#F3F4F6] dark:hover:bg-[#292D37]"
        >
          <Download className="h-4 w-4" />
          <span>{t.pwa.installIOS}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-3xl border border-[#363B46] bg-[#222630] p-6 shadow-xl dark:border-[#3A404C] dark:bg-[#222630]">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="text-lg font-semibold text-[#F3F4F6] dark:text-[#F3F4F6]"
                >
                  {t.pwa.iosTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#A6AAB4] hover:bg-[#292D37] dark:text-[#A6AAB4] dark:hover:bg-[#292D37]"
                  aria-label={t.pwa.close}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#A6AAB4] dark:text-[#A6AAB4]">
                <p>{t.pwa.iosStep1}</p>
                <p>{t.pwa.iosStep2}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 min-h-[44px] w-full rounded-xl bg-[#F4CE25] py-2.5 text-sm font-medium text-[#191B20] hover:bg-[#DDB816] transition-colors"
              >
                {t.pwa.close}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ language: Language }> = ({ language }) => {
  const isOnline = useOnlineStatus();
  const t = getCopy(language);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 shadow-md dark:border-amber-700/60 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>{t.pwa.offlineBanner}</span>
    </div>
  );
};

export const SyncStatusIndicator: React.FC<{
  language: Language;
  syncStatus: SyncStatusSnapshot;
  onRetrySync: () => void;
  onResolveConflict?: (operationId: string) => void;
}> = ({ language, syncStatus, onRetrySync, onResolveConflict }) => {
  const t = getCopy(language);

  const label =
    syncStatus.state === "offline"
      ? t.sync.offline
      : syncStatus.state === "syncing"
        ? t.sync.syncing
        : syncStatus.state === "synced"
          ? t.sync.synced
          : syncStatus.state === "error"
            ? t.sync.error
            : t.sync.online;

  const formattedTime = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString(
        language === "ar" ? "ar-EG" : "en-US",
        { hour: "2-digit", minute: "2-digit" }
      )
    : t.sync.never;

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-1.5 rounded-xl border border-[#363B46] bg-[#151820] px-3 py-2.5 text-xs text-[#A6AAB4] dark:border-[#3A404C] dark:bg-[#151820] dark:text-[#A6AAB4]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-[#F3F4F6] dark:text-[#F3F4F6]">
          {syncStatus.state === "offline" && <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
          {syncStatus.state === "syncing" && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#F4CE25]" />
          )}
          {syncStatus.state === "synced" && <Check className="h-3.5 w-3.5 text-[#F4CE25]" />}
          {syncStatus.state === "online" && <Cloud className="h-3.5 w-3.5 text-[#F4CE25]" />}
          {syncStatus.state === "error" && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
          <span>{label}</span>
          {syncStatus.pendingCount > 0 && (
            <span className="font-mono-tabular text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
              · {syncStatus.pendingCount} {t.sync.pendingSuffix}
            </span>
          )}
        </span>

        {(syncStatus.state === "error" || (syncStatus.isOnline && syncStatus.pendingCount > 0)) && (
          <button
            type="button"
            onClick={onRetrySync}
            className="font-semibold text-[#F4CE25] hover:underline"
          >
            {t.sync.retry}
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#A6AAB4] dark:text-[#A6AAB4]">
        {t.sync.lastSynced}: <span className="font-mono-tabular">{formattedTime}</span>
      </p>

      {syncStatus.conflicts.length > 0 && onResolveConflict && (
        <div className="pt-1">
          {syncStatus.conflicts.map((c) => (
            <button
              key={c.operationId}
              type="button"
              onClick={() => onResolveConflict(c.operationId)}
              className="text-[11px] font-semibold text-amber-700 underline dark:text-amber-300"
            >
              {t.sync.keepServer}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

