import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Volume2,
  VolumeX,
  X,
  ExternalLink,
} from "lucide-react";
import {
  stopContinuousRing,
  isContinuousRingActive,
} from "../../utils/soundEffects";
import { focusAppWindow } from "../../utils/notifications";

export interface ActiveMacNotification {
  id: string;
  title: string;
  body?: string;
  sound?: string;
  todoId?: string;
  persistent: boolean;
  continuousRing: boolean;
  timestamp: number;
}

export const MacNotificationBanner: React.FC = () => {
  const [notifications, setNotifications] = useState<ActiveMacNotification[]>([]);
  const [isRinging, setIsRinging] = useState(false);

  // Sync with continuous ring audio state
  useEffect(() => {
    setIsRinging(isContinuousRingActive());

    const handleRingState = (e: Event) => {
      const customEvent = e as CustomEvent<{ ringing: boolean; sound?: string }>;
      if (customEvent.detail) {
        setIsRinging(Boolean(customEvent.detail.ringing));
      }
    };

    window.addEventListener("kanban:ring-state-changed", handleRingState);
    return () => {
      window.removeEventListener("kanban:ring-state-changed", handleRingState);
    };
  }, []);

  // Listen for dispatched in-app notifications
  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveMacNotification>;
      if (!customEvent.detail) return;

      const notif = customEvent.detail;
      setNotifications((prev) => {
        // Avoid duplicate ids
        const filtered = prev.filter((n) => n.id !== notif.id);
        return [notif, ...filtered];
      });
    };

    window.addEventListener("kanban-reminder-notification", handleNotification);
    return () => {
      window.removeEventListener("kanban-reminder-notification", handleNotification);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      // If no notifications left or none ringing, stop ringing
      if (next.length === 0) {
        stopContinuousRing();
      }
      return next;
    });
  }, []);

  const handleStopRinging = useCallback(() => {
    stopContinuousRing();
    setIsRinging(false);
  }, []);

  const handleOpenTodo = useCallback((notif: ActiveMacNotification) => {
    stopContinuousRing();
    focusAppWindow().catch(() => {});
    handleDismiss(notif.id);

    // Open Todos workspace tab and select the todo
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kanban:open-todo", {
          detail: { todoId: notif.todoId },
        })
      );
    }
  }, [handleDismiss]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="mac-notification-container"
      style={{
        position: "fixed",
        top: "14px",
        right: "18px",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "380px",
        width: "calc(100vw - 36px)",
        pointerEvents: "auto",
      }}
    >
      {notifications.map((notif) => {
        return (
          <div
            key={notif.id}
            data-testid="mac-notification-banner"
            className="mac-native-banner"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px 16px",
              borderRadius: "16px",
              backgroundColor: "rgba(22, 24, 30, 0.96)",
              backdropFilter: "blur(32px) saturate(200%)",
              WebkitBackdropFilter: "blur(32px) saturate(200%)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              boxShadow: "0 24px 54px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              color: "#FFFFFF",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
              animation: "macBannerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
            }}
          >
            {/* Top row: App icon, Title, Timestamp, Dismiss button */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              {/* Native App Icon with Sound Wave Pulse Indicator */}
              <div
                style={{
                  position: "relative",
                  width: "38px",
                  height: "38px",
                  borderRadius: "9px",
                  backgroundColor: isRinging ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.2)",
                  border: `1px solid ${isRinging ? "rgba(239, 68, 68, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                }}
              >
                {isRinging ? (
                  <Volume2 size={20} color="#EF4444" className="mac-bell-ringing" />
                ) : (
                  <Bell size={20} color="#3B82F6" />
                )}

                {/* Animated pulse badge when continuous ring is active */}
                {isRinging && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-3px",
                      right: "-3px",
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: "#EF4444",
                      border: "2px solid #1C1E24",
                      animation: "pulse 1.2s infinite",
                    }}
                  />
                )}
              </div>

              {/* Header text info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#F3F4F6",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Tolaria Kanban
                    </span>
                    {isRinging && (
                      <span
                        data-testid="mac-banner-ringing-tag"
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(239, 68, 68, 0.2)",
                          color: "#FCA5A5",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        Ringing
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.45)" }}>
                      Just now
                    </span>
                    <button
                      type="button"
                      data-testid="mac-banner-close-btn"
                      onClick={() => handleDismiss(notif.id)}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "none",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "rgba(255, 255, 255, 0.6)",
                        padding: 0,
                        transition: "background 0.15s ease",
                      }}
                      title="Dismiss notification"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {/* Title & Body message */}
                <div
                  data-testid="mac-banner-title"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    marginTop: "3px",
                    lineHeight: "1.3",
                    wordBreak: "break-word",
                  }}
                >
                  {notif.title}
                </div>

                {notif.body && (
                  <div
                    data-testid="mac-banner-body"
                    style={{
                      fontSize: "12px",
                      color: "rgba(255, 255, 255, 0.72)",
                      marginTop: "2px",
                      lineHeight: "1.35",
                      wordBreak: "break-word",
                    }}
                  >
                    {notif.body}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: Stop Sound, Open Todo, Dismiss */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "8px",
                paddingTop: "6px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              {isRinging && (
                <button
                  type="button"
                  data-testid="mac-banner-stop-sound-btn"
                  onClick={handleStopRinging}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#FCA5A5",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Silence the ringing alarm"
                >
                  <VolumeX size={12} />
                  <span>Stop Ringing</span>
                </button>
              )}

              {notif.todoId && (
                <button
                  type="button"
                  data-testid="mac-banner-open-todo-btn"
                  onClick={() => handleOpenTodo(notif)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    backgroundColor: "rgba(59, 130, 246, 0.25)",
                    border: "1px solid rgba(59, 130, 246, 0.45)",
                    color: "#93C5FD",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>Open Todo</span>
                  <ExternalLink size={11} />
                </button>
              )}

              <button
                type="button"
                data-testid="mac-banner-dismiss-btn"
                onClick={() => handleDismiss(notif.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                  borderRadius: "6px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "rgba(255, 255, 255, 0.75)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
