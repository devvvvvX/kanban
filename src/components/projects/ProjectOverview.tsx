import { useState } from "react";
import { CheckCircle2, Clock, ListTodo, Milestone, Plus, ArrowRight, Kanban } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { NewEpicModal } from "../epics/NewEpicModal";

export function ProjectOverview() {
  const { activeProject, metrics, epics, setActiveView } = useProject();
  const { setListFilterCategory } = useTickets();
  const { openEpicTab } = useTabs();
  const [isNewEpicModalOpen, setIsNewEpicModalOpen] = useState(false);

  if (!activeProject) return null;

  const totalTickets = metrics?.totalTickets || 0;
  const openTickets = metrics?.openTickets || 0;
  const inProgressTickets = metrics?.inProgressTickets || 0;
  const completedTickets = metrics?.completedTickets || 0;
  const totalEpics = metrics?.totalEpics || epics.length;
  const completionRate = metrics?.completionRate || 0;

  return (
    <div style={{ padding: "var(--space-8)" }}>
      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-completion"
          onClick={() => setActiveView("board")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveView("board");
            }
          }}
          title="Open Kanban Board"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">Completion</span>
            <CheckCircle2 size={16} color="var(--color-success)" />
          </div>
          <div className="metric-card-value">{completionRate}%</div>
          <div className="progress-track" style={{ marginTop: "var(--space-2)" }}>
            <div
              className="progress-fill"
              style={{ width: `${completionRate}%`, backgroundColor: "var(--color-success)" }}
            />
          </div>
        </div>

        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-total-tickets"
          onClick={() => {
            setListFilterCategory("all");
            setActiveView("list");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setListFilterCategory("all");
              setActiveView("list");
            }
          }}
          title="View all tickets in List view"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">Total Tickets</span>
            <ListTodo size={16} color="var(--accent-blue)" />
          </div>
          <div className="metric-card-value">{totalTickets}</div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Click to view all in list
          </span>
        </div>

        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-in-progress"
          onClick={() => {
            setListFilterCategory("in_progress");
            setActiveView("list");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setListFilterCategory("in_progress");
              setActiveView("list");
            }
          }}
          title="View In Progress tickets in List view"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">In Progress</span>
            <Clock size={16} color="var(--color-warning)" />
          </div>
          <div className="metric-card-value">{inProgressTickets}</div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Click to view active tasks
          </span>
        </div>

        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-open"
          onClick={() => {
            setListFilterCategory("open");
            setActiveView("list");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setListFilterCategory("open");
              setActiveView("list");
            }
          }}
          title="View Open tickets in List view"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">Open</span>
            <ListTodo size={16} color="var(--text-secondary)" />
          </div>
          <div className="metric-card-value">{openTickets}</div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Click to view open tickets
          </span>
        </div>

        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-completed"
          onClick={() => {
            setListFilterCategory("completed");
            setActiveView("list");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setListFilterCategory("completed");
              setActiveView("list");
            }
          }}
          title="View Completed tickets in List view"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">Completed</span>
            <CheckCircle2 size={16} color="var(--color-success)" />
          </div>
          <div className="metric-card-value">{completedTickets}</div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Click to view shipped tasks
          </span>
        </div>

        <div
          className="metric-card clickable"
          role="button"
          tabIndex={0}
          data-testid="metric-card-epics"
          onClick={() => setActiveView("epics")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveView("epics");
            }
          }}
          title="View All Epics"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-card-title">Epics</span>
            <Milestone size={16} color="#8B5CF6" />
          </div>
          <div className="metric-card-value">{totalEpics}</div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Click to manage initiatives
          </span>
        </div>
      </div>

      {/* Epics Quick Section */}
      <div style={{ marginTop: "var(--space-8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Feature Epics</h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              High-level milestones and initiatives for {activeProject.name}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              className="btn-secondary"
              style={{ height: "32px", fontSize: "var(--text-xs)", gap: "4px" }}
              onClick={() => setActiveView("epics")}
            >
              <span>View All Epics</span>
              <ArrowRight size={13} />
            </button>
            <button
              className="btn-primary"
              style={{ height: "32px", fontSize: "var(--text-xs)", gap: "4px" }}
              onClick={() => setIsNewEpicModalOpen(true)}
            >
              <Plus size={14} />
              <span>New Epic</span>
            </button>
          </div>
        </div>

        {epics.length === 0 ? (
          <div
            style={{
              padding: "var(--space-8)",
              textAlign: "center",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px dashed var(--border-subtle)",
            }}
          >
            <Milestone size={32} color="var(--text-muted)" style={{ margin: "0 auto var(--space-2)" }} />
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>No Epics in this Project</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "360px", margin: "var(--space-1) auto var(--space-4)" }}>
              Break your project into major milestones or feature epics with progress rollups.
            </p>
            <button
              className="btn-primary"
              style={{ height: "32px", fontSize: "var(--text-xs)" }}
              onClick={() => setIsNewEpicModalOpen(true)}
            >
              <Plus size={14} /> Create First Epic
            </button>
          </div>
        ) : (
          <div className="epic-grid">
            {epics.slice(0, 4).map((epic) => (
              <div
                key={epic.id}
                className="epic-card"
                role="button"
                tabIndex={0}
                data-testid={`epic-card-${epic.id}`}
                onClick={() => openEpicTab(epic.id, epic.title)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEpicTab(epic.id, epic.title);
                  }
                }}
                title={`Open Epic: ${epic.title}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span className="project-dot" style={{ backgroundColor: epic.color, width: "10px", height: "10px" }} />
                    <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{epic.title}</span>
                  </div>
                  <span className={`status-badge ${epic.status}`}>{epic.status.replace("_", " ")}</span>
                </div>

                {epic.description && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineClamp: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {epic.description}
                  </p>
                )}

                <div style={{ marginTop: "auto", paddingTop: "var(--space-2)" }}>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: epic.status === "completed" ? "100%" : epic.status === "in_progress" ? "50%" : "0%",
                        backgroundColor: epic.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Launch Board banner */}
      <div
        style={{
          marginTop: "var(--space-8)",
          padding: "var(--space-6)",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <Kanban size={18} color="var(--accent-blue)" />
            <span>Interactive Kanban Board</span>
          </h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "4px" }}>
            Organize tickets into Backlog, Todo, In Progress, and Done columns with custom drag and drop.
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ height: "34px", fontSize: "var(--text-xs)", gap: "6px" }}
          onClick={() => setActiveView("board")}
        >
          <span>Open Kanban Board</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <NewEpicModal
        isOpen={isNewEpicModalOpen}
        onClose={() => setIsNewEpicModalOpen(false)}
      />
    </div>
  );
}
