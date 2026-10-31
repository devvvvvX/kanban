import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import type { EpicRecord, EpicStatus } from "../../lib/projects/epicService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface NewEpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  epicToEdit?: EpicRecord | null;
}

const COLOR_SWATCHES = [
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Slate", hex: "#64748B" },
];

export function NewEpicModal({ isOpen, onClose, epicToEdit }: NewEpicModalProps) {
  useEscapeKey(isOpen, onClose);

  const { createEpic, updateEpic } = useProject();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [status, setStatus] = useState<EpicStatus>("planned");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (epicToEdit) {
      setTitle(epicToEdit.title);
      setDescription(epicToEdit.description || "");
      setColor(epicToEdit.color);
      setStatus(epicToEdit.status);
      setStartDate(epicToEdit.start_date || "");
      setTargetDate(epicToEdit.target_date || "");
    } else {
      setTitle("");
      setDescription("");
      setColor("#8B5CF6");
      setStatus("planned");
      setStartDate("");
      setTargetDate("");
    }
    setError("");
  }, [epicToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Epic title is required.");
      return;
    }
    if (trimmed.length > 150) {
      setError("Epic title cannot exceed 150 characters.");
      return;
    }

    if (startDate && targetDate) {
      const start = new Date(startDate).getTime();
      const target = new Date(targetDate).getTime();
      if (!isNaN(start) && !isNaN(target) && start > target) {
        setError("Start date cannot be after target completion date.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (epicToEdit) {
        updateEpic(epicToEdit.id, {
          title: trimmed,
          description: description.trim() || null,
          color,
          status,
          startDate: startDate || null,
          targetDate: targetDate || null,
        });
      } else {
        createEpic({
          title: trimmed,
          description: description.trim() || undefined,
          color,
          status,
          startDate: startDate || undefined,
          targetDate: targetDate || undefined,
        });
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to save epic.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
            {epicToEdit ? "Edit Epic" : "Create New Epic"}
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
          {/* Title */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              Epic Title *
            </label>
            <input
              type="text"
              data-testid="epic-title-input"
              className="input-text"
              placeholder="e.g. Authentication & Recovery Flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={150}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              Description (Markdown)
            </label>
            <textarea
              className="input-text"
              style={{ height: "64px", paddingTop: "var(--space-2)", resize: "none" }}
              placeholder="Scope, user story, or acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Status & Color */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                Status
              </label>
              <select
                className="input-text"
                value={status}
                onChange={(e) => setStatus(e.target.value as EpicStatus)}
                style={{ cursor: "pointer" }}
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                Accent Color
              </label>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", height: "36px" }}>
                {COLOR_SWATCHES.map((swatch) => {
                  const isSelected = color === swatch.hex;
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setColor(swatch.hex)}
                      style={{
                        width: "18px",
                        height: "18px",
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
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                Start Date
              </label>
              <input
                type="date"
                className="input-text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                Target Date
              </label>
              <input
                type="date"
                className="input-text"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" data-testid="epic-submit-btn" className="btn-primary" disabled={isSubmitting}>
              {epicToEdit ? "Save Changes" : "Create Epic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
