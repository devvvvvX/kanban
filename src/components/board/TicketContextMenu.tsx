import React, { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  PanelRight,
  ChevronRight,
  Copy,
  CopyPlus,
  Archive,
  RotateCcw,
  Trash2,
  Check,
} from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { StatusIcon } from "../ui/StatusIcon";
import type { TicketRecord } from "../../lib/tickets/ticketService";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface TicketContextMenuProps {
  ticket: TicketRecord;
  position: ContextMenuPosition;
  onClose: () => void;
}

export function TicketContextMenu({
  ticket,
  position,
  onClose,
}: TicketContextMenuProps) {
  const {
    openTicketDetail,
    deleteTicket,
    moveTicket,
    duplicateTicket,
    archiveTicket,
    restoreTicket,
    workflowStates,
  } = useTickets();
  const { openTicketTab } = useTabs();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Adjust menu coordinates so it doesn't overflow viewport
  const menuWidth = 190;
  const menuHeight = 220;
  const posX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const posY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const handleOpenDrawer = () => {
    onClose();
    openTicketDetail(ticket.id);
  };

  const handleOpenTab = () => {
    onClose();
    openTicketTab(ticket.id, ticket.title, ticket.identifier);
  };

  const handleDuplicate = () => {
    onClose();
    const dup = duplicateTicket(ticket.id);
    if (dup) {
      openTicketTab(dup.id, dup.title, dup.identifier);
    }
  };

  const handleToggleArchive = () => {
    onClose();
    if (ticket.is_archived === 1) {
      restoreTicket(ticket.id);
    } else {
      archiveTicket(ticket.id);
    }
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ticket.identifier);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const handleMove = (stateId: string) => {
    moveTicket(ticket.id, stateId);
    onClose();
  };

  const handleDelete = () => {
    deleteTicket(ticket.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="ticket-context-menu"
      style={{
        position: "fixed",
        top: posY,
        left: posX,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with ticket identifier */}
      <div className="ticket-context-menu-header">
        <span className="ticket-context-menu-id">{ticket.identifier}</span>
        <span className="ticket-context-menu-title" title={ticket.title}>
          {ticket.title}
        </span>
      </div>

      <div className="ticket-context-menu-divider" />

      {/* 1. Open Details Drawer */}
      <button
        type="button"
        className="ticket-context-menu-item"
        onClick={handleOpenDrawer}
      >
        <PanelRight size={14} />
        <span>Open in Drawer</span>
      </button>

      {/* 2. Open in New Tab */}
      <button
        type="button"
        className="ticket-context-menu-item"
        onClick={handleOpenTab}
      >
        <ExternalLink size={14} />
        <span>Open in New Tab</span>
      </button>

      {/* 3. Duplicate Ticket */}
      <button
        type="button"
        className="ticket-context-menu-item"
        onClick={handleDuplicate}
        data-testid="context-menu-duplicate-btn"
      >
        <CopyPlus size={14} />
        <span>Duplicate Ticket</span>
      </button>

      {/* 4. Copy Identifier */}
      <button
        type="button"
        className="ticket-context-menu-item"
        onClick={handleCopyId}
      >
        {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
        <span>{copied ? "Copied ID" : `Copy ${ticket.identifier}`}</span>
      </button>

      <div className="ticket-context-menu-divider" />

      {/* 4. Move to State Submenu */}
      <div
        className="ticket-context-menu-submenu-trigger"
        onMouseEnter={() => setShowMoveSubmenu(true)}
        onMouseLeave={() => setShowMoveSubmenu(false)}
      >
        <div className="ticket-context-menu-item" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Move to</span>
          </div>
          <ChevronRight size={12} color="var(--text-muted)" />
        </div>

        {showMoveSubmenu && (
          <div className="ticket-context-submenu">
            {workflowStates.map((ws) => {
              const isCurrent = ws.id === ticket.workflow_state_id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  className={`ticket-context-menu-item ${isCurrent ? "active" : ""}`}
                  onClick={() => handleMove(ws.id)}
                  disabled={isCurrent}
                >
                  <StatusIcon category={ws.category} color={ws.color} size={13} />
                  <span>{ws.name}</span>
                  {isCurrent && <Check size={12} color="#10B981" style={{ marginLeft: "auto" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="ticket-context-menu-divider" />

      {/* 6. Archive / Restore Ticket */}
      <button
        type="button"
        className="ticket-context-menu-item"
        onClick={handleToggleArchive}
        data-testid="context-menu-archive-btn"
      >
        {ticket.is_archived === 1 ? <RotateCcw size={14} /> : <Archive size={14} />}
        <span>{ticket.is_archived === 1 ? "Restore Ticket" : "Archive Ticket"}</span>
      </button>

      {/* 7. Delete Ticket */}
      <button
        type="button"
        className="ticket-context-menu-item danger"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        <span>Delete Ticket</span>
      </button>
    </div>
  );
}
