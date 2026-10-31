import React, { useState, useMemo } from "react";
import {
  Milestone,
  ArrowLeft,
  X,
  Plus,
  Calendar,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  CheckSquare,
  Edit2,
  Folder,
  Layers,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { TicketContextMenu, type ContextMenuPosition } from "../board/TicketContextMenu";
import type { TicketRecord } from "../../lib/tickets/ticketService";
import { NewEpicModal } from "./NewEpicModal";
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

interface EpicDetailPageProps {
  epicId: string;
  tabId: string;
}

export function EpicDetailPage({ epicId, tabId }: EpicDetailPageProps) {
  const { epics, projects, selectProject, getEpicRollup } = useProject();
  const { tickets, workflowStates, subtaskProgress, openTicketDetail } = useTickets();
  const { closeTab, openCreateTab, switchToHome } = useTabs();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ ticket: TicketRecord; position: ContextMenuPosition } | null>(null);

  const epic = useMemo(() => epics.find((e) => e.id === epicId), [epics, epicId]);
  const project = useMemo(() => {
    if (!epic) return null;
    return projects.find((p) => p.id === epic.project_id) || null;
  }, [projects, epic]);

  const epicTickets = useMemo(() => {
    return tickets.filter((t) => t.epic_id === epicId);
  }, [tickets, epicId]);

  const rollup = useMemo(() => {
    return getEpicRollup(epicId);
  }, [getEpicRollup, epicId]);

  if (!epic) {
    return (
      <div style={{ padding: "var(--space-12)", textAlign: "center" }}>
        <Milestone size={40} color="var(--text-muted)" style={{ margin: "0 auto var(--space-4)" }} />
        <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Epic not found</h3>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
          This epic may have been removed or deleted.
        </p>
        <button className="btn-secondary" onClick={() => closeTab(tabId)}>
          Close Tab
        </button>
      </div>
    );
  }

  const total = rollup?.totalTickets || epicTickets.length;
  const completed = rollup?.completedTickets || 0;
  const progress = rollup?.progressPercentage || (total > 0 ? Math.round((completed / total) * 100) : 0);

  const handleProjectBreadcrumbClick = () => {
    if (project) {
      selectProject(project.id);
    }
    switchToHome();
  };

  const handleAddTicketToEpic = () => {
    openCreateTab();
  };

  return (
    <div
      data-testid="epic-detail-page"
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-app)",
        overflowY: "auto",
      }}
    >
      {/* Top Header Bar with Clickable Breadcrumbs */}
      <header
        style={{
          padding: "var(--space-3) var(--space-8)",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button
            className="btn-ghost"
            onClick={switchToHome}
            title="Return to Home board"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)" }}
          >
            <ArrowLeft size={14} />
            <span>Home</span>
          </button>

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)" }}>/</span>

          <button
            className="btn-ghost"
            onClick={handleProjectBreadcrumbClick}
            title={`Go to ${project ? project.name : "Project"}`}
            style={{
              padding: "2px 6px",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Folder size={12} color="var(--accent-blue)" />
            <span>{project ? project.name : "Project"}</span>
          </button>

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)" }}>/</span>

          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: epic.color,
                boxShadow: `0 0 6px ${epic.color}80`,
              }}
            />
            <span>{epic.title}</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            className="btn-secondary"
            onClick={() => setIsEditModalOpen(true)}
            style={{ height: "30px", fontSize: "var(--text-xs)", gap: "6px" }}
          >
            <Edit2 size={13} />
            <span>Edit Epic</span>
          </button>

          <button
            className="btn-ghost"
            onClick={() => closeTab(tabId)}
            title="Close epic tab"
            aria-label="Close epic tab"
            style={{ height: "30px", width: "30px" }}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Epic Content */}
      <div
        style={{
          flex: 1,
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-8)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Epic Hero Card */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-6)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: `${epic.color}20`,
                  color: epic.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Milestone size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
                    {epic.title}
                  </h1>
                  <span className={`status-badge ${epic.status}`}>
                    {epic.status.replace("_", " ")}
                  </span>
                </div>
                {project && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "4px 0 0" }}>
                    Initiative under <strong style={{ color: "var(--text-secondary)" }}>{project.name}</strong>
                  </p>
                )}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleAddTicketToEpic}
              style={{ height: "32px", fontSize: "var(--text-xs)", gap: "6px" }}
            >
              <Plus size={14} /> Add Ticket
            </button>
          </div>

          {epic.description && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-4)", lineHeight: 1.5 }}>
              {epic.description}
            </p>
          )}

          {/* Epic Meta and Progress */}
          <div
            style={{
              marginTop: "var(--space-6)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-6)",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {(epic.start_date || epic.target_date) && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                <Calendar size={13} />
                <span>
                  {epic.start_date || "Anytime"} → {epic.target_date || "No deadline"}
                </span>
              </div>
            )}

            <div style={{ flex: "1 1 300px", maxWidth: "400px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span>Completion Rollup</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {completed}/{total} tickets ({progress}%)
                </span>
              </div>
              <div className="progress-track" style={{ height: "6px" }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: epic.color,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tickets under Epic Section */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>
                Tickets in this Epic
              </h2>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {epicTickets.length} {epicTickets.length === 1 ? "ticket" : "tickets"}
              </span>
            </div>
          </div>

          {epicTickets.length === 0 ? (
            <div
              style={{
                padding: "var(--space-12)",
                textAlign: "center",
                backgroundColor: "var(--bg-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--border-subtle)",
              }}
            >
              <Layers size={36} color="var(--text-muted)" style={{ margin: "0 auto var(--space-3)" }} />
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                No tickets in this epic yet
              </h3>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  maxWidth: "360px",
                  margin: "0 auto var(--space-4)",
                }}
              >
                Add user stories, bugs, or engineering tasks to track progress toward this epic.
              </p>
              <button className="btn-primary" onClick={handleAddTicketToEpic}>
                <Plus size={14} /> Add First Ticket
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: "90px", fontWeight: 600, color: "var(--text-muted)" }}>ID</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)" }}>Title</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: "130px", fontWeight: 600, color: "var(--text-muted)" }}>State</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: "110px", fontWeight: 600, color: "var(--text-muted)" }}>Priority</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: "90px", fontWeight: 600, color: "var(--text-muted)" }}>Subtasks</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: "110px", fontWeight: 600, color: "var(--text-muted)" }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {epicTickets.map((ticket) => {
                    const state = workflowStates.find((s) => s.id === ticket.workflow_state_id);
                    const priorityInfo = PRIORITY_CONFIG[ticket.priority];
                    const PriorityIcon = priorityInfo.Icon;
                    const subtasks = subtaskProgress[ticket.id];

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => openTicketDetail(ticket.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ ticket, position: { x: e.clientX, y: e.clientY } });
                        }}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          transition: "background-color var(--transition-fast)",
                        }}
                        className="ticket-table-row"
                      >
                        <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-blue)" }}>
                          {ticket.identifier}
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--text-primary)" }}>
                          {ticket.title}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {state && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: state.color }} />
                              <span>{state.name}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: priorityInfo.color }}>
                            <PriorityIcon size={13} color={priorityInfo.color} />
                            <span>{priorityInfo.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {subtasks && subtasks.total > 0 ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckSquare size={12} />
                              {subtasks.completed}/{subtasks.total}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>
                          {ticket.due_date ? ticket.due_date : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <NewEpicModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          epicToEdit={epic}
        />
      )}

      {contextMenu && (
        <TicketContextMenu
          ticket={contextMenu.ticket}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
