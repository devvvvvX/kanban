import React, { useState, useEffect, useRef } from "react";
import { CheckSquare, Square, Trash2, Plus, Check } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { Subtask } from "../../lib/tickets/subtaskService";

interface SubtaskListProps {
  ticketId: string;
}

export function SubtaskList({ ticketId }: SubtaskListProps) {
  const {
    getSubtasks,
    createSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTickets();

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSubtasks = React.useCallback(() => {
    try {
      const items = getSubtasks(ticketId);
      setSubtasks(items);
    } catch (err) {
      console.error("Failed to load subtasks:", err);
    }
  }, [ticketId, getSubtasks]);

  useEffect(() => {
    loadSubtasks();
  }, [loadSubtasks]);

  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    createSubtask(ticketId, trimmed);
    setNewTitle("");
    loadSubtasks();
    // Keep focus in input for rapid typing
    inputRef.current?.focus();
  };

  const handleToggle = (subtaskId: string) => {
    toggleSubtask(subtaskId);
    loadSubtasks();
  };

  const handleDelete = (subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSubtask(subtaskId);
    loadSubtasks();
  };

  const startEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const handleSaveEdit = (subtaskId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      updateSubtask(subtaskId, { title: trimmed });
    }
    setEditingId(null);
    loadSubtasks();
  };

  return (
    <div style={{ marginTop: "16px" }}>
      {/* Header and Progress Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Subtasks {total > 0 && `(${completed}/${total})`}
        </span>
        {total > 0 && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {percentage}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          style={{
            height: "4px",
            backgroundColor: "var(--bg-subtle)",
            borderRadius: "2px",
            overflow: "hidden",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percentage}%`,
              backgroundColor: percentage === 100 ? "var(--accent-green)" : "var(--accent-primary)",
              borderRadius: "2px",
              transition: "width var(--transition-normal)",
            }}
          />
        </div>
      )}

      {/* Subtasks items list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {subtasks.map((s) => {
          const isEditing = editingId === s.id;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: isEditing ? "var(--bg-subtle)" : "transparent",
                transition: "background-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (!isEditing) e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                if (!isEditing) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => handleToggle(s.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: s.is_completed ? "var(--accent-green)" : "var(--text-muted)",
                    transition: "color var(--transition-fast)",
                  }}
                  title={s.is_completed ? "Mark incomplete" : "Mark complete"}
                >
                  {s.is_completed ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(s.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleSaveEdit(s.id)}
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--accent-primary)",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                ) : (
                  <span
                    onClick={() => startEditing(s)}
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      color: s.is_completed ? "var(--text-muted)" : "var(--text-primary)",
                      textDecoration: s.is_completed ? "line-through" : "none",
                      cursor: "text",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title="Click to edit"
                  >
                    {s.title}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => handleDelete(s.id, e)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  opacity: 0.6,
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent-red)";
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.opacity = "0.6";
                }}
                title="Delete subtask"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Add Subtask Input */}
      <form onSubmit={handleCreate} style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a subtask... (press Enter)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px 6px 26px",
              fontSize: "13px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              outline: "none",
              transition: "border-color var(--transition-fast)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
          />
          <Plus
            size={14}
            style={{
              position: "absolute",
              left: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
        </div>
        {newTitle.trim() && (
          <button
            type="submit"
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: "var(--accent-primary)",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Check size={12} />
            Add
          </button>
        )}
      </form>
    </div>
  );
}
