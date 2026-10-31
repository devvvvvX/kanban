import React, { useState, useEffect } from "react";
import { Folder, Layout, Terminal, Cpu, Target, Book, Zap, Code, Layers, CheckSquare, X } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import type { ProjectRecord } from "../../lib/projects/projectService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: ProjectRecord | null;
}

const COLOR_SWATCHES = [
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Slate", hex: "#64748B" },
];

const ICONS = [
  { id: "folder", label: "Folder", Icon: Folder },
  { id: "layout", label: "Layout", Icon: Layout },
  { id: "terminal", label: "Terminal", Icon: Terminal },
  { id: "cpu", label: "System", Icon: Cpu },
  { id: "target", label: "Target", Icon: Target },
  { id: "book", label: "Roadmap", Icon: Book },
  { id: "zap", label: "Fast", Icon: Zap },
  { id: "code", label: "Engineering", Icon: Code },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "check-square", label: "Tasks", Icon: CheckSquare },
];

export function NewProjectModal({ isOpen, onClose, projectToEdit }: NewProjectModalProps) {
  useEscapeKey(isOpen, onClose);

  const { createProject, updateProject } = useProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState("folder");
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description || "");
      setColor(projectToEdit.color);
      setIcon(projectToEdit.icon);
      setIsPinned(projectToEdit.is_pinned === 1);
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
      setIcon("folder");
      setIsPinned(false);
    }
    setError("");
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Project name cannot exceed 100 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (projectToEdit) {
        updateProject(projectToEdit.id, {
          name: trimmed,
          description: description.trim() || null,
          color,
          icon,
          isPinned,
        });
      } else {
        createProject({
          name: trimmed,
          description: description.trim() || undefined,
          color,
          icon,
          isPinned,
        });
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to save project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
            {projectToEdit ? "Edit Project" : "Create New Project"}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: "var(--space-2) var(--space-3)",
            marginBottom: "var(--space-4)",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
            border: "1px solid var(--color-danger)",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              Project Name *
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Distributed KV Store, Interview Prep"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              Description
            </label>
            <textarea
              className="input-text"
              style={{ height: "64px", paddingTop: "var(--space-2)", resize: "none" }}
              placeholder="Brief description or goals of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Color Swatches */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
              Accent Color
            </label>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              {COLOR_SWATCHES.map((swatch) => {
                const isSelected = color === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor: swatch.hex,
                      border: isSelected ? "2px solid #FFFFFF" : "1px solid rgba(0,0,0,0.2)",
                      outline: isSelected ? `2px solid ${swatch.hex}` : "none",
                      outlineOffset: "2px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title={swatch.name}
                  />
                );
              })}
            </div>
          </div>

          {/* Icon Selector */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
              Icon
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-2)" }}>
              {ICONS.map(({ id, Icon }) => {
                const isSelected = icon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIcon(id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "36px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: isSelected ? "var(--accent-blue-subtle)" : "var(--bg-surface)",
                      border: isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                      color: isSelected ? "var(--accent-blue)" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pin to Sidebar */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
            <input
              type="checkbox"
              id="pin-project"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <label htmlFor="pin-project" style={{ fontSize: "var(--text-base)", color: "var(--text-primary)", cursor: "pointer" }}>
              Pin project to top of sidebar
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {projectToEdit ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
