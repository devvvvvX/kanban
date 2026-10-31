import React, { useState, useRef, useEffect } from "react";
import {
  Briefcase,
  Laptop,
  Book,
  Layers,
  Zap,
  Coffee,
  Terminal,
  Folder,
  ChevronsUpDown,
  Check,
  Plus,
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { NewWorkspaceModal } from "./NewWorkspaceModal";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  briefcase: Briefcase,
  laptop: Laptop,
  folder: Folder,
  book: Book,
  layers: Layers,
  zap: Zap,
  coffee: Coffee,
  terminal: Terminal,
};

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const CurrentIcon = activeWorkspace && ICON_MAP[activeWorkspace.icon] ? ICON_MAP[activeWorkspace.icon] : Briefcase;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        data-testid="workspace-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          backgroundColor: isOpen ? "var(--bg-active)" : "var(--bg-card)",
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "5px",
              backgroundColor: `${activeWorkspace?.color || "#3B82F6"}25`,
              color: activeWorkspace?.color || "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CurrentIcon size={13} />
          </div>
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeWorkspace?.name || "Workspace"}
          </span>
        </div>
        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "var(--space-1)" }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="workspace-dropdown-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            padding: "var(--space-1) 0",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "var(--space-2) var(--space-3) var(--space-1)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Workspaces
          </div>

          {workspaces.map((ws) => {
            const ItemIcon = ICON_MAP[ws.icon] || Briefcase;
            const isSelected = activeWorkspace?.id === ws.id;
            return (
              <button
                key={ws.id}
                type="button"
                data-testid={`workspace-item-${ws.id}`}
                onClick={() => {
                  selectWorkspace(ws.id);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  backgroundColor: isSelected ? "var(--bg-hover)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-sm)",
                  transition: "background-color 0.1s ease",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "4px",
                    backgroundColor: `${ws.color}25`,
                    color: ws.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ItemIcon size={11} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {ws.name}
                  </span>
                  {ws.is_default === 1 && (
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        backgroundColor: "var(--bg-subtle)",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>
                {isSelected && <Check size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}

          <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "var(--space-1) 0" }} />

          <button
            type="button"
            data-testid="new-workspace-btn"
            onClick={() => {
              setIsOpen(false);
              setIsModalOpen(true);
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              color: "var(--color-primary)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
            }}
          >
            <Plus size={14} />
            <span>Create Workspace</span>
          </button>
        </div>
      )}

      {/* New Workspace Modal */}
      <NewWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
