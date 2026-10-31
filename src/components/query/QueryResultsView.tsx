import {
  Inbox,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Calendar,
} from "lucide-react";
import { useQuery } from "../../context/QueryContext";
import { useTickets } from "../../context/TicketContext";
import { QueryBuilder } from "./QueryBuilder";
import { SaveQueryModal } from "./SaveQueryModal";
import type { TicketPriority } from "../../lib/tickets/ticketService";

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; color: string; Icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  urgent: { label: "Urgent", color: "#EF4444", Icon: AlertTriangle },
  high: { label: "High", color: "#F59E0B", Icon: ArrowUp },
  medium: { label: "Medium", color: "#3B82F6", Icon: Equal },
  low: { label: "Low", color: "#64748B", Icon: ArrowDown },
  none: { label: "None", color: "#9CA3AF", Icon: Equal },
};

export function QueryResultsView() {
  const { queryResults, totalCount, isQueryRunning } = useQuery();
  const { openTicketDetail } = useTickets();

  return (
    <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
      {/* Visual Query Builder Header */}
      <QueryBuilder />

      {/* Results Table */}
      {isQueryRunning ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Executing query...
        </div>
      ) : totalCount === 0 ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-subtle)",
          }}
        >
          <Inbox size={32} color="var(--text-muted)" style={{ marginBottom: "12px" }} />
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            No tickets match your query
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "340px", margin: "0 auto" }}>
            Try relaxing filter criteria or switching the logic operator to OR.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 110px 130px 140px 110px",
              padding: "10px 16px",
              backgroundColor: "var(--bg-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span>ID</span>
            <span>Title</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Epic</span>
            <span>Due Date</span>
          </div>

          {/* Table Rows */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {queryResults.map((t) => {
              const priorityConfig = PRIORITY_CONFIG[t.priority];
              const PriorityIcon = priorityConfig.Icon;

              return (
                <div
                  key={t.id}
                  onClick={() => openTicketDetail(t.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 110px 130px 140px 110px",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "background-color var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--accent-primary)",
                    }}
                  >
                    {t.identifier}
                  </span>

                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      paddingRight: "16px",
                    }}
                  >
                    {t.title}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <PriorityIcon size={13} color={priorityConfig.color} />
                    <span style={{ fontSize: "12px", color: priorityConfig.color }}>
                      {priorityConfig.label}
                    </span>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "var(--text-xs)",
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        backgroundColor: `${t.workflow_state_color}22`,
                        color: t.workflow_state_color,
                      }}
                    >
                      {t.workflow_state_name}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      color: t.epic_title ? "var(--text-secondary)" : "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.epic_title || "—"}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {t.due_date ? (
                      <>
                        <Calendar size={12} />
                        <span>{t.due_date}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Query Modal */}
      <SaveQueryModal />
    </div>
  );
}
