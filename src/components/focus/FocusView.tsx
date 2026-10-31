import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  VolumeX,
  Clock,
  Flame,
} from "lucide-react";
import { useFocus } from "../../context/FocusContext";

const PRESET_DURATIONS = [
  { label: "25 min", minutes: 25, tag: "Pomodoro" },
  { label: "40 min", minutes: 40, tag: "Deep Focus" },
  { label: "50 min", minutes: 50, tag: "Sprint" },
  { label: "60 min", minutes: 60, tag: "Immersion" },
];

export const FocusView: React.FC = () => {
  const {
    durationMinutes,
    status,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    stopAlert,
    setDurationMinutes,
    formattedTime,
    progressPercent,
  } = useFocus();

  const [customInput, setCustomInput] = useState<string>(String(durationMinutes));

  const handleStart = () => {
    if (status === "paused") {
      resumeTimer();
    } else {
      const parsed = parseInt(customInput, 10);
      const mins = !isNaN(parsed) && parsed > 0 ? parsed : durationMinutes;
      startTimer(mins);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 360) {
      setDurationMinutes(parsed);
      if (status === "idle") {
        resetTimer(parsed);
      }
    }
  };

  const selectPreset = (mins: number) => {
    setCustomInput(String(mins));
    setDurationMinutes(mins);
    if (status === "idle") {
      resetTimer(mins);
    }
  };

  // SVG circular progress calculation
  const strokeRadius = 140;
  const circumference = 2 * Math.PI * strokeRadius;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  return (
    <div
      data-testid="focus-view-container"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        backgroundColor: "var(--bg-app)",
        overflowY: "auto",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-6)",
          padding: "var(--space-8)",
          borderRadius: "var(--radius-xl)",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-md)",
          position: "relative",
        }}
      >
        {/* Header Title & Tag */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "var(--accent-blue)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            <Flame size={13} />
            <span>macOS Deep Work Engine</span>
          </div>

          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            Focus Session
          </h1>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              margin: "6px 0 0",
            }}
          >
            Timed distraction-free focus with continuous ring alarm and macOS alert
          </p>
        </div>

        {/* Circular Timer Display */}
        <div
          style={{
            position: "relative",
            width: 320,
            height: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="320"
            height="320"
            viewBox="0 0 320 320"
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Background track circle */}
            <circle
              cx="160"
              cy="160"
              r={strokeRadius}
              stroke="var(--border-subtle)"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Progress indicator circle */}
            <circle
              cx="160"
              cy="160"
              r={strokeRadius}
              stroke={
                status === "completed"
                  ? "var(--accent-red)"
                  : status === "paused"
                  ? "var(--color-warning)"
                  : "var(--accent-blue)"
              }
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: "stroke-dashoffset 0.8s ease-in-out, stroke 0.3s ease",
              }}
            />
          </svg>

          {/* Time & State Text */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            <div
              data-testid="focus-timer-digits"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "52px",
                fontWeight: 700,
                color:
                  status === "completed"
                    ? "var(--accent-red)"
                    : status === "paused"
                    ? "var(--color-warning)"
                    : "var(--text-primary)",
                letterSpacing: 2,
                lineHeight: 1,
              }}
            >
              {formattedTime}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1,
                color:
                  status === "running"
                    ? "var(--accent-blue)"
                    : status === "paused"
                    ? "var(--color-warning)"
                    : status === "completed"
                    ? "var(--accent-red)"
                    : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {status === "running" && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "var(--accent-blue)",
                    boxShadow: "0 0 8px var(--accent-blue)",
                    animation: "pulse 1.5s infinite",
                  }}
                />
              )}
              {status === "running"
                ? "Focus In Progress"
                : status === "paused"
                ? "Timer Paused"
                : status === "completed"
                ? "Session Complete!"
                : "Ready to Focus"}
            </div>

            {status === "completed" && (
              <button
                type="button"
                data-testid="focus-stop-alert-btn"
                onClick={stopAlert}
                className="btn-danger"
                style={{
                  marginTop: 14,
                  fontSize: "var(--text-xs)",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  gap: 5,
                  animation: "pulse 1s infinite",
                }}
              >
                <VolumeX size={13} />
                <span>Stop Alarm Sound</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {status === "running" ? (
            <button
              type="button"
              data-testid="focus-pause-btn"
              onClick={pauseTimer}
              className="btn-secondary"
              style={{
                height: 42,
                padding: "0 22px",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                borderRadius: "var(--radius-full)",
                gap: 8,
              }}
            >
              <Pause size={16} />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="focus-start-btn"
              onClick={handleStart}
              className="btn-primary"
              style={{
                height: 42,
                padding: "0 24px",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                borderRadius: "var(--radius-full)",
                gap: 8,
              }}
            >
              <Play size={16} />
              <span>{status === "paused" ? "Resume" : "Start Focus"}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="focus-reset-btn"
            onClick={() => resetTimer()}
            className="btn-ghost"
            style={{
              height: 42,
              padding: "0 18px",
              fontSize: "var(--text-sm)",
              borderRadius: "var(--radius-full)",
              gap: 6,
              color: "var(--text-secondary)",
            }}
            title="Reset timer"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
        </div>

        {/* Quick Duration Presets */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              textAlign: "center",
            }}
          >
            Duration Presets
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              width: "100%",
            }}
          >
            {PRESET_DURATIONS.map((preset) => {
              const isSelected = durationMinutes === preset.minutes;
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  data-testid={`focus-preset-${preset.minutes}`}
                  onClick={() => selectPreset(preset.minutes)}
                  className={`btn-secondary ${isSelected ? "active" : ""}`}
                  style={{
                    flexDirection: "column",
                    height: 54,
                    padding: "6px 8px",
                    borderRadius: "var(--radius-md)",
                    borderColor: isSelected ? "var(--accent-blue)" : "var(--border-subtle)",
                    backgroundColor: isSelected ? "rgba(59, 130, 246, 0.12)" : "var(--bg-app)",
                    color: isSelected ? "var(--accent-blue)" : "var(--text-primary)",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
                    {preset.label}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: isSelected ? "var(--accent-blue)" : "var(--text-muted)",
                    }}
                  >
                    {preset.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Duration Input */}
        <form
          onSubmit={handleCustomSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            maxWidth: 340,
            padding: "8px 12px",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Clock size={15} color="var(--text-muted)" />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            Custom Minutes:
          </span>
          <input
            type="number"
            min="1"
            max="360"
            data-testid="focus-custom-input"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            style={{
              flex: 1,
              width: "60px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              textAlign: "center",
            }}
          />
          <button
            type="submit"
            className="btn-secondary btn-sm"
            style={{ height: 26, fontSize: "var(--text-xs)", padding: "0 10px" }}
          >
            Apply
          </button>
        </form>
      </div>
    </div>
  );
};
