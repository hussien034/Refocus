import { useCallback, useEffect, useState } from "react";

export type BrowserNotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

function readBrowserPermission(): BrowserNotificationPermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  const perm = Notification.permission;
  if (perm === "granted" || perm === "denied" || perm === "default") {
    return perm;
  }
  return "default";
}

/**
 * Safe browser Notification helper.
 * Never requests notification permission on mount or page load; permission is only
 * requested inside an explicit user click handler via `requestPermission()`.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<BrowserNotificationPermissionState>(() =>
    readBrowserPermission()
  );

  useEffect(() => {
    const sync = () => setPermission(readBrowserPermission());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const requestPermission = useCallback(async (): Promise<BrowserNotificationPermissionState> => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPermission("unsupported");
      return "unsupported";
    }
    try {
      const result = await Notification.requestPermission();
      const normalized: BrowserNotificationPermissionState =
        result === "granted" || result === "denied" || result === "default"
          ? result
          : "default";
      setPermission(normalized);
      return normalized;
    } catch {
      const current = readBrowserPermission();
      setPermission(current);
      return current;
    }
  }, []);

  const sendInSessionAlert = useCallback(
    (title: string, body: string): boolean => {
      if (readBrowserPermission() !== "granted") return false;
      try {
        new Notification(title, {
          body,
          tag: "refocus-session-reminder",
        });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return {
    permission,
    requestPermission,
    sendInSessionAlert,
  };
}
