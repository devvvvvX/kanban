import { useState, useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { WorkflowStateRecord } from "../../lib/tickets/workflowStateService";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CustomSelect } from "../ui/Select";

interface SafeStateDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  stateToDelete: WorkflowStateRecord | null;
}

export function SafeStateDeleteModal({ isOpen, onClose, stateToDelete }: SafeStateDeleteModalProps) {
  useEscapeKey(Boolean(isOpen && stateToDelete), onClose);

  const { workflowStates, ticketsByState, deleteWorkflowState } = useTickets();

  const [targetStateId, setTargetStateId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableDestinations = useMemo(() => {
    if (!stateToDelete) return [];
    return workflowStates.filter((s) => s.id !== stateToDelete.id);
  }, [workflowStates, stateToDelete]);

  const destinationOptions = useMemo(() => {
    return [
      { value: "", label: "Select destination column..." },
      ...availableDestinations.map((dest) => ({
        value: dest.id,
        label: `${dest.name} (${dest.category})`,
        color: dest.color,
      })),
    ];
  }, [availableDestinations]);

  if (!isOpen || !stateToDelete) return null;

  const ticketsInState = ticketsByState[stateToDelete.id] || [];
  const ticketCount = ticketsInState.length;

  const handleDelete = () => {
    if (availableDestinations.length === 0) {
      setError("Cannot delete the only workflow state in a project.");
      return;
    }

    if (ticketCount > 0 && !targetStateId) {
      setError("Please select a destination column for the existing tickets.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      deleteWorkflowState(stateToDelete.id, ticketCount > 0 ? targetStateId : undefined);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to delete workflow state");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <AlertTriangle size={20} color="var(--color-danger)" />
            <h3 className="modal-title modal-title-danger">Delete Column</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="modal-error-alert">
            <span>{error}</span>
          </div>
        )}

        {ticketCount > 0 ? (
          <div>
            <p className="modal-body-text">
              Delete Workflow Column: This stage contains {ticketCount} tickets. Select a destination column to migrate these tickets before removing.
            </p>

            <div className="modal-field">
              <label className="modal-label">Migrate Tickets To *</label>
              <CustomSelect
                fullWidth
                size="sm"
                value={targetStateId}
                onChange={(val) => setTargetStateId(val)}
                options={destinationOptions}
                placeholder="Select destination column..."
              />
            </div>
          </div>
        ) : (
          <p className="modal-body-text">
            Are you sure you want to delete column <strong>{stateToDelete.name}</strong>? This action cannot be undone.
          </p>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleDelete}
            disabled={isSubmitting || (ticketCount > 0 && !targetStateId)}
          >
            {ticketCount > 0 ? "Migrate & Delete Column" : "Delete Column"}
          </button>
        </div>
      </div>
    </div>
  );
}
