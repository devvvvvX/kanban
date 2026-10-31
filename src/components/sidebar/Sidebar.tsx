import React, { useState, useEffect } from "react";
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
  Plus,
  Search,
  Pin,
  Settings,
  CheckCircle2,
  Bookmark,
  SlidersHorizontal,
  Trash2,
  FileText,
  Archive,
  ListTodo,
  Flame,
} from "lucide-react";
import { useTabs } from "../../context/TabContext";
import { useFocus } from "../../context/FocusContext";
import { useProject } from "../../context/ProjectContext";
import { useQuery } from "../../context/QueryContext";
import { useTickets } from "../../context/TicketContext";
import { useTodos } from "../../context/TodoContext";
import { NewProjectModal } from "../projects/NewProjectModal";
import { WorkspaceSwitcher } from "../workspace/WorkspaceSwitcher";

interface SidebarProps {
  onOpenSettings?: () => void;
  onOpenMcpSettings?: () => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>> = {
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

export function Sidebar({ onOpenSettings, onOpenMcpSettings }: SidebarProps) {
  void onOpenMcpSettings;
  const { activeTab, openNotesTab, openTodosTab, openFocusTab, openArchivedTab, switchToHome } = useTabs();
  const { status: focusStatus, formattedTime } = useFocus();
  const { projects, pinnedProjects, activeProject, selectProject, setActiveView, activeView } = useProject();
  const { savedQueries, loadSavedQuery, activeSavedQueryId, deleteSavedQuery } = useQuery();
  const { tickets, archivedTickets } = useTickets();
  const { todayCount, totalActiveCount } = useTodos();
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Global keyboard shortcut: Cmd+Shift+N to create project
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProjectIcon = (iconName: string, color: string) => {
    const IconComp = ICON_MAP[iconName] || Folder;
    return <IconComp size={16} color={color} />;
  };

  return (
    <aside className="sidebar">
      {/* App Workspace Switcher Section */}
      <div style={{ padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border-subtle)" }}>
        <WorkspaceSwitcher />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-2) 0" }}>
        {/* Quick Nav */}
        <div style={{ marginBottom: "var(--space-3)" }}>
          <div
            className={`sidebar-item ${activeTab.type === "home" && !activeProject ? "active" : ""}`}
            onClick={() => {
              switchToHome();
              selectProject(null);
            }}
          >
            <Folder size={16} />
            <span>All Projects</span>
            <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {projects.length}
            </span>
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "home" && activeView === "list" && activeProject ? "active" : ""}`}
            onClick={() => {
              switchToHome();
              if (projects.length === 0) {
                setIsNewProjectModalOpen(true);
                return;
              }
              if (!activeProject) {
                selectProject(projects[0].id);
              }
              setActiveView("list");
            }}
            title={projects.length === 0 ? "Create a project to view tickets" : "View all tickets in list view"}
          >
            <CheckCircle2 size={16} />
            <span>All Tickets</span>
            {activeProject && (
              <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {tickets.length}
              </span>
            )}
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "home" && activeView === "query" && !activeSavedQueryId ? "active" : ""}`}
            onClick={() => {
              switchToHome();
              if (!activeProject && projects.length > 0) {
                selectProject(projects[0].id);
              }
              setActiveView("query");
            }}
          >
            <SlidersHorizontal size={16} />
            <span>Visual Query</span>
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "notes" ? "active" : ""}`}
            onClick={() => openNotesTab()}
            data-testid="sidebar-notepad-link"
            title="Open Scratchpad / Notepad & Whiteboard Canvas"
          >
            <FileText size={16} />
            <span>Notepad &amp; Canvas</span>
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "todos" ? "active" : ""}`}
            onClick={() => openTodosTab()}
            data-testid="sidebar-todos-link"
            title="Daily, Weekly & Cadence Todos & Thoughts"
          >
            <ListTodo size={16} />
            <span>Todos</span>
            {totalActiveCount > 0 && (
              <span
                data-testid="sidebar-todos-count"
                style={{
                  marginLeft: "auto",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg-surface-active)",
                }}
              >
                {todayCount > 0 ? todayCount : totalActiveCount}
              </span>
            )}
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "focus" ? "active" : ""}`}
            onClick={() => openFocusTab()}
            data-testid="sidebar-focus-link"
            title="Focus Timer & Distraction-Free Deep Work"
          >
            <Flame size={16} color="var(--accent-blue)" />
            <span>Focus Timer</span>
            {focusStatus === "running" && (
              <span
                data-testid="sidebar-focus-countdown"
                style={{
                  marginLeft: "auto",
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-blue)",
                  fontWeight: 600,
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                }}
              >
                {formattedTime}
              </span>
            )}
          </div>

          <div
            className={`sidebar-item ${activeTab.type === "archived" ? "active" : ""}`}
            onClick={() => openArchivedTab()}
            data-testid="sidebar-archived-tickets-link"
            title="View Archived Tickets (Full Page)"
          >
            <Archive size={16} />
            <span>Archived Tickets</span>
            {archivedTickets.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg-surface-active)",
                }}
              >
                {archivedTickets.length}
              </span>
            )}
          </div>
        </div>

        {/* Saved Views / Saved Queries */}
        {savedQueries.length > 0 && (
          <div style={{ marginBottom: "var(--space-3)" }}>
            <div className="sidebar-section-header">
              <span>Saved Views</span>
              <Bookmark size={12} />
            </div>
            {savedQueries.map((sq) => {
              const isSelected = activeSavedQueryId === sq.id;
              return (
                <div
                  key={sq.id}
                  className={`sidebar-item ${activeTab.type === "home" && isSelected ? "active" : ""}`}
                  onClick={() => {
                    switchToHome();
                    if (sq.project_id && activeProject?.id !== sq.project_id) {
                      selectProject(sq.project_id);
                    }
                    loadSavedQuery(sq);
                    setActiveView("query");
                  }}
                  title={sq.name}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: sq.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sq.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedQuery(sq.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--accent-red)";
                      e.currentTarget.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                      e.currentTarget.style.opacity = "0.5";
                    }}
                    title="Delete saved view"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pinned Projects */}
        {pinnedProjects.length > 0 && (
          <div style={{ marginBottom: "var(--space-3)" }}>
            <div className="sidebar-section-header">
              <span>Pinned</span>
              <Pin size={12} />
            </div>
            {pinnedProjects.map((proj) => {
              const isActive = activeProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  className={`sidebar-item ${activeTab.type === "home" && isActive ? "active" : ""}`}
                  onClick={() => {
                    switchToHome();
                    selectProject(proj.id);
                  }}
                  title={proj.name}
                >
                  <span className="project-dot" style={{ backgroundColor: proj.color }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {proj.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Projects Section with Inline Search & Add */}
        <div style={{ marginBottom: "var(--space-3)" }}>
          <div className="sidebar-section-header">
            <span>Projects</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                className="btn-ghost"
                style={{ width: "22px", height: "22px" }}
                onClick={() => setIsNewProjectModalOpen(true)}
                title="New Project (Cmd+Shift+N)"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Search box if more than 3 projects */}
          {projects.length > 3 && (
            <div style={{ padding: "0 var(--space-3) var(--space-2)" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} style={{ position: "absolute", left: "8px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    height: "26px",
                    paddingLeft: "26px",
                    paddingRight: "8px",
                    fontSize: "var(--text-xs)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>
          )}

          {filteredProjects.length === 0 ? (
            <div style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {projects.length === 0 ? (
                <button
                  className="btn-secondary"
                  style={{ width: "100%", height: "30px", fontSize: "var(--text-xs)", gap: "4px" }}
                  onClick={() => setIsNewProjectModalOpen(true)}
                >
                  <Plus size={13} /> Create Project
                </button>
              ) : (
                "No matching projects"
              )}
            </div>
          ) : (
            filteredProjects.map((proj) => {
              const isActive = activeProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  className={`sidebar-item ${activeTab.type === "home" && isActive ? "active" : ""}`}
                  onClick={() => {
                    switchToHome();
                    selectProject(proj.id);
                  }}
                  title={proj.name}
                >
                  {renderProjectIcon(proj.icon, proj.color)}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {proj.name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer / Settings */}
      <div style={{ padding: "var(--space-2) var(--space-3)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "2px" }}>
        <div
          className="sidebar-item"
          onClick={onOpenSettings}
          data-testid="sidebar-settings-link"
          title="Preferences & Settings"
        >
          <Settings size={16} />
          <span>Settings</span>
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />
    </aside>
  );
}
