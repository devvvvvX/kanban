import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import type { ISqlDatabase } from "../../src/lib/db/types";
import type { WorkspaceTab } from "../../src/context/TabContext";

const mockUser = {
  id: "tab-test-user",
  email: "tabs@mac.local",
  password_hash: "hash",
  display_name: "Tab Tester",
  status: "active" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe("Tab State Management & Header Tab Workflow", () => {
  let db: ISqlDatabase;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let projectId: string;
  let todoStateId: string;
  let ticket1Id: string;
  let ticket2Id: string;

  beforeEach(async () => {
    mockLocalStorage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    db = await resetTestDb();
    runMigrations(db);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      mockUser.id,
      mockUser.email,
      mockUser.password_hash,
      mockUser.display_name,
      mockUser.status,
      mockUser.created_at,
      mockUser.updated_at
    );

    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);

    const proj = projectService.createProject({
      userId: mockUser.id,
      name: "Desktop Tabs App",
    });
    projectId = proj.id;

    const states = workflowStateService.ensureDefaultStates(projectId, mockUser.id);
    todoStateId = states[1].id;

    const t1 = ticketService.createTicket({
      userId: mockUser.id,
      projectId,
      workflowStateId: todoStateId,
      title: "First Tab Ticket",
      priority: "high",
    });
    ticket1Id = t1.id;

    const t2 = ticketService.createTicket({
      userId: mockUser.id,
      projectId,
      workflowStateId: todoStateId,
      title: "Second Tab Ticket",
      priority: "medium",
    });
    ticket2Id = t2.id;
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
  });

  // State simulator mimicking TabContext logic
  function createTabManager() {
    const fixedHomeTab: WorkspaceTab = {
      id: "home",
      type: "home",
      title: "Home",
      isFixed: true,
    };

    let tabs: WorkspaceTab[] = [fixedHomeTab];
    let activeTabId = "home";

    return {
      getTabs: () => tabs,
      getActiveTabId: () => activeTabId,
      openTicketTab: (ticketId: string, title?: string, identifier?: string) => {
        const tabId = `ticket-${ticketId}`;
        const existing = tabs.find((t) => t.id === tabId);
        if (existing) {
          activeTabId = tabId;
          return;
        }
        const ticket = ticketService.getTicket(ticketId, mockUser.id);
        const resolvedTitle =
          title || (ticket ? `${ticket.identifier ? ticket.identifier + ": " : ""}${ticket.title}` : "Ticket Details");
        const newTab: WorkspaceTab = {
          id: tabId,
          type: "ticket",
          ticketId,
          identifier: identifier || ticket?.identifier,
          title: resolvedTitle,
          isFixed: false,
        };
        tabs = [...tabs, newTab];
        activeTabId = tabId;
      },
      openCreateTab: (defaultStateId?: string) => {
        const newTabId = `create-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newTab: WorkspaceTab = {
          id: newTabId,
          type: "create",
          title: "New Ticket",
          defaultStateId,
          isFixed: false,
        };
        tabs = [...tabs, newTab];
        activeTabId = newTabId;
        return newTabId;
      },
      updateTabTitle: (tabId: string, title: string) => {
        tabs = tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab));
      },
      closeTab: (tabId: string) => {
        const tabToClose = tabs.find((t) => t.id === tabId);
        if (!tabToClose || tabToClose.isFixed) {
          return; // The Home tab is fixed and cannot be closed
        }
        if (tabToClose.type === "create" || tabId.startsWith("create")) {
          try {
            localStorage.removeItem(`kanban_ticket_draft_${tabId}`);
          } catch {}
        }
        const closeIndex = tabs.findIndex((t) => t.id === tabId);
        const remaining = tabs.filter((t) => t.id !== tabId);
        tabs = remaining;
        if (activeTabId === tabId) {
          const nextActive = remaining[Math.max(0, closeIndex - 1)] || fixedHomeTab;
          activeTabId = nextActive.id;
        }
      },
      closeCreateTab: function (targetTabId?: string) {
        if (targetTabId) {
          this.closeTab(targetTabId);
          return;
        }
        if (activeTabId.startsWith("create") || activeTabId === "create") {
          this.closeTab(activeTabId);
          return;
        }
        const lastCreate = [...tabs].reverse().find((t) => t.type === "create");
        if (lastCreate) {
          this.closeTab(lastCreate.id);
        } else {
          this.closeTab("create");
        }
      },
      syncTickets: (currentTickets: Array<{ id: string; title: string; identifier: string }>) => {
        tabs = tabs
          .filter((tab) => {
            if (tab.type !== "ticket" || !tab.ticketId) return true;
            return currentTickets.some((t) => t.id === tab.ticketId);
          })
          .map((tab) => {
            if (tab.type !== "ticket" || !tab.ticketId) return tab;
            const t = currentTickets.find((x) => x.id === tab.ticketId);
            if (t) {
              return {
                ...tab,
                title: `${t.identifier}: ${t.title}`,
                identifier: t.identifier,
              };
            }
            return tab;
          });
        if (!tabs.some((t) => t.id === activeTabId)) {
          activeTabId = "home";
        }
      },
    };
  }

  it("ensures the Home tab is fixed, positioned first, and cannot be closed", () => {
    const manager = createTabManager();

    expect(manager.getTabs()).toHaveLength(1);
    expect(manager.getTabs()[0].id).toBe("home");
    expect(manager.getTabs()[0].type).toBe("home");
    expect(manager.getTabs()[0].isFixed).toBe(true);
    expect(manager.getActiveTabId()).toBe("home");

    // Close attempt on fixed home tab should do nothing
    manager.closeTab("home");
    expect(manager.getTabs()).toHaveLength(1);
    expect(manager.getTabs()[0].id).toBe("home");
    expect(manager.getActiveTabId()).toBe("home");
  });

  it("opens independent page tabs on clicking tickets and focuses existing tab without duplicate", () => {
    const manager = createTabManager();

    // 1. Open first ticket
    manager.openTicketTab(ticket1Id);
    expect(manager.getTabs()).toHaveLength(2);
    expect(manager.getTabs()[1].id).toBe(`ticket-${ticket1Id}`);
    expect(manager.getTabs()[1].type).toBe("ticket");
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket1Id}`);

    // 2. Open second ticket
    manager.openTicketTab(ticket2Id);
    expect(manager.getTabs()).toHaveLength(3);
    expect(manager.getTabs()[2].id).toBe(`ticket-${ticket2Id}`);
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket2Id}`);

    // 3. Opening first ticket again should focus tab rather than duplicate
    manager.openTicketTab(ticket1Id);
    expect(manager.getTabs()).toHaveLength(3);
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket1Id}`);
  });

  it("allows opening and closing create tabs in the header", () => {
    const manager = createTabManager();

    // 1. Open create tab
    const tab1 = manager.openCreateTab(todoStateId);
    expect(manager.getTabs()).toHaveLength(2);
    expect(manager.getTabs()[1].id).toBe(tab1);
    expect(manager.getTabs()[1].type).toBe("create");
    expect(manager.getActiveTabId()).toBe(tab1);

    // 2. Close create tab via closeCreateTab
    manager.closeCreateTab();
    expect(manager.getTabs()).toHaveLength(1);
    expect(manager.getActiveTabId()).toBe("home");

    // 3. Re-open and close via closeTab
    const tab2 = manager.openCreateTab();
    expect(manager.getTabs()).toHaveLength(2);
    manager.closeTab(tab2);
    expect(manager.getTabs()).toHaveLength(1);
    expect(manager.getActiveTabId()).toBe("home");
  });

  it("allows opening multiple independent create tabs with dynamic titles", () => {
    const manager = createTabManager();

    // 1. Open first create tab
    const tab1 = manager.openCreateTab(todoStateId);
    manager.updateTabTitle(tab1, "Design Auth Modal");

    // 2. Open second create tab
    const tab2 = manager.openCreateTab(todoStateId);
    manager.updateTabTitle(tab2, "Fix Column Drag & Drop");

    // 3. Open third create tab
    const tab3 = manager.openCreateTab();

    expect(manager.getTabs()).toHaveLength(4); // Home + 3 create tabs
    expect(manager.getActiveTabId()).toBe(tab3);

    const tabs = manager.getTabs();
    expect(tabs[1].id).toBe(tab1);
    expect(tabs[1].title).toBe("Design Auth Modal");
    expect(tabs[2].id).toBe(tab2);
    expect(tabs[2].title).toBe("Fix Column Drag & Drop");
    expect(tabs[3].id).toBe(tab3);
    expect(tabs[3].title).toBe("New Ticket");
  });

  it("persists draft ticket data per tab in localStorage and commits to database only on Create Ticket submit", () => {
    const manager = createTabManager();

    const tab1 = manager.openCreateTab(todoStateId);
    const draftKey1 = `kanban_ticket_draft_${tab1}`;
    const draft1 = {
      title: "Draft Ticket 1",
      description: "Description for draft 1",
      workflowStateId: todoStateId,
      epicId: "",
      priority: "high" as const,
      dueDate: "2026-11-01",
      estimate: "5",
      labels: ["frontend", "urgent"],
    };
    localStorage.setItem(draftKey1, JSON.stringify(draft1));

    const tab2 = manager.openCreateTab(todoStateId);
    const draftKey2 = `kanban_ticket_draft_${tab2}`;
    const draft2 = {
      title: "Draft Ticket 2",
      description: "Draft 2 notes",
      workflowStateId: todoStateId,
      epicId: "",
      priority: "medium" as const,
      dueDate: "",
      estimate: "3",
      labels: ["backend"],
    };
    localStorage.setItem(draftKey2, JSON.stringify(draft2));

    // Initial database count check: drafts are NOT written to DB
    const initialTickets = ticketService.listTickets(projectId, mockUser.id);
    expect(initialTickets).toHaveLength(2); // Only ticket1 and ticket2 exist

    // Simulate switching between tabs - verify drafts in localStorage remain separate and uncommitted
    expect(JSON.parse(localStorage.getItem(draftKey1)!)).toEqual(draft1);
    expect(JSON.parse(localStorage.getItem(draftKey2)!)).toEqual(draft2);

    // Now simulate committing draft 1 via Create Ticket submission
    const createdTicket = ticketService.createTicket({
      projectId,
      title: draft1.title,
      description: draft1.description,
      workflowStateId: draft1.workflowStateId,
      priority: draft1.priority,
      dueDate: draft1.dueDate,
      estimate: parseInt(draft1.estimate, 10),
      labels: draft1.labels,
      userId: mockUser.id,
    });
    localStorage.removeItem(draftKey1);
    manager.closeTab(tab1);

    // Verify DB now has draft 1 committed, but draft 2 is still NOT committed
    const ticketsAfterCommit = ticketService.listTickets(projectId, mockUser.id);
    expect(ticketsAfterCommit).toHaveLength(3);
    expect(ticketsAfterCommit.some((t) => t.id === createdTicket.id)).toBe(true);

    // Verify tab 2 is still open with its draft in localStorage
    expect(manager.getTabs().some((t) => t.id === tab2)).toBe(true);
    expect(JSON.parse(localStorage.getItem(draftKey2)!)).toEqual(draft2);

    // Closing tab 2 clears its draft
    manager.closeTab(tab2);
    expect(localStorage.getItem(draftKey2)).toBeNull();
    expect(ticketService.listTickets(projectId, mockUser.id)).toHaveLength(3);
  });

  it("gracefully switches to the previous tab or home when active tab is closed", () => {
    const manager = createTabManager();

    manager.openTicketTab(ticket1Id);
    manager.openTicketTab(ticket2Id);
    expect(manager.getTabs()).toHaveLength(3);
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket2Id}`);

    // Close active ticket2 tab -> focus should move to ticket1 tab
    manager.closeTab(`ticket-${ticket2Id}`);
    expect(manager.getTabs()).toHaveLength(2);
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket1Id}`);

    // Close active ticket1 tab -> focus should move to home tab
    manager.closeTab(`ticket-${ticket1Id}`);
    expect(manager.getTabs()).toHaveLength(1);
    expect(manager.getActiveTabId()).toBe("home");
  });

  it("automatically closes ticket tab if the ticket is deleted in the database", () => {
    const manager = createTabManager();

    manager.openTicketTab(ticket1Id);
    expect(manager.getTabs()).toHaveLength(2);
    expect(manager.getActiveTabId()).toBe(`ticket-${ticket1Id}`);

    // Delete ticket in database
    ticketService.deleteTicket(ticket1Id, mockUser.id);
    const remainingTickets = ticketService.listTickets(projectId, mockUser.id);

    // Sync tabs with ticket list
    manager.syncTickets(remainingTickets);

    expect(manager.getTabs().some((t) => t.ticketId === ticket1Id)).toBe(false);
    expect(manager.getActiveTabId()).toBe("home");
  });
});
