import React, { useState } from "react";
import {
  Folder,
  Layout,
  Terminal,
  Cpu,
  Target,
  Book,
  Zap,
  Code,
  Layers,
  CheckSquare,
  Pin,
  Edit2,
  Trash2,
  Archive,
  BarChart2,
  Kanban,
  List,
  Milestone,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { useProject, type ProjectViewTab } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { NewProjectModal } from "./NewProjectModal";
import { useEscapeKey } from "../../hooks/useEscapeKey";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  folder: Folder,
  layout: Layout,
  terminal: Terminal,
  cpu: Cpu,
  target: Target,
  book: Book,
  zap: Zap,
  code: Code,
  layers: Layers,
  "check-square": CheckSquare,
};

export function ProjectHeader() {
  const { activeProject, activeView, setActiveView, togglePin, archiveProject, deleteProject } = useProject();
  const { openArchivedModal } = useTickets();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEscapeKey(showDeleteConfirm, () => setShowDeleteConfirm(false));

  if (!activeProject) return null;

  const IconComp = ICON_MAP[activeProject.icon] || Folder;
  const isPinned = activeProject.is_pinned === 1;

  const tabs: Array<{ id: ProjectViewTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "board", label: "Board", icon: Kanban },
    { id: "list", label: "List", icon: List },
    { id: "epics", label: "Epics", icon: Milestone },
    { id: "query", label: "Query", icon: SlidersHorizontal },
  ];

  const handleDelete = () => {
    deleteProject(activeProject.id);
    setShowDeleteConfirm(false);
  };

  return (
    <header className="project-header">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Project Info */}
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-lg)",
              backgroundColor: `${activeProject.color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: activeProject.color,
            }}
          >
            <IconComp size={22} color={activeProject.color} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, letterSpacing: "-0.01em" }}>
                {activeProject.name}
              </h1>
              {isPinned && (
                <span
                  title="Pinned to sidebar"
                  style={{ color: "var(--accent-blue)", display: "flex", alignItems: "center" }}
                >
                  <Pin size={14} />
                </span>
              )}
            </div>
            {activeProject.description && (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "2px" }}>
                {activeProject.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            className="btn-secondary"
            style={{ height: "32px", padding: "0 10px", fontSize: "var(--text-xs)", gap: "6px" }}
            onClick={() => togglePin(activeProject.id)}
            title={isPinned ? "Unpin project" : "Pin project"}
          >
            <Pin size={13} style={{ transform: isPinned ? "rotate(45deg)" : "none" }} />
            <span>{isPinned ? "Pinned" : "Pin"}</span>
          </button>

          <button
            className="btn-ghost"
            style={{ height: "32px", width: "32px" }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Project actions"
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "38px",
                right: 0,
                width: "180px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                padding: "4px",
                zIndex: 100,
              }}
              onMouseLeave={() => setIsMenuOpen(false)}
            >
              <button
                className="sidebar-item"
                style={{ width: "100%", margin: 0, padding: "6px 10px", border: "none", background: "transparent" }}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsEditModalOpen(true);
                }}
              >
                <Edit2 size={14} />
                <span>Edit Project</span>
              </button>

              <button
                className="sidebar-item"
                style={{ width: "100%", margin: 0, padding: "6px 10px", border: "none", background: "transparent" }}
                onClick={() => {
                  setIsMenuOpen(false);
                  openArchivedModal();
                }}
                data-testid="project-header-archived-tickets-btn"
              >
                <Archive size={14} />
                <span>Archived Tickets</span>
              </button>

              <button
                className="sidebar-item"
                style={{ width: "100%", margin: 0, padding: "6px 10px", border: "none", background: "transparent" }}
                onClick={() => {
                  setIsMenuOpen(false);
                  archiveProject(activeProject.id);
                }}
              >
                <Archive size={14} />
                <span>Archive Project</span>
              </button>

              <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "4px 0" }} />

              <button
                className="sidebar-item"
                style={{ width: "100%", margin: 0, padding: "6px 10px", border: "none", background: "transparent", color: "var(--color-danger)" }}
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 size={14} />
                <span>Delete Project</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <nav className="view-tabs">
        {tabs.map(({ id, label, icon: TabIcon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              className={`view-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveView(id)}
            >
              <TabIcon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Edit Project Modal */}
      <NewProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectToEdit={activeProject}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-danger)", marginBottom: "var(--space-2)" }}>
              Delete Project
            </h3>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
              Are you sure you want to delete <strong>{activeProject.name}</strong> and all associated epics? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                onClick={handleDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
