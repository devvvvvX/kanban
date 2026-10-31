import {
  Home,
  Plus,
  X,
  FileText,
  PlusCircle,
  Milestone,
  PenTool,
  Globe,
  Flame,
  Archive,
  ListTodo,
} from "lucide-react";
import { useTabs, type WorkspaceTab } from "../../context/TabContext";

export function HeaderTabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    openCreateTab,
    openNotesTab,
    openTodosTab,
    openFocusTab,
  } = useTabs();

  const handlePlusClick = () => {
    try {
      const defaultAction = localStorage.getItem("kanban_default_plus_action") || "ticket";
      if (defaultAction === "todo") {
        openTodosTab();
        return;
      }
      if (defaultAction === "notepad") {
        openNotesTab();
        return;
      }
      if (defaultAction === "focus") {
        openFocusTab();
        return;
      }
      if (defaultAction === "epic") {
        window.dispatchEvent(new CustomEvent("kanban:open-create-epic"));
        return;
      }
    } catch {}
    openCreateTab();
  };

  return (
    <div
      data-tauri-drag-region
      className="header-tab-bar"
      role="tablist"
      aria-label="Workspace tabs"
    >
      {tabs.map((tab: WorkspaceTab) => {
        const isActive = tab.id === activeTabId;
        const isHome = tab.type === "home";
        const isCreate = tab.type === "create";
        const isEpic = tab.type === "epic";
        const isNotes = tab.type === "notes";
        const isTodos = tab.type === "todos";
        const isFocus = tab.type === "focus";
        const isArchived = tab.type === "archived";
        const isWebview = tab.type === "webview";

        const tabClasses = [
          "header-tab",
          "no-drag",
          isActive ? "active" : "",
          isHome ? "header-tab-home" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTabId(tab.id);
              }
            }}
            title={tab.title}
            className={tabClasses}
          >
            {/* Tab Icon */}
            <span className="header-tab-icon">
              {isHome ? (
                <Home size={13} color={isActive ? "var(--accent-blue)" : "currentColor"} />
              ) : isCreate ? (
                <PlusCircle size={13} color={isActive ? "var(--color-success)" : "currentColor"} />
              ) : isEpic ? (
                <Milestone size={13} color={isActive ? "#8B5CF6" : "currentColor"} />
              ) : isNotes ? (
                <PenTool size={13} color={isActive ? "#F59E0B" : "currentColor"} />
              ) : isTodos ? (
                <ListTodo size={13} color={isActive ? "var(--accent-blue)" : "currentColor"} />
              ) : isFocus ? (
                <Flame size={13} color={isActive ? "var(--accent-blue)" : "currentColor"} />
              ) : isArchived ? (
                <Archive size={13} color={isActive ? "#F59E0B" : "currentColor"} />
              ) : isWebview ? (
                <Globe size={13} color={isActive ? "var(--accent-blue)" : "currentColor"} />
              ) : (
                <FileText size={13} color={isActive ? "var(--accent-blue)" : "currentColor"} />
              )}
            </span>

            {/* Tab Identifier Badge (for tickets) */}
            {tab.identifier && (
              <span className="header-tab-identifier">
                {tab.identifier}
              </span>
            )}

            {/* Tab Title */}
            <span className="header-tab-title">
              {isHome
                ? "Home"
                : isCreate
                ? tab.title || "New Ticket"
                : isEpic
                ? tab.title
                : tab.title.includes(": ")
                ? tab.title.split(": ")[1]
                : tab.title}
            </span>

            {/* Close Button - fixed Home tab has NO close button */}
            {!tab.isFixed && (
              <button
                type="button"
                className="header-tab-close tab-close-btn no-drag"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                aria-label={`Close ${tab.title} tab`}
                title={`Close ${tab.title} tab`}
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}

      {/* Create New Tab Button - Executes user-configured default action */}
      <button
        type="button"
        data-testid="header-plus-btn"
        className="btn-ghost header-tab-new-btn no-drag"
        onClick={handlePlusClick}
        title="Create new ticket tab (Cmd+N)"
        aria-label="Create tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
