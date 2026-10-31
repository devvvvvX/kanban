import { useState, useEffect, useRef } from "react";
import {
  X,
  Star,
  Trash2,
  ArrowRight,
  ExternalLink,
  Calendar,
  Bell,
  Plus,
  Check,
  FileText,
  Clock,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Volume2,
} from "lucide-react";
import { useTodos } from "../../context/TodoContext";
import { useTabs } from "../../context/TabContext";
import { useTickets } from "../../context/TicketContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CustomSelect } from "../ui/Select";
import {
  parseTodoSteps,
  type TodoStep,
  type TodoCadence,
  type TodoPriority,
  type TodoRecord,
} from "../../lib/todos/todoService";
import {
  sendDesktopNotification,
  requestNotificationPermission,
  getNotificationPermission,
} from "../../utils/notifications";
import {
  getTargetDateRemainingLabel,
  getCadenceRemainingLabel,
  toLocalDatetimeString,
  toLocalDateString,
  localDatetimeToISO,
  formatLocalReminder,
  getLocalTimezoneShort,
  getLocalTimezoneFull,
} from "../../utils/cadenceTime";

interface TodoDetailDrawerProps {
  onOpenConvertModal?: (todo: TodoRecord) => void;
}

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily (Today)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom List" },
];

const PRIORITY_OPTIONS = [
  { value: "none", label: "None", icon: <Equal size={13} color="#9CA3AF" /> },
  { value: "low", label: "Low", icon: <ArrowDown size={13} color="#64748B" /> },
  { value: "medium", label: "Medium", icon: <Equal size={13} color="#3B82F6" /> },
  { value: "high", label: "High", icon: <ArrowUp size={13} color="#F59E0B" /> },
  { value: "urgent", label: "Urgent", icon: <AlertTriangle size={13} color="#EF4444" /> },
];

