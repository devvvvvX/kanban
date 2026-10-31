import { useState, useEffect } from "react";
import { X, ArrowRight, CheckSquare } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTabs } from "../../context/TabContext";
import { useTickets } from "../../context/TicketContext";
import { useTodos } from "../../context/TodoContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { TodoRecord } from "../../lib/todos/todoService";
import type { TicketPriority } from "../../lib/tickets/ticketService";
import { WorkflowStateService } from "../../lib/tickets/workflowStateService";
import { EpicService, type EpicRecord } from "../../lib/projects/epicService";
import { useAuth } from "../../context/AuthContext";

interface ConvertToTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo: TodoRecord | null;
}

export function ConvertToTicketModal({ isOpen, onClose, todo }: ConvertToTicketModalProps) {
  const { user } = useAuth();
  const { projects, activeProject } = useProject();
  const { openTicketTab } = useTabs();
  const { refreshTickets } = useTickets();
  const { convertTodoToTicket } = useTodos();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedStateId, setSelectedStateId] = useState<string>("");
  const [selectedEpicId, setSelectedEpicId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [states, setStates] = useState<{ id: string; name: string; category: string }[]>([]);
  const [epics, setEpics] = useState<EpicRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  // Initialize form when todo changes
  useEffect(() => {
    if (todo && isOpen) {
      setTitle(todo.title);
      setDescription(todo.notes || "");
      setPriority(
        todo.priority !== "none" ? (todo.priority as TicketPriority) : "medium"
      );
      setError(null);

      // Default project
      const initialProjId =
        todo.project_id || (activeProject ? activeProject.id : projects[0]?.id || "");
      setSelectedProjectId(initialProjId);
    }
  }, [todo, isOpen, activeProject, projects]);

  // Load workflow states and epics when project changes
  useEffect(() => {
    if (!user || !selectedProjectId) {
      setStates([]);
      setEpics([]);
      return;
    }

    try {
      const stateService = new WorkflowStateService();
      const projectStates = stateService.listStates(selectedProjectId, user.id);
      setStates(projectStates);

      const defaultState =
        projectStates.find((s) => s.category === "unstarted" || s.category === "backlog") ||
        projectStates[0];
      setSelectedStateId(defaultState ? defaultState.id : "");

      const epicService = new EpicService();
      const projectEpics = epicService.listEpics(selectedProjectId, user.id);
      setEpics(projectEpics);
      setSelectedEpicId("");
    } catch (err) {
      console.error("Failed to load project states or epics:", err);
    }
  }, [user, selectedProjectId]);

  if (!isOpen || !todo) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError("Ticket title is required");
      return;
    }
    if (!selectedProjectId) {
      setError("Please select a target project");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { ticket } = convertTodoToTicket({
        todoId: todo.id,
        projectId: selectedProjectId,
        workflowStateId: selectedStateId || undefined,
        epicId: selectedEpicId || undefined,
        customTitle: title.trim(),
        customDescription: description.trim() || undefined,
        priority,
      });

      refreshTickets();
      onClose();
      // Open ticket in tab for immediate access
      openTicketTab(ticket.id, ticket.title, ticket.identifier);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to convert todo to ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      data-testid="convert-todo-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        data-testid="convert-todo-modal"
        style={{
          maxWidth: "560px",
          width: "90vw",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: "var(--space-4) var(--space-6)",
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
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowRight size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, margin: 0 }}>
                Convert Todo to Ticket
              </h2>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  margin: 0,
                  marginTop: 2,
                }}
              >
                Promote this unstructured thought into a tracked Kanban ticket
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "var(--space-6)" }}>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "var(--color-danger)",
                fontSize: "var(--text-xs)",
                marginBottom: "var(--space-4)",
              }}
            >
              {error}
            </div>
          )}

          {/* Project & Workflow State */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}
          >
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
                Target Project *
              </label>
              <select
                className="select"
                data-testid="convert-project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{ width: "100%", height: "36px" }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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
                Workflow Column / State
              </label>
              <select
                className="select"
                data-testid="convert-state-select"
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                style={{ width: "100%", height: "36px" }}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority & Epic */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
            }}
          >
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
                Priority
              </label>
              <select
                className="select"
                data-testid="convert-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                style={{ width: "100%", height: "36px" }}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
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
                Epic (Optional)
              </label>
              <select
                className="select"
                data-testid="convert-epic-select"
                value={selectedEpicId}
                onChange={(e) => setSelectedEpicId(e.target.value)}
                style={{ width: "100%", height: "36px" }}
              >
                <option value="">No Epic</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Ticket Title *
            </label>
            <input
              type="text"
              className="input"
              data-testid="convert-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ticket Title"
              style={{ width: "100%", height: "36px" }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <label
              style={{
                display: "block",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Description / Notes
            </label>
            <textarea
              className="input"
              data-testid="convert-description-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Unstructured thoughts or details to carry over into the ticket..."
              rows={4}
              style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
            />
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "var(--space-4)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="convert-submit-btn"
              disabled={isSubmitting || !title.trim()}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <CheckSquare size={14} />
              <span>{isSubmitting ? "Converting..." : "Create Ticket & Open Tab"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
