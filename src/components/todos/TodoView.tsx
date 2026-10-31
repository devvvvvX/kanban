import { useState, useMemo, useRef } from "react";
import {
  ListTodo,
  Plus,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Tag,
  Star,
  FileText,
  CornerDownLeft,
  X,
} from "lucide-react";
import { useTodos, type TodoCadenceFilter } from "../../context/TodoContext";
import { TodoItemRow } from "./TodoItemRow";
import { TodoDetailDrawer } from "./TodoDetailDrawer";
import { ConvertToTicketModal } from "./ConvertToTicketModal";
import type { TodoRecord, TodoCadence, TodoPriority } from "../../lib/todos/todoService";
import {
  getDaysLeftInWeek,
  getDaysLeftInMonth,
  getDaysLeftInQuarter,
} from "../../utils/cadenceTime";

const CADENCE_TABS: { id: TodoCadenceFilter; label: string }[] = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
  { id: "quarterly", label: "Quarterly" },
  { id: "custom", label: "Custom Lists" },
  { id: "all", label: "All" },
];

export function TodoView() {
  const {
    todos,
    activeCadence,
    setActiveCadence,
    activeCustomList,
    setActiveCustomList,
    searchQuery,
    setSearchQuery,
    customLists,
    stats,
    createTodo,
    reorderTodos,
  } = useTodos();

  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("none");
  const [newIsStarred, setNewIsStarred] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [newCustomListName, setNewCustomListName] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [convertModalTodo, setConvertModalTodo] = useState<TodoRecord | null>(null);
  const [starredFilterOnly, setStarredFilterOnly] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Filter todos based on activeCadence, activeCustomList, starredFilterOnly, and searchQuery
  const filteredTodos = useMemo(() => {
    let result = todos;

    // Filter by cadence
    if (activeCadence !== "all") {
      result = result.filter((t) => t.cadence === activeCadence);
    }

    // Filter by custom list if custom cadence is active and a custom list is chosen
    if (activeCadence === "custom" && activeCustomList) {
      result = result.filter((t) => t.custom_list === activeCustomList);
    }

    // Starred filter
    if (starredFilterOnly) {
      result = result.filter((t) => t.is_starred === 1);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.custom_list && t.custom_list.toLowerCase().includes(q))
      );
    }

    return result;
  }, [todos, activeCadence, activeCustomList, starredFilterOnly, searchQuery]);

  const activeTodos = useMemo(() => filteredTodos.filter((t) => t.is_completed === 0), [filteredTodos]);
  const completedTodos = useMemo(() => filteredTodos.filter((t) => t.is_completed === 1), [filteredTodos]);

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    const cadence: TodoCadence = activeCadence === "all" ? "daily" : (activeCadence as TodoCadence);
    const customList =
      cadence === "custom"
        ? activeCustomList || newCustomListName.trim() || "Braindump"
        : undefined;

    createTodo({
      title,
      notes: newNotes.trim() || undefined,
      cadence,
      custom_list: customList,
      priority: newPriority,
      is_starred: newIsStarred,
    });

    setNewTitle("");
    setNewNotes("");
    setNewPriority("none");
    setNewIsStarred(false);
    setShowNotesInput(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...activeTodos];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, movedItem);

    const orderedIds = reordered.map((item) => item.id);
    reorderTodos(orderedIds);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getTabBadgeCount = (tabId: TodoCadenceFilter) => {
    switch (tabId) {
      case "daily":
        return stats.dailyCount;
      case "weekly":
        return stats.weeklyCount;
      case "monthly":
        return stats.monthlyCount;
      case "quarterly":
        return stats.quarterlyCount;
      case "custom":
        return stats.customCount;
      case "all":
        return stats.totalActive;
      default:
        return 0;
    }
  };

  // Contextual header subtitle with days remaining
  const cadenceHeaderSubtitle = useMemo(() => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    switch (activeCadence) {
      case "daily":
        return `${formattedDate} • Daily plan & unstructured thoughts`;
      case "weekly": {
        const left = getDaysLeftInWeek(now);
        return `This Week • ${left === 0 ? "Ends today" : `${left} days left (ends Sunday)`}`;
      }
      case "monthly": {
        const left = getDaysLeftInMonth(now);
        const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return `${monthName} • ${left === 0 ? "Ends today" : `${left} days left`}`;
      }
      case "quarterly": {
        const left = getDaysLeftInQuarter(now);
        return `Quarterly Horizon • ${left === 0 ? "Ends today" : `${left} days left in quarter`}`;
      }
      case "custom":
        return activeCustomList ? `Custom List: ${activeCustomList}` : "Custom Task Collections";
      case "all":
        return "Complete overview across all cadences";
      default:
        return "Daily plan & unstructured thoughts";
    }
  }, [activeCadence, activeCustomList]);

  return (
    <div
      className="todo-view-container"
      data-testid="todo-view"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--space-6) var(--space-8)",
        overflowY: "auto",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-5)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ListTodo size={20} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Todos &amp; Unstructured Planning
            </h1>
            <p
              data-testid="todo-header-subtitle"
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                margin: 0,
                marginTop: 2,
              }}
            >
              {cadenceHeaderSubtitle}
            </p>
          </div>
        </div>

        {/* Global stats & Starred Filter toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {stats.starredCount > 0 && (
            <button
              type="button"
              data-testid="todo-starred-filter-btn"
              onClick={() => setStarredFilterOnly((prev) => !prev)}
              style={{
                fontSize: "var(--text-xs)",
                color: starredFilterOnly ? "#F59E0B" : "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "14px",
                backgroundColor: starredFilterOnly ? "rgba(245, 158, 11, 0.15)" : "var(--bg-surface)",
                border: starredFilterOnly ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border-subtle)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontWeight: 500,
              }}
              title="Filter starred priority items"
            >
              <Star size={12} fill={starredFilterOnly ? "#F59E0B" : "none"} stroke="#F59E0B" />
              <span>{stats.starredCount} starred</span>
            </button>
          )}

          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              padding: "4px 10px",
              borderRadius: "14px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{stats.totalActive}</span> active
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              padding: "4px 10px",
              borderRadius: "14px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{stats.completedCount}</span> completed
          </div>
        </div>
      </div>

      {/* Cadence Tabs & Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "var(--space-4)",
        }}
      >
        {/* Cadence Segmented Control */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            padding: "3px",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {CADENCE_TABS.map((tab) => {
            const isActive = activeCadence === tab.id;
            const badgeCount = getTabBadgeCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`todo-cadence-tab-${tab.id}`}
                onClick={() => setActiveCadence(tab.id)}
                style={{
                  padding: "4px 11px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-xs)",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  backgroundColor: isActive ? "var(--accent-blue)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                  border: "none",
                }}
              >
                <span>{tab.label}</span>
                {badgeCount > 0 && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "0 5px",
                      borderRadius: "8px",
                      backgroundColor: isActive ? "rgba(255, 255, 255, 0.25)" : "var(--bg-surface-active)",
                      color: isActive ? "#FFFFFF" : "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modern Spotlight-Style Search Input */}
        <div
          style={{
            position: "relative",
            width: "250px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={13}
            color="var(--text-muted)"
            style={{
              position: "absolute",
              left: "11px",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            data-testid="todo-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter thoughts and todos..."
            style={{
              paddingLeft: "32px",
              paddingRight: searchQuery ? "28px" : "12px",
              height: "30px",
              fontSize: "var(--text-xs)",
              width: "100%",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "15px",
              color: "var(--text-primary)",
              outline: "none",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              data-testid="todo-search-clear-btn"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Clear search filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Custom lists sub-bar if in Custom mode */}
      {activeCadence === "custom" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "var(--space-4)",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Tag size={13} color="var(--text-secondary)" />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>List:</span>

          <button
            type="button"
            onClick={() => setActiveCustomList(null)}
            style={{
              padding: "2px 8px",
              borderRadius: "10px",
              fontSize: "11px",
              cursor: "pointer",
              backgroundColor: activeCustomList === null ? "var(--color-primary)" : "transparent",
              color: activeCustomList === null ? "#FFF" : "var(--text-muted)",
              border: "none",
            }}
          >
            All Custom
          </button>

          {customLists.map((listName) => (
            <button
              key={listName}
              type="button"
              onClick={() => setActiveCustomList(listName)}
              style={{
                padding: "2px 8px",
                borderRadius: "10px",
                fontSize: "11px",
                cursor: "pointer",
                backgroundColor: activeCustomList === listName ? "var(--color-primary)" : "transparent",
                color: activeCustomList === listName ? "#FFF" : "var(--text-muted)",
                border: "none",
              }}
            >
              {listName}
            </button>
          ))}
        </div>
      )}

      {/* Sleek, Impeccable Task Composer (No Ugly Double-Boxes, Native Feel) */}
      <form
        onSubmit={handleCreate}
        data-testid="todo-quick-add-form"
        className="todo-composer-card"
      >
        {/* Top Input Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Plus
            size={16}
            color={newTitle.trim() ? "var(--accent-blue)" : "var(--text-muted)"}
            style={{
              transition: "color 0.15s ease",
              flexShrink: 0,
            }}
          />

          <input
            ref={inputRef}
            type="text"
            data-testid="todo-new-input"
            className="todo-composer-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder={`Add a thought or task for ${
              activeCadence === "daily"
                ? "Today"
                : activeCadence === "weekly"
                ? "This Week"
                : activeCadence === "monthly"
                ? "This Month"
                : activeCadence === "quarterly"
                ? "This Quarter"
                : activeCadence === "custom"
                ? activeCustomList || "Custom"
                : "Today"
            }...`}
          />
        </div>

        {/* Optional Expandable Notes */}
        {showNotesInput && (
          <div style={{ paddingLeft: "26px", paddingRight: "4px" }}>
            <textarea
              data-testid="todo-new-notes-input"
              className="todo-composer-notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Dump unstructured details, URLs, or notes..."
              rows={2}
            />
          </div>
        )}

        {/* Bottom Toolbar: Micro-actions left, Return keycap right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "6px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Star toggle chip */}
            <button
              type="button"
              data-testid="todo-new-star-btn"
              onClick={() => setNewIsStarred((prev) => !prev)}
              className={`todo-composer-chip ${newIsStarred ? "starred" : ""}`}
              title={newIsStarred ? "Starred priority" : "Star to prioritize"}
            >
              <Star
                size={12}
                fill={newIsStarred ? "#F59E0B" : "none"}
                stroke={newIsStarred ? "#F59E0B" : "currentColor"}
              />
              <span>Star</span>
            </button>

            {/* Notes toggle chip */}
            <button
              type="button"
              data-testid="todo-new-notes-toggle"
              onClick={() => setShowNotesInput((prev) => !prev)}
              className={`todo-composer-chip ${showNotesInput ? "active" : ""}`}
              title="Add notes"
            >
              <FileText size={12} />
              <span>Notes</span>
            </button>

            {/* Priority Selector Chip */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <select
                data-testid="todo-new-priority-select"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                className={`todo-composer-chip ${newPriority !== "none" ? "active" : ""}`}
                style={{
                  height: "24px",
                  fontSize: "11px",
                  padding: "0 22px 0 8px",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  outline: "none",
                }}
                title="Set Priority"
              >
                <option value="none">Priority: None</option>
                <option value="low">Priority: Low</option>
                <option value="medium">Priority: Medium</option>
                <option value="high">Priority: High</option>
                <option value="urgent">Priority: Urgent</option>
              </select>
              <ChevronDown
                size={11}
                color={newPriority !== "none" ? "var(--accent-blue)" : "var(--text-muted)"}
                style={{
                  position: "absolute",
                  right: "6px",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Optional Custom List Name Input */}
            {activeCadence === "custom" && !activeCustomList && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>List:</span>
                <input
                  type="text"
                  data-testid="todo-new-custom-list-input"
                  value={newCustomListName}
                  onChange={(e) => setNewCustomListName(e.target.value)}
                  placeholder="e.g. Braindump"
                  style={{
                    height: "24px",
                    fontSize: "11px",
                    padding: "0 8px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    outline: "none",
                    width: "120px",
                  }}
                />
              </div>
            )}
          </div>

          {/* Keycap Return Badge Button */}
          <button
            type="submit"
            data-testid="todo-save-btn"
            disabled={!newTitle.trim()}
            className={newTitle.trim() ? "btn-primary" : "todo-keycap"}
            style={{
              height: "24px",
              padding: newTitle.trim() ? "0 10px" : "0 7px",
              fontSize: "11px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              cursor: newTitle.trim() ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
            title="Press Enter to save"
          >
            <span>{newTitle.trim() ? "Add" : "Return"}</span>
            <CornerDownLeft size={11} />
          </button>
        </div>
      </form>

      {/* Active Items Section with Drag-and-Drop Reordering */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        {activeTodos.length === 0 ? (
          <div
            style={{
              padding: "var(--space-8) var(--space-4)",
              textAlign: "center",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px dashed var(--border-subtle)",
            }}
          >
            <CheckCircle2
              size={32}
              color="var(--color-primary)"
              style={{ opacity: 0.5, margin: "0 auto 8px" }}
            />
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>
              All clear for {CADENCE_TABS.find((c) => c.id === activeCadence)?.label || "Todos"}
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Quickly capture your unstructured thoughts and plans in the composer above.
            </p>
          </div>
        ) : (
          <div>
            {activeTodos.map((todo, index) => (
              <TodoItemRow
                key={todo.id}
                todo={todo}
                index={index}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onOpenConvertModal={(t) => setConvertModalTodo(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Items Section */}
      {completedTodos.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <button
            type="button"
            data-testid="todo-toggle-completed-btn"
            onClick={() => setShowCompleted((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              marginBottom: "8px",
            }}
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Completed ({completedTodos.length})</span>
          </button>

          {showCompleted && (
            <div>
              {completedTodos.map((todo, index) => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  index={index}
                  onOpenConvertModal={(t) => setConvertModalTodo(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Left Slide Drawer for Todo Details */}
      <TodoDetailDrawer onOpenConvertModal={(t) => setConvertModalTodo(t)} />

      {/* Convert to Ticket Modal */}
      <ConvertToTicketModal
        isOpen={Boolean(convertModalTodo)}
        onClose={() => setConvertModalTodo(null)}
        todo={convertModalTodo}
      />
    </div>
  );
}
