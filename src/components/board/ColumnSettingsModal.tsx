import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { WorkflowStateRecord, WorkflowStateCategory } from "../../lib/tickets/workflowStateService";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CustomSelect } from "../ui/Select";

interface ColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stateToEdit?: WorkflowStateRecord | null;
}

const COLOR_SWATCHES = [
  { name: "Blue", hex: "#3B82F6" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Slate", hex: "#64748B" },
  { name: "Indigo", hex: "#6366F1" },
];

const CATEGORY_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Unstarted / Ready" },
  { value: "started", label: "Started / Active" },
  { value: "completed", label: "Completed / Shipped" },
  { value: "cancelled", label: "Cancelled" },
];

export function ColumnSettingsModal({ isOpen, onClose, stateToEdit }: ColumnSettingsModalProps) {
  useEscapeKey(isOpen, onClose);

  const { createWorkflowState, updateWorkflowState } = useTickets();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<WorkflowStateCategory>("unstarted");
  const [color, setColor] = useState("#3B82F6");
  const [wipLimit, setWipLimit] = useState<string>("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (stateToEdit) {
      setName(stateToEdit.name);
      setCategory(stateToEdit.category);
      setColor(stateToEdit.color);
      setWipLimit(stateToEdit.wip_limit !== null ? String(stateToEdit.wip_limit) : "");
    } else {
      setName("");
      setCategory("unstarted");
      setColor("#3B82F6");
      setWipLimit("");
    }
    setError("");
  }, [stateToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Column name is required");
      return;
    }
    if (trimmed.length > 50) {
      setError("Column name cannot exceed 50 characters");
      return;
    }

    const parsedWip = wipLimit.trim() ? parseInt(wipLimit, 10) : null;
    if (parsedWip !== null && (isNaN(parsedWip) || parsedWip < 1)) {
      setError("WIP limit must be an integer of 1 or greater");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (stateToEdit) {
        updateWorkflowState(stateToEdit.id, {
          name: trimmed,
          category,
          color,
          wipLimit: parsedWip,
        });
      } else {
        createWorkflowState({
          name: trimmed,
          category,
          color,
          wipLimit: parsedWip,
        });
      }

      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to save workflow state");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {stateToEdit ? "Edit Column" : "Add Workflow Column"}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="modal-error-alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="modal-field">
            <label className="modal-label">Column Name *</label>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. In Review, QA, Blocked"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
              required
            />
          </div>

          {/* Category */}
          <div className="modal-field">
            <label className="modal-label">Semantic Category</label>
            <CustomSelect
              fullWidth
              size="sm"
              value={category}
              onChange={(val) => setCategory(val as WorkflowStateCategory)}
              options={CATEGORY_OPTIONS}
            />
          </div>

          {/* Color Swatches */}
          <div className="modal-field">
            <label className="modal-label">Color</label>
            <div className="modal-swatches">
              {COLOR_SWATCHES.map((swatch) => {
                const isSelected = color === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    className={`modal-swatch ${isSelected ? "selected" : ""}`}
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.name}
                    aria-label={`Color ${swatch.name}`}
                  >
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* WIP Limit */}
          <div className="modal-field" style={{ marginBottom: "var(--space-6)" }}>
            <label className="modal-label">WIP Limit (optional)</label>
            <input
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 5 (leave blank for unlimited)"
              className="modal-input"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {stateToEdit ? "Save Changes" : "Create Column"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
