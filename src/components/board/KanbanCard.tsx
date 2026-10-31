import React, { useState, useRef } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Equal,
  ArrowDown,
  Calendar,
  MoreVertical,
  CheckSquare,
} from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { useProject } from "../../context/ProjectContext";
import { PriorityIcon as LinearPriorityIcon } from "../ui/PriorityIcon";
import { TicketContextMenu, type ContextMenuPosition } from "./TicketContextMenu";
import type { TicketRecord, TicketPriority } from "../../lib/tickets/ticketService";

interface KanbanCardProps {
  ticket: TicketRecord;
  columnStateId: string;
}

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

export function KanbanCard({ ticket, columnStateId: _columnStateId }: KanbanCardProps) {
  const { openTicketDetail, subtaskProgress } = useTickets();
  const { epics } = useProject();
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const hasDraggedRef = useRef(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const epic = ticket.epic_id ? epics.find((e) => e.id === ticket.epic_id) : null;

  // Check if due date is overdue
  const isOverdue = ticket.due_date
    ? new Date(ticket.due_date).getTime() < new Date().setHours(0, 0, 0, 0)
    : false;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", ticket.id);
    e.dataTransfer.setData("text", ticket.id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    hasDraggedRef.current = true;
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);
  };

  const handleClick = () => {
    if (hasDraggedRef.current) return;
    openTicketDetail(ticket.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleMenuBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contextMenuPos) {
      setContextMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenuPos({ x: rect.left, y: rect.bottom + 4 });
    }
  };

  return (
    <>
      <div
        className={`kanban-card ${isDragging ? "dragging" : ""}`}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Card Header: Identifier, Priority, Epic Pill, and Actions */}
        <div className="kanban-card-header">
          <div className="kanban-card-header-left">
            <span className="kanban-card-id">{ticket.identifier}</span>

            {ticket.priority !== "none" && (
              <span
                className="kanban-card-priority"
                title={`Priority: ${PRIORITY_CONFIG[ticket.priority].label}`}
              >
                <LinearPriorityIcon priority={ticket.priority} size={13} />
              </span>
            )}
          </div>

          <div className="kanban-card-header-right">
            {epic && (
              <span
                className="kanban-card-epic-pill"
                style={{
                  color: epic.color,
                  backgroundColor: `${epic.color}1A`,
                  borderColor: `${epic.color}33`,
                }}
                title={`Epic: ${epic.title}`}
              >
                {epic.title}
              </span>
            )}

            <button
              ref={menuBtnRef}
              type="button"
              className="kanban-card-menu-btn"
              onClick={handleMenuBtnClick}
              title="Ticket actions"
              aria-label="Ticket actions"
            >
              <MoreVertical size={13} />
            </button>
          </div>
        </div>

        {/* Card Title */}
        <h4 className="kanban-card-title" title={ticket.title}>
          {ticket.title}
        </h4>

        {/* Card Footer: Due Date, Subtasks, Labels, Estimate */}
        <div className="kanban-card-footer">
          <div className="kanban-card-footer-left">
            {ticket.due_date && (
              <span
                className={`kanban-card-pill ${isOverdue ? "overdue" : ""}`}
                title={isOverdue ? "Overdue" : "Due date"}
              >
                <Calendar size={12} />
                <span>{ticket.due_date}</span>
              </span>
            )}

            {subtaskProgress[ticket.id] && subtaskProgress[ticket.id].total > 0 && (
              <span
                className={`kanban-card-pill ${
                  subtaskProgress[ticket.id].completed === subtaskProgress[ticket.id].total
                    ? "subtasks-complete"
                    : ""
                }`}
                title={`Subtasks: ${subtaskProgress[ticket.id].completed} of ${subtaskProgress[ticket.id].total} completed`}
              >
                <CheckSquare size={12} />
                <span>
                  {subtaskProgress[ticket.id].completed}/{subtaskProgress[ticket.id].total}
                </span>
              </span>
            )}

            {ticket.labels && ticket.labels.length > 0 && (
              <div className="kanban-card-labels">
                {ticket.labels.slice(0, 2).map((lbl) => (
                  <span key={lbl} className="kanban-card-label-chip">
                    {lbl}
                  </span>
                ))}
                {ticket.labels.length > 2 && (
                  <span className="kanban-card-label-overflow">
                    +{ticket.labels.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {ticket.estimate !== null && ticket.estimate !== undefined && (
            <span className="kanban-card-pill estimate" title="Estimate points">
              {ticket.estimate} pts
            </span>
          )}
        </div>
      </div>

      {contextMenuPos && (
        <TicketContextMenu
          ticket={ticket}
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </>
  );
}
