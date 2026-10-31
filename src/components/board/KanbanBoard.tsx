import { useState } from "react";
import { Plus } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import { KanbanColumn } from "./KanbanColumn";
import { ColumnSettingsModal } from "./ColumnSettingsModal";
import { SafeStateDeleteModal } from "./SafeStateDeleteModal";
import type { WorkflowStateRecord } from "../../lib/tickets/workflowStateService";
import type { TicketRecord } from "../../lib/tickets/ticketService";

export interface KanbanBoardProps {
  isLoading?: boolean;
  searchQuery?: string;
  selectedPriority?: string;
  selectedStateId?: string;
  onAddColumn?: () => void;
}

export function KanbanBoard({
  isLoading = false,
  searchQuery = "",
  selectedPriority = "all",
  selectedStateId = "all",
  onAddColumn,
}: KanbanBoardProps) {
  const { workflowStates, ticketsByState } = useTickets();

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<WorkflowStateRecord | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<WorkflowStateRecord | null>(null);

  const handleEditColumn = (state: WorkflowStateRecord) => {
    setEditingColumn(state);
    setIsColumnModalOpen(true);
  };

  const handleAddColumn = () => {
    if (onAddColumn) {
      onAddColumn();
    } else {
      setEditingColumn(null);
      setIsColumnModalOpen(true);
    }
  };

  const handleDeleteColumn = (state: WorkflowStateRecord) => {
    setDeletingColumn(state);
  };

  const filterTicket = (ticket: TicketRecord) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = ticket.identifier.toLowerCase().includes(q);
      const matchTitle = ticket.title.toLowerCase().includes(q);
      const matchDesc = ticket.description?.toLowerCase().includes(q);
      const matchLabel = ticket.labels?.some((l) => l.toLowerCase().includes(q));
      if (!matchId && !matchTitle && !matchDesc && !matchLabel) return false;
    }
    if (selectedPriority !== "all" && ticket.priority !== selectedPriority) {
      return false;
    }
    return true;
  };

  const displayedStates =
    selectedStateId !== "all"
      ? workflowStates.filter((s) => s.id === selectedStateId)
      : workflowStates;

  return (
    <div className="kanban-board-container">
      {/* Workflow Columns */}
      {displayedStates.map((state) => {
        const rawTickets = ticketsByState[state.id] || [];
        const tickets = rawTickets.filter(filterTicket);
        return (
          <KanbanColumn
            key={state.id}
            state={state}
            tickets={tickets}
            onEditColumn={handleEditColumn}
            onDeleteColumn={handleDeleteColumn}
            isLoading={isLoading}
          />
        );
      })}

      {/* Add Column Card */}
      <div className="kanban-board-add-column-card">
        <button
          type="button"
          className="kanban-board-add-column-btn"
          onClick={handleAddColumn}
          title="Add new workflow column"
          aria-label="Add Column"
        >
          <Plus size={16} />
          <span>Add Column</span>
        </button>
      </div>

      {/* Column Modals */}
      <ColumnSettingsModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        stateToEdit={editingColumn}
      />

      <SafeStateDeleteModal
        isOpen={!!deletingColumn}
        onClose={() => setDeletingColumn(null)}
        stateToDelete={deletingColumn}
      />
    </div>
  );
}