export function TodoDetailDrawer({ onOpenConvertModal }: TodoDetailDrawerProps) {
  const {
    selectedTodo,
    setSelectedTodo,
    updateTodo,
    toggleStar,
    deleteTodo,
    addStep,
    toggleStep,
    removeStep,
    setReminder,
  } = useTodos();
  const { openTicketTab } = useTabs();
  const { tickets } = useTickets();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState<TodoCadence>("daily");
  const [customList, setCustomList] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("none");
  const [newStepText, setNewStepText] = useState("");
  const [reminderInput, setReminderInput] = useState("");
  const [reminderStatusNotice, setReminderStatusNotice] = useState<string | null>(null);

  const newStepInputRef = useRef<HTMLInputElement>(null);

  // Synchronize state when selectedTodo changes
  useEffect(() => {
    if (selectedTodo) {
      setTitle(selectedTodo.title);
      setNotes(selectedTodo.notes || "");
      setCadence(selectedTodo.cadence);
      setCustomList(selectedTodo.custom_list || "");
      setTargetDate(selectedTodo.target_date || "");
      setPriority(selectedTodo.priority);
      setReminderInput(toLocalDatetimeString(selectedTodo.remind_at));
      setReminderStatusNotice(null);
    }
  }, [selectedTodo]);

  useEscapeKey(Boolean(selectedTodo), () => setSelectedTodo(null));

  if (!selectedTodo) return null;

  const isStarred = selectedTodo.is_starred === 1;
  const isCompleted = selectedTodo.is_completed === 1;
  const steps: TodoStep[] = parseTodoSteps(selectedTodo.steps);
  const completedStepsCount = steps.filter((s) => s.completed).length;
  const progressPercent = steps.length > 0 ? Math.round((completedStepsCount / steps.length) * 100) : 0;

  const convertedTicket = selectedTodo.converted_ticket_id
    ? tickets.find((t) => t.id === selectedTodo.converted_ticket_id)
    : null;

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== selectedTodo.title) {
      updateTodo(selectedTodo.id, { title: trimmed });
    } else {
      setTitle(selectedTodo.title);
    }
  };

  const handleNotesBlur = () => {
    const trimmed = notes.trim() || null;
    if (trimmed !== selectedTodo.notes) {
      updateTodo(selectedTodo.id, { notes: trimmed });
    }
  };

  const handleCadenceChange = (val: string) => {
    const newCad = val as TodoCadence;
    setCadence(newCad);
    updateTodo(selectedTodo.id, { cadence: newCad });
  };

  const handlePriorityChange = (val: string) => {
    const newPri = val as TodoPriority;
    setPriority(newPri);
    updateTodo(selectedTodo.id, { priority: newPri });
  };

  const handleDateChange = (dateVal: string) => {
    setTargetDate(dateVal);
    updateTodo(selectedTodo.id, { target_date: dateVal || null });
  };

  const handleAddStepSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newStepText.trim();
    if (!trimmed) return;
    addStep(selectedTodo.id, trimmed);
    setNewStepText("");
    if (newStepInputRef.current) {
      newStepInputRef.current.focus();
    }
  };

  const handleScheduleReminder = async (isoDateTime: string) => {
    setReminderInput(toLocalDatetimeString(isoDateTime));
    const perm = getNotificationPermission();
    if (perm !== "granted") {
      await requestNotificationPermission();
    }
    setReminder(selectedTodo.id, isoDateTime);
    setReminderStatusNotice("Reminder scheduled!");
    setTimeout(() => setReminderStatusNotice(null), 3000);
  };

  const handleClearReminder = () => {
    setReminderInput("");
    setReminder(selectedTodo.id, null);
    setReminderStatusNotice("Reminder removed.");
    setTimeout(() => setReminderStatusNotice(null), 2500);
  };

  const handleTestAlert = () => {
    sendDesktopNotification({
      id: selectedTodo.id,
      title: `Reminder: ${selectedTodo.title}`,
      body: selectedTodo.notes || "Todo reminder alert test.",
      todoId: selectedTodo.id,
      persistent: true,
      continuousRing: true,
    });
    setReminderStatusNotice("Test alert dispatched!");
    setTimeout(() => setReminderStatusNotice(null), 3000);
  };

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = toLocalDateString(d);
    handleDateChange(dateStr);
  };

  const setNowReminder = () => {
    const d = new Date(Date.now() + 1000);
    handleScheduleReminder(d.toISOString());
  };

  const setQuickReminder = (minutesAhead: number) => {
    const d = new Date(Date.now() + minutesAhead * 60000);
    handleScheduleReminder(d.toISOString());
  };

  const setTonightReminder = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0); // 8:00 PM local time
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    handleScheduleReminder(d.toISOString());
  };

  const setTomorrowMorningReminder = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0); // 9:00 AM local time
    handleScheduleReminder(d.toISOString());
  };

  const cadenceCountdown =
    !isCompleted && (cadence === "weekly" || cadence === "monthly" || cadence === "quarterly")
      ? getCadenceRemainingLabel(cadence)
      : null;

  const dueCountdown =
    !isCompleted && targetDate ? getTargetDateRemainingLabel(targetDate) : null;

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className="todo-drawer-backdrop"
        onClick={() => setSelectedTodo(null)}
        data-testid="todo-drawer-backdrop"
      />

      {/* Slide Drawer on Right */}
      <div
        className="todo-drawer-panel"
        data-testid="todo-detail-drawer"
      >
        {/* Header */}
        <div className="todo-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "var(--bg-surface-active)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
                fontWeight: 500,
                textTransform: "capitalize",
              }}
            >
              {cadence === "custom" && customList ? customList : cadence}
            </span>

            {isStarred && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "11px",
                  color: "#F59E0B",
                  fontWeight: 600,
                }}
              >
                <Star size={12} fill="#F59E0B" />
                <span>Starred</span>
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Star Toggle */}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => toggleStar(selectedTodo.id)}
              data-testid="drawer-star-btn"
              title={isStarred ? "Remove Star" : "Star to Prioritize"}
              style={{ color: isStarred ? "#F59E0B" : "var(--text-muted)" }}
            >
              <Star
                size={15}
                fill={isStarred ? "#F59E0B" : "none"}
                stroke={isStarred ? "#F59E0B" : "currentColor"}
              />
            </button>

            {/* Convert to Ticket or Open Ticket */}
            {convertedTicket ? (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  openTicketTab(convertedTicket.id, convertedTicket.title, convertedTicket.identifier);
                  setSelectedTodo(null);
                }}
                style={{ height: "26px", padding: "0 8px", fontSize: "11px", gap: "4px" }}
                title={`Open Ticket ${convertedTicket.identifier}`}
              >
                <span>{convertedTicket.identifier}</span>
                <ExternalLink size={11} />
              </button>
            ) : (
              onOpenConvertModal && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onOpenConvertModal(selectedTodo)}
                  data-testid="drawer-convert-btn"
                  style={{ height: "26px", padding: "0 8px", fontSize: "11px", gap: "4px" }}
                  title="Promote to Kanban Ticket"
                >
                  <ArrowRight size={12} />
                  <span>To Ticket</span>
                </button>
              )
            )}

            {/* Delete Todo */}
            <button
              type="button"
              className="btn-ghost btn-sm danger"
              onClick={() => {
                deleteTodo(selectedTodo.id);
                setSelectedTodo(null);
              }}
              data-testid="drawer-delete-btn"
              title="Delete Todo"
              style={{ color: "var(--color-danger)" }}
            >
              <Trash2 size={15} />
            </button>

            <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

            {/* Close Drawer Button */}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setSelectedTodo(null)}
              data-testid="drawer-close-btn"
              aria-label="Close Drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="todo-drawer-body">
          {/* Editable Title */}
          <div>
            <textarea
              data-testid="drawer-title-input"
              className="todo-drawer-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              rows={2}
              placeholder="What needs to be done?"
            />
          </div>

          {/* Configuration Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr",
              rowGap: "12px",
              columnGap: "8px",
              alignItems: "center",
              padding: "12px 14px",
              backgroundColor: "var(--bg-app)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Cadence Selection */}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
              Cadence
            </span>
            <div>
              <CustomSelect
                options={CADENCE_OPTIONS}
                value={cadence}
                onChange={handleCadenceChange}
                size="sm"
              />
              {cadenceCountdown && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-primary)",
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Clock size={11} />
                  <span>{cadenceCountdown}</span>
                </div>
              )}
            </div>

            {/* Custom List Tag (if Cadence is Custom) */}
            {cadence === "custom" && (
              <>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                  List Tag
                </span>
                <div>
                  <input
                    type="text"
                    value={customList}
                    onChange={(e) => setCustomList(e.target.value)}
                    onBlur={() => updateTodo(selectedTodo.id, { custom_list: customList.trim() || null })}
                    placeholder="e.g. Braindump, Ideas..."
                    style={{
                      width: "100%",
                      fontSize: "var(--text-xs)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </>
            )}

            {/* Due Date */}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
              Due Date
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="date"
                  data-testid="drawer-due-date-input"
                  value={targetDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={{
                    fontSize: "var(--text-xs)",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    colorScheme: "dark",
                    outline: "none",
                  }}
                />
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => handleDateChange("")}
                    className="btn-ghost btn-sm"
                    style={{ fontSize: "11px", height: "24px", padding: "0 6px" }}
                    title="Clear Date"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Date Shortcuts */}
              <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="btn-ghost btn-sm"
                  style={{ fontSize: "10px", height: "20px", padding: "0 6px" }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="btn-ghost btn-sm"
                  style={{ fontSize: "10px", height: "20px", padding: "0 6px" }}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="btn-ghost btn-sm"
                  style={{ fontSize: "10px", height: "20px", padding: "0 6px" }}
                >
                  +1 Week
                </button>
                {dueCountdown && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: dueCountdown.includes("Overdue") ? "var(--color-danger)" : "var(--text-muted)",
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <Calendar size={11} />
                    <span>{dueCountdown}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Priority */}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
              Priority
            </span>
            <div>
              <CustomSelect
                options={PRIORITY_OPTIONS}
                value={priority}
                onChange={handlePriorityChange}
                size="sm"
              />
            </div>
          </div>

          {/* Remind Me Section (Local Timezone Aware) */}
          <div
            data-testid="drawer-remind-me-section"
            style={{
              padding: "14px",
              backgroundColor: "var(--bg-app)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Bell size={14} color="var(--accent-blue)" />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                  Remind Me
                </span>
                {selectedTodo.remind_at && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      color: "var(--accent-blue)",
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              <button
                type="button"
                data-testid="drawer-test-alert-btn"
                onClick={handleTestAlert}
                className="btn-ghost btn-sm"
                style={{ fontSize: "11px", height: "22px", padding: "0 6px", gap: "3px" }}
                title="Send test alert notification with sound"
              >
                <Volume2 size={11} />
                <span>Test Alert</span>
              </button>
            </div>

            {/* Active Reminder Display in Local Timezone */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: selectedTodo.remind_at ? "rgba(59, 130, 246, 0.08)" : "var(--bg-surface)",
                border: `1px solid ${selectedTodo.remind_at ? "rgba(59, 130, 246, 0.25)" : "var(--border-subtle)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={12} color={selectedTodo.remind_at ? "var(--accent-blue)" : "var(--text-muted)"} />
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    color: selectedTodo.remind_at ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {selectedTodo.remind_at
                    ? `${formatLocalReminder(selectedTodo.remind_at)} (${getLocalTimezoneShort()})`
                    : "No reminder scheduled"}
                </span>
              </div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {getLocalTimezoneFull()}
              </span>
            </div>

            {/* Date-time picker input (Using local timezone) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="datetime-local"
                data-testid="drawer-reminder-input"
                value={reminderInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setReminderInput(val);
                  if (val) {
                    const iso = localDatetimeToISO(val);
                    handleScheduleReminder(iso);
                  }
                }}
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "5px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  colorScheme: "dark",
                  outline: "none",
                  flex: 1,
                }}
              />

              {selectedTodo.remind_at && (
                <button
                  type="button"
                  data-testid="drawer-clear-reminder-btn"
                  onClick={handleClearReminder}
                  className="btn-ghost btn-sm"
                  style={{ fontSize: "11px", height: "28px", padding: "0 8px" }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick reminder presets in local time */}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="drawer-remind-now-btn"
                onClick={setNowReminder}
                className="btn-secondary btn-sm"
                style={{ fontSize: "var(--text-xs)", height: "22px", padding: "0 8px", fontWeight: 600, color: "var(--accent-blue)" }}
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setQuickReminder(15)}
                className="btn-secondary btn-sm"
                style={{ fontSize: "var(--text-xs)", height: "22px", padding: "0 8px" }}
              >
                +15 min
              </button>
              <button
                type="button"
                onClick={() => setQuickReminder(60)}
                className="btn-secondary btn-sm"
                style={{ fontSize: "var(--text-xs)", height: "22px", padding: "0 8px" }}
              >
                +1 hour
              </button>
              <button
                type="button"
                onClick={setTonightReminder}
                className="btn-secondary btn-sm"
                style={{ fontSize: "var(--text-xs)", height: "22px", padding: "0 8px" }}
              >
                Tonight 8 PM
              </button>
              <button
                type="button"
                onClick={setTomorrowMorningReminder}
                className="btn-secondary btn-sm"
                style={{ fontSize: "var(--text-xs)", height: "22px", padding: "0 8px" }}
              >
                Tomorrow 9 AM
              </button>
            </div>

            {reminderStatusNotice && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", fontWeight: 500 }}>
                {reminderStatusNotice}
              </div>
            )}
          </div>

          {/* Checkbox Steps Checklist ("add check box steps") */}
          <div
            data-testid="drawer-checklist-section"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                Checklist Steps
              </span>

              {steps.length > 0 && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {completedStepsCount} of {steps.length} done ({progressPercent}%)
                </span>
              )}
            </div>

            {/* Slim progress bar */}
            {steps.length > 0 && (
              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  backgroundColor: "var(--bg-surface-active)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    backgroundColor: progressPercent === 100 ? "var(--color-success)" : "var(--color-primary)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            )}

            {/* Steps List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {steps.map((step) => (
                <div
                  key={step.id}
                  data-testid={`drawer-step-item-${step.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-subtle)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  {/* Step Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleStep(selectedTodo.id, step.id)}
                    data-testid={`drawer-step-checkbox-${step.id}`}
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "3px",
                      border: step.completed
                        ? "1px solid var(--color-primary)"
                        : "1px solid var(--border-default)",
                      backgroundColor: step.completed ? "var(--color-primary)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    {step.completed && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                  </button>

                  {/* Step Text */}
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      flex: 1,
                      color: step.completed ? "var(--text-muted)" : "var(--text-primary)",
                      textDecoration: step.completed ? "line-through" : "none",
                    }}
                  >
                    {step.text}
                  </span>

                  {/* Delete Step */}
                  <button
                    type="button"
                    onClick={() => removeStep(selectedTodo.id, step.id)}
                    data-testid={`drawer-delete-step-${step.id}`}
                    className="btn-ghost btn-sm"
                    style={{
                      padding: "2px",
                      height: "20px",
                      width: "20px",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Remove step"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Step Form */}
            <form onSubmit={handleAddStepSubmit} style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
              <input
                ref={newStepInputRef}
                type="text"
                data-testid="drawer-new-step-input"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="+ Add a step (Press Enter)..."
                style={{
                  flex: 1,
                  fontSize: "var(--text-xs)",
                  padding: "5px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                data-testid="drawer-add-step-btn"
                className="btn-secondary btn-sm"
                style={{ height: "28px", padding: "0 10px", fontSize: "11px" }}
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </form>
          </div>

          {/* Notes Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FileText size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                Unstructured Thoughts &amp; Notes
              </span>
            </div>

            <textarea
              data-testid="drawer-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Dump freeform ideas, links, background details, or next actions..."
              style={{
                width: "100%",
                fontSize: "var(--text-xs)",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          {/* Timestamp footer */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
            }}
          >
            <span>Created: {new Date(selectedTodo.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(selectedTodo.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </>
  );
}
