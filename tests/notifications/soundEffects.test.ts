import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NOTIFICATION_SOUNDS,
  setNotificationSoundEnabled,
  getContinuousRingEnabled,
  setContinuousRingEnabled,
  startContinuousRing,
  stopContinuousRing,
  isContinuousRingActive,
} from "../../src/utils/soundEffects";
import {
  sendDesktopNotification,
  triggerNativeMacNotification,
  focusAppWindow,
  isTauriEnvironment,
  getNotificationPermission,
} from "../../src/utils/notifications";

// Mock window and EventTarget for Node test environment
if (typeof (globalThis as any).window === "undefined") {
  const target = new EventTarget();
  (globalThis as any).window = target;
}

describe("Persisted Notifications & Continuous Ring Engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopContinuousRing();
    setNotificationSoundEnabled(true);
    setContinuousRingEnabled(true);
  });

  afterEach(() => {
    stopContinuousRing();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("includes all 6 notification sounds including Radar Ring alarm", () => {
    const ids = NOTIFICATION_SOUNDS.map((s) => s.id);
    expect(ids).toContain("chime");
    expect(ids).toContain("bell");
    expect(ids).toContain("alarm");
    expect(ids).toContain("pop");
    expect(ids).toContain("ping");
    expect(ids).toContain("subtle");
  });

  it("persists continuous ring enabled preference", () => {
    setContinuousRingEnabled(false);
    expect(getContinuousRingEnabled()).toBe(false);

    setContinuousRingEnabled(true);
    expect(getContinuousRingEnabled()).toBe(true);
  });

  it("starts and stops continuous ring loop cleanly", () => {
    expect(isContinuousRingActive()).toBe(false);

    let ringStateEvents: any[] = [];
    const handleRing = (e: any) => {
      ringStateEvents.push(e.detail);
    };
    window.addEventListener("kanban:ring-state-changed", handleRing);

    startContinuousRing("alarm", true);
    expect(isContinuousRingActive()).toBe(true);
    expect(ringStateEvents.length).toBeGreaterThanOrEqual(1);
    expect(ringStateEvents[ringStateEvents.length - 1].ringing).toBe(true);

    // Advance timer past cadence
    vi.advanceTimersByTime(3200);
    expect(isContinuousRingActive()).toBe(true);

    // Stop continuous ring
    stopContinuousRing();
    expect(isContinuousRingActive()).toBe(false);
    expect(ringStateEvents[ringStateEvents.length - 1].ringing).toBe(false);

    window.removeEventListener("kanban:ring-state-changed", handleRing);
  });

  it("sendDesktopNotification dispatches persistent in-app event with continuousRing flag", () => {
    let capturedEvent: any = null;
    const handleNotif = (e: any) => {
      capturedEvent = e.detail;
    };
    window.addEventListener("kanban-reminder-notification", handleNotif);

    sendDesktopNotification({
      id: "test-todo-123",
      title: "Urgent patch deployment",
      body: "Ship zero-downtime database migration",
      todoId: "todo-abc",
      persistent: true,
      continuousRing: true,
    });

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.title).toBe("Urgent patch deployment");
    expect(capturedEvent.body).toBe("Ship zero-downtime database migration");
    expect(capturedEvent.persistent).toBe(true);
    expect(capturedEvent.continuousRing).toBe(true);
    expect(capturedEvent.todoId).toBe("todo-abc");

    // Continuous ring was started
    expect(isContinuousRingActive()).toBe(true);

    // Clean up
    stopContinuousRing();
    window.removeEventListener("kanban-reminder-notification", handleNotif);
  });

  it("handles environment detection and native macOS notification triggers gracefully", async () => {
    // In Node test environment, isTauriEnvironment returns false
    expect(isTauriEnvironment()).toBe(false);

    // triggerNativeMacNotification returns false gracefully in non-Tauri test env
    const result = await triggerNativeMacNotification(
      "Test Native Notification",
      "Body text",
      "alarm"
    );
    expect(result).toBe(false);

    // focusAppWindow does not throw
    await expect(focusAppWindow()).resolves.toBeUndefined();

    // getNotificationPermission returns standard permission in non-Tauri env
    const perm = getNotificationPermission();
    expect(["default", "granted", "denied"]).toContain(perm);
  });
});
