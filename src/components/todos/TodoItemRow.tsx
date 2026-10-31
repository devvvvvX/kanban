import { useState, useRef, useEffect } from "react";
import {
  Check,
  Trash2,
  ArrowRight,
  ExternalLink,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Star,
  GripVertical,
  Clock,
  Bell,
  CheckSquare,
} from "lucide-react";
import type { TodoRecord, TodoCadence } from "../../lib/todos/todoService";
import { parseTodoSteps } from "../../lib/todos/todoService";
import { useTodos } from "../../context/TodoContext";
import { useTabs } from "../../context/TabContext";
import { useTickets } from "../../context/TicketContext";
import { getCadenceRemainingLabel, getTargetDateRemainingLabel } from "../../utils/cadenceTime";

interface TodoItemRowProps {
  todo: TodoRecord;
  index: number;
  onOpenConvertModal: (todo: TodoRecord) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDrop?: (index: number) => void;
  onDragEnd?: () => void;
}

const CADENCE_LABELS: Record<TodoCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  custom: "Custom",
};

export function TodoItemRow({
  todo,
  index,
  onOpenConvertModal,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TodoItemRowProps) {
  const { toggleTodo, toggleStar, updateTodo, deleteTodo, selectedTodo, setSelectedTodo } = useTodos();
  const { openTicketTab } = useTabs();
  const { tickets } = useTickets();

  const isSelected = selectedTodo?.id === todo.id;
  const steps = parseTodoSteps(todo.steps);
  const completedStepsCount = steps.filter((s) => s.completed).length;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState(todo.notes || "");
  const [isHovered, setIsHovered] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(todo.title);
  }, [todo.title]);

  useEffect(() => {
    setEditNotes(todo.notes || "");
  }, [todo.notes]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== todo.title) {
      updateTodo(todo.id, { title: trimmed });
    } else {
      setEditTitle(todo.title);
    }
    setIsEditingTitle(false);
  };

  const handleSaveNotes = () => {
    updateTodo(todo.id, { notes: editNotes.trim() || null });
    setIsEditingNotes(false);
  };

  const isCompleted = todo.is_completed === 1;
  const isStarred = todo.is_starred === 1;

  const handleRowClick = (e: React.MouseEvent) => {
    if (isEditingTitle) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest(`[data-testid="todo-drag-handle-${todo.id}"]`)
    ) {
      return;
    }
    setSelectedTodo(todo);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTodo(todo);
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  // Find converted ticket if any
  const convertedTicket = todo.converted_ticket_id
    ? tickets.find((t) => t.id === todo.converted_ticket_id)
    : null;

  const priorityColor =
    todo.priority === "urgent"
      ? "var(--color-danger)"
      : todo.priority === "high"
      ? "#F59E0B"
      : todo.priority === "medium"
      ? "var(--color-primary)"
      : todo.priority === "low"
      ? "var(--text-muted)"
      : "transparent";

  // Cadence countdown calculation
  const cadenceDaysLeft =
    !isCompleted && (todo.cadence === "weekly" || todo.cadence === "monthly" || todo.cadence === "quarterly")
      ? getCadenceRemainingLabel(todo.cadence)
      : null;

  const targetDateLabel =
    !isCompleted && todo.target_date
      ? getTargetDateRemainingLabel(todo.target_date)
      : null;

  return (
    <div
      className={`todo-item-row ${isCompleted ? "is-completed" : ""} ${isStarred ? "is-starred" : ""} ${isSelected ? "is-selected" : ""}`}
      data-testid={`todo-row-${todo.id}`}
      draggable={!isCompleted}
      onClick={handleRowClick}
      onDragStart={() => onDragStart && onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver && onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop && onDrop(index);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: isSelected
          ? "var(--bg-surface-active)"
          : isStarred && !isCompleted
          ? "rgba(245, 158, 11, 0.03)"
          : "var(--bg-surface)",
        borderTop: isDragOver ? "2px solid var(--accent-blue)" : isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
        borderRight: isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
        borderBottom: isSelected ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
        borderLeft: isStarred && !isCompleted ? "2px solid #F59E0B" : isSelected ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
        boxShadow: isSelected ? "0 0 0 1px var(--accent-blue-subtle)" : "none",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        marginBottom: "6px",
        cursor: "pointer",
        transition: "border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
        opacity: isDragging ? 0.4 : isCompleted ? 0.6 : 1,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", width: "100%" }}>
        {/* Drag Handle */}
        {!isCompleted && (
          <div
            data-testid={`todo-drag-handle-${todo.id}`}
            style={{
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isHovered ? "var(--text-secondary)" : "transparent",
              marginTop: "2px",
              transition: "color 0.15s ease",
              width: "12px",
              flexShrink: 0,
            }}
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Custom Checkbox */}
        <button
          type="button"
          onClick={() => toggleTodo(todo.id)}
          data-testid={`todo-checkbox-${todo.id}`}
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            border: isCompleted
              ? "1px solid var(--color-primary)"
              : "1px solid var(--border-default)",
            backgroundColor: isCompleted ? "var(--accent-blue)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: "2px",
            padding: 0,
            transition: "all 0.15s ease",
          }}
          title={isCompleted ? "Mark incomplete" : "Mark complete"}
        >
          {isCompleted && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </button>

        {/* Star / Priority Toggle Button */}
        <button
          type="button"
          onClick={() => toggleStar(todo.id)}
          data-testid={`todo-star-btn-${todo.id}`}
          style={{
            background: "none",
            border: "none",
            padding: "2px",
            cursor: "pointer",
            color: isStarred ? "#F59E0B" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "1px",
            opacity: isStarred || isHovered ? 1 : 0.3,
            transition: "all 0.15s ease",
          }}
          title={isStarred ? "Remove star priority" : "Star to prioritize"}
        >
          <Star
            size={15}
            fill={isStarred ? "#F59E0B" : "none"}
            stroke={isStarred ? "#F59E0B" : "currentColor"}
            strokeWidth={isStarred ? 1.5 : 2}
          />
        </button>

        {/* Title & Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") {
                  setEditTitle(todo.title);
                  setIsEditingTitle(false);
                }
              }}
              style={{
                width: "100%",
                background: "var(--bg-surface-active)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-sans)",
                outline: "none",
              }}
            />
          ) : (
            <div
              onClick={handleTitleClick}
              onDoubleClick={handleTitleDoubleClick}
              data-testid={`todo-title-${todo.id}`}
              style={{
                fontSize: "var(--text-sm)",
                color: isCompleted ? "var(--text-muted)" : "var(--text-primary)",
                textDecoration: isCompleted ? "line-through" : "none",
                cursor: "pointer",
                wordBreak: "break-word",
                lineHeight: 1.4,
                fontWeight: isStarred && !isCompleted ? 500 : 400,
              }}
              title="Click to open details drawer (double-click to quick rename)"
            >
              {todo.title}
            </div>
          )}

          {/* Badges / Meta row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "6px",
            }}
          >
            {/* Cadence Tag */}
            <span
              style={{
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-surface-active)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
                textTransform: "capitalize",
              }}
            >
              {todo.cadence === "custom" && todo.custom_list
                ? todo.custom_list
                : CADENCE_LABELS[todo.cadence]}
            </span>

            {/* Days Left in Cadence Indicator */}
            {cadenceDaysLeft && (
              <span
                data-testid={`todo-days-left-${todo.id}`}
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  color: "var(--color-primary)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontWeight: 500,
                }}
              >
                <Clock size={10} />
                {cadenceDaysLeft}
              </span>
            )}

            {/* Target Date with relative countdown */}
            {todo.target_date && (
              <span
                style={{
                  fontSize: "11px",
                  color: targetDateLabel?.includes("Overdue") ? "var(--color-danger)" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <Calendar size={11} />
                <span>{targetDateLabel || todo.target_date}</span>
              </span>
            )}

            {/* Priority Chip */}
            {todo.priority !== "none" && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: priorityColor,
                  border: `1px solid ${priorityColor}40`,
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  textTransform: "capitalize",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: priorityColor,
                  }}
                />
                {todo.priority}
              </span>
            )}

            {/* Checkbox Steps Count Badge */}
            {steps.length > 0 && (
              <span
                data-testid={`todo-steps-badge-${todo.id}`}
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg-surface-active)",
                  color: completedStepsCount === steps.length ? "var(--color-success)" : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontWeight: 500,
                }}
              >
                <CheckSquare size={10} />
                <span>{completedStepsCount}/{steps.length} steps</span>
              </span>
            )}

            {/* Remind Me Badge */}
            {todo.remind_at && (
              <span
                data-testid={`todo-reminder-badge-${todo.id}`}
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontWeight: 500,
                }}
                title={`Reminder set for ${new Date(todo.remind_at).toLocaleString()}`}
              >
                <Bell size={10} />
                <span>Remind</span>
              </span>
            )}

            {/* Converted Ticket Link */}
            {convertedTicket ? (
              <button
                type="button"
                onClick={() =>
                  openTicketTab(
                    convertedTicket.id,
                    convertedTicket.title,
                    convertedTicket.identifier
                  )
                }
                style={{
                  fontSize: "11px",
                  padding: "1px 7px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  color: "var(--color-primary)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
                title={`Open Ticket ${convertedTicket.identifier}`}
              >
                <span>{convertedTicket.identifier}</span>
                <ExternalLink size={10} />
              </button>
            ) : todo.converted_ticket_id ? (
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  color: "var(--color-primary)",
                }}
              >
                Ticket Created
              </span>
            ) : null}

            {/* Expand notes button if notes exist */}
            {todo.notes && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0 4px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  fontSize: "11px",
                }}
              >
                <FileText size={11} />
                <span>{isExpanded ? "Hide notes" : "Notes"}</span>
                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {/* Convert to Ticket Button */}
          {!todo.converted_ticket_id && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => onOpenConvertModal(todo)}
              data-testid={`todo-convert-btn-${todo.id}`}
              style={{
                height: "26px",
                padding: "0 8px",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--text-secondary)",
              }}
              title="Promote to Kanban Ticket"
            >
              <ArrowRight size={12} />
              <span>To Ticket</span>
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => deleteTodo(todo.id)}
            data-testid={`todo-delete-btn-${todo.id}`}
            style={{
              height: "26px",
              width: "26px",
              color: "var(--text-muted)",
              opacity: isHovered ? 1 : 0.4,
            }}
            title="Delete Todo"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Notes Section */}
      {(isExpanded || isEditingNotes) && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
          }}
        >
          {isEditingNotes ? (
            <div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add unstructured notes..."
                rows={3}
                style={{
                  width: "100%",
                  background: "var(--bg-surface-active)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 8px",
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.4,
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setIsEditingNotes(false)}
                  style={{ height: "24px", fontSize: "11px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveNotes}
                  style={{ height: "24px", fontSize: "11px" }}
                >
                  Save Notes
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingNotes(true)}
              style={{
                cursor: "pointer",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
              title="Click to edit notes"
            >
              {todo.notes || <em>No notes. Click to add details.</em>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
