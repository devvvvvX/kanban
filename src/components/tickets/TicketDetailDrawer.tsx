import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Copy,
  Archive,
  Trash2,
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Eye,
  Edit3,
  MessageSquare,
  History,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import type { TicketPriority } from "../../lib/tickets/ticketService";
import { SubtaskList } from "./SubtaskList";
import { DependencySection } from "./DependencySection";
import { CommentSection } from "./CommentSection";
import { ActivityTimeline } from "./ActivityTimeline";
import { TicketAttachmentsSection } from "./TicketAttachmentsSection";
import { MarkdownRenderer, toggleMarkdownTask } from "../common/MarkdownRenderer";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  urgent: { label: "Urgent", color: "#EF4444", Icon: AlertTriangle },
  high: { label: "High", color: "#F59E0B", Icon: ArrowUp },
  medium: { label: "Medium", color: "#3B82F6", Icon: Equal },
  low: { label: "Low", color: "#64748B", Icon: ArrowDown },
  none: { label: "None", color: "#9CA3AF", Icon: Equal },
};

export function TicketDetailDrawer() {
  const { epics } = useProject();
  const { openTicketTab } = useTabs();
  const {
    selectedTicket,
    closeTicketDetail,
    updateTicket,
    duplicateTicket,
    archiveTicket,
    restoreTicket,
    deleteTicket,
    workflowStates,
  } = useTickets();

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

  // Sync state with selected ticket
  useEffect(() => {
    if (selectedTicket) {
      setTitle(selectedTicket.title);
      setDescription(selectedTicket.description || "");
      setWorkflowStateId(selectedTicket.workflow_state_id);
      setEpicId(selectedTicket.epic_id || "");
      setPriority(selectedTicket.priority);
      setDueDate(selectedTicket.due_date || "");
      setEstimate(selectedTicket.estimate !== null ? String(selectedTicket.estimate) : "");
      setLabels(selectedTicket.labels || []);
      setLabelInput("");
      setIsPreviewDesc(true);
      setShowDeleteConfirm(false);
    }
  }, [selectedTicket]);

  // Manage Escape key dismissals via global LIFO modal stack
  useEscapeKey(Boolean(selectedTicket), closeTicketDetail);
  useEscapeKey(showDeleteConfirm, () => setShowDeleteConfirm(false));

  const stateOptions = useMemo(() => {
    return workflowStates.map((ws) => ({
      value: ws.id,
      label: ws.name,
      color: ws.color,
      icon: <StatusIcon category={ws.category} color={ws.color} size={13} />,
    }));
  }, [workflowStates]);

  const priorityOptions = useMemo(() => {
    const keys: TicketPriority[] = ["urgent", "high", "medium", "low", "none"];
    return keys.map((pKey) => {
      const cfg = PRIORITY_CONFIG[pKey];
      return {
        value: pKey,
        label: cfg.label,
        color: cfg.color,
        icon: <PriorityIcon priority={pKey} size={13} />,
      };
    });
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

  if (!selectedTicket) return null;

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== selectedTicket.title) {
      updateTicket(selectedTicket.id, { title: trimmed });
    } else {
      setTitle(selectedTicket.title);
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (selectedTicket.description || "")) {
      updateTicket(selectedTicket.id, { description: description.trim() || null });
    }
  };

  const handleToggleTask = (taskIndex: number, newChecked: boolean) => {
    const updated = toggleMarkdownTask(description, taskIndex, newChecked);
    setDescription(updated);
    updateTicket(selectedTicket.id, { description: updated });
  };

  const handleStateChange = (newStateId: string) => {
    setWorkflowStateId(newStateId);
    updateTicket(selectedTicket.id, { workflowStateId: newStateId });
  };

  const handlePriorityChange = (newPriority: string) => {
    const p = newPriority as TicketPriority;
    setPriority(p);
    updateTicket(selectedTicket.id, { priority: p });
  };

  const handleEpicChange = (newEpicId: string) => {
    setEpicId(newEpicId);
    updateTicket(selectedTicket.id, { epicId: newEpicId || null });
  };

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate);
    updateTicket(selectedTicket.id, { dueDate: newDate || null });
  };

  const handleEstimateBlur = () => {
    const parsed = estimate.trim() ? parseInt(estimate, 10) : null;
    if (parsed !== selectedTicket.estimate) {
      updateTicket(selectedTicket.id, { estimate: parsed });
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
        updateTicket(selectedTicket.id, { labels: nextLabels });
      }
    }
  };

  const handleRemoveLabel = (tagToRemove: string) => {
    const nextLabels = labels.filter((t) => t !== tagToRemove);
    setLabels(nextLabels);
    updateTicket(selectedTicket.id, { labels: nextLabels });
  };

  const handleDuplicate = () => {
    if (!selectedTicket) return;
    const dup = duplicateTicket(selectedTicket.id);
    if (dup) {
      openTicketTab(dup.id, dup.title, dup.identifier);
      closeTicketDetail();
    }
  };

  const handleArchive = () => {
    if (!selectedTicket) return;
    archiveTicket(selectedTicket.id);
  };

  const handleRestore = () => {
    if (!selectedTicket) return;
    restoreTicket(selectedTicket.id);
  };

  const handleDelete = () => {
    if (!selectedTicket) return;
    deleteTicket(selectedTicket.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="ticket-drawer-backdrop" onClick={closeTicketDetail} />

      {/* Drawer Panel */}
      <div className="ticket-drawer-panel">
        {/* Header */}
        <div className="ticket-drawer-header">
          {/* Ticket Key Badge */}
          <div className="ticket-drawer-key-badge">
            {selectedTicket.identifier}
          </div>

          {/* Action Icons */}
          <div className="ticket-drawer-actions">
            <button
              className="btn-ghost"
              onClick={() => {
                openTicketTab(selectedTicket.id, selectedTicket.title, selectedTicket.identifier);
                closeTicketDetail();
              }}
              title="Open in new tab"
              aria-label="Open in new tab"
            >
              <ExternalLink size={15} />
            </button>
            <button className="btn-ghost" onClick={handleDuplicate} title="Duplicate ticket">
              <Copy size={15} />
            </button>
            {selectedTicket.is_archived === 1 ? (
              <button
                className="btn-ghost"
                onClick={handleRestore}
                title="Restore ticket to board"
                data-testid="drawer-restore-btn"
              >
                <RotateCcw size={15} />
              </button>
            ) : (
              <button
                className="btn-ghost"
                onClick={handleArchive}
                title="Archive ticket"
                data-testid="drawer-archive-btn"
              >
                <Archive size={15} />
              </button>
            )}
            <button
              className="btn-ghost danger"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete ticket"
            >
              <Trash2 size={15} />
            </button>
            <div className="ticket-drawer-actions-divider" />
            <button className="btn-ghost" onClick={closeTicketDetail} aria-label="Close detail">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Archived Notice Banner */}
        {selectedTicket.is_archived === 1 && (
          <div
            data-testid="drawer-archived-banner"
            style={{
              padding: "8px 16px",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderBottom: "1px solid rgba(245, 158, 11, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "var(--text-xs)",
              color: "#F59E0B",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Archive size={14} />
              <span>This ticket is archived</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleRestore}
                style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)" }}
              >
                Restore
              </button>
              <button
                type="button"
                className="btn-danger-ghost btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
                style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)" }}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="ticket-drawer-body">
          {/* Editable Title */}
          <div>
            <textarea
              className="ticket-drawer-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              maxLength={200}
              placeholder="Ticket title..."
            />
          </div>

          {/* 2-Column Properties Grid */}
          <div className="ticket-drawer-grid">
            {/* Status / Column */}
            <span className="ticket-drawer-grid-label">Status</span>
            <div className="ticket-drawer-grid-value">
              <CustomSelect
                options={stateOptions}
                value={workflowStateId}
                onChange={handleStateChange}
                size="sm"
              />
            </div>

            {/* Priority */}
            <span className="ticket-drawer-grid-label">Priority</span>
            <div className="ticket-drawer-grid-value">
              <CustomSelect
                options={priorityOptions}
                value={priority}
                onChange={handlePriorityChange}
                size="sm"
              />
            </div>

            {/* Epic */}
            <span className="ticket-drawer-grid-label">Epic</span>
            <div className="ticket-drawer-grid-value">
              <CustomSelect
                options={epicOptions}
                value={epicId}
                onChange={handleEpicChange}
                size="sm"
              />
            </div>

            {/* Due Date */}
            <span className="ticket-drawer-grid-label">Due Date</span>
            <div className="ticket-drawer-grid-value">
              <input
                type="date"
                className="ticket-drawer-date-input"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
              />
            </div>

            {/* Estimate */}
            <span className="ticket-drawer-grid-label">Estimate</span>
            <div className="ticket-drawer-grid-value">
              <input
                type="number"
                min="0"
                max="100"
                placeholder="pts"
                className="ticket-drawer-number-input"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                onBlur={handleEstimateBlur}
              />
            </div>

            {/* Labels */}
            <span className="ticket-drawer-grid-label">Labels</span>
            <div className="ticket-drawer-grid-value">
              <div className="ticket-drawer-labels-container">
                {labels.map((l) => (
                  <span key={l} className="ticket-drawer-label-chip">
                    {l}
                    <button
                      type="button"
                      className="ticket-drawer-label-remove btn-ghost"
                      onClick={() => handleRemoveLabel(l)}
                      aria-label={`Remove label ${l}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="+ Add label"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={handleAddLabel}
                  className="ticket-drawer-label-input"
                />
              </div>
            </div>
          </div>

          <hr className="ticket-drawer-divider" />

          {/* Description Section with Markdown Edit / Preview Toggle */}
          <div>
            <div className="ticket-drawer-section-header">
              <span className="ticket-drawer-section-title">Description</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-button ${!isPreviewDesc ? "active" : ""}`}
                  onClick={() => setIsPreviewDesc(false)}
                >
                  <Edit3 size={11} /> Edit
                </button>
                <button
                  type="button"
                  className={`segmented-button ${isPreviewDesc ? "active" : ""}`}
                  onClick={() => setIsPreviewDesc(true)}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>
            </div>

            {isPreviewDesc ? (
              <div
                className="ticket-drawer-desc-preview"
                onDoubleClick={() => setIsPreviewDesc(false)}
                title="Double-click to edit description"
              >
                <MarkdownRenderer content={description} onToggleTask={handleToggleTask} />
              </div>
            ) : (
              <textarea
                data-testid="ticket-description-input"
                className="ticket-drawer-desc-edit"
                placeholder="Add Markdown description, acceptance criteria, or technical notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
              />
            )}
          </div>

          <hr className="ticket-drawer-divider" />

          {/* Checklist Subtasks */}
          <SubtaskList ticketId={selectedTicket.id} />

          <hr className="ticket-drawer-divider" />

          {/* Cross-Ticket Dependencies */}
          <DependencySection ticketId={selectedTicket.id} />

          <hr className="ticket-drawer-divider" />

          {/* Attachments Section */}
          <TicketAttachmentsSection ticketId={selectedTicket.id} />

          <hr className="ticket-drawer-divider" />

          {/* Discussion & Activity Tabs */}
          <div className="ticket-drawer-tabs">
            <button
              type="button"
              className={`ticket-drawer-tab-btn ${activeBottomTab === "comments" ? "active" : ""}`}
              onClick={() => setActiveBottomTab("comments")}
            >
              <MessageSquare size={13} />
              <span>Comments</span>
            </button>
            <button
              type="button"
              className={`ticket-drawer-tab-btn ${activeBottomTab === "activity" ? "active" : ""}`}
              onClick={() => setActiveBottomTab("activity")}
            >
              <History size={13} />
              <span>Activity</span>
            </button>
          </div>

          {activeBottomTab === "comments" ? (
            <CommentSection ticketId={selectedTicket.id} />
          ) : (
            <ActivityTimeline ticketId={selectedTicket.id} />
          )}
        </div>

        {/* Footer Meta */}
        <div className="ticket-drawer-footer">
          <span>Created: {new Date(selectedTicket.created_at).toLocaleDateString()}</span>
          <span>Updated: {new Date(selectedTicket.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title modal-title-danger">Delete Ticket</h3>
              <button
                className="btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-body-text">
              Delete Ticket {selectedTicket.identifier}: This action cannot be undone. Are you sure you want to permanently delete '{selectedTicket.title}'?
            </p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
