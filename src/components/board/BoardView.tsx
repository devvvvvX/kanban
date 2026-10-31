import { useState } from "react";
import { Plus, Search, X, Columns } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { CustomSelect } from "../ui/Select";
import { StatusIcon } from "../ui/StatusIcon";
import { PriorityIcon } from "../ui/PriorityIcon";
import { KanbanBoard } from "./KanbanBoard";
import { ColumnSettingsModal } from "./ColumnSettingsModal";

export function BoardView() {
  const { workflowStates, openQuickCreate, tickets } = useTickets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedStateId, setSelectedStateId] = useState<string>("all");
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedPriority !== "all" || selectedStateId !== "all"
  );

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedPriority("all");
    setSelectedStateId("all");
  };

  return (
    <div className="board-view-container">
      {/* Board Toolbar & Filters */}
      <div className="board-view-toolbar">
        <div className="board-view-filter-group">
          {/* Search Input */}
          <div className="board-view-search-wrapper">
            <Search size={14} className="board-view-search-icon" />
            <input
              type="text"
              className="board-view-search-input"
              placeholder="Search tickets by ID, title, label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="board-view-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                aria-label="Clear search"
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
              { value: "all", label: "All States" },
              ...workflowStates.map((ws) => ({
                value: ws.id,
                label: ws.name,
                color: ws.color,
                icon: <StatusIcon category={ws.category} color={ws.color} size={13} />,
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-ghost list-view-clear-filters-btn"
              onClick={handleClearFilters}
              title="Reset board filters"
            >
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* View Action Buttons */}
        <div className="board-view-actions">
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginRight: "var(--space-2)" }}>
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAddColumnModalOpen(true)}
            title="Add a new workflow column"
          >
            <Columns size={14} />
            <span>Add Column</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="new-ticket-btn"
            onClick={() => openQuickCreate()}
            title="Create ticket (Cmd+N)"
          >
            <Plus size={14} />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Plane-style Active Filter Chips Row */}
      {hasActiveFilters && (
        <div className="board-view-active-chips-row">
          <span className="board-view-filter-label">Active filters:</span>
          {searchQuery.trim() && (
            <span className="board-filter-chip">
              <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Remove search filter"
                aria-label="Remove search filter"
              >
                ✕
              </button>
            </span>
          )}
          {selectedStateId !== "all" && (
            <span className="board-filter-chip">
              <span>
                State: {workflowStates.find((ws) => ws.id === selectedStateId)?.name || selectedStateId}
              </span>
              <button
                type="button"
                onClick={() => setSelectedStateId("all")}
                title="Remove state filter"
                aria-label="Remove state filter"
              >
                ✕
              </button>
            </span>
          )}
          {selectedPriority !== "all" && (
            <span className="board-filter-chip">
              <span>Priority: {selectedPriority.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => setSelectedPriority("all")}
                title="Remove priority filter"
                aria-label="Remove priority filter"
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            className="board-clear-all-btn"
            onClick={handleClearFilters}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Kanban Board Canvas */}
      <KanbanBoard
        searchQuery={searchQuery}
        selectedPriority={selectedPriority}
        selectedStateId={selectedStateId}
      />

      {/* Column Settings Modal */}
      <ColumnSettingsModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
        stateToEdit={null}
      />
    </div>
  );
}
