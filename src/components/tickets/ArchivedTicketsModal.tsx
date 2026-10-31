import { useState, useMemo } from "react";
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import type { TicketRecord } from "../../lib/tickets/ticketService";

export function ArchivedTicketsModal() {
  const {
    isArchivedModalOpen,
    closeArchivedModal,
    archivedTickets,
    restoreTicket,
    deleteTicket,
    openTicketDetail,
    workflowStates,
  } = useTickets();

  const { openTicketTab } = useTabs();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEscapeKey(isArchivedModalOpen, () => {
    if (deleteConfirmId) {
      setDeleteConfirmId(null);
    } else {
      closeArchivedModal();
    }
  });

  const stateMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; category: string }>();
    workflowStates.forEach((ws) => {
      map.set(ws.id, { name: ws.name, color: ws.color, category: ws.category });
    });
    return map;
  }, [workflowStates]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return archivedTickets;
    return archivedTickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.identifier.toLowerCase().includes(q) ||
        (t.labels && t.labels.some((l) => l.toLowerCase().includes(q)))
    );
  }, [archivedTickets, searchQuery]);

  if (!isArchivedModalOpen) return null;

  const handleRestore = (ticketId: string) => {
    restoreTicket(ticketId);
  };

  const handlePermanentDelete = (ticketId: string) => {
    deleteTicket(ticketId);
    setDeleteConfirmId(null);
  };

  const handleOpenTicket = (ticket: TicketRecord) => {
    openTicketDetail(ticket.id);
  };

  const handleOpenTab = (ticket: TicketRecord) => {
    openTicketTab(ticket.id, ticket.title, ticket.identifier);
    closeArchivedModal();
  };

  return (
    <div
      className="modal-overlay"
      data-testid="archived-tickets-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeArchivedModal();
      }}
    >
      <div
        className="modal-card modal-card-lg"
        data-testid="archived-tickets-modal"
        style={{
          maxWidth: "840px",
          width: "90vw",
          maxHeight: "85vh",
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
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                color: "#F59E0B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Archive size={17} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>
                  Archived Tickets
                </h2>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    backgroundColor: "var(--bg-surface-active)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {archivedTickets.length}
                </span>
              </div>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "2px" }}>
                Archived tickets are safely stored here and excluded from active boards and queries.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={closeArchivedModal}
            aria-label="Close"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div
          style={{
            padding: "var(--space-3) var(--space-6)",
            backgroundColor: "var(--bg-app)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: 1,
              maxWidth: "360px",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              className="modal-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived tickets by key, title, label..."
              style={{
                paddingLeft: "32px",
                paddingRight: searchQuery ? "28px" : "10px",
                height: "32px",
                fontSize: "var(--text-xs)",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 2,
                }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Showing {filteredTickets.length} of {archivedTickets.length} archived
          </div>
        </div>

        {/* List Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            minHeight: "240px",
            maxHeight: "55vh",
          }}
        >
          {archivedTickets.length === 0 ? (
            <div
              style={{
                padding: "var(--space-12) var(--space-6)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-3)",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-surface-active)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <Archive size={24} />
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                  No archived tickets
                </p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "4px" }}>
                  When you archive tickets from the board, list, or drawer, they will appear here.
                </p>
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div
              style={{
                padding: "var(--space-10) var(--space-6)",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                No archived tickets match &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setSearchQuery("")}
                style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)" }}
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredTickets.map((ticket) => {
                const stateInfo = stateMap.get(ticket.workflow_state_id);
                const isConfirmingDelete = deleteConfirmId === ticket.id;

                return (
                  <div
                    key={ticket.id}
                    data-testid={`archived-ticket-row-${ticket.identifier}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      padding: "10px var(--space-6)",
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-surface)",
                      transition: "background-color var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-surface)";
                    }}
                  >
                    {/* Left: Identifier & Title */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 700,
                          color: "var(--accent-blue)",
                          padding: "2px 6px",
                          backgroundColor: "var(--accent-blue-subtle)",
                          borderRadius: "var(--radius-sm)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {ticket.identifier}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenTicket(ticket)}
                        title="Open ticket details drawer"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                          color: "var(--text-primary)",
                          fontSize: "var(--text-sm)",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--accent-blue)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-primary)";
                        }}
                      >
                        {ticket.title}
                      </button>
                    </div>

                    {/* Middle: Badges (State & Priority) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {stateInfo && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-app)",
                            border: "1px solid var(--border-subtle)",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <StatusIcon
                            category={stateInfo.category as any}
                            color={stateInfo.color}
                            size={12}
                          />
                          <span>{stateInfo.name}</span>
                        </div>
                      )}

                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--bg-app)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "var(--text-xs)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <PriorityIcon priority={ticket.priority} size={12} />
                        <span style={{ textTransform: "capitalize" }}>{ticket.priority}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0,
                      }}
                    >
                      {isConfirmingDelete ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent-red)", fontWeight: 600 }}>
                            Delete permanently?
                          </span>
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            style={{ height: 26, padding: "0 8px", fontSize: "var(--text-xs)" }}
                            onClick={() => handlePermanentDelete(ticket.id)}
                            data-testid={`confirm-delete-${ticket.identifier}`}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            style={{ height: 26, padding: "0 8px", fontSize: "var(--text-xs)" }}
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{
                              height: 28,
                              padding: "0 10px",
                              fontSize: "var(--text-xs)",
                              gap: "5px",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            onClick={() => handleRestore(ticket.id)}
                            title="Restore ticket to active board"
                            data-testid={`restore-ticket-${ticket.identifier}`}
                          >
                            <RotateCcw size={12} />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            className="btn-ghost btn-icon btn-sm"
                            style={{ width: 28, height: 28, padding: 0 }}
                            onClick={() => handleOpenTab(ticket)}
                            title="Open ticket in new tab"
                            aria-label="Open in new tab"
                          >
                            <ExternalLink size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn-ghost btn-icon btn-sm danger"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              color: "var(--text-muted)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "var(--accent-red)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                            onClick={() => setDeleteConfirmId(ticket.id)}
                            title="Permanently delete ticket"
                            data-testid={`delete-archived-${ticket.identifier}`}
                            aria-label="Delete ticket"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "var(--space-3) var(--space-6)",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-app)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button type="button" className="btn-secondary btn-sm" onClick={closeArchivedModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
