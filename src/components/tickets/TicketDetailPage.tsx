import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Archive,
  Trash2,
  X,
  Calendar,
  Tag,
  Clock,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Eye,
  Edit3,
  MessageSquare,
  History,
  Folder,
  Milestone,
  RotateCcw,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { SubtaskList } from "./SubtaskList";
import { DependencySection } from "./DependencySection";
import { CommentSection } from "./CommentSection";
import { ActivityTimeline } from "./ActivityTimeline";
import { TicketAttachmentsSection } from "./TicketAttachmentsSection";
import { MarkdownRenderer, toggleMarkdownTask } from "../common/MarkdownRenderer";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import type { TicketPriority } from "../../lib/tickets/ticketService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

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

interface TicketDetailPageProps {
  ticketId: string;
  tabId: string;
}

export function TicketDetailPage({ ticketId, tabId }: TicketDetailPageProps) {
  const { activeProject, projects, selectProject, epics, createEpic } = useProject();
  const {
    tickets,
    archivedTickets,
    workflowStates,
    updateTicket,
    duplicateTicket,
    archiveTicket,
    restoreTicket,
    deleteTicket,
    refreshTickets,
    refreshArchivedTickets,
  } = useTickets();
  const { closeTab, switchToHome, openEpicTab, openTicketTab } = useTabs();

  const ticket = tickets.find((t) => t.id === ticketId) || archivedTickets.find((t) => t.id === ticketId);
  useEffect(() => {
    if (!ticket) {
      refreshTickets();
      refreshArchivedTickets();
    }
  }, [ticket, refreshTickets, refreshArchivedTickets]);
  const project = activeProject || (ticket ? projects.find((p) => p.id === ticket.project_id) : null);
  const ticketEpic = ticket?.epic_id ? epics.find((e) => e.id === ticket.epic_id) : null;

  const titleTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workflowStateId, setWorkflowStateId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("none");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [isPreviewDesc, setIsPreviewDesc] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"comments" | "activity">("comments");

  useEscapeKey(showDeleteConfirm, () => setShowDeleteConfirm(false));
  useEscapeKey(!showDeleteConfirm, () => closeTab(tabId));

  // Sync state when ticket is loaded or updated
  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description || "");
      setWorkflowStateId(ticket.workflow_state_id);
      setEpicId(ticket.epic_id || "");
      setPriority(ticket.priority);
      setDueDate(ticket.due_date || "");
      setEstimate(ticket.estimate !== null && ticket.estimate !== undefined ? String(ticket.estimate) : "");
      setLabels(ticket.labels || []);
      setLabelInput("");
    }
  }, [ticket]);

  // Esc key listener to close page tab and return to board
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showDeleteConfirm) {
        closeTab(tabId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeTab, tabId, showDeleteConfirm]);

  if (!ticket) {
    return (
      <div
        style={{
          padding: "var(--space-8)",
          textAlign: "center",
          color: "var(--text-secondary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <p>This ticket could not be found or has been removed.</p>
        <button className="btn-secondary" onClick={() => closeTab(tabId)}>
          Close Tab
        </button>
      </div>
    );
  }

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== ticket.title) {
      updateTicket(ticket.id, { title: trimmed });
    } else {
      setTitle(ticket.title);
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (ticket.description || "")) {
      updateTicket(ticket.id, { description: description.trim() || null });
    }
  };

  const handleToggleTask = (taskIndex: number, newChecked: boolean) => {
    const updated = toggleMarkdownTask(description, taskIndex, newChecked);
    setDescription(updated);
    updateTicket(ticket.id, { description: updated });
  };

  const handleStateChange = (newStateId: string) => {
    setWorkflowStateId(newStateId);
    updateTicket(ticket.id, { workflowStateId: newStateId });
  };

  const handlePriorityChange = (newPriority: TicketPriority) => {
    setPriority(newPriority);
    updateTicket(ticket.id, { priority: newPriority });
  };

  const handleEpicChange = (newEpicId: string) => {
    setEpicId(newEpicId);
    updateTicket(ticket.id, { epicId: newEpicId || null });
  };

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate);
    updateTicket(ticket.id, { dueDate: newDate || null });
  };

  const handleEstimateBlur = () => {
    const parsed = estimate.trim() ? parseInt(estimate, 10) : null;
    if (parsed !== ticket.estimate) {
      updateTicket(ticket.id, { estimate: parsed });
    }
  };

  const handleAddLabel = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = labelInput.trim().replace(/,/g, "");
      if (trimmed && !labels.includes(trimmed)) {
        const nextLabels = [...labels, trimmed];
        setLabels(nextLabels);
        setLabelInput("");
        updateTicket(ticket.id, { labels: nextLabels });
      }
    }
  };

  const handleRemoveLabel = (tagToRemove: string) => {
    const nextLabels = labels.filter((t) => t !== tagToRemove);
    setLabels(nextLabels);
    updateTicket(ticket.id, { labels: nextLabels });
  };

  const handleDuplicate = () => {
    if (!ticket) return;
    const dup = duplicateTicket(ticket.id);
    if (dup) {
      openTicketTab(dup.id, dup.title, dup.identifier);
    }
  };

  const handleArchive = () => {
    if (!ticket) return;
    archiveTicket(ticket.id);
  };

  const handleRestore = () => {
    if (!ticket) return;
    restoreTicket(ticket.id);
  };

  const handleDelete = () => {
    deleteTicket(ticket.id);
    closeTab(tabId);
  };

  const handleConvertToEpic = () => {
    if (!ticket) return;
    try {
      const newEpic = createEpic({
        title: ticket.title,
        description: ticket.description || undefined,
        targetDate: ticket.due_date || undefined,
        color: "#8B5CF6",
      });
      archiveTicket(ticket.id);
      closeTab(tabId);
      openEpicTab(newEpic.id, newEpic.title);
    } catch (err) {
      console.error("Failed to convert ticket to epic:", err);
    }
  };

  return (
    <div
      className="ticket-detail-page"
      data-testid="ticket-detail-page"
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-app)",
        overflowY: "auto",
      }}
    >
      {/* Top Page Header Bar */}
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
        <div
          data-testid="ticket-breadcrumbs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          <button
            type="button"
            className="btn-ghost"
            onClick={switchToHome}
            title="Return to Home board"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "var(--text-xs)",
              height: "28px",
              padding: "0 8px",
              whiteSpace: "nowrap",
            }}
          >
            <ArrowLeft size={14} />
            <span>Home</span>
          </button>

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)", userSelect: "none" }}>/</span>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (project) {
                selectProject(project.id);
              }
              switchToHome();
            }}
            title={`Go to ${project ? project.name : "Project"}`}
            style={{
              height: "28px",
              padding: "0 8px",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              maxWidth: "220px",
              whiteSpace: "nowrap",
            }}
          >
            <Folder size={12} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project ? project.name : "Project"}
            </span>
          </button>

          {ticketEpic && (
            <>
              <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)", userSelect: "none" }}>/</span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => openEpicTab(ticketEpic.id, ticketEpic.title)}
                title={`Open Epic: ${ticketEpic.title}`}
                style={{
                  height: "28px",
                  padding: "0 8px",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  maxWidth: "180px",
                  whiteSpace: "nowrap",
                }}
              >
                <Milestone size={12} color={ticketEpic.color} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ticketEpic.title}
                </span>
              </button>
            </>
          )}

          <span style={{ color: "var(--border-hover)", fontSize: "var(--text-xs)", userSelect: "none" }}>/</span>

          <button
            type="button"
            data-testid="ticket-identifier-badge"
            className="btn-ghost"
            onClick={() => titleTextareaRef.current?.focus()}
            title="Focus ticket title"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--accent-blue)",
              padding: "2px 8px",
              backgroundColor: "var(--accent-blue-subtle)",
              borderRadius: "var(--radius-sm)",
              whiteSpace: "nowrap",
              height: "26px",
            }}
          >
            {ticket.identifier}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            data-testid="convert-to-epic-btn"
            className="btn btn-secondary btn-sm"
            onClick={handleConvertToEpic}
            title="Convert this ticket into an Epic"
          >
            <Milestone size={13} color="#8B5CF6" />
            <span>Convert to Epic</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDuplicate} title="Duplicate ticket">
            <Copy size={13} />
            <span>Duplicate</span>
          </button>
          {ticket.is_archived === 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRestore}
              title="Restore ticket to board"
              data-testid="page-restore-btn"
            >
              <RotateCcw size={13} />
              <span>Restore</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleArchive}
              title="Archive ticket"
              data-testid="page-archive-btn"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete ticket"
            style={{ color: "var(--color-danger)" }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
          <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)", margin: "0 4px" }} />
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => closeTab(tabId)}
            title="Close detail"
            aria-label="Close detail"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Archived Notice Banner */}
      {ticket.is_archived === 1 && (
        <div
          data-testid="page-archived-banner"
          style={{
            margin: "var(--space-4) var(--space-8) 0",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            color: "#F59E0B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "var(--text-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Archive size={16} />
            <span>This ticket is archived and hidden from active boards and lists.</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleRestore}
              style={{ height: 28, padding: "0 10px", fontSize: "var(--text-xs)", gap: 4 }}
            >
              <RotateCcw size={12} />
              <span>Restore to Board</span>
            </button>
            <button
              type="button"
              className="btn-danger-ghost btn-sm"
              onClick={() => setShowDeleteConfirm(true)}
              style={{ height: 28, padding: "0 10px", fontSize: "var(--text-xs)", gap: 4 }}
            >
              <Trash2 size={12} />
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Page Layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          maxWidth: "1380px",
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-8)",
          gap: "var(--space-8)",
          boxSizing: "border-box",
        }}
      >
        {/* Left / Primary Column */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Editable Title */}
          <div>
            <textarea
              ref={titleTextareaRef}
              data-testid="ticket-detail-title-input"
              className="ticket-detail-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Ticket title..."
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                color: "var(--text-primary)",
                backgroundColor: "transparent",
                border: "1px solid transparent",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-2) var(--space-3)",
                outline: "none",
                fontFamily: "var(--font-sans)",
                letterSpacing: "-0.01em",
                resize: "none",
                transition: "border-color var(--transition-fast)",
              }}
            />
          </div>

          {/* Description Section with Markdown Editor & Preview */}
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
                  data-testid="edit-desc-btn"
                  className={`btn-ghost ${!isPreviewDesc ? "active" : ""}`}
                  style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)", gap: "4px" }}
                  onClick={() => setIsPreviewDesc(false)}
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  data-testid="preview-desc-btn"
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
                data-testid="ticket-description-preview"
                style={{
                  minHeight: "120px",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "text",
                }}
                onDoubleClick={() => setIsPreviewDesc(false)}
                title="Double-click to edit description"
              >
                <MarkdownRenderer
                  content={description}
                  onToggleTask={handleToggleTask}
                />
              </div>
            ) : (
              <textarea
                data-testid="ticket-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder="Add Markdown description, specifications, or acceptance criteria..."
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
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.5,
                  resize: "none",
                  outline: "none",
                }}
              />
            )}
          </div>

          {/* Subtasks Checklist Section */}
          <SubtaskList ticketId={ticket.id} />

          {/* Dependencies Section */}
          <DependencySection ticketId={ticket.id} />

          {/* Image & Video Attachments Section */}
          <TicketAttachmentsSection ticketId={ticket.id} />

          {/* Comments & Activity Timeline */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
            }}
          >
            <div
              data-testid="bottom-tabs-nav"
              style={{
                display: "flex",
                gap: "8px",
                borderBottom: "1px solid var(--border-subtle)",
                paddingBottom: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
            >
              <button
                type="button"
                data-testid="tab-comments-btn"
                className={`btn-ghost ${activeBottomTab === "comments" ? "active" : ""}`}
                style={{
                  height: "32px",
                  padding: "0 14px",
                  fontSize: "var(--text-xs)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: activeBottomTab === "comments" ? 600 : 500,
                  backgroundColor: activeBottomTab === "comments" ? "var(--bg-card)" : "transparent",
                  color: activeBottomTab === "comments" ? "var(--text-primary)" : "var(--text-secondary)",
                  border: activeBottomTab === "comments" ? "1px solid var(--border-default)" : "1px solid transparent",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setActiveBottomTab("comments")}
              >
                <MessageSquare size={14} color={activeBottomTab === "comments" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                <span>Comments</span>
              </button>
              <button
                type="button"
                data-testid="tab-activity-btn"
                className={`btn-ghost ${activeBottomTab === "activity" ? "active" : ""}`}
                style={{
                  height: "32px",
                  padding: "0 14px",
                  fontSize: "var(--text-xs)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: activeBottomTab === "activity" ? 600 : 500,
                  backgroundColor: activeBottomTab === "activity" ? "var(--bg-card)" : "transparent",
                  color: activeBottomTab === "activity" ? "var(--text-primary)" : "var(--text-secondary)",
                  border: activeBottomTab === "activity" ? "1px solid var(--border-default)" : "1px solid transparent",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setActiveBottomTab("activity")}
              >
                <History size={14} color={activeBottomTab === "activity" ? "var(--accent-blue)" : "var(--text-secondary)"} />
                <span>Activity</span>
              </button>
            </div>

            {activeBottomTab === "comments" ? (
              <CommentSection ticketId={ticket.id} />
            ) : (
              <ActivityTimeline ticketId={ticket.id} />
            )}
          </div>
        </div>

        {/* Right / Metadata Sidebar */}
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
              Properties
            </h3>

            {/* Workflow State Picker */}
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500 }}>
                Status
              </label>
              <CustomSelect
                fullWidth
                size="sm"
                value={workflowStateId}
                onChange={(val) => handleStateChange(val)}
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
                onChange={(val) => handlePriorityChange(val as TicketPriority)}
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
                onChange={(val) => handleEpicChange(val)}
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
                onChange={(e) => handleDueDateChange(e.target.value)}
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
                onBlur={handleEstimateBlur}
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
                      <X size={12} />
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

          {/* Timestamps Card */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={12} />
              <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
            </div>
            {ticket.updated_at && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={12} />
                <span>Updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-card"
            style={{
              width: "420px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-6)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-danger)", marginBottom: "var(--space-2)" }}>
              Delete Ticket
            </h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
              Are you sure you want to delete <strong>{ticket.identifier}: {ticket.title}</strong>? All subtasks and comments will be permanently removed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                onClick={handleDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
