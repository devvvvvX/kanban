import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  startContinuousRing,
  stopContinuousRing,
} from "../utils/soundEffects";
import {
  sendDesktopNotification,
} from "../utils/notifications";

export type FocusTimerStatus = "idle" | "running" | "paused" | "completed";

export interface FocusContextType {
  durationMinutes: number;
  remainingSeconds: number;
  status: FocusTimerStatus;
  startTimer: (customMinutes?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: (customMinutes?: number) => void;
  stopAlert: () => void;
  setDurationMinutes: (minutes: number) => void;
  formattedTime: string;
  progressPercent: number;
}

export const FocusContext = createContext<FocusContextType | undefined>(undefined);

const FOCUS_STORAGE_KEY = "kanban_focus_duration_minutes";

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [durationMinutes, setDurationMinutesState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(FOCUS_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 360) return parsed;
      }
    } catch {}
    return 40; // Default 40 mins as requested
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => durationMinutes * 60);
  const [status, setStatus] = useState<FocusTimerStatus>("idle");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationMinutesRef = useRef(durationMinutes);
  durationMinutesRef.current = durationMinutes;

  const setDurationMinutes = useCallback((minutes: number) => {
    const valid = Math.max(1, Math.min(360, Math.round(minutes)));
    setDurationMinutesState(valid);
    try {
      localStorage.setItem(FOCUS_STORAGE_KEY, String(valid));
    } catch {}
    if (status === "idle") {
      setRemainingSeconds(valid * 60);
    }
  }, [status]);

  const stopAlert = useCallback(() => {
    stopContinuousRing();
    if (status === "completed") {
      setStatus("idle");
      setRemainingSeconds(durationMinutesRef.current * 60);
    }
  }, [status]);

  // Handle timer tick completion
  const handleTimerComplete = useCallback(async () => {
    setStatus("completed");
    setRemainingSeconds(0);

    // 1. Play continuous ring sound until user dismisses or stops
    try {
      startContinuousRing("alarm");
    } catch (e) {
      console.warn("Failed to play continuous ring:", e);
    }

    // 2. Dispatch desktop notification & in-app banner alert (single unified dispatch)
    try {
      sendDesktopNotification({
        id: `focus_complete_${Date.now()}`,
        title: "Focus Session Complete!",
        subtitle: "Focus Timer",
        body: `Your ${durationMinutesRef.current}-minute focus session has ended. Take a break!`,
        sound: "alarm",
        persistent: true,
        continuousRing: true,
      });
    } catch (e) {
      console.warn("Notification error:", e);
    }

    // 4. Dispatch global event
    window.dispatchEvent(
      new CustomEvent("kanban:focus-completed", {
        detail: { durationMinutes: durationMinutesRef.current },
      })
    );
  }, []);

  // Interval timer engine
  useEffect(() => {
    if (status === "running") {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, handleTimerComplete]);

  const startTimer = useCallback(
    (customMinutes?: number) => {
      stopContinuousRing();
      let mins = durationMinutes;
      if (customMinutes && customMinutes > 0) {
        mins = customMinutes;
        setDurationMinutes(customMinutes);
      }
      setRemainingSeconds(mins * 60);
      setStatus("running");
    },
    [durationMinutes, setDurationMinutes]
  );

  const pauseTimer = useCallback(() => {
    if (status === "running") {
      setStatus("paused");
    }
  }, [status]);

  const resumeTimer = useCallback(() => {
    if (status === "paused" && remainingSeconds > 0) {
      setStatus("running");
    }
  }, [status, remainingSeconds]);

  const resetTimer = useCallback(
    (customMinutes?: number) => {
      stopContinuousRing();
      if (timerRef.current) clearInterval(timerRef.current);
      let mins = durationMinutes;
      if (customMinutes && customMinutes > 0) {
        mins = customMinutes;
        setDurationMinutes(customMinutes);
      }
      setStatus("idle");
      setRemainingSeconds(mins * 60);
    },
    [durationMinutes, setDurationMinutes]
  );

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const totalSecs = durationMinutes * 60;
  const progressPercent = totalSecs > 0 ? Math.min(100, Math.max(0, ((totalSecs - remainingSeconds) / totalSecs) * 100)) : 0;

  return (
    <FocusContext.Provider
      value={{
        durationMinutes,
        remainingSeconds,
        status,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        stopAlert,
        setDurationMinutes,
        formattedTime,
        progressPercent,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus(): FocusContextType {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return ctx;
}
