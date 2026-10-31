import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { AccountSwitcher } from "../auth/AccountSwitcher";
import { Sidebar } from "../sidebar/Sidebar";
import { ProjectHeader } from "../projects/ProjectHeader";
import { ProjectOverview } from "../projects/ProjectOverview";
import { AllProjectsView } from "../projects/AllProjectsView";
import { EpicGridView } from "../epics/EpicGridView";
import { BoardView } from "../board/BoardView";
import { ListView } from "../board/ListView";
import { QueryResultsView } from "../query/QueryResultsView";
import { CommandPalette } from "../search/CommandPalette";
import { McpSettingsModal } from "../settings/McpSettingsModal";
import { SettingsModal } from "../settings/SettingsModal";
import { HeaderTabBar } from "./HeaderTabBar";
import { TicketDetailPage } from "../tickets/TicketDetailPage";
import { TicketDetailDrawer } from "../tickets/TicketDetailDrawer";
import { CreateTicketPage } from "../tickets/CreateTicketPage";
import { QuickCreateModal } from "../tickets/QuickCreateModal";
import { ArchivedTicketsModal } from "../tickets/ArchivedTicketsModal";
import { EpicDetailPage } from "../epics/EpicDetailPage";
import { NotepadView } from "../notepad/NotepadView";
import { TodoView } from "../todos/TodoView";
import { MacNotificationBanner } from "../notifications/MacNotificationBanner";
import { WebviewTab } from "../webview/WebviewTab";
import { FocusView } from "../focus/FocusView";
import { HeaderFocusTimer } from "../focus/HeaderFocusTimer";
import { ArchivedTicketsPage } from "../tickets/ArchivedTicketsPage";
import { handleLinkOpen } from "../../utils/linkHandler";
import { useMcpSync } from "../../hooks/useMcpSync";
import { Search, X, RotateCw, Check, PanelLeft, Bot } from "lucide-react";

