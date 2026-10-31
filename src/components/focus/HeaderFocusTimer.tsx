import React from "react";
import { Play, Pause, RotateCcw, VolumeX, Flame } from "lucide-react";
import { useFocus } from "../../context/FocusContext";
import { useTabs } from "../../context/TabContext";

export const HeaderFocusTimer: React.FC = () => {
  const {
    status,
    formattedTime,
    pauseTimer,
    resumeTimer,
    resetTimer,
    stopAlert,
  } = useFocus();

  const { openFocusTab } = useTabs();

  // If idle, render a subtle compact Focus launcher button
  if (status === "idle") {
    return (
      <button
        type="button"
        data-testid="header-focus-idle-btn"
        onClick={openFocusTab}
        className="btn-ghost btn-sm no-drag"
        style={{
          height: 26,
          padding: "0 8px",
          gap: 5,
          fontSize: "var(--text-xs)",
          color: "var(--text-secondary)",
          borderRadius: "var(--radius-sm)",
          display: "inline-flex",
          alignItems: "center",
        }}
        title="Open Focus Timer"
      >
        <Flame size={12} color="var(--accent-blue)" />
        <span>Focus</span>
      </button>
    );
  }

  const isCompleted = status === "completed";
  const isRunning = status === "running";
  const isPaused = status === "paused";

  return (
    <div
      data-testid="header-focus-timer-pill"
      className="no-drag"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 6px 0 8px",
        borderRadius: "var(--radius-full)",
        backgroundColor: isCompleted
          ? "rgba(239, 68, 68, 0.18)"
          : isPaused
          ? "rgba(245, 158, 11, 0.15)"
          : "rgba(59, 130, 246, 0.14)",
        border: `1px solid ${
          isCompleted
            ? "rgba(239, 68, 68, 0.35)"
            : isPaused
            ? "rgba(245, 158, 11, 0.3)"
            : "rgba(59, 130, 246, 0.28)"
        }`,
        color: isCompleted
          ? "var(--accent-red)"
          : isPaused
          ? "var(--color-warning)"
          : "var(--accent-blue)",
        fontSize: "12px",
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Status indicator dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: isCompleted
            ? "var(--accent-red)"
            : isPaused
            ? "var(--color-warning)"
            : "var(--accent-blue)",
          boxShadow: isRunning ? "0 0 6px var(--accent-blue)" : "none",
          animation: isRunning || isCompleted ? "pulse 1.5s infinite" : "none",
        }}
      />

      {/* Digits that open Focus tab on click */}
      <button
        type="button"
        data-testid="header-focus-time-display"
        onClick={openFocusTab}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          cursor: "pointer",
        }}
        title="Click to open Focus Timer tab"
      >
        {isCompleted ? "DONE!" : formattedTime}
      </button>

      {/* Mini Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {isCompleted ? (
          <button
            type="button"
            data-testid="header-focus-stop-alert"
            onClick={stopAlert}
            className="btn-ghost"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: "50%",
              color: "var(--accent-red)",
            }}
            title="Stop Alarm Sound"
          >
            <VolumeX size={11} />
          </button>
        ) : isRunning ? (
          <button
            type="button"
            data-testid="header-focus-pause-btn"
            onClick={pauseTimer}
            className="btn-ghost"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: "50%",
              color: "inherit",
            }}
            title="Pause Focus"
          >
            <Pause size={11} />
          </button>
        ) : (
          <button
            type="button"
            data-testid="header-focus-resume-btn"
            onClick={resumeTimer}
            className="btn-ghost"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: "50%",
              color: "inherit",
            }}
            title="Resume Focus"
          >
            <Play size={11} />
          </button>
        )}

        <button
          type="button"
          data-testid="header-focus-reset-btn"
          onClick={() => resetTimer()}
          className="btn-ghost"
          style={{
            width: 20,
            height: 20,
            padding: 0,
            borderRadius: "50%",
            color: "var(--text-muted)",
          }}
          title="Reset Focus Timer"
        >
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  );
};
