import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useTickets } from "./TicketContext";

export type TabType = "home" | "ticket" | "create" | "epic" | "notes" | "todos" | "focus" | "archived" | "webview";

export interface WorkspaceTab {
  id: string; // "home", `ticket-${ticketId}`, `create`, `epic-${epicId}`, "notes", "todos", "focus", "archived", `webview-${hash}`
  type: TabType;
  title: string;
  identifier?: string;
  ticketId?: string;
  epicId?: string;
  defaultStateId?: string;
  url?: string;
  isFixed?: boolean;
}

export interface TabContextValue {
  tabs: WorkspaceTab[];
  activeTabId: string;
  activeTab: WorkspaceTab;
  openTicketTab: (ticketId: string, initialTitle?: string, initialIdentifier?: string) => void;
  openEpicTab: (epicId: string, initialTitle?: string) => void;
  openCreateTab: (defaultStateId?: string) => string | void;
  openNotesTab: () => void;
  openTodosTab: () => void;
  openFocusTab: () => void;
  openArchivedTab: () => void;
  openWebviewTab: (url: string, initialTitle?: string) => void;
  closeTab: (tabId: string) => void;
  closeCreateTab: (targetTabId?: string) => void;
  updateTabTitle?: (tabId: string, title: string) => void;
  setActiveTabId: (tabId: string) => void;
  switchToHome: () => void;
}

const FIXED_HOME_TAB: WorkspaceTab = {
  id: "home",
  type: "home",
  title: "Home",
  isFixed: true,
};

