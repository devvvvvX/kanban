import React, { useState, useEffect } from "react";
import { Briefcase, Laptop, Book, Layers, Zap, Coffee, Terminal, X, Folder } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_SWATCHES = [
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Cyan", hex: "#06B6D4" },
];

const ICONS = [
  { id: "briefcase", label: "Work", Icon: Briefcase },
  { id: "laptop", label: "Tech", Icon: Laptop },
  { id: "folder", label: "General", Icon: Folder },
  { id: "book", label: "Study", Icon: Book },
  { id: "layers", label: "Projects", Icon: Layers },
  { id: "zap", label: "Sprint", Icon: Zap },
  { id: "coffee", label: "Personal", Icon: Coffee },
  { id: "terminal", label: "Dev", Icon: Terminal },
];

export function NewWorkspaceModal({ isOpen, onClose }: NewWorkspaceModalProps) {
  useEscapeKey(isOpen, onClose);

  const { createWorkspace } = useWorkspace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState("briefcase");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setColor("#3B82F6");
      setIcon("briefcase");
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Workspace name cannot exceed 100 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      createWorkspace({
        name: trimmed,
        description: description.trim() || undefined,
        color,
        icon,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create workspace.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-md)",
                backgroundColor: `${color}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: color,
              }}
            >
              <Briefcase size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>
                Create Workspace
              </h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
                Organize distinct projects, workflows, and epics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {error && (
            <div
              style={{
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid var(--color-error)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-error)",
                fontSize: "var(--text-xs)",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Workspace Name *
            </label>
            <input
              type="text"
              data-testid="workspace-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Engineering, Open Source"
              autoFocus
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-app)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              rows={2}
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-app)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Color Selection */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-2)",
              }}
            >
              Theme Color
            </label>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setColor(swatch.hex)}
                  title={swatch.name}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    backgroundColor: swatch.hex,
                    border: color === swatch.hex ? "2px solid #fff" : "2px solid transparent",
                    boxShadow: color === swatch.hex ? `0 0 0 2px ${swatch.hex}` : "none",
                    cursor: "pointer",
                    padding: 0,
                    outline: "none",
                    transition: "transform 0.15s ease",
                    transform: color === swatch.hex ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-2)",
              }}
            >
              Icon
            </label>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {ICONS.map((item) => {
                const ItemIcon = item.Icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    title={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 34,
                      height: 34,
                      borderRadius: "var(--radius-md)",
                      backgroundColor: isSelected ? "var(--bg-active)" : "var(--bg-app)",
                      border: isSelected ? `1px solid ${color}` : "1px solid var(--border-default)",
                      color: isSelected ? color : "var(--text-secondary)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <ItemIcon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-2)",
              marginTop: "var(--space-2)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="create-workspace-submit-btn"
              disabled={isSubmitting}
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: color,
                color: "#ffffff",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
