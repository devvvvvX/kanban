import React, { useState, useMemo } from "react";
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  ExternalLink,
  Folder,
} from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { useProject } from "../../context/ProjectContext";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import type { TicketRecord } from "../../lib/tickets/ticketService";
import type { WorkflowStateCategory } from "../../lib/tickets/workflowStateService";

export const ArchivedTicketsPage: React.FC = () => {
  const {
    archivedTickets,
    restoreTicket,
    deleteTicket,
    openTicketDetail,
    workflowStates,
  } = useTickets();

  const { openTicketTab } = useTabs();
  const { projects } = useProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const stateMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; category: WorkflowStateCategory }>();
    workflowStates.forEach((ws) => {
      map.set(ws.id, { name: ws.name, color: ws.color, category: ws.category });
    });
    return map;
  }, [workflowStates]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => {
      map.set(p.id, p.name);
    });
    return map;
  }, [projects]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return archivedTickets.filter((t) => {
      if (selectedProjectId !== "all" && t.project_id !== selectedProjectId) {
        return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.identifier.toLowerCase().includes(q) ||
        (t.labels && t.labels.some((l) => l.toLowerCase().includes(q)))
      );
    });
  }, [archivedTickets, searchQuery, selectedProjectId]);

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
  };

  return (
    <div
      data-testid="archived-tickets-page"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-app)",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Page Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
            <Archive size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Archived Tickets
              </h1>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                {archivedTickets.length} total
              </span>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Completed or inactive tickets safely preserved outside active Kanban boards
            </p>
          </div>
        </div>

        {/* Search & Project Filter Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Project Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Folder size={14} color="var(--text-muted)" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                height: 30,
                padding: "0 8px",
                fontSize: "var(--text-xs)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", width: 240 }}>
            <Search
              size={13}
              style={{ position: "absolute", left: 10, top: 8, color: "var(--text-muted)" }}
            />
            <input
              type="text"
              data-testid="archived-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived tickets..."
              style={{
                width: "100%",
                height: 30,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: "var(--text-xs)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Main List Table / Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {filteredTickets.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Archive size={36} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
              {searchQuery || selectedProjectId !== "all"
                ? "No archived tickets match your filters"
                : "No archived tickets"}
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", maxWidth: 360, margin: 0 }}>
              Tickets you archive from boards or detail drawers will be preserved here and can be restored anytime.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxWidth: 1000,
              margin: "0 auto",
            }}
          >
            {filteredTickets.map((ticket) => {
              const state = stateMap.get(ticket.workflow_state_id);
              const projectName = projectMap.get(ticket.project_id) || "Project";
              const isConfirmingDelete = deleteConfirmId === ticket.id;

              return (
                <div
                  key={ticket.id}
                  data-testid={`archived-ticket-row-${ticket.identifier}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {/* Left: Identifier, Status, Title, Labels */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        color: "var(--accent-blue)",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-xs)",
                        flexShrink: 0,
                      }}
                    >
                      {ticket.identifier}
                    </span>

                    {state && (
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                        title={`State: ${state.name}`}
                      >
                        <StatusIcon category={state.category} color={state.color} size={13} />
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {state.name}
                        </span>
                      </div>
                    )}

                    <PriorityIcon priority={ticket.priority} size={13} />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        onClick={() => handleOpenTicket(ticket)}
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={ticket.title}
                      >
                        {ticket.title}
                      </span>

                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        ({projectName})
                      </span>
                    </div>

                    {ticket.labels && ticket.labels.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {ticket.labels.slice(0, 3).map((lbl) => (
                          <span
                            key={lbl}
                            style={{
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "var(--radius-full)",
                              backgroundColor: "var(--bg-subtle)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Actions: Open Tab, Open Drawer, Restore, Delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
                    {isConfirmingDelete ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "11px", color: "var(--accent-red)", fontWeight: 600 }}>
                          Permanently delete?
                        </span>
                        <button
                          type="button"
                          data-testid="confirm-delete-btn"
                          onClick={() => handlePermanentDelete(ticket.id)}
                          className="btn-danger btn-sm"
                          style={{ height: 24, padding: "0 8px", fontSize: "11px" }}
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="btn-ghost btn-sm"
                          style={{ height: 24, padding: "0 6px", fontSize: "11px" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenTab(ticket)}
                          className="btn-ghost btn-sm"
                          style={{ height: 26, padding: "0 6px", gap: 4, fontSize: "11px" }}
                          title="Open ticket in tab"
                        >
                          <ExternalLink size={12} />
                          <span>Tab</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`restore-ticket-btn-${ticket.identifier}`}
                          onClick={() => handleRestore(ticket.id)}
                          className="btn-secondary btn-sm"
                          style={{ height: 26, padding: "0 8px", gap: 4, fontSize: "11px" }}
                          title="Restore ticket to active board"
                        >
                          <RotateCcw size={12} />
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-archived-btn-${ticket.identifier}`}
                          onClick={() => setDeleteConfirmId(ticket.id)}
                          className="btn-ghost btn-sm danger"
                          style={{ height: 26, width: 26, padding: 0 }}
                          title="Delete ticket permanently"
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
    </div>
  );
};
