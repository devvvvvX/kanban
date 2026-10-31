import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  X,
  Calendar,
  Tag,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Eye,
  Edit3,
  PlusCircle,
  Folder,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import type { TicketPriority } from "../../lib/tickets/ticketService";

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; color: string; Icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  urgent: { label: "Urgent", color: "#EF4444", Icon: AlertTriangle },
  high: { label: "High", color: "#F59E0B", Icon: ArrowUp },
  medium: { label: "Medium", color: "#3B82F6", Icon: Equal },
  low: { label: "Low", color: "#64748B", Icon: ArrowDown },
  none: { label: "None", color: "#9CA3AF", Icon: Equal },
};

interface CreateTicketPageProps {
  defaultStateId?: string;
  tabId: string;
}

interface TicketDraft {
  title: string;
  description: string;
  workflowStateId: string;
  epicId: string;
  priority: TicketPriority;
  dueDate: string;
  estimate: string;
  labels: string[];
}

const getDraftKey = (id: string) => `kanban_ticket_draft_${id}`;

function loadInitialDraft(id: string): Partial<TicketDraft> {
  try {
    const raw = localStorage.getItem(getDraftKey(id));
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function CreateTicketPage({ defaultStateId, tabId }: CreateTicketPageProps) {
  const { activeProject, selectProject, epics } = useProject();
  const { workflowStates, createTicket } = useTickets();
  const { closeTab, openTicketTab, switchToHome, updateTabTitle } = useTabs();

  const initialDraft = useRef(loadInitialDraft(tabId)).current;

  const [title, setTitle] = useState(initialDraft.title ?? "");
  const [description, setDescription] = useState(initialDraft.description ?? "");
  const [workflowStateId, setWorkflowStateId] = useState(
    initialDraft.workflowStateId || defaultStateId || (workflowStates.length > 0 ? workflowStates[0].id : "")
  );
  const [epicId, setEpicId] = useState(initialDraft.epicId ?? "");
  const [priority, setPriority] = useState<TicketPriority>(initialDraft.priority ?? "none");
  const [dueDate, setDueDate] = useState(initialDraft.dueDate ?? "");
  const [estimate, setEstimate] = useState<string>(initialDraft.estimate ?? "");
  const [labels, setLabels] = useState<string[]>(initialDraft.labels ?? []);
  const [labelInput, setLabelInput] = useState("");
  const [isPreviewDesc, setIsPreviewDesc] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Sync draft inputs to localStorage keyed by tabId
  useEffect(() => {
    const draft: TicketDraft = {
      title,
      description,
      workflowStateId,
      epicId,
      priority,
      dueDate,
      estimate,
      labels,
    };
    try {
      localStorage.setItem(getDraftKey(tabId), JSON.stringify(draft));
    } catch {}
  }, [tabId, title, description, workflowStateId, epicId, priority, dueDate, estimate, labels]);

  // Sync tab title with user-typed title in real time
  useEffect(() => {
    const trimmed = title.trim();
    updateTabTitle?.(tabId, trimmed ? trimmed : "New Ticket");
  }, [tabId, title, updateTabTitle]);

  useEffect(() => {
    if (!workflowStateId && workflowStates.length > 0) {
      setWorkflowStateId(defaultStateId || workflowStates[0].id);
    }
  }, [workflowStates, defaultStateId, workflowStateId]);

  const handleCancel = () => {
    try {
      localStorage.removeItem(getDraftKey(tabId));
    } catch {}
    closeTab(tabId);
  };

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

  const handleRemoveLabel = (tagToRemove: string) => {
    setLabels(labels.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Ticket title is required");
      return;
    }

    if (!activeProject) {
      setError("No active project selected");
      return;
    }

    const stateId = workflowStateId || (workflowStates[0] ? workflowStates[0].id : "");
    if (!stateId) {
      setError("No workflow state available for this project");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const parsedEstimate = estimate.trim() ? parseInt(estimate, 10) : null;
      const created = createTicket({
        title: title.trim(),
        description: description.trim() || undefined,
        workflowStateId: stateId,
        epicId: epicId || undefined,
        priority,
        dueDate: dueDate || undefined,
        estimate: parsedEstimate !== null && !isNaN(parsedEstimate) ? parsedEstimate : undefined,
        labels: labels.length > 0 ? labels : undefined,
      });

      // Clear draft storage for this tab
      try {
        localStorage.removeItem(getDraftKey(tabId));
      } catch {}

      // Close create tab and open the new ticket's tab
      closeTab(tabId);
      openTicketTab(created.id, `${created.identifier}: ${created.title}`, created.identifier);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-app)",
        overflowY: "auto",
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          padding: "var(--space-3) var(--space-8)",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button
            className="btn-ghost"
            onClick={switchToHome}
            title="Return to Home board"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)" }}
          >
            <ArrowLeft size={14} />
            <span>Home</span>
          </button>

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)" }}>/</span>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (activeProject) {
                selectProject(activeProject.id);
              }
              switchToHome();
            }}
            title={`Go to ${activeProject ? activeProject.name : "Project"}`}
            style={{
              padding: "2px 6px",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Folder size={12} color="var(--accent-blue)" />
            <span>{activeProject ? activeProject.name : "Project"}</span>
          </button>

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)" }}>/</span>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => titleInputRef.current?.focus()}
            title="Focus title"
            style={{
              padding: "2px 6px",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <PlusCircle size={13} />
            <span>New Ticket</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            className="btn-secondary"
            onClick={handleCancel}
            style={{ height: "30px", fontSize: "var(--text-xs)" }}
          >
            Cancel
          </button>
          <button
            className="btn-ghost"
            onClick={handleCancel}
            title="Close create tab"
            aria-label="Close create tab"
            style={{ height: "30px", width: "30px" }}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Create Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          display: "flex",
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-8)",
          gap: "var(--space-8)",
          boxSizing: "border-box",
        }}
      >
        {/* Left Form Content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {error && (
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                backgroundColor: "var(--color-danger-subtle)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-danger)",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </div>
          )}

          {/* Title Input */}
          <div>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ticket Title *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done? (e.g. Design auth screen)"
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3) var(--space-4)",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          {/* Description with Markdown editor & preview */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Description (Markdown)
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className={`btn-ghost ${!isPreviewDesc ? "active" : ""}`}
                  style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)", gap: "4px" }}
                  onClick={() => setIsPreviewDesc(false)}
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className={`btn-ghost ${isPreviewDesc ? "active" : ""}`}
                  style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)", gap: "4px" }}
                  onClick={() => setIsPreviewDesc(true)}
                >
                  <Eye size={12} />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {isPreviewDesc ? (
              <div
                style={{
                  minHeight: "140px",
                  padding: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                  color: description.trim() ? "var(--text-primary)" : "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                {description.trim() ? (
                  description.split("\n").map((line, i) => <p key={i} style={{ marginBottom: "6px" }}>{line || "\u00A0"}</p>)
                ) : (
                  <span style={{ fontStyle: "italic" }}>No description provided.</span>
                )}
              </div>
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add Markdown description, acceptance criteria, or implementation notes..."
                rows={8}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.5,
                  resize: "vertical",
                  outline: "none",
                }}
              />
            )}
          </div>

          {/* Form Submit Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="btn-primary"
              style={{
                height: "38px",
                padding: "0 20px",
                fontSize: "var(--text-sm)",
                opacity: isSubmitting || !title.trim() ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              style={{ height: "38px", padding: "0 16px", fontSize: "var(--text-sm)" }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div style={{ width: "320px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <h3 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Initial Properties
            </h3>

            {/* Workflow State Picker */}
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
                Status / Column *
              </label>
              <CustomSelect
                fullWidth
                size="sm"
                value={workflowStateId}
                onChange={(val) => setWorkflowStateId(val)}
                options={workflowStates.map((state) => ({
                  value: state.id,
                  label: state.name,
                  color: state.color,
                  icon: <StatusIcon category={state.category} color={state.color} size={13} />,
                }))}
              />
            </div>

            {/* Priority Picker */}
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
                Priority
              </label>
              <CustomSelect
                fullWidth
                size="sm"
                value={priority}
                onChange={(val) => setPriority(val as TicketPriority)}
                options={(["urgent", "high", "medium", "low", "none"] as TicketPriority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  return {
                    value: p,
                    label: cfg.label,
                    color: cfg.color,
                    icon: <PriorityIcon priority={p} size={13} />,
                  };
                })}
              />
            </div>

            {/* Epic Picker */}
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
                Epic
              </label>
              <CustomSelect
                fullWidth
                size="sm"
                value={epicId}
                onChange={(val) => setEpicId(val)}
                placeholder="No Epic"
                options={[
                  { value: "", label: "No Epic" },
                  ...epics.map((epic) => ({
                    value: epic.id,
                    label: epic.title,
                    color: epic.color,
                  })),
                ]}
              />
            </div>

            {/* Due Date Picker */}
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                <Calendar size={12} />
                <span>Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: "100%",
                  height: "32px",
                  padding: "0 8px",
                  boxSizing: "border-box",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-xs)",
                }}
              />
            </div>

            {/* Estimate Points */}
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                Estimate Points
              </label>
              <input
                type="number"
                min="0"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="Story points..."
                style={{
                  width: "100%",
                  height: "32px",
                  padding: "0 8px",
                  boxSizing: "border-box",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            {/* Labels Input */}
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                <Tag size={12} />
                <span>Labels</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                {labels.map((lbl) => (
                  <span
                    key={lbl}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "var(--text-xs)",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>{lbl}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(lbl)}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={handleAddLabel}
                placeholder="Add label (press Enter)..."
                style={{
                  width: "100%",
                  height: "30px",
                  padding: "0 8px",
                  boxSizing: "border-box",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-xs)",
                }}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
