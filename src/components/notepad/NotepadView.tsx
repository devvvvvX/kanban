import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Pin,
  Search,
  CheckSquare,
  Sparkles,
  Edit3,
  Eye,
  Columns,
  Image as ImageIcon,
  PenTool,
  Check,
  X,
  Maximize2,
  Minimize2,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProject } from "../../context/ProjectContext";
import { useTabs } from "../../context/TabContext";
import { useTickets } from "../../context/TicketContext";
import { NoteService, type NoteRecord, type UpdateNoteInput } from "../../lib/notes/noteService";
import { MarkdownRenderer, toggleMarkdownTask } from "../common/MarkdownRenderer";
import { WhiteboardCanvas } from "./WhiteboardCanvas";

export function NotepadView() {
  const { user } = useAuth();
  const { projects, activeProject } = useProject();
  const { openTicketTab } = useTabs();
  const { refreshTickets } = useTickets();

  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [editingEmbeddedWhiteboard, setEditingEmbeddedWhiteboard] = useState<{
    rawBlock: string;
    designJson: string;
  } | null>(null);

  const handleEditWhiteboard = (rawBlock: string, designJson: string) => {
    setEditingEmbeddedWhiteboard({ rawBlock, designJson });
  };

  const handleSaveEditedWhiteboard = (newJsonBlock: string) => {
    if (!editingEmbeddedWhiteboard || !activeNote) return;
    const updatedContent = activeNote.content.replace(
      editingEmbeddedWhiteboard.rawBlock,
      newJsonBlock.trim()
    );
    handleUpdateActiveNote({ content: updatedContent });
    setEditingEmbeddedWhiteboard(null);
  };

  // Resizable notes sidebar and Zen full screen mode
  const [notesListWidth, setNotesListWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("kanban_notepad_list_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 180 && parsed <= 480) return parsed;
      }
    } catch {}
    return 280;
  });

  const [isNotesListCollapsed, setIsNotesListCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kanban_notepad_list_collapsed") === "true";
    } catch {}
    return false;
  });

  const [isResizingNotesList, setIsResizingNotesList] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  const toggleNotesList = useCallback(() => {
    setIsNotesListCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kanban_notepad_list_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleNotesResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingNotesList(true);
      const startX = e.clientX;
      const startWidth = notesListWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 180), 480);
        setNotesListWidth(newWidth);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        const finalWidth = Math.min(Math.max(startWidth + (upEvent.clientX - startX), 180), 480);
        setNotesListWidth(finalWidth);
        setIsResizingNotesList(false);
        try {
          localStorage.setItem("kanban_notepad_list_width", String(finalWidth));
        } catch {}
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [notesListWidth]
  );

  // Zen mode shortcut Cmd+Shift+F and Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      } else if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode]);

  // Convert modal states
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [ticketPriority, setTicketPriority] = useState<"none" | "low" | "medium" | "high" | "urgent">("medium");
  const [customTicketTitle, setCustomTicketTitle] = useState("");
  const [convertSuccessTicket, setConvertSuccessTicket] = useState<{ id: string; identifier: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const noteService = React.useMemo(() => new NoteService(), []);

  const loadNotes = useCallback(() => {
    if (!user) return;
    try {
      const list = noteService.listNotes(user.id);
      setNotes(list);
      if (list.length > 0 && !selectedNoteId) {
        setSelectedNoteId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
  }, [noteService, user, selectedNoteId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const activeNote = notes.find((n) => n.id === selectedNoteId) || null;

  useEffect(() => {
    if (activeNote) {
      setCustomTicketTitle(activeNote.title);
      if (activeProject) setTargetProjectId(activeProject.id);
      else if (projects.length > 0 && !targetProjectId) setTargetProjectId(projects[0].id);
    }
  }, [activeNote, activeProject, projects]);

  const handleCreateNote = () => {
    if (!user) return;
    try {
      const newNote = noteService.createNote(
        {
          title: "New Note",
          content: "### Ideas & Brainstorming\n\n- [ ] Task 1\n- [ ] Task 2\n\n> [!NOTE]\n> Write any thoughts, specs, or draft requirements here!\n",
          projectId: activeProject?.id,
          color: "#3B82F6",
        },
        user.id
      );
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleUpdateActiveNote = (updates: Partial<NoteRecord> & UpdateNoteInput) => {
    if (!user || !activeNote) return;
    try {
      const updated = noteService.updateNote(activeNote.id, updates, user.id);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!user) return;
    try {
      noteService.deleteNote(noteId, user.id);
      const remaining = notes.filter((n) => n.id !== noteId);
      setNotes(remaining);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const handleTogglePin = (note: NoteRecord) => {
    handleUpdateActiveNote({ is_pinned: note.is_pinned ? 0 : 1, isPinned: !note.is_pinned } as any);
  };

  const handleToggleTaskInPreview = (taskIndex: number, newChecked: boolean) => {
    if (!activeNote) return;
    const updated = toggleMarkdownTask(activeNote.content, taskIndex, newChecked);
    handleUpdateActiveNote({ content: updated });
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (!activeNote || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = activeNote.content.substring(0, start);
    const after = activeNote.content.substring(end);
    const nextContent = before + textToInsert + after;
    handleUpdateActiveNote({ content: nextContent });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      insertTextAtCursor(`\n![${file.name}](${dataUrl})\n`);
    };
    reader.readAsDataURL(file);
  };

  const handleConvertNote = () => {
    if (!user || !activeNote || !targetProjectId) return;
    try {
      const ticket = noteService.convertNoteToTicket(
        {
          noteId: activeNote.id,
          projectId: targetProjectId,
          priority: ticketPriority,
          customTitle: customTicketTitle,
        },
        user.id
      );
      refreshTickets();
      setConvertSuccessTicket({
        id: ticket.id,
        identifier: ticket.identifier,
        title: ticket.title,
      });
    } catch (err) {
      console.error("Failed to convert note to ticket:", err);
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const noteColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"];

  return (
    <div
      data-testid="notepad-view-container"
      style={{
        flex: 1,
        display: "flex",
        backgroundColor: "var(--bg-app)",
        overflow: "hidden",
        position: isZenMode ? "fixed" : "relative",
        inset: isZenMode ? 0 : undefined,
        zIndex: isZenMode ? 1000 : undefined,
        width: isZenMode ? "100vw" : "100%",
        height: isZenMode ? "100vh" : "100%",
        userSelect: isResizingNotesList ? "none" : undefined,
      }}
    >
      {/* Left Sidebar: Notes list */}
      {!isNotesListCollapsed && (
        <div
          style={{
            width: `${notesListWidth}px`,
            backgroundColor: "var(--bg-surface)",
            display: "flex",
            flexDirection: "row",
            flexShrink: 0,
            position: "relative",
            transition: isResizingNotesList ? "none" : "width var(--transition-fast)",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header & Search */}
            <div style={{ padding: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    data-testid="collapse-notes-list-btn"
                    onClick={toggleNotesList}
                    className="btn-ghost"
                    style={{ width: "22px", height: "22px", padding: 0 }}
                    title="Hide notes list"
                  >
                    <PanelLeft size={13} />
                  </button>
                  <FileText size={15} color="var(--accent-blue)" />
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>Notepad</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", backgroundColor: "var(--bg-muted)", padding: "1px 6px", borderRadius: "10px" }}>
                    {notes.length}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="new-note-btn"
                  className="btn-primary"
                  onClick={handleCreateNote}
                  style={{ height: "26px", fontSize: "var(--text-xs)", padding: "0 8px", gap: "4px" }}
                  title="Create New Note (Cmd+N)"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </div>

          <div style={{ position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: "8px", top: "8px", color: "var(--text-muted)" }} />
            <input
              type="text"
              data-testid="notes-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search thoughts & notes..."
              style={{
                width: "100%",
                height: "28px",
                paddingLeft: "26px",
                paddingRight: "8px",
                boxSizing: "border-box",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-app)",
                color: "var(--text-primary)",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filteredNotes.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              {searchQuery ? "No matching notes found." : "No notes yet. Click '+ New' to start jotting thoughts!"}
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = note.id === selectedNoteId;
              const dateStr = new Date(note.updated_at).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={note.id}
                  data-testid={`note-item-${note.id}`}
                  onClick={() => setSelectedNoteId(note.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "4px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--bg-subtle)" : "transparent",
                    border: isSelected ? "1px solid var(--border-default)" : "1px solid transparent",
                    borderLeft: `1px solid ${note.color || "var(--accent-blue)"}`,
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                      }}
                    >
                      {note.title}
                    </span>
                    {note.is_pinned ? <Pin size={11} color="var(--accent-blue)" style={{ transform: "rotate(45deg)" }} /> : null}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{dateStr}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                      {note.content.substring(0, 25).replace(/[#*`[\]]/g, "") || "Empty note"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

        {/* Notes list stretch divider handle */}
        <div
          data-testid="notes-list-resizer"
          className={`sidebar-resizer ${isResizingNotesList ? "dragging" : ""}`}
          onMouseDown={handleNotesResizeStart}
          onDoubleClick={() => {
            setNotesListWidth(280);
            try {
              localStorage.setItem("kanban_notepad_list_width", "280");
            } catch {}
          }}
          title="Drag to resize notes list, double-click to reset"
        />
      </div>
      )}

      {/* Right Area: Note Content, Whiteboard & Tools */}
      {activeNote ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Note Top Bar */}
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            {/* Title & Color */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, marginRight: "16px" }}>
              {isNotesListCollapsed && (
                <button
                  type="button"
                  data-testid="expand-notes-list-btn"
                  onClick={toggleNotesList}
                  className="btn-ghost"
                  style={{ width: "24px", height: "24px", padding: 0, marginRight: "4px" }}
                  title="Show notes list"
                >
                  <PanelLeft size={14} />
                </button>
              )}
              <div style={{ display: "flex", gap: "4px" }}>
                {noteColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleUpdateActiveNote({ color: c })}
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: c,
                      border: activeNote.color === c ? "2px solid var(--text-primary)" : "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              <input
                type="text"
                data-testid="note-title-input"
                value={activeNote.title}
                onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                placeholder="Note title..."
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  outline: "none",
                  flex: 1,
                }}
              />
            </div>

            {/* Actions Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className={`btn-ghost ${activeNote.is_pinned ? "active" : ""}`}
                onClick={() => handleTogglePin(activeNote)}
                title={activeNote.is_pinned ? "Unpin note" : "Pin note to top"}
                style={{ width: "28px", height: "28px", padding: 0 }}
              >
                <Pin size={13} color={activeNote.is_pinned ? "var(--accent-blue)" : "inherit"} />
              </button>

              <button
                type="button"
                data-testid="toggle-whiteboard-btn"
                className="btn-secondary"
                onClick={() => setShowWhiteboard((prev) => !prev)}
                style={{ height: "28px", fontSize: "var(--text-xs)", gap: "4px", padding: "0 8px" }}
                title="Open interactive Whiteboard canvas"
              >
                <PenTool size={12} color="var(--accent-blue)" />
                <span>{showWhiteboard ? "Hide Canvas" : "Whiteboard"}</span>
              </button>

              <button
                type="button"
                data-testid="convert-note-to-ticket-btn"
                className="btn-primary"
                onClick={() => setShowConvertModal(true)}
                style={{ height: "28px", fontSize: "var(--text-xs)", gap: "4px", padding: "0 10px" }}
                title="Convert this note into a Kanban Ticket"
              >
                <Sparkles size={12} />
                <span>Create Ticket</span>
              </button>

              <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

              {/* View Mode Toggle: Edit / Split / Preview */}
              <div style={{ display: "flex", backgroundColor: "var(--bg-app)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", padding: "1px" }}>
                <button
                  type="button"
                  data-testid="view-edit-btn"
                  onClick={() => setViewMode("edit")}
                  className="btn-ghost"
                  style={{ width: "24px", height: "24px", padding: 0, backgroundColor: viewMode === "edit" ? "var(--bg-surface)" : "transparent" }}
                  title="Editor only"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  type="button"
                  data-testid="view-split-btn"
                  onClick={() => setViewMode("split")}
                  className="btn-ghost"
                  style={{ width: "24px", height: "24px", padding: 0, backgroundColor: viewMode === "split" ? "var(--bg-surface)" : "transparent" }}
                  title="Split view (Live Preview)"
                >
                  <Columns size={11} />
                </button>
                <button
                  type="button"
                  data-testid="view-preview-btn"
                  onClick={() => setViewMode("preview")}
                  className="btn-ghost"
                  style={{ width: "24px", height: "24px", padding: 0, backgroundColor: viewMode === "preview" ? "var(--bg-surface)" : "transparent" }}
                  title="Preview only"
                >
                  <Eye size={11} />
                </button>
              </div>

              <button
                type="button"
                data-testid="toggle-zen-mode-btn"
                className={`btn-ghost ${isZenMode ? "active" : ""}`}
                onClick={() => setIsZenMode((prev) => !prev)}
                style={{
                  height: "28px",
                  padding: "0 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "var(--text-xs)",
                  color: isZenMode ? "var(--accent-blue)" : "var(--text-secondary)",
                  backgroundColor: isZenMode ? "var(--accent-blue-subtle)" : "transparent",
                  border: isZenMode ? "1px solid rgba(59, 130, 246, 0.3)" : undefined,
                }}
                title={isZenMode ? "Exit Zen Mode (Esc or Cmd+Shift+F)" : "Zen Full Screen Mode (Cmd+Shift+F)"}
              >
                {isZenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isZenMode ? "Exit Zen" : "Zen Mode"}</span>
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleDeleteNote(activeNote.id)}
                style={{ width: "28px", height: "28px", padding: 0, color: "var(--color-danger)" }}
                title="Delete note"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Quick Markdown Formatting Toolbar */}
          <div
            style={{
              padding: "4px 16px",
              backgroundColor: "var(--bg-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("**Bold**")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", fontWeight: 700 }}
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("_Italic_")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", fontStyle: "italic" }}
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("`code`")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}
              title="Inline Code"
            >
              &lt;/&gt;
            </button>

            <div style={{ width: "1px", height: "14px", backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("\n### Heading\n")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)" }}
              title="Heading 3"
            >
              H3
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("\n- [ ] ")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", gap: "3px" }}
              title="Checklist task"
            >
              <CheckSquare size={11} /> Check
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("\n> [!NOTE]\n> Thought description...\n")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)" }}
              title="Note Alert Box"
            >
              [!Note]
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => insertTextAtCursor("\n:::info\nHighlight info box\n:::\n")}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)" }}
              title="Custom Box"
            >
              :::box
            </button>

            <div style={{ width: "1px", height: "14px", backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

            <button
              type="button"
              data-testid="import-image-btn"
              className="btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", gap: "3px" }}
              title="Import image into note"
            >
              <ImageIcon size={11} /> Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                handleImageUpload(e.target.files);
                if (e.target) e.target.value = "";
              }}
            />
          </div>

          {/* Embedded Whiteboard Canvas (if active) */}
          {showWhiteboard && (
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <WhiteboardCanvas
                initialData={activeNote.whiteboard_data}
                onSaveData={(dataUrl) => handleUpdateActiveNote({ whiteboard_data: dataUrl, whiteboardData: dataUrl })}
                onInsertIntoNote={(mdTag) => {
                  insertTextAtCursor(mdTag);
                  setShowWhiteboard(false);
                }}
                onClose={() => setShowWhiteboard(false)}
              />
            </div>
          )}

          {/* Main Editor & Preview Workspace */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Markdown Textarea */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  borderRight: viewMode === "split" ? "1px solid var(--border-subtle)" : "none",
                  backgroundColor: "var(--bg-app)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  data-testid="note-content-editor"
                  value={activeNote.content}
                  onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                  placeholder="Start dumping your thoughts, markdown notes, code snippets, or task checklists..."
                  style={{
                    flex: 1,
                    width: "100%",
                    padding: "16px",
                    boxSizing: "border-box",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.6,
                    resize: "none",
                    outline: "none",
                  }}
                />
              </div>
            )}

            {/* Rendered Live Markdown Preview */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div
                data-testid="note-preview-pane"
                style={{
                  flex: 1,
                  padding: "20px 24px",
                  overflowY: "auto",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <MarkdownRenderer
                  content={activeNote.content}
                  onToggleTask={handleToggleTaskInPreview}
                  onEditWhiteboard={handleEditWhiteboard}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: "12px" }}>
          {isNotesListCollapsed && (
            <button
              type="button"
              data-testid="expand-notes-list-btn"
              onClick={toggleNotesList}
              className="btn-secondary"
              style={{ fontSize: "12px", height: "30px", gap: "6px" }}
              title="Show notes list"
            >
              <PanelLeft size={14} />
              <span>Show Notes</span>
            </button>
          )}
          <span>Select or create a note to get started.</span>
        </div>
      )}

      {/* Convert Note to Ticket Modal */}
      {showConvertModal && activeNote && (
        <div
          data-testid="convert-note-modal"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => {
            setShowConvertModal(false);
            setConvertSuccessTicket(null);
          }}
        >
          <div
            style={{
              width: "480px",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-xl)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} color="var(--accent-blue)" />
                <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>Convert Note to Ticket</h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowConvertModal(false);
                  setConvertSuccessTicket(null);
                }}
              >
                <X size={16} />
              </button>
            </div>

            {convertSuccessTicket ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <Check size={32} color="var(--color-success)" style={{ marginBottom: "12px" }} />
                <h4 style={{ margin: "0 0 8px", fontSize: "var(--text-base)" }}>Ticket Created Successfully!</h4>
                <p style={{ margin: "0 0 16px", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                  Created <strong>{convertSuccessTicket.identifier}</strong>: {convertSuccessTicket.title}
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertSuccessTicket(null);
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    data-testid="open-converted-ticket-tab-btn"
                    className="btn-primary"
                    onClick={() => {
                      setShowConvertModal(false);
                      openTicketTab(convertSuccessTicket.id, convertSuccessTicket.identifier, convertSuccessTicket.title);
                      setConvertSuccessTicket(null);
                    }}
                  >
                    Open Ticket Tab
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Ticket Title
                  </label>
                  <input
                    type="text"
                    data-testid="convert-ticket-title-input"
                    value={customTicketTitle}
                    onChange={(e) => setCustomTicketTitle(e.target.value)}
                    style={{
                      width: "100%",
                      height: "32px",
                      padding: "0 8px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Destination Project
                  </label>
                  <select
                    data-testid="convert-ticket-project-select"
                    value={targetProjectId}
                    onChange={(e) => setTargetProjectId(e.target.value)}
                    style={{
                      width: "100%",
                      height: "32px",
                      padding: "0 8px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      boxSizing: "border-box",
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Priority
                  </label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    style={{
                      width: "100%",
                      height: "32px",
                      padding: "0 8px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowConvertModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-convert-btn"
                    className="btn-primary"
                    onClick={handleConvertNote}
                  >
                    Create Ticket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editing Embedded Whiteboard Modal */}
      {editingEmbeddedWhiteboard && (
        <div
          data-testid="edit-embedded-whiteboard-modal"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1500,
            backdropFilter: "blur(4px)",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "95vw",
              maxWidth: "1100px",
              height: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <WhiteboardCanvas
              initialData={editingEmbeddedWhiteboard.designJson}
              title="Editing Embedded Whiteboard Diagram"
              isEditingEmbedded={true}
              onInsertIntoNote={handleSaveEditedWhiteboard}
              onClose={() => setEditingEmbeddedWhiteboard(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
