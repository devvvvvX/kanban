import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import type { TicketPriority } from "../../lib/tickets/ticketService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function QuickCreateModal() {
  const { activeProject, selectProject, projects, epics } = useProject();
  const {
    isQuickCreateOpen,
    quickCreateStateId,
    openQuickCreate,
    closeQuickCreate,
    createTicket,
    openTicketDetail,
    workflowStates,
  } = useTickets();

  useEscapeKey(isQuickCreateOpen, closeQuickCreate);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workflowStateId, setWorkflowStateId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("none");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first project if modal opens and no project was active
  useEffect(() => {
    if (isQuickCreateOpen && !activeProject && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [isQuickCreateOpen, activeProject, projects, selectProject]);

  // Global Cmd+N shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (!activeProject && projects.length > 0) {
          selectProject(projects[0].id);
        }
        openQuickCreate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProject, projects, selectProject, openQuickCreate]);

  // Reset form when modal opens
  useEffect(() => {
    if (isQuickCreateOpen) {
      setTitle("");
      setDescription("");
      setEpicId("");
      setPriority("none");
      setDueDate("");
      setEstimate("");
      setLabels([]);
      setLabelInput("");
      setShowDetails(false);
      setError("");

      if (quickCreateStateId) {
        setWorkflowStateId(quickCreateStateId);
      } else if (workflowStates.length > 0) {
        const todo = workflowStates.find((ws) => ws.category === "unstarted");
        setWorkflowStateId(todo ? todo.id : workflowStates[0].id);
      }

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isQuickCreateOpen, quickCreateStateId, workflowStates]);

  const stateOptions = useMemo(() => {
    return workflowStates.map((ws) => ({
      value: ws.id,
      label: ws.name,
      color: ws.color,
      icon: <StatusIcon category={ws.category} color={ws.color} size={13} />,
    }));
  }, [workflowStates]);

  const priorityOptions = useMemo(() => {
    return [
      { value: "none", label: "None", color: "#9CA3AF", icon: <PriorityIcon priority="none" size={13} /> },
      { value: "low", label: "Low", color: "#64748B", icon: <PriorityIcon priority="low" size={13} /> },
      { value: "medium", label: "Medium", color: "#3B82F6", icon: <PriorityIcon priority="medium" size={13} /> },
      { value: "high", label: "High", color: "#F59E0B", icon: <PriorityIcon priority="high" size={13} /> },
      { value: "urgent", label: "Urgent", color: "#EF4444", icon: <PriorityIcon priority="urgent" size={13} /> },
    ];
  }, []);

  const epicOptions = useMemo(() => {
    return [
      { value: "", label: "No Epic" },
      ...epics.map((ep) => ({
        value: ep.id,
        label: ep.title,
        color: ep.color,
      })),
    ];
  }, [epics]);

  const currentProject = activeProject || (projects.length > 0 ? projects[0] : null);
  if (!isQuickCreateOpen || !currentProject) return null;

  const handleAddLabel = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = labelInput.trim().replace(/,/g, "");
      if (trimmed && !labels.includes(trimmed)) {
        setLabels([...labels, trimmed]);
        setLabelInput("");
      }
    }
  };

  const removeLabel = (tagToRemove: string) => {
    setLabels(labels.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (openDetailAfter: boolean = false) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      setError("Ticket title is required. Enter between 1 and 200 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const parsedEstimate = estimate.trim() ? parseInt(estimate, 10) : null;
      const created = createTicket({
        title: trimmedTitle,
        description: description.trim() || undefined,
        workflowStateId: workflowStateId || undefined,
        epicId: epicId || null,
        priority,
        labels,
        dueDate: dueDate || null,
        estimate: parsedEstimate !== null && !isNaN(parsedEstimate) ? parsedEstimate : null,
      });

      closeQuickCreate();

      if (openDetailAfter) {
        openTicketDetail(created.id);
      }
    } catch (err) {
      setError((err as Error).message || "Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(true);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeQuickCreate}>
      <div
        className="modal-card modal-card-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleFormKeyDown}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <h2 className="modal-title">Create Ticket</h2>
            <span className="modal-keycap-pill">Cmd+N</span>
          </div>
          <button
            data-testid="quick-create-close-btn"
            className="btn-ghost"
            onClick={closeQuickCreate}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="modal-error-alert">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Title Input */}
        <div className="modal-field">
          <input
            ref={titleInputRef}
            type="text"
            className="modal-input"
            placeholder="What needs to be done? (Press Enter to create)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !showDetails) {
                e.preventDefault();
                handleSubmit(false);
              }
            }}
            maxLength={200}
          />
        </div>

        {/* Progressive Disclosure Toggle */}
        <div className="modal-field">
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "0 var(--space-2)", height: "28px", fontSize: "var(--text-xs)", gap: "var(--space-1)" }}
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>{showDetails ? "Fewer options" : "Add details (description, priority, dates)"}</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded Fields */}
        {showDetails && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            {/* Description */}
            <div>
              <textarea
                className="modal-input"
                placeholder="Description or acceptance criteria (Markdown supported)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ height: "68px", padding: "var(--space-2) var(--space-3)", resize: "none" }}
              />
            </div>

            {/* State & Priority */}
            <div className="modal-grid-2">
              <div>
                <label className="modal-label">Column / State</label>
                <CustomSelect
                  fullWidth
                  size="sm"
                  value={workflowStateId}
                  onChange={(val) => setWorkflowStateId(val)}
                  options={stateOptions}
                />
              </div>

              <div>
                <label className="modal-label">Priority</label>
                <CustomSelect
                  ariaLabel="Priority"
                  fullWidth
                  size="sm"
                  value={priority}
                  onChange={(val) => setPriority(val as TicketPriority)}
                  options={priorityOptions}
                />
              </div>
            </div>

            {/* Epic & Due Date */}
            <div className="modal-grid-2">
              <div>
                <label className="modal-label">Epic</label>
                <CustomSelect
                  fullWidth
                  size="sm"
                  value={epicId}
                  onChange={(val) => setEpicId(val)}
                  placeholder="No Epic"
                  options={epicOptions}
                />
              </div>

              <div>
                <label className="modal-label">Due Date</label>
                <input
                  type="date"
                  className="modal-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ height: "32px", fontSize: "var(--text-xs)" }}
                />
              </div>
            </div>

            {/* Estimate & Labels */}
            <div className="modal-grid-1-2">
              <div>
                <label className="modal-label">Estimate (pts)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 3"
                  className="modal-input"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  style={{ height: "32px", fontSize: "var(--text-xs)" }}
                />
              </div>

              <div>
                <label className="modal-label">Labels</label>
                <div className="ticket-drawer-labels-container">
                  {labels.map((l) => (
                    <span key={l} className="ticket-drawer-label-chip">
                      {l}
                      <button
                        type="button"
                        className="ticket-drawer-label-remove btn-ghost"
                        onClick={() => removeLabel(l)}
                        aria-label={`Remove label ${l}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add label + Enter"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={handleAddLabel}
                    className="ticket-drawer-label-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-footer" style={{ justifyContent: "space-between", marginTop: "var(--space-3)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Tip: Press <strong>Cmd+Enter</strong> to create &amp; open details
          </span>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={closeQuickCreate}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              Create Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
