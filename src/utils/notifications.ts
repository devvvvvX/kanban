import {
  playNotificationSound,
  startContinuousRing,
  stopContinuousRing,
  type NotificationSound,
  getNotificationSoundEnabled,
  getContinuousRingEnabled,
} from "./soundEffects";

export interface SendNotificationOptions {
  id?: string;
  title: string;
  subtitle?: string;
  body?: string;
  sound?: NotificationSound;
  playSound?: boolean;
  persistent?: boolean;
  continuousRing?: boolean;
  todoId?: string;
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

/**
 * Triggers native macOS OS-level system notification via Tauri IPC.
 * Delivers authentic system notifications outside the app window directly
 * into macOS Notification Center with native system sounds and dock icon bounce.
 */
export async function triggerNativeMacNotification(
  title: string,
  body?: string,
  sound?: NotificationSound,
  subtitle?: string
): Promise<boolean> {
  try {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      await invoke("send_native_notification", {
        title,
        subtitle: subtitle ?? "Todo Reminder",
        body: body || "Todo reminder from your Kanban board",
        sound: sound || "ping",
      });
      return true;
    }
  } catch (err) {
    console.warn("Failed to trigger native macOS notification:", err);
  }
  return false;
}

/**
 * Unminimizes and brings the application window to the foreground.
 */
export async function focusAppWindow(): Promise<void> {
  try {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      await invoke("focus_app_window");
      return;
    }
  } catch {}

  if (typeof window !== "undefined") {
    try {
      window.focus();
    } catch {}
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (isTauriEnvironment()) {
    return "granted";
  }
  if (!isNotificationSupported()) {
    return "denied";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isTauriEnvironment()) {
    return "granted";
  }
  if (!isNotificationSupported()) {
    return "denied";
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

/**
 * Dispatches a native macOS / browser notification and plays the configured sound.
 * Supports persistent macOS Alert style (requireInteraction: true) and continuous ringing sound.
 */
export function sendDesktopNotification(options: SendNotificationOptions): boolean {
  const {
    id,
    title,
    subtitle,
    body,
    sound,
    playSound = true,
    persistent = true,
    continuousRing,
    todoId,
  } = options;

  const shouldContinuousRing =
    continuousRing !== undefined
      ? continuousRing
      : (persistent && getContinuousRingEnabled());

  // 1. Play audio sound or start continuous ring
  if (playSound && getNotificationSoundEnabled()) {
    if (shouldContinuousRing) {
      startContinuousRing(sound);
    } else {
      playNotificationSound(sound);
    }
  }

  // 2. Dispatch custom in-app event for macOS notification banner
  if (typeof window !== "undefined") {
    const event = new CustomEvent("kanban-reminder-notification", {
      detail: {
        id: id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        body,
        sound,
        todoId,
        persistent,
        continuousRing: shouldContinuousRing,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(event);
  }

  // 3. Dispatch native macOS OS-level system notification via Tauri IPC
  if (isTauriEnvironment()) {
    triggerNativeMacNotification(title, body, sound, subtitle ?? "Todo Reminder").catch(() => {});
  } else if (isNotificationSupported() && Notification.permission === "granted") {
    // 4. Dispatch native browser notification fallback ONLY when not in Tauri environment
    try {
      const notif = new Notification(title, {
        body: body || undefined,
        icon: "/icons/32x32.png",
        // macOS Alert style: notification remains active until user interacts
        requireInteraction: persistent,
        tag: id || "kanban-alert",
      });

      notif.onclick = () => {
        focusAppWindow().catch(() => {});
        stopContinuousRing();
        if (todoId && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("kanban:open-todo", {
              detail: { todoId },
            })
          );
        }
        notif.close();
      };

      notif.onclose = () => {
        stopContinuousRing();
      };

      return true;
    } catch {
      // Ignore background notification exceptions
    }
  }

  return true;
}