export const TabContext = createContext<TabContextValue | undefined>(undefined);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const { tickets, openTicketDetail, closeTicketDetail } = useTickets();
  const [tabs, setTabs] = useState<WorkspaceTab[]>([FIXED_HOME_TAB]);
  const [activeTabId, setActiveTabIdState] = useState<string>("home");

  // Keep tab titles in sync if ticket titles change or tickets get deleted
  useEffect(() => {
    setTabs((prevTabs) => {
      let changed = false;
      const updated = prevTabs.filter((tab) => {
        if (tab.type !== "ticket" || !tab.ticketId) return true;
        const exists = tickets.some((t) => t.id === tab.ticketId);
        if (!exists) {
          changed = true;
          return false; // ticket was deleted, remove tab
        }
        return true;
      }).map((tab) => {
        if (tab.type !== "ticket" || !tab.ticketId) return tab;
        const ticket = tickets.find((t) => t.id === tab.ticketId);
        if (ticket) {
          const expectedTitle = `${ticket.identifier ? ticket.identifier + ": " : ""}${ticket.title}`;
          if (tab.title !== expectedTitle || tab.identifier !== ticket.identifier) {
            changed = true;
            return {
              ...tab,
              title: expectedTitle,
              identifier: ticket.identifier,
            };
          }
        }
        return tab;
      });

      return changed ? updated : prevTabs;
    });
  }, [tickets]);

  // Ensure active tab points to a valid tab
  useEffect(() => {
    if (activeTabId === "home") {
      return;
    }
    const tabExists = tabs.some((t) => t.id === activeTabId);
    if (!tabExists) {
      setActiveTabIdState("home");
      closeTicketDetail();
    }
  }, [tabs, activeTabId, closeTicketDetail]);

  const setActiveTabId = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      setActiveTabIdState(tabId);
      // Close side drawer when switching to full page tabs
      if (target.type !== "home") {
        closeTicketDetail();
      }
    },
    [tabs, closeTicketDetail]
  );

  const openTicketTab = useCallback(
    (ticketId: string, initialTitle?: string, initialIdentifier?: string) => {
      const tabId = `ticket-${ticketId}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTabId(tabId);
        return;
      }

      const ticket = tickets.find((t) => t.id === ticketId);
      const title =
        initialTitle ||
        (ticket
          ? `${ticket.identifier ? ticket.identifier + ": " : ""}${ticket.title}`
          : "Ticket Details");

      const newTab: WorkspaceTab = {
        id: tabId,
        type: "ticket",
        ticketId,
        identifier: initialIdentifier || ticket?.identifier,
        title,
        isFixed: false,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabIdState(tabId);
      closeTicketDetail();
    },
    [tabs, tickets, setActiveTabId, closeTicketDetail]
  );

  const openEpicTab = useCallback(
    (epicId: string, initialTitle?: string) => {
      const tabId = `epic-${epicId}`;
      setTabs((prev) => {
        const existing = prev.find((t) => t.id === tabId);
        if (existing) {
          return prev;
        }
        return [
          ...prev,
          {
            id: tabId,
            type: "epic",
            epicId,
            title: initialTitle || "Epic Details",
            isFixed: false,
          },
        ];
      });
      setActiveTabIdState(tabId);
      closeTicketDetail();
    },
    [closeTicketDetail]
  );

  const openCreateTab = useCallback((defaultStateId?: string) => {
    const newTabId = `create-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTab: WorkspaceTab = {
      id: newTabId,
      type: "create",
      title: "New Ticket",
      defaultStateId,
      isFixed: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabIdState(newTabId);
    closeTicketDetail();
    return newTabId;
  }, [closeTicketDetail]);

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
    );
  }, []);

  const openNotesTab = useCallback(() => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.type === "notes");
      if (existing) {
        return prev;
      }
      return [
        ...prev,
        {
          id: "notes",
          type: "notes",
          title: "Notepad",
          isFixed: false,
        },
      ];
    });
    setActiveTabIdState("notes");
    closeTicketDetail();
  }, [closeTicketDetail]);

  const openTodosTab = useCallback(() => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.type === "todos");
      if (existing) {
        return prev;
      }
      return [
        ...prev,
        {
          id: "todos",
          type: "todos",
          title: "Todos",
          isFixed: false,
        },
      ];
    });
    setActiveTabIdState("todos");
    closeTicketDetail();
  }, [closeTicketDetail]);

  const openFocusTab = useCallback(() => {
    setTabs((prev) => {
      const exists = prev.some((t) => t.id === "focus");
      if (exists) return prev;
      return [
        ...prev,
        {
          id: "focus",
          type: "focus",
          title: "Focus Timer",
          isFixed: false,
        },
      ];
    });
    setActiveTabIdState("focus");
    closeTicketDetail();
  }, [closeTicketDetail]);

  const openArchivedTab = useCallback(() => {
    setTabs((prev) => {
      const exists = prev.some((t) => t.id === "archived");
      if (exists) return prev;
      return [
        ...prev,
        {
          id: "archived",
          type: "archived",
          title: "Archived Tickets",
          isFixed: false,
        },
      ];
    });
    setActiveTabIdState("archived");
    closeTicketDetail();
  }, [closeTicketDetail]);

  const openWebviewTab = useCallback((url: string, initialTitle?: string) => {
    if (!url) return;
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const tabId = `webview-${encodeURIComponent(normalizedUrl)}`;
    let targetActiveId = tabId;

    setTabs((prev) => {
      const existing = prev.find((t) => t.id === tabId || (t.type === "webview" && t.url === normalizedUrl));
      if (existing) {
        targetActiveId = existing.id;
        return prev;
      }
      let displayTitle = initialTitle;
      if (!displayTitle) {
        try {
          const parsed = new URL(normalizedUrl);
          displayTitle = parsed.hostname.replace(/^www\./, "") + (parsed.pathname !== "/" ? parsed.pathname.slice(0, 20) : "");
        } catch {
          displayTitle = normalizedUrl.length > 25 ? normalizedUrl.slice(0, 22) + "..." : normalizedUrl;
        }
      }
      return [
        ...prev,
        {
          id: tabId,
          type: "webview",
          title: displayTitle,
          url: normalizedUrl,
          isFixed: false,
        },
      ];
    });
    setActiveTabIdState(targetActiveId);
    closeTicketDetail();
  }, [closeTicketDetail]);

  const closeTab = useCallback(
    (tabId: string) => {
      const tabToClose = tabs.find((t) => t.id === tabId);
      // The Home tab is fixed and cannot be closed
      if (!tabToClose || tabToClose.isFixed) {
        return;
      }

      // Purge draft storage if this was a create tab
      if (tabToClose.type === "create" || tabId.startsWith("create")) {
        try {
          localStorage.removeItem(`kanban_ticket_draft_${tabId}`);
        } catch {}
      }

      const closeIndex = tabs.findIndex((t) => t.id === tabId);
      const remainingTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(remainingTabs);

      // If we closed the currently active tab, determine next active tab
      if (activeTabId === tabId) {
        const nextActive =
          remainingTabs[Math.max(0, closeIndex - 1)] || FIXED_HOME_TAB;
        setActiveTabIdState(nextActive.id);
        if (nextActive.type === "ticket" && nextActive.ticketId) {
          openTicketDetail(nextActive.ticketId);
        } else {
          closeTicketDetail();
        }
      }
    },
    [tabs, activeTabId, openTicketDetail, closeTicketDetail]
  );

  const closeCreateTab = useCallback(
    (targetTabId?: string) => {
      if (targetTabId) {
        closeTab(targetTabId);
        return;
      }
      if (activeTabId.startsWith("create") || activeTabId === "create") {
        closeTab(activeTabId);
        return;
      }
      const lastCreate = [...tabs].reverse().find((t) => t.type === "create");
      if (lastCreate) {
        closeTab(lastCreate.id);
      } else {
        closeTab("create");
      }
    },
    [tabs, activeTabId, closeTab]
  );

  const switchToHome = useCallback(() => {
    setActiveTabId("home");
  }, [setActiveTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || FIXED_HOME_TAB;

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        activeTab,
        openTicketTab,
        openEpicTab,
        openCreateTab,
        openNotesTab,
        openTodosTab,
        openFocusTab,
        openArchivedTab,
        openWebviewTab,
        closeTab,
        closeCreateTab,
        updateTabTitle,
        setActiveTabId,
        switchToHome,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabs(): TabContextValue {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabProvider");
  }
  return context;
}
