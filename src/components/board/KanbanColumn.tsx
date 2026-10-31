import React, { useState } from "react";
import { Plus, MoreHorizontal, AlertCircle, ChevronRight, Edit2, Trash2 } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { KanbanCard } from "./KanbanCard";
import { StatusIcon } from "../ui/StatusIcon";
import type { WorkflowStateRecord } from "../../lib/tickets/workflowStateService";
import type { TicketRecord } from "../../lib/tickets/ticketService";

export interface KanbanColumnProps {
  state: WorkflowStateRecord;
  tickets: TicketRecord[];
  onEditColumn: (state: WorkflowStateRecord) => void;
  onDeleteColumn: (state: WorkflowStateRecord) => void;
  isLoading?: boolean;
}

export function KanbanColumn({
  state,
  tickets,
  onEditColumn,
  onDeleteColumn,
  isLoading = false,
}: KanbanColumnProps) {
  const { moveTicket, openQuickCreate } = useTickets();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const count = tickets.length;
  const isWipExceeded = state.wip_limit !== null && count > state.wip_limit;
  const wipWarningMessage = `WIP Limit Exceeded: Stage '${state.name}' allows maximum ${state.wip_limit} tickets (${count} active).`;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only leave if not entering a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const ticketId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    if (ticketId) {
      moveTicket(ticketId, state.id);
    }
  };

  if (isCollapsed) {
    return (
      <div
        className="kanban-column collapsed"
        onClick={() => setIsCollapsed(false)}
        title={`Click to expand ${state.name} (${count} tickets)`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsCollapsed(false);
          }
        }}
      >
        <span
          className="kanban-column-collapsed-dot"
          style={{ backgroundColor: state.color }}
        />
        <span className="kanban-column-collapsed-title">{state.name}</span>
        <span
          className={`kanban-column-collapsed-count ${isWipExceeded ? "exceeded" : ""}`}
          title={isWipExceeded ? wipWarningMessage : `${count} tickets`}
        >
          {count}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`kanban-column ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="kanban-column-header">
        <div className="kanban-column-header-left">
          <span
            className="kanban-column-dot"
            style={{ backgroundColor: "transparent", display: "inline-flex", alignItems: "center" }}
          >
            <StatusIcon category={state.category} color={state.color} size={14} />
          </span>
          <h3 className="kanban-column-title" title={state.name}>
            {state.name}
          </h3>

          {/* Ticket Count & WIP Limit Badge */}
          <span
            className={`wip-limit-badge ${isWipExceeded ? "exceeded" : ""}`}
            title={
              state.wip_limit !== null
                ? isWipExceeded
                  ? wipWarningMessage
                  : `WIP: ${count}/${state.wip_limit}`
                : `${count} tickets`
            }
          >
            {isWipExceeded && <AlertCircle size={12} />}
            <span>{count}</span>
            {state.wip_limit !== null && <span>/{state.wip_limit}</span>}
          </span>
        </div>

        {/* Action Controls */}
        <div className="kanban-column-header-actions">
          <button
            type="button"
            className="btn-ghost kanban-column-action-btn"
            onClick={() => openQuickCreate(state.id)}
            title={`Add ticket to ${state.name}`}
            aria-label={`Add ticket to ${state.name}`}
          >
            <Plus size={14} />
          </button>

          <div className="kanban-column-menu-wrapper">
            <button
              type="button"
              className="btn-ghost kanban-column-action-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Column options"
              aria-label="Column options"
            >
              <MoreHorizontal size={14} />
            </button>

            {isMenuOpen && (
              <div
                className="kanban-column-menu-popover"
                onMouseLeave={() => setIsMenuOpen(false)}
              >
                <button
                  type="button"
                  className="kanban-column-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onEditColumn(state);
                  }}
                >
                  <Edit2 size={13} />
                  <span>Edit Column</span>
                </button>
                <button
                  type="button"
                  className="kanban-column-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCollapsed(true);
                  }}
                >
                  <ChevronRight size={13} />
                  <span>Collapse Column</span>
                </button>
                <div className="kanban-column-menu-divider" />
                <button
                  type="button"
                  className="kanban-column-menu-item danger"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDeleteColumn(state);
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete Column</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards Scrollable Body */}
      <div className="kanban-column-body">
        {isLoading ? (
          <>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </>
        ) : tickets.length === 0 ? (
          <div className="kanban-column-empty">
            No tickets in this stage. Drag tickets here or press Cmd+N to create one.
          </div>
        ) : (
          tickets.map((t) => (
            <KanbanCard key={t.id} ticket={t} columnStateId={state.id} />
          ))
        )}
      </div>
    </div>
  );
}
