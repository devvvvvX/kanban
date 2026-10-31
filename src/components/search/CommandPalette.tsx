import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  CheckCircle2,
  Milestone,
  Folder,
  ArrowRight,
  Command,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProject } from "../../context/ProjectContext";
import { useTickets } from "../../context/TicketContext";
import { useTabs } from "../../context/TabContext";
import { SearchService, type GlobalSearchResult, type SearchResultItem } from "../../lib/search/searchService";
import { getDb } from "../../lib/db/connection";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

export function highlightMatch(text: string, query: string): React.ReactNode {
  const trimmed = query.trim().replace(/^[>]/, "").trim();
  if (!trimmed) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <span key={i} className="command-palette-highlight">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function CommandPalette() {
  const { user } = useAuth();
  const { selectProject, activeProject, projects, setActiveView } = useProject();
  const { openTicketDetail, openQuickCreate } = useTickets();
  const { openNotesTab, openTodosTab, openFocusTab, openArchivedTab, switchToHome } = useTabs();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>({
    query: "",
    tickets: [],
    epics: [],
    projects: [],
    total: 0,
    durationMs: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEscapeKey(isOpen, () => setIsOpen(false));

  // Global Cmd+K or Ctrl+K shortcut listener and custom open-search event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const handleCustomOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("kanban:open-search", handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("kanban:open-search", handleCustomOpen);
    };
  }, []);

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Execute search when query changes
  useEffect(() => {
    if (!isOpen || !user) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults({
        query: "",
        tickets: [],
        epics: [],
        projects: [],
        total: 0,
        durationMs: 0,
      });
      setSelectedIndex(0);
      return;
    }

    try {
      const db = getDb();
      const service = new SearchService(db);
      const res = service.search(user.id, trimmed);
      setResults(res);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }, [isOpen, query, user]);

  // Flattened actionable list for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{
      id: string;
      category: "command" | "ticket" | "epic" | "project";
      data?: SearchResultItem;
      title: string;
      action: () => void;
    }> = [];

    const allCommands: Array<{
      id: string;
      category: "command";
      title: string;
      keywords: string[];
      action: () => void;
    }> = [
      {
        id: "cmd-new-ticket",
        category: "command",
        title: "Create New Ticket",
        keywords: ["new", "ticket", "issue", "task", "create"],
        action: () => {
          if (!activeProject && projects.length > 0) {
            selectProject(projects[0].id);
          }
          openQuickCreate();
        },
      },
      {
        id: "cmd-focus",
        category: "command",
        title: "Open Focus Timer",
        keywords: ["focus", "timer", "pomodoro", "clock", "countdown", "deep work"],
        action: () => {
          openFocusTab();
        },
      },
      {
        id: "cmd-notepad",
        category: "command",
        title: "Open Notepad",
        keywords: ["notepad", "notes", "canvas", "scratchpad", "markdown"],
        action: () => {
          openNotesTab();
        },
      },
      {
        id: "cmd-todos",
        category: "command",
        title: "Open Todos",
        keywords: ["todos", "todo", "checklist", "daily", "cadence"],
        action: () => {
          openTodosTab();
        },
      },
      {
        id: "cmd-visual-query",
        category: "command",
        title: "Visual Query",
        keywords: ["visual", "query", "filter", "search", "sql"],
        action: () => {
          switchToHome();
          if (!activeProject && projects.length > 0) {
            selectProject(projects[0].id);
          }
          setActiveView("query");
        },
      },
      {
        id: "cmd-all-projects",
        category: "command",
        title: "View All Projects",
        keywords: ["projects", "all projects", "overview", "portfolio"],
        action: () => {
          switchToHome();
          selectProject(null);
        },
      },
      {
        id: "cmd-archived-tickets",
        category: "command",
        title: "View Archived Tickets",
        keywords: ["archive", "archived", "trash", "history", "closed tickets"],
        action: () => {
          openArchivedTab();
        },
      },
    ];

    const trimmed = query.trim();
    const isCmdOnly = trimmed.startsWith(">");
    const filterText = (isCmdOnly ? trimmed.slice(1) : trimmed).toLowerCase().trim();

    if (!trimmed) {
      items.push(...allCommands);
    } else {
      const matchingCommands = allCommands.filter((cmd) => {
        if (!filterText) return true;
        return (
          cmd.title.toLowerCase().includes(filterText) ||
          cmd.keywords.some((kw) => kw.includes(filterText))
        );
      });
      items.push(...matchingCommands);
    }

    // Tickets
    results.tickets.forEach((t) => {
      items.push({
        id: `ticket-${t.id}`,
        category: "ticket",
        data: t,
        title: `${t.identifier}: ${t.title}`,
        action: () => {
          if (t.projectId && activeProject?.id !== t.projectId) {
            selectProject(t.projectId);
          }
          switchToHome();
          openTicketDetail(t.id);
        },
      });
    });

    // Epics
    results.epics.forEach((e) => {
      items.push({
        id: `epic-${e.id}`,
        category: "epic",
        data: e,
        title: e.title,
        action: () => {
          if (e.projectId && activeProject?.id !== e.projectId) {
            selectProject(e.projectId);
          }
          switchToHome();
          setActiveView("epics");
        },
      });
    });

    // Projects
    results.projects.forEach((p) => {
      items.push({
        id: `project-${p.id}`,
        category: "project",
        data: p,
        title: p.title,
        action: () => {
          switchToHome();
          selectProject(p.id);
        },
      });
    });

    return items;
  }, [
    query,
    results,
    activeProject,
    projects,
    selectProject,
    openTicketDetail,
    openQuickCreate,
    openNotesTab,
    openTodosTab,
    openFocusTab,
    openArchivedTab,
    switchToHome,
    setActiveView,
  ]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex((prev) => clampIndex(prev, flatItems.length));
  }, [flatItems.length]);

  // Scroll active item into view
  useEffect(() => {
    const el = document.getElementById(`command-palette-item-${selectedIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (item: (typeof flatItems)[number]) => {
      item.action();
      setIsOpen(false);
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => clampIndex(prev + 1, flatItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => clampIndex(prev - 1, flatItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = flatItems[selectedIndex];
      if (current) {
        handleSelect(current);
      }
    }
  };

  if (!isOpen) return null;

  const categoryTitles: Record<string, string> = {
    command: "Quick Actions",
    ticket: "Tickets",
    epic: "Epics",
    project: "Projects",
  };

  return (
    <div className="command-palette-backdrop" onClick={() => setIsOpen(false)}>
      <div className="command-palette-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Search Header */}
        <div className="command-palette-header">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search tickets, epics, projects, or type '>'..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd
            className="command-palette-keycap"
            onClick={() => setIsOpen(false)}
            style={{ cursor: "pointer" }}
            title="Close (ESC)"
            data-testid="command-palette-close-btn"
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="command-palette-list">
          {flatItems.length === 0 ? (
            <div className="command-palette-empty">
              No results found for '{query}'. Try searching by ticket ID, title, or label.
            </div>
          ) : (
            flatItems.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const isFirstInCategory =
                idx === 0 || flatItems[idx - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {isFirstInCategory && (
                    <div className="command-palette-section-title">
                      {categoryTitles[item.category] || item.category}
                    </div>
                  )}
                  <div
                    id={`command-palette-item-${idx}`}
                    data-testid={`command-palette-item-${item.id}`}
                    className={`command-palette-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="command-palette-item-content">
                      {item.category === "command" && (
                        <Command size={14} color="var(--accent-blue)" />
                      )}
                      {item.category === "ticket" && (
                        <CheckCircle2 size={14} color="var(--accent-blue)" />
                      )}
                      {item.category === "epic" && (
                        <Milestone size={14} color="#8B5CF6" />
                      )}
                      {item.category === "project" && (
                        <Folder size={14} color="var(--accent-blue)" />
                      )}

                      <div className="command-palette-item-text">
                        <div className="command-palette-item-title">
                          {item.data?.fragments && item.data.fragments.length > 0
                            ? item.data.fragments.map((frag, i) =>
                                frag.isMatch ? (
                                  <span key={i} className="command-palette-highlight">
                                    {frag.text}
                                  </span>
                                ) : (
                                  <span key={i}>{frag.text}</span>
                                )
                              )
                            : highlightMatch(item.title, query)}
                        </div>

                        {item.data?.subtitle && (
                          <span className="command-palette-item-subtitle">
                            {item.data.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {item.data?.badge && (
                        <span
                          className="command-palette-badge"
                          style={{
                            backgroundColor: `${item.data.badgeColor || "var(--accent-blue)"}22`,
                            color: item.data.badgeColor || "var(--accent-blue)",
                          }}
                        >
                          {item.data.badge}
                        </span>
                      )}
                      {isSelected && <ArrowRight size={13} color="var(--accent-blue)" />}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="command-palette-footer">
          <div className="command-palette-shortcuts">
            <span>
              <kbd className="command-palette-keycap">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="command-palette-keycap">↵</kbd> Select
            </span>
            <span>
              <kbd className="command-palette-keycap">ESC</kbd> Close
            </span>
          </div>

          {results.total > 0 && (
            <span className="command-palette-count">
              {results.total} results ({results.durationMs}ms)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
