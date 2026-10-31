import { useState, useMemo } from "react";
import {
  ListTodo,
  Plus,
  Search,
  Calendar,
  CheckSquare,
  FolderPlus,
  X,
  ArrowUpDown,
  FilterX,
  Archive,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import { TicketContextMenu, type ContextMenuPosition } from "./TicketContextMenu";
import type { TicketRecord, TicketPriority } from "../../lib/tickets/ticketService";

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

type SortField = "identifier" | "priority" | "due_date" | "created_at" | "title";

export interface ListViewProps {
  isLoading?: boolean;
}

export function ListView({ isLoading = false }: ListViewProps) {
  const { activeProject, projects, selectProject, epics } = useProject();
  const {
    tickets,
    workflowStates,
    openTicketDetail,
    subtaskProgress,
    listFilterCategory,
    setListFilterCategory,
    updateTicket,
    moveTicket,
    archivedTickets,
    openArchivedModal,
  } = useTickets();
  const { openCreateTab } = useTabs();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStateId, setSelectedStateId] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ ticket: TicketRecord; position: ContextMenuPosition } | null>(null);

  // Ticket counts by state
  const ticketsByStateCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      map[t.workflow_state_id] = (map[t.workflow_state_id] || 0) + 1;
    }
    return map;
  }, [tickets]);

  // Active filters count
  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedStateId !== "all" || selectedPriority !== "all" || listFilterCategory !== "all"
  );
  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (selectedStateId !== "all" ? 1 : 0) +
    (selectedPriority !== "all" ? 1 : 0) +
    (listFilterCategory !== "all" ? 1 : 0);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStateId("all");
    setSelectedPriority("all");
    setListFilterCategory("all");
  };

  // Toggle or set column sort
  const handleHeaderSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchIdentifier = ticket.identifier.toLowerCase().includes(q);
          const matchTitle = ticket.title.toLowerCase().includes(q);
          const matchDesc = ticket.description?.toLowerCase().includes(q);
          const matchLabels = ticket.labels?.some((l) => l.toLowerCase().includes(q));
          if (!matchIdentifier && !matchTitle && !matchDesc && !matchLabels) return false;
        }

        // State filter
        if (selectedStateId !== "all" && ticket.workflow_state_id !== selectedStateId) {
          return false;
        }

        // Priority filter
        if (selectedPriority !== "all" && ticket.priority !== selectedPriority) {
          return false;
        }

        // Category filter (e.g. from Project Overview)
        if (listFilterCategory !== "all") {
          const ws = workflowStates.find((s) => s.id === ticket.workflow_state_id);
          if (listFilterCategory === "open") {
            if (!ws || (ws.category !== "backlog" && ws.category !== "unstarted")) return false;
          } else if (listFilterCategory === "in_progress") {
            if (!ws || ws.category !== "started") return false;
          } else if (listFilterCategory === "completed") {
            if (!ws || ws.category !== "completed") return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === "priority") {
          diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        } else if (sortBy === "identifier") {
          diff = a.ticket_number - b.ticket_number;
        } else if (sortBy === "due_date") {
          const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          diff = dateA - dateB;
        } else if (sortBy === "title") {
          diff = a.title.localeCompare(b.title);
        } else {
          // created_at
          diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return sortAsc ? -diff : diff;
      });
  }, [tickets, searchQuery, selectedStateId, selectedPriority, listFilterCategory, workflowStates, sortBy, sortAsc]);

  // If no project is selected
  if (!activeProject) {
    return (
      <div className="list-view-container">
        <div className="list-view-empty-card">
          <FolderPlus size={40} className="list-view-empty-icon" />
          <h2 className="list-view-empty-title">
            No Project Selected
          </h2>
          <p className="list-view-empty-desc">
            Select an existing project from the sidebar to view and manage its tickets.
          </p>
          {projects.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => selectProject(projects[0].id)}
            >
              Open {projects[0].name}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="list-view-container">
      {/* Top Header */}
      <div className="list-view-header">
        <div className="list-view-header-left">
          <div className="list-view-header-icon">
            <ListTodo size={20} />
          </div>

          <div>
            <div className="list-view-header-title-row">
              <h2 className="list-view-header-title">
                All Tickets
              </h2>
              <span className="list-view-header-badge">
                {hasActiveFilters
                  ? `${filteredTickets.length} of ${tickets.length}`
                  : `${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`}
              </span>
            </div>
            <p className="list-view-header-subtitle">
              Sequential list of tickets in <span className="list-view-header-project-name">{activeProject.name}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          data-testid="new-ticket-btn"
          onClick={() => {
            openCreateTab();
          }}
        >
          <Plus size={14} />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Modern Filter & Toolbar Bar */}
      <div className="list-view-toolbar">
        {/* Search Bar */}
        <div className="list-view-search-wrapper">
          <Search
            size={14}
            className={`list-view-search-icon ${isSearchFocused ? "focused" : ""}`}
          />
          <input
            type="text"
            className="list-view-search-input"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by ID, title, label..."
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              aria-label="Clear search"
              className="list-view-search-clear"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* State Filter */}
        <CustomSelect
          size="sm"
          value={selectedStateId}
          onChange={(val) => setSelectedStateId(val)}
          labelPrefix="State:"
          options={[
            { value: "all", label: "All States", badge: tickets.length },
            ...workflowStates.map((ws) => ({
              value: ws.id,
              label: ws.name,
              color: ws.color,
              icon: <StatusIcon category={ws.category} color={ws.color} size={13} />,
              badge: ticketsByStateCount[ws.id] || 0,
            })),
          ]}
        />

        {/* Priority Filter */}
        <CustomSelect
          size="sm"
          value={selectedPriority}
          onChange={(val) => setSelectedPriority(val)}
          labelPrefix="Priority:"
          options={[
            { value: "all", label: "All Priorities" },
            {
              value: "urgent",
              label: "Urgent",
              color: "#EF4444",
              icon: <PriorityIcon priority="urgent" size={13} />,
            },
            {
              value: "high",
              label: "High",
              color: "#F59E0B",
              icon: <PriorityIcon priority="high" size={13} />,
            },
            {
              value: "medium",
              label: "Medium",
              color: "#3B82F6",
              icon: <PriorityIcon priority="medium" size={13} />,
            },
            {
              value: "low",
              label: "Low",
              color: "#64748B",
              icon: <PriorityIcon priority="low" size={13} />,
            },
            {
              value: "none",
              label: "None",
              color: "#9CA3AF",
              icon: <PriorityIcon priority="none" size={13} />,
            },
          ]}
        />

        {/* Sort Controls */}
        <div className="list-view-sort-group">
          <CustomSelect
            size="sm"
            value={sortBy}
            onChange={(val) => setSortBy(val as SortField)}
            labelPrefix="Sort:"
            options={[
              { value: "created_at", label: "Created Date" },
              { value: "priority", label: "Priority" },
              { value: "due_date", label: "Due Date" },
              { value: "identifier", label: "Identifier" },
              { value: "title", label: "Title" },
            ]}
          />

          <button
            type="button"
            className="list-view-sort-dir-btn"
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? "Sort Ascending (click for Descending)" : "Sort Descending (click for Ascending)"}
            aria-label="Toggle sort direction"
          >
            <ArrowUpDown size={13} />
            <span className="list-view-sort-dir-label">
              {sortAsc ? "ASC" : "DESC"}
            </span>
          </button>
        </div>

        {/* Active Category Filter Pill */}
        {listFilterCategory !== "all" && (
          <div
            data-testid="list-category-filter-pill"
            className={`list-view-category-pill ${listFilterCategory === "in_progress" ? "in-progress" : listFilterCategory}`}
          >
            <span>
              {listFilterCategory === "in_progress"
                ? "In Progress"
                : listFilterCategory === "completed"
                ? "Completed"
                : "Open"}
            </span>
            <button
              type="button"
              onClick={() => setListFilterCategory("all")}
              title="Remove category filter"
              aria-label="Remove category filter"
              className="list-view-category-remove-btn"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Reset / Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="list-view-clear-filters-btn"
            onClick={handleClearFilters}
            title="Reset all search & filters"
          >
            <FilterX size={13} />
            <span>Clear ({activeFilterCount})</span>
          </button>
        )}

        {/* View Archived Tickets */}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={openArchivedModal}
          data-testid="list-view-archived-btn"
          style={{ height: "32px", fontSize: "var(--text-xs)", gap: "6px", marginLeft: "auto" }}
          title="View and manage archived tickets"
        >
          <Archive size={13} />
          <span>Archived ({archivedTickets.length})</span>
        </button>
      </div>

      {/* Table Container */}
      {tickets.length === 0 ? (
        /* Empty project */
        <div className="list-view-empty-card">
          <ListTodo size={40} className="list-view-empty-icon" />
          <h3 className="list-view-empty-title">
            No Tickets Created Yet
          </h3>
          <p className="list-view-empty-desc">
            Get started by adding your first task or user story to this project.
          </p>
          <button
            type="button"
            className="btn-primary"
            data-testid="create-first-ticket-btn"
            onClick={() => {
              openCreateTab();
            }}
          >
            <Plus size={14} />
            <span>Create First Ticket</span>
          </button>
        </div>
      ) : filteredTickets.length === 0 && !isLoading ? (
        /* Filter matched nothing */
        <div className="list-view-empty-card">
          <Search size={36} className="list-view-empty-icon" />
          <h3 className="list-view-empty-title">
            No Matching Tickets
          </h3>
          <p className="list-view-empty-desc">
            No tickets match your current search and filter criteria.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearFilters}
          >
            <FilterX size={13} />
            <span>Reset Filters</span>
          </button>
        </div>
      ) : (
        /* Ticket Table */
        <div className="list-view-table-wrapper">
          <table className="list-view-table">
            <thead>
              <tr className="list-view-thead-tr">
                <th
                  className="list-view-th sortable"
                  onClick={() => handleHeaderSort("identifier")}
                  style={{ width: "90px" }}
                  title="Sort by Identifier"
                >
                  <div className="list-view-th-content">
                    <span>ID</span>
                    {sortBy === "identifier" && (
                      <span className="list-view-sort-indicator">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th
                  className="list-view-th sortable"
                  onClick={() => handleHeaderSort("title")}
                  style={{ minWidth: "180px" }}
                  title="Sort by Title"
                >
                  <div className="list-view-th-content">
                    <span>Title</span>
                    {sortBy === "title" && (
                      <span className="list-view-sort-indicator">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th className="list-view-th" style={{ width: "130px" }}>State</th>
                <th
                  className="list-view-th sortable"
                  onClick={() => handleHeaderSort("priority")}
                  style={{ width: "125px" }}
                  title="Sort by Priority"
                >
                  <div className="list-view-th-content">
                    <span>Priority</span>
                    {sortBy === "priority" && (
                      <span className="list-view-sort-indicator">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th className="list-view-th" style={{ width: "85px" }}>Subtasks</th>
                <th
                  className="list-view-th sortable"
                  onClick={() => handleHeaderSort("due_date")}
                  style={{ width: "115px" }}
                  title="Sort by Due Date"
                >
                  <div className="list-view-th-content">
                    <span>Due Date</span>
                    {sortBy === "due_date" && (
                      <span className="list-view-sort-indicator">{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
                <th className="list-view-th" style={{ width: "55px", textAlign: "right" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="skeleton-row">
                    <td colSpan={7}>
                      <div className="skeleton-cell" />
                    </td>
                  </tr>
                ))
              ) : (
                filteredTickets.map((ticket) => {
                  const subtasks = subtaskProgress[ticket.id];
                  const epic = ticket.epic_id ? epics.find((e) => e.id === ticket.epic_id) : null;
                  const isOverdue = ticket.due_date
                    ? new Date(ticket.due_date).getTime() < new Date().setHours(0, 0, 0, 0)
                    : false;

                  return (
                    <tr
                      key={ticket.id}
                      className="list-view-row"
                      onClick={() => openTicketDetail(ticket.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ ticket, position: { x: e.clientX, y: e.clientY } });
                      }}
                    >
                      {/* Identifier */}
                      <td className="list-view-td">
                        <span className="list-view-id-badge">
                          {ticket.identifier}
                        </span>
                      </td>

                      {/* Title + Labels + Epic */}
                      <td className="list-view-td">
                        <div className="list-view-title-cell">
                          <span className="list-view-title-text">{ticket.title}</span>

                          {epic && (
                            <span
                              className="list-view-epic-badge"
                              style={{
                                backgroundColor: `${epic.color}15`,
                                color: epic.color,
                                borderColor: `${epic.color}30`,
                              }}
                            >
                              {epic.title}
                            </span>
                          )}

                          {ticket.labels?.map((label) => (
                            <span key={label} className="list-view-label-badge">
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Workflow State (Inline Picker) */}
                      <td className="list-view-td" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          size="sm"
                          value={ticket.workflow_state_id}
                          onChange={(newStateId) => moveTicket(ticket.id, newStateId)}
                          options={workflowStates.map((ws) => ({
                            value: ws.id,
                            label: ws.name,
                            color: ws.color,
                            icon: <StatusIcon category={ws.category} color={ws.color} size={13} />,
                          }))}
                        />
                      </td>

                      {/* Priority (Inline Picker) */}
                      <td className="list-view-td" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          size="sm"
                          value={ticket.priority}
                          onChange={(newPriority) =>
                            updateTicket(ticket.id, { priority: newPriority as TicketPriority })
                          }
                          options={[
                            {
                              value: "urgent",
                              label: "Urgent",
                              color: "#EF4444",
                              icon: <PriorityIcon priority="urgent" size={13} />,
                            },
                            {
                              value: "high",
                              label: "High",
                              color: "#F59E0B",
                              icon: <PriorityIcon priority="high" size={13} />,
                            },
                            {
                              value: "medium",
                              label: "Medium",
                              color: "#3B82F6",
                              icon: <PriorityIcon priority="medium" size={13} />,
                            },
                            {
                              value: "low",
                              label: "Low",
                              color: "#64748B",
                              icon: <PriorityIcon priority="low" size={13} />,
                            },
                            {
                              value: "none",
                              label: "None",
                              color: "#9CA3AF",
                              icon: <PriorityIcon priority="none" size={13} />,
                            },
                          ]}
                        />
                      </td>

                      {/* Subtasks */}
                      <td className="list-view-td">
                        {subtasks && subtasks.total > 0 ? (
                          <span
                            className={`list-view-subtask-badge ${
                              subtasks.completed === subtasks.total ? "complete" : ""
                            }`}
                          >
                            <CheckSquare size={12} />
                            <span>
                              {subtasks.completed}/{subtasks.total}
                            </span>
                          </span>
                        ) : (
                          <span className="list-view-empty-dash">—</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="list-view-td">
                        {ticket.due_date ? (
                          <span
                            className={`list-view-due-date ${isOverdue ? "overdue" : ""}`}
                            title={isOverdue ? "Overdue" : "Due date"}
                          >
                            <Calendar size={12} />
                            <span>{ticket.due_date}</span>
                          </span>
                        ) : (
                          <span className="list-view-empty-dash">—</span>
                        )}
                      </td>

                      {/* Estimate Points */}
                      <td className="list-view-td" style={{ textAlign: "right" }}>
                        {ticket.estimate !== null && ticket.estimate !== undefined ? (
                          <span className="list-view-pts-badge">
                            {ticket.estimate}
                          </span>
                        ) : (
                          <span className="list-view-empty-dash">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu && (
        <TicketContextMenu
          ticket={contextMenu.ticket}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