interface AppShellProps {
  onOpenAuth: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onOpenAuth }) => {
  const { user } = useAuth();
  const { activeProject, activeView, refreshProjects, refreshEpics } = useProject();
  const { refreshTickets, refreshStates, refreshSubtaskProgress, openQuickCreate } = useTickets();
  const { tabs, activeTab, closeTab, openCreateTab, openNotesTab, openWebviewTab, openTodosTab } = useTabs();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMcpSettingsOpen, setIsMcpSettingsOpen] = useState(false);
  const { activeToast, dismissToast } = useMcpSync(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState(false);

  const webviewTabs = useMemo(() => tabs.filter((t) => t.type === "webview" && t.url), [tabs]);
  const isWebviewActive = activeTab.type === "webview";

  // Switch to Todos workspace tab when requested by a notification alert
  useEffect(() => {
    const handleOpenTodoTab = () => {
      openTodosTab();
    };
    window.addEventListener("kanban:open-todo", handleOpenTodoTab);
    return () => window.removeEventListener("kanban:open-todo", handleOpenTodoTab);
  }, [openTodosTab]);

  // Resizable and Collapsible Sidebar
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("kanban_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 180 && parsed <= 480) return parsed;
      }
    } catch {}
    return 240;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kanban_sidebar_collapsed") === "true";
    } catch {}
    return false;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kanban_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSidebarResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 180), 480);
        setSidebarWidth(newWidth);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        const finalWidth = Math.min(Math.max(startWidth + (upEvent.clientX - startX), 180), 480);
        setSidebarWidth(finalWidth);
        setIsResizingSidebar(false);
        try {
          localStorage.setItem("kanban_sidebar_width", String(finalWidth));
        } catch {}
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth]
  );

  const handleRefreshData = React.useCallback(() => {
    setIsRefreshing(true);
    try {
      refreshProjects();
      refreshEpics();
      refreshTickets();
      refreshStates();
      refreshSubtaskProgress();
      window.dispatchEvent(new CustomEvent("kanban:data-reloaded"));
    } catch (e) {
      console.error("Manual refresh error:", e);
    }
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshToast(true);
      setTimeout(() => setRefreshToast(false), 2000);
    }, 450);
  }, [refreshProjects, refreshEpics, refreshTickets, refreshStates, refreshSubtaskProgress]);

  // Intercept Cmd+R / custom kanban:refresh event
  useEffect(() => {
    const onRefresh = () => handleRefreshData();
    window.addEventListener("kanban:refresh", onRefresh);
    return () => window.removeEventListener("kanban:refresh", onRefresh);
  }, [handleRefreshData]);

  // Global keyboard shortcuts (Cmd+N, Cmd+K, Cmd+T, Cmd+W, Cmd+\, Cmd+Alt+O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "n" && !e.shiftKey && !e.altKey) {
        if (activeProject) {
          e.preventDefault();
          openQuickCreate();
        }
      }
      if (isCmdOrCtrl && e.key.toLowerCase() === "t" && !e.shiftKey) {
        e.preventDefault();
        openCreateTab();
      }
      if (isCmdOrCtrl && e.key.toLowerCase() === "w" && !e.shiftKey) {
        if (activeTab.id !== "home") {
          e.preventDefault();
          closeTab(activeTab.id);
        }
      }
      if (isCmdOrCtrl && (e.altKey || e.shiftKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openNotesTab();
      }
      if (isCmdOrCtrl && (e.key === "\\" || e.code === "Backslash")) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreateTab, closeTab, openNotesTab, toggleSidebar, openQuickCreate, activeProject, activeTab.id]);

  // Global link interception so markdown, notes, and content links always open in new in-app tabs
  useEffect(() => {
    const handleGlobalLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      const isExternalOrWeb =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//") ||
        href.startsWith("www.") ||
        /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(href);

      if (isExternalOrWeb) {
        e.preventDefault();
        e.stopPropagation();
        handleLinkOpen(href, anchor.textContent?.trim() || href, openWebviewTab);
      }
    };

    document.addEventListener("click", handleGlobalLinkClick, true);
    return () => document.removeEventListener("click", handleGlobalLinkClick, true);
  }, [openWebviewTab]);

  return (
    <div className="app-root-container">
      {/* macOS Custom Titlebar */}
      <header
        data-tauri-drag-region
        className="window-titlebar window-drag-region"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target &&
            !target.closest("button, input, select, textarea, a, .no-drag, [data-no-drag]")
          ) {
            import("@tauri-apps/api/window")
              .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
              .catch(() => {});
          }
        }}
      >
        <div data-tauri-drag-region className="window-titlebar-left">
          {user && (
            <button
              type="button"
              data-testid="toggle-sidebar-btn"
              className={`btn-ghost no-drag btn-icon btn-sm ${isSidebarCollapsed ? "active" : ""}`}
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Show Sidebar (Cmd+\\)" : "Hide Sidebar (Cmd+\\)"}
            >
              <PanelLeft size={14} />
            </button>
          )}

          <div className="window-titlebar-brand">
            <img
              src="/icon.png"
              alt="Kanban Icon"
              className="window-titlebar-brand-icon"
            />
            <span className="window-titlebar-brand-name">
              Kanban
            </span>
          </div>

          {user && (
            <>
              <div className="window-titlebar-divider" />
              <HeaderTabBar />
            </>
          )}
        </div>

        {/* Right Titlebar Controls */}
        <div className="window-titlebar-right no-drag">
          {user && (
            <>
              {/* Real-time Focus Timer Indicator */}
              <HeaderFocusTimer />

              {/* Refresh Button (Icon Only - De-cluttered) */}
              <button
                type="button"
                data-testid="header-refresh-btn"
                onClick={handleRefreshData}
                className="btn-ghost btn-icon btn-sm"
                title="Refresh Workspace Data (Cmd+R)"
                style={{ width: 28, height: 28 }}
              >
                <RotateCw size={13} className={isRefreshing ? "spin-animation" : ""} />
              </button>

              {/* Command Palette Trigger (Search Icon) */}
              <button
                type="button"
                className="titlebar-search-btn"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("kanban:open-search"));
                }}
                title="Global Search (Cmd+K)"
              >
                <Search size={13} />
                <span>Search...</span>
                <span className="titlebar-search-keycap">
                  ⌘K
                </span>
              </button>
            </>
          )}

          <AccountSwitcher onOpenAuth={onOpenAuth} />
        </div>
      </header>

      {/* Manual Data Refresh Toast */}
      {refreshToast && (
        <div data-testid="refresh-toast" className="refresh-toast">
          <Check size={14} color="var(--color-success)" />
          <span>Workspace refreshed</span>
        </div>
      )}

      {/* Main Body */}
      {user ? (
        <div
          className="app-main-layout"
          style={{
            userSelect: isResizingSidebar ? "none" : undefined,
          }}
        >
          {!isSidebarCollapsed && (
            <div
              className="sidebar-container"
              style={{
                width: `${sidebarWidth}px`,
                transition: isResizingSidebar ? "none" : "width var(--transition-fast)",
              }}
            >
              <Sidebar
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenMcpSettings={() => setIsMcpSettingsOpen(true)}
              />
              <div
                data-testid="sidebar-resizer"
                className={`sidebar-resizer ${isResizingSidebar ? "dragging" : ""}`}
                onMouseDown={handleSidebarResizeStart}
                onDoubleClick={() => {
                  setSidebarWidth(240);
                  try {
                    localStorage.setItem("kanban_sidebar_width", "240");
                  } catch {}
                }}
                title="Drag to resize sidebar, double-click to reset (Cmd+\ to toggle)"
              />
            </div>
          )}

          <main className="workspace-canvas">
            {/* Persisted In-App Webview Tabs (Kept mounted to preserve video/media/DOM state across tab switches) */}
            {webviewTabs.map((tab) => {
              const isTabActive = activeTab.id === tab.id;
              return (
                <div
                  key={tab.id}
                  data-testid={`webview-tab-container-${tab.id}`}
                  style={{
                    display: isTabActive ? "flex" : "none",
                    flex: 1,
                    width: "100%",
                    height: "100%",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <WebviewTab url={tab.url!} title={tab.title} />
                </div>
              );
            })}

            {/* Non-Webview Workspace Canvas Views */}
            <div
              style={{
                display: isWebviewActive ? "none" : "flex",
                flex: 1,
                width: "100%",
                height: "100%",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {activeTab.type === "ticket" && activeTab.ticketId ? (
                <TicketDetailPage key={activeTab.id} ticketId={activeTab.ticketId} tabId={activeTab.id} />
              ) : activeTab.type === "epic" && activeTab.epicId ? (
                <EpicDetailPage key={activeTab.id} epicId={activeTab.epicId} tabId={activeTab.id} />
              ) : activeTab.type === "create" ? (
                <CreateTicketPage key={activeTab.id} defaultStateId={activeTab.defaultStateId} tabId={activeTab.id} />
              ) : activeTab.type === "notes" ? (
                <NotepadView />
              ) : activeTab.type === "todos" ? (
                <TodoView />
              ) : activeTab.type === "focus" ? (
                <FocusView key={activeTab.id} />
              ) : activeTab.type === "archived" ? (
                <ArchivedTicketsPage key={activeTab.id} />
              ) : activeProject ? (
                <>
                  <ProjectHeader />
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {activeView === "overview" && <ProjectOverview />}
                    {activeView === "board" && <BoardView />}
                    {activeView === "list" && <ListView />}
                    {activeView === "epics" && <EpicGridView />}
                    {activeView === "query" && <QueryResultsView />}
                  </div>
                </>
              ) : (
                <AllProjectsView />
              )}
            </div>
          </main>
        </div>
      ) : (
        <main className="app-auth-wrapper">
          <div className="app-auth-container">
            <div className="app-auth-card">
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 16px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.3))",
                }}
              >
                <img
                  src="/icon.png"
                  alt="Kanban App Icon"
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "14px" }}
                />
              </div>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600, marginBottom: 8 }}>
                Local &amp; Offline by Design
              </h2>
              <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto 24px" }}>
                Sign in or register a local account to manage personal software projects, technical interviews, and Kanban workflows with zero cloud lock-in.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="btn btn-primary"
                style={{ height: 40, padding: "0 24px", fontSize: "var(--text-base)" }}
              >
                Sign In or Register
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Global Ticket Slide-out Drawer */}
      <TicketDetailDrawer />

      {/* Global Spotlight Command Palette (Cmd+K) */}
      <CommandPalette />

      {/* Global Quick Create Ticket Modal */}
      <QuickCreateModal />

      {/* Global Archived Tickets Modal */}
      <ArchivedTicketsModal />

      {/* MCP Agent Settings Modal */}
      <McpSettingsModal
        isOpen={isMcpSettingsOpen}
        onClose={() => setIsMcpSettingsOpen(false)}
      />

      {/* Main Preferences & Backup Modal (SETT-01, SETT-02, SETT-03) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenMcpSettings={() => setIsMcpSettingsOpen(true)}
      />

      {/* Real-Time Agent Notification Toast (MCP-05) */}
      {activeToast && (
        <div className="app-mcp-toast">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Bot size={14} />
          </div>

          <div style={{ flex: 1, fontSize: "var(--text-xs)", color: "var(--text-primary)", fontWeight: 500 }}>
            {activeToast.message}
          </div>

          <button
            type="button"
            onClick={dismissToast}
            className="btn-ghost btn-icon btn-sm"
            style={{ width: 20, height: 20, padding: 0, color: "var(--text-muted)" }}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Persistent macOS Native-Style Reminder Alert Banner */}
      <MacNotificationBanner />
    </div>
  );
};
