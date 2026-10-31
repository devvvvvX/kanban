import { useState, useEffect, useCallback } from "react";
import {
  History,
  CheckCircle2,
  GitCommit,
  CheckSquare,
  Link2,
  FileText,
  MessageSquare,
  Archive,
  Copy,
} from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { TicketActivity } from "../../lib/tickets/activityService";

interface ActivityTimelineProps {
  ticketId: string;
}

export function ActivityTimeline({ ticketId }: ActivityTimelineProps) {
  const { getActivity, workflowStates } = useTickets();
  const [activities, setActivities] = useState<TicketActivity[]>([]);

  const loadActivities = useCallback(() => {
    try {
      const list = getActivity(ticketId);
      setActivities(list);
    } catch (err) {
      console.error("Failed to load activity log:", err);
    }
  }, [ticketId, getActivity]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const renderActionDescription = (act: TicketActivity) => {
    const details = act.details || {};
    switch (act.action_type) {
      case "created":
        return <span>Created ticket <strong>{String(details.title || "")}</strong></span>;
      case "state_changed": {
        const targetState = workflowStates.find((s) => s.id === details.targetStateId);
        return (
          <span>
            Moved state to{" "}
            <strong style={{ color: targetState?.color || "var(--text-primary)" }}>
              {targetState?.name || "new state"}
            </strong>
          </span>
        );
      }
      case "subtask_added":
        return <span>Added subtask <strong>{String(details.title || "")}</strong></span>;
      case "subtask_toggled":
        return (
          <span>
            Marked subtask <strong>{String(details.title || "")}</strong> as{" "}
            {details.completed ? "completed" : "incomplete"}
          </span>
        );
      case "dependency_linked":
        return (
          <span>
            Linked dependency with relation <code>{String(details.type || "relates_to")}</code>
          </span>
        );
      case "comment_added":
        return <span>Added a comment</span>;
      case "updated": {
        const keys = Object.keys(details).filter((k) => details[k] !== undefined);
        return <span>Updated fields: {keys.join(", ") || "details"}</span>;
      }
      case "archived":
        return <span>Archived ticket</span>;
      case "duplicated":
        return <span>Duplicated from ticket</span>;
      default:
        return <span>Performed action <code>{act.action_type}</code></span>;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "created":
        return <CheckCircle2 size={13} color="var(--accent-green)" />;
      case "state_changed":
        return <GitCommit size={13} color="var(--accent-primary)" />;
      case "subtask_added":
      case "subtask_toggled":
        return <CheckSquare size={13} color="#8B5CF6" />;
      case "dependency_linked":
        return <Link2 size={13} color="#F59E0B" />;
      case "comment_added":
        return <MessageSquare size={13} color="#3B82F6" />;
      case "archived":
        return <Archive size={13} color="#64748B" />;
      case "duplicated":
        return <Copy size={13} color="#64748B" />;
      default:
        return <FileText size={13} color="var(--text-muted)" />;
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <History size={14} color="var(--text-secondary)" />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Activity Audit Log {activities.length > 0 && `(${activities.length})`}
        </span>
      </div>

      {activities.length === 0 ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-subtle)",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No logged activity yet.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: "16px" }}>
          {/* Timeline continuous vertical line */}
          <div
            style={{
              position: "absolute",
              left: "6px",
              top: "6px",
              bottom: "10px",
              width: "1px",
              backgroundColor: "var(--border-subtle)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activities.map((act) => {
              const dateStr = new Date(act.created_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={act.id} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  {/* Timeline Node Icon */}
                  <div
                    style={{
                      position: "absolute",
                      left: "-16px",
                      top: "2px",
                      width: "13px",
                      height: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "var(--bg-surface)",
                    }}
                  >
                    {getActionIcon(act.action_type)}
                  </div>

                  {/* Activity Details */}
                  <div style={{ flex: 1, fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                    <div>{renderActionDescription(act)}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "2px" }}>
                      <span>{act.actor_name}</span> • <span>{dateStr}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
