import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Edit3, Trash2, Eye, Check, X } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { TicketComment } from "../../lib/tickets/commentService";
import { MarkdownRenderer } from "../common/MarkdownRenderer";

interface CommentSectionProps {
  ticketId: string;
}

export function CommentSection({ ticketId }: CommentSectionProps) {
  const { getComments, addComment, updateComment, deleteComment } = useTickets();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newContent, setNewContent] = useState("");
  const [isPreviewNew, setIsPreviewNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isPreviewEditing, setIsPreviewEditing] = useState(false);

  const loadComments = useCallback(() => {
    try {
      const list = getComments(ticketId);
      setComments(list);
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  }, [ticketId, getComments]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newContent.trim();
    if (!trimmed) return;

    addComment(ticketId, trimmed);
    setNewContent("");
    setIsPreviewNew(false);
    loadComments();
  };

  const handleSaveEdit = (commentId: string) => {
    const trimmed = editingContent.trim();
    if (trimmed) {
      updateComment(commentId, trimmed);
    }
    setEditingId(null);
    setIsPreviewEditing(false);
    loadComments();
  };

  const handleDelete = (commentId: string) => {
    deleteComment(commentId);
    loadComments();
  };

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <MessageSquare size={14} />
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {/* Existing Comments List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
        {comments.length === 0 ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-muted)",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            No comments yet. Start the conversation!
          </div>
        ) : (
          comments.map((c) => {
            const isEditing = editingId === c.id;
            const dateStr = new Date(c.created_at).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const isEdited = c.updated_at !== c.created_at;

            return (
              <div
                key={c.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                {/* Comment Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent-primary)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                      }}
                    >
                      U
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>
                      User
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{dateStr}</span>
                    {isEdited && (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontStyle: "italic" }}>
                        (edited)
                      </span>
                    )}
                  </div>

                  {!isEditing && (
                    <div style={{ display: "flex", gap: "2px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingContent(c.content);
                          setIsPreviewEditing(false);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "3px",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Edit comment"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "3px",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Comment Content / Edit Form */}
                {isEditing ? (
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginBottom: "4px" }}>
                      <button
                        type="button"
                        onClick={() => setIsPreviewEditing(false)}
                        className={`btn-ghost ${!isPreviewEditing ? "active" : ""}`}
                        style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPreviewEditing(true)}
                        className={`btn-ghost ${isPreviewEditing ? "active" : ""}`}
                        style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)" }}
                      >
                        Preview
                      </button>
                    </div>

                    {isPreviewEditing ? (
                      <div
                        style={{
                          padding: "8px",
                          minHeight: "60px",
                          backgroundColor: "var(--bg-app)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <MarkdownRenderer content={editingContent} />
                      </div>
                    ) : (
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        style={{
                          width: "100%",
                          minHeight: "60px",
                          padding: "8px",
                          fontSize: "13px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--accent-primary)",
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-primary)",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-ghost"
                        style={{ height: "24px", padding: "0 8px", fontSize: "var(--text-xs)" }}
                      >
                        <X size={12} /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(c.id)}
                        style={{
                          height: "24px",
                          padding: "0 8px",
                          fontSize: "var(--text-xs)",
                          fontWeight: 500,
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          backgroundColor: "var(--accent-primary)",
                          color: "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "4px" }}>
                    <MarkdownRenderer content={c.content} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input Box with Markdown Preview */}
      <form
        className="comment-form"
        onSubmit={handleAddComment}
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 8px",
            backgroundColor: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Markdown supported</span>
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              type="button"
              className={`btn-ghost ${!isPreviewNew ? "active" : ""}`}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", gap: "3px" }}
              onClick={() => setIsPreviewNew(false)}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              type="button"
              className={`btn-ghost ${isPreviewNew ? "active" : ""}`}
              style={{ height: "22px", padding: "0 6px", fontSize: "var(--text-xs)", gap: "3px" }}
              onClick={() => setIsPreviewNew(true)}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
        </div>

        {isPreviewNew ? (
          <div
            style={{
              padding: "10px 12px",
              minHeight: "80px",
              backgroundColor: "var(--bg-app)",
            }}
          >
            <MarkdownRenderer content={newContent} />
          </div>
        ) : (
          <textarea
            placeholder="Write a comment or note... (**bold**, _italic_, `code`)"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "10px 12px",
              fontSize: "13px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--text-primary)",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.4,
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "6px 8px",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <button
            type="submit"
            disabled={!newContent.trim()}
            style={{
              height: "26px",
              padding: "0 10px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: newContent.trim() ? "var(--accent-primary)" : "var(--bg-subtle)",
              color: newContent.trim() ? "#FFFFFF" : "var(--text-muted)",
              cursor: newContent.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Send size={11} /> Comment
          </button>
        </div>
      </form>
    </div>
  );
}
