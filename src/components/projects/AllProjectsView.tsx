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
  Plus,
  Pin,
  ArrowRight,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { NewProjectModal } from "./NewProjectModal";

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

export function AllProjectsView() {
  const { projects, selectProject, togglePin } = useProject();
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  return (
    <div style={{ padding: "var(--space-8)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Projects</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "2px" }}>
            All active workspaces and development roadmaps
          </p>
        </div>

        <button
          className="btn-primary"
          style={{ height: "34px", fontSize: "var(--text-sm)", gap: "6px" }}
          onClick={() => setIsNewProjectModalOpen(true)}
        >
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div
          style={{
            padding: "var(--space-16) var(--space-8)",
            textAlign: "center",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-xl)",
            border: "1px dashed var(--border-subtle)",
            maxWidth: "600px",
            margin: "var(--space-8) auto",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "var(--radius-xl)",
              backgroundColor: "var(--accent-blue-subtle)",
              color: "var(--accent-blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-4)",
            }}
          >
            <Folder size={28} />
          </div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>No Projects Created Yet</h2>
          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-secondary)",
              maxWidth: "420px",
              margin: "var(--space-2) auto var(--space-6)",
            }}
          >
            Create your first project to organize engineering work, interview prep, or roadmaps.
          </p>
          <button
            className="btn-primary"
            style={{ height: "38px", padding: "0 var(--space-6)" }}
            onClick={() => setIsNewProjectModalOpen(true)}
          >
            <Plus size={16} /> Create Project
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {projects.map((proj) => {
            const IconComp = ICON_MAP[proj.icon] || Folder;
            const isPinned = proj.is_pinned === 1;

            return (
              <div
                key={proj.id}
                className="epic-card"
                style={{ cursor: "pointer" }}
                onClick={() => selectProject(proj.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: `${proj.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconComp size={18} color={proj.color} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{proj.name}</h3>
                    </div>
                  </div>

                  <button
                    className="btn-ghost"
                    style={{ width: "24px", height: "24px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(proj.id);
                    }}
                    title={isPinned ? "Unpin project" : "Pin project"}
                  >
                    <Pin size={13} style={{ color: isPinned ? "var(--accent-blue)" : "var(--text-muted)" }} />
                  </button>
                </div>

                {proj.description && (
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      lineClamp: 2,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {proj.description}
                  </p>
                )}

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "var(--space-2)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "var(--text-xs)",
                    color: "var(--accent-blue)",
                    fontWeight: 500,
                  }}
                >
                  <span>Open workspace</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />
    </div>
  );
}
