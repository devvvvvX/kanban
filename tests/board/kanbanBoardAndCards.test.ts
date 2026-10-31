import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KanbanCard } from "../../src/components/board/KanbanCard";
import { KanbanColumn } from "../../src/components/board/KanbanColumn";
import { ListView } from "../../src/components/board/ListView";
import { BoardView } from "../../src/components/board/BoardView";
import { TicketContext, type TicketContextType } from "../../src/context/TicketContext";
import { ProjectContext, type ProjectContextType } from "../../src/context/ProjectContext";
import { TabContext, type TabContextValue } from "../../src/context/TabContext";
import type { TicketRecord, TicketPriority } from "../../src/lib/tickets/ticketService";
import type { WorkflowStateRecord } from "../../src/lib/tickets/workflowStateService";
import type { EpicRecord } from "../../src/lib/projects/epicService";

const mockWorkflowStates: WorkflowStateRecord[] = [
  {
    id: "ws-1",
    project_id: "proj-1",
    user_id: "user-1",
    name: "Todo",
    color: "#3B82F6",
    category: "unstarted",
    position: 0,
    wip_limit: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ws-2",
    project_id: "proj-1",
    user_id: "user-1",
    name: "In Progress",
    color: "#F59E0B",
    category: "started",
    position: 1,
    wip_limit: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "ws-3",
    project_id: "proj-1",
    user_id: "user-1",
    name: "Done",
    color: "#10B981",
    category: "completed",
    position: 2,
    wip_limit: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockEpic: EpicRecord = {
  id: "epic-1",
  project_id: "proj-1",
  user_id: "user-1",
  title: "Frontend Redesign",
  description: "Modernize UI",
  color: "#8B5CF6",
  icon: "target",
  status: "in_progress",
  is_archived: 0,
  start_date: null,
  target_date: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function createMockTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    id: "ticket-1",
    project_id: "proj-1",
    user_id: "user-1",
    ticket_number: 101,
    identifier: "APP-101",
    title: "Implement modern Kanban card layout",
    description: "Follow the 08-UI-SPEC contract strictly",
    workflow_state_id: "ws-1",
    priority: "urgent" as TicketPriority,
    epic_id: null,
    parent_id: null,
    due_date: null,
    estimate: 5,
    position: 0,
    labels: ["frontend", "ui"],
    is_archived: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderWithProviders(
  ui: React.ReactElement,
  options: {
    tickets?: TicketRecord[];
    workflowStates?: WorkflowStateRecord[];
    subtaskProgress?: Record<string, { total: number; completed: number }>;
    epics?: EpicRecord[];
  } = {}
) {
  const mockTicketContextValue: TicketContextType = {
    tickets: options.tickets || [],
    ticketsByState: {
      "ws-1": (options.tickets || []).filter((t) => t.workflow_state_id === "ws-1"),
      "ws-2": (options.tickets || []).filter((t) => t.workflow_state_id === "ws-2"),
      "ws-3": (options.tickets || []).filter((t) => t.workflow_state_id === "ws-3"),
    },
    workflowStates: options.workflowStates || mockWorkflowStates,
    selectedTicket: null,
    selectedTicketId: null,
    isQuickCreateOpen: false,
    quickCreateStateId: null,
    subtaskProgress: options.subtaskProgress || {},
    openQuickCreate: () => {},
    closeQuickCreate: () => {},
    openTicketDetail: () => {},
    closeTicketDetail: () => {},
    createTicket: () => ({} as any),
    updateTicket: () => ({} as any),
    moveTicket: () => ({} as any),
    duplicateTicket: () => ({} as any),
    archiveTicket: () => {},
    restoreTicket: () => {},
    unarchiveTicket: () => {},
    deleteTicket: () => {},
    archivedTickets: [],
    refreshArchivedTickets: () => {},
    isArchivedModalOpen: false,
    openArchivedModal: () => {},
    closeArchivedModal: () => {},
    createWorkflowState: () => ({} as any),
    updateWorkflowState: () => ({} as any),
    deleteWorkflowState: () => {},
    reorderWorkflowStates: () => {},
    refreshTickets: () => {},
    refreshStates: () => {},
    refreshSubtaskProgress: () => {},
    listFilterCategory: "all",
    setListFilterCategory: () => {},
    getSubtasks: () => [],
    createSubtask: () => ({} as any),
    updateSubtask: () => ({} as any),
    toggleSubtask: () => ({} as any),
    deleteSubtask: () => {},
    reorderSubtasks: () => {},
    getDependencies: () => [],
    linkTickets: () => {},
    unlinkTickets: () => {},
    getComments: () => [],
    addComment: () => ({} as any),
    updateComment: () => ({} as any),
    deleteComment: () => {},
    getActivity: () => [],
    recordActivity: () => ({} as any),
  };

  const mockProjectContextValue: ProjectContextType = {
    projects: [
      {
        id: "proj-1",
        user_id: "user-1",
        name: "Acme App",
        description: "",
        color: "#3B82F6",
        icon: "folder",
        is_pinned: 1,
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    pinnedProjects: [],
    activeProject: {
      id: "proj-1",
      user_id: "user-1",
      name: "Acme App",
      description: "",
      color: "#3B82F6",
      icon: "folder",
      is_pinned: 1,
      is_archived: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    activeView: "board",
    epics: options.epics || [mockEpic],
    metrics: null,
    isLoading: false,
    selectProject: () => {},
    setActiveView: () => {},
    createProject: () => ({} as any),
    updateProject: () => ({} as any),
    createEpic: () => ({} as any),
    updateEpic: () => ({} as any),
    togglePin: () => {},
    archiveProject: () => {},
    restoreProject: () => {},
    deleteProject: () => {},
    archiveEpic: () => {},
    restoreEpic: () => {},
    deleteEpic: () => {},
    getEpicRollup: () => null,
    refreshProjects: () => {},
    refreshEpics: () => {},
  };

  const mockTabContextValue: TabContextValue = {
    tabs: [{ id: "home", type: "home", title: "Home", isFixed: true }],
    activeTabId: "home",
    activeTab: { id: "home", type: "home", title: "Home", isFixed: true },
    openTicketTab: () => {},
    openEpicTab: () => {},
    openCreateTab: () => {},
    openNotesTab: () => {},
    openTodosTab: () => {},
    openFocusTab: () => {},
    openArchivedTab: () => {},
    openWebviewTab: () => {},
    closeTab: () => {},
    closeCreateTab: () => {},
    setActiveTabId: () => {},
    switchToHome: () => {},
  };

  return renderToStaticMarkup(
    React.createElement(
      TabContext.Provider,
      { value: mockTabContextValue },
      React.createElement(
        ProjectContext.Provider,
        { value: mockProjectContextValue },
        React.createElement(
          TicketContext.Provider,
          { value: mockTicketContextValue },
          ui
        )
      )
    )
  );
}

describe("Modern Kanban Board, Columns & Ticket Cards (08-UI-SPEC)", () => {
  const themeCssPath = path.resolve(process.cwd(), "src/styles/theme.css");
  const themeCss = fs.readFileSync(themeCssPath, "utf-8");

  describe("1. KanbanCard Style Contract (theme.css)", () => {
    it("defines strictly 72px min-height on .kanban-card", () => {
      const match = themeCss.match(/\.kanban-card\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const cardCss = match![1];
      expect(cardCss).toContain("min-height: 72px;");
      expect(cardCss).toContain("background-color: var(--bg-card);");
      expect(cardCss).toContain("border: 1px solid var(--border-subtle);");
      expect(cardCss).toContain("border-radius: var(--radius-md);");
    });

    it("clamps .kanban-card-title to strictly two lines with ellipsis", () => {
      const match = themeCss.match(/\.kanban-card-title\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const titleCss = match![1];
      expect(titleCss).toContain("-webkit-line-clamp: 2;");
      expect(titleCss).toContain("overflow: hidden;");
      expect(titleCss).toContain("text-overflow: ellipsis;");
    });

    it("configures .kanban-card-pill.overdue with crimson danger tokens", () => {
      const match = themeCss.match(/\.kanban-card-pill\.overdue\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const overdueCss = match![1];
      expect(overdueCss).toContain("color: var(--color-danger);");
      expect(overdueCss).toContain("background-color: var(--color-danger-subtle);");
    });

    it("configures .kanban-card-pill.subtasks-complete with success green tokens", () => {
      const match = themeCss.match(/\.kanban-card-pill\.subtasks-complete\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const completeCss = match![1];
      expect(completeCss).toContain("color: var(--color-success);");
      expect(completeCss).toContain("background-color: rgba(16, 185, 129, 0.15);");
    });

    it("defines 280px standard column width and 40px collapsed state", () => {
      const columnMatch = themeCss.match(/\.kanban-column\s*\{([^}]+)\}/);
      expect(columnMatch).not.toBeNull();
      expect(columnMatch![1]).toContain("width: 280px;");
      expect(columnMatch![1]).toContain("min-width: 280px;");

      const collapsedMatch = themeCss.match(/\.kanban-column\.collapsed\s*\{([^}]+)\}/);
      expect(collapsedMatch).not.toBeNull();
      expect(collapsedMatch![1]).toContain("width: 40px;");
      expect(collapsedMatch![1]).toContain("min-width: 40px;");
    });

    it("configures pulsing 72px skeleton cards and rows", () => {
      expect(themeCss).toContain(".skeleton-card");
      expect(themeCss).toContain("height: 72px;");
      expect(themeCss).toContain("animation: pulse 1.5s infinite;");

      expect(themeCss).toContain(".skeleton-row");
      expect(themeCss).toContain(".skeleton-cell");
    });
  });

  describe("2. KanbanCard Metadata Formatting & UI Logic", () => {
    it("renders monospace ticket key badge and title tooltip", () => {
      const ticket = createMockTicket({ identifier: "APP-42", title: "Refactor architecture" });
      const html = renderWithProviders(
        React.createElement(KanbanCard, { ticket, columnStateId: "ws-1" })
      );

      expect(html).toContain('class="kanban-card-id"');
      expect(html).toContain("APP-42");
      expect(html).toContain('class="kanban-card-title"');
      expect(html).toContain('title="Refactor architecture"');
    });

    it("calculates subtask counter X/Y and applies .subtasks-complete when all completed", () => {
      const ticket = createMockTicket({ id: "ticket-partial" });
      const htmlPartial = renderWithProviders(
        React.createElement(KanbanCard, { ticket, columnStateId: "ws-1" }),
        { subtaskProgress: { "ticket-partial": { total: 4, completed: 2 } } }
      );
      expect(htmlPartial).toContain("2/4");
      expect(htmlPartial).not.toContain("subtasks-complete");

      const ticketDone = createMockTicket({ id: "ticket-done" });
      const htmlDone = renderWithProviders(
        React.createElement(KanbanCard, { ticket: ticketDone, columnStateId: "ws-1" }),
        { subtaskProgress: { "ticket-done": { total: 3, completed: 3 } } }
      );
      expect(htmlDone).toContain("3/3");
      expect(htmlDone).toContain("subtasks-complete");
    });

    it("detects overdue dates and applies .overdue crimson styling", () => {
      const pastDate = "2020-01-01";
      const futureDate = "2099-12-31";

      const overdueTicket = createMockTicket({ due_date: pastDate });
      const htmlOverdue = renderWithProviders(
        React.createElement(KanbanCard, { ticket: overdueTicket, columnStateId: "ws-1" })
      );
      expect(htmlOverdue).toContain("kanban-card-pill overdue");
      expect(htmlOverdue).toContain('title="Overdue"');
      expect(htmlOverdue).toContain(pastDate);

      const futureTicket = createMockTicket({ due_date: futureDate });
      const htmlFuture = renderWithProviders(
        React.createElement(KanbanCard, { ticket: futureTicket, columnStateId: "ws-1" })
      );
      expect(htmlFuture).toContain("kanban-card-pill ");
      expect(htmlFuture).not.toContain("kanban-card-pill overdue");
      expect(htmlFuture).toContain('title="Due date"');
    });

    it("truncates labels to 2 max and renders +N overflow indicator", () => {
      const twoLabelsTicket = createMockTicket({ labels: ["react", "frontend"] });
      const htmlTwo = renderWithProviders(
        React.createElement(KanbanCard, { ticket: twoLabelsTicket, columnStateId: "ws-1" })
      );
      expect(htmlTwo).toContain("react");
      expect(htmlTwo).toContain("frontend");
      expect(htmlTwo).not.toContain("kanban-card-label-overflow");

      const fourLabelsTicket = createMockTicket({
        labels: ["react", "frontend", "sqlite", "desktop"],
      });
      const htmlFour = renderWithProviders(
        React.createElement(KanbanCard, { ticket: fourLabelsTicket, columnStateId: "ws-1" })
      );
      expect(htmlFour).toContain("react");
      expect(htmlFour).toContain("frontend");
      expect(htmlFour).not.toContain("sqlite");
      expect(htmlFour).toContain("kanban-card-label-overflow");
      expect(htmlFour).toContain("+2");
    });

    it("renders epic pill with dynamic opacity background", () => {
      const ticketWithEpic = createMockTicket({ epic_id: "epic-1" });
      const html = renderWithProviders(
        React.createElement(KanbanCard, { ticket: ticketWithEpic, columnStateId: "ws-1" })
      );

      expect(html).toContain("kanban-card-epic-pill");
      expect(html).toContain("Frontend Redesign");
      expect(html).toContain("color:#8B5CF6");
    });
  });

  describe("3. KanbanColumn WIP Limit Warning & Contract Copy", () => {
    it("detects count > wip_limit and renders alert badge with contract copy", () => {
      const stateWithLimit: WorkflowStateRecord = {
        ...mockWorkflowStates[1], // In Progress, limit = 2
        name: "In Progress",
        wip_limit: 2,
      };

      const threeTickets = [
        createMockTicket({ id: "t-1", workflow_state_id: "ws-2" }),
        createMockTicket({ id: "t-2", workflow_state_id: "ws-2" }),
        createMockTicket({ id: "t-3", workflow_state_id: "ws-2" }),
      ];

      const htmlExceeded = renderWithProviders(
        React.createElement(KanbanColumn, {
          state: stateWithLimit,
          tickets: threeTickets,
          onEditColumn: () => {},
          onDeleteColumn: () => {},
        })
      );

      expect(htmlExceeded).toContain("wip-limit-badge exceeded");
      expect(htmlExceeded).toMatch(/WIP Limit Exceeded: Stage (?:'|&#x27;)In Progress(?:'|&#x27;) allows maximum 2 tickets \(3 active\)\./);
      expect(htmlExceeded).toContain("<span>3</span>");
      expect(htmlExceeded).toContain("<span>/2</span>");

      // Within limit: 1 ticket
      const htmlNormal = renderWithProviders(
        React.createElement(KanbanColumn, {
          state: stateWithLimit,
          tickets: [threeTickets[0]],
          onEditColumn: () => {},
          onDeleteColumn: () => {},
        })
      );
      expect(htmlNormal).toContain("wip-limit-badge ");
      expect(htmlNormal).not.toContain("wip-limit-badge exceeded");
      expect(htmlNormal).toContain('title="WIP: 1/2"');
    });

    it("renders exact contract empty state copy when column has 0 tickets", () => {
      const emptyState: WorkflowStateRecord = mockWorkflowStates[0];
      const html = renderWithProviders(
        React.createElement(KanbanColumn, {
          state: emptyState,
          tickets: [],
          onEditColumn: () => {},
          onDeleteColumn: () => {},
        })
      );

      expect(html).toContain("kanban-column-empty");
      const exactCopy = "No tickets in this stage. Drag tickets here or press Cmd+N to create one.";
      expect(html).toContain(exactCopy);
    });

    it("renders 3 skeleton cards when isLoading is true", () => {
      const html = renderWithProviders(
        React.createElement(KanbanColumn, {
          state: mockWorkflowStates[0],
          tickets: [],
          onEditColumn: () => {},
          onDeleteColumn: () => {},
          isLoading: true,
        })
      );

      const skeletonMatches = html.match(/class="skeleton-card"/g);
      expect(skeletonMatches).not.toBeNull();
      expect(skeletonMatches!.length).toBe(3);
    });
  });

  describe("4. ListView & BoardView Modern Layout Integration", () => {
    it("renders 5 shimmering skeleton rows in ListView during loading", () => {
      const html = renderWithProviders(
        React.createElement(ListView, { isLoading: true }),
        { tickets: [createMockTicket()] }
      );

      const skeletonMatches = html.match(/class="skeleton-row"/g);
      expect(skeletonMatches).not.toBeNull();
      expect(skeletonMatches!.length).toBe(5);
    });

    it("renders BoardView with search input, filter selects, and action CTAs", () => {
      const html = renderWithProviders(React.createElement(BoardView));

      expect(html).toContain('class="board-view-container"');
      expect(html).toContain('class="board-view-toolbar"');
      expect(html).toContain('placeholder="Search tickets by ID, title, label..."');
      expect(html).toContain("State:");
      expect(html).toContain("Priority:");
      expect(html).toContain("Add Column");
      expect(html).toContain("New Ticket");
    });
  });
});
