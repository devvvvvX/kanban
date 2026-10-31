import React, { useState } from "react";
import { X, Link2, AlertTriangle, Search, Check } from "lucide-react";
import { useTickets } from "../../context/TicketContext";
import type { DependencyRelationshipType } from "../../lib/tickets/dependencyService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTicketId: string;
  onLinked: () => void;
}

const RELATION_OPTIONS: Array<{
  value: DependencyRelationshipType;
  label: string;
  desc: string;
}> = [
  { value: "blocks", label: "Blocks", desc: "This ticket blocks the target ticket" },
  { value: "is_blocked_by", label: "Is blocked by", desc: "This ticket depends on target ticket" },
  { value: "relates_to", label: "Relates to", desc: "Related or relevant context" },
  { value: "duplicates", label: "Duplicates", desc: "This ticket duplicates the target ticket" },
];

export function AddLinkModal({
  isOpen,
  onClose,
  sourceTicketId,
  onLinked,
}: AddLinkModalProps) {
  useEscapeKey(isOpen, onClose);

  const { tickets, linkTickets } = useTickets();
  const [relationshipType, setRelationshipType] =
    useState<DependencyRelationshipType>("relates_to");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter available candidate tickets: exclude current ticket
  const candidateTickets = tickets
    .filter((t) => t.id !== sourceTicketId)
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.identifier.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
      );
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) {
      setErrorMessage("Please select a target ticket to link.");
      return;
    }

    setErrorMessage(null);
    try {
      linkTickets(sourceTicketId, selectedTargetId, relationshipType);
      onLinked();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to link tickets.");
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="add-link-modal"
        style={{
          width: "480px",
          maxWidth: "92vw",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link2 size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
              Link Ticket
            </h3>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "26px", height: "26px", padding: 0 }}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          {/* Error Notice */}
          {errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--accent-red)",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Relationship Type Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Relationship
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {RELATION_OPTIONS.map((opt) => {
                const isSelected = relationshipType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setRelationshipType(opt.value);
                      setErrorMessage(null);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-md)",
                      border: isSelected
                        ? "1px solid var(--accent-primary)"
                        : "1px solid var(--border-subtle)",
                      backgroundColor: isSelected ? "rgba(59, 130, 246, 0.08)" : "var(--bg-subtle)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-muted)",
                        marginTop: "2px",
                        lineHeight: 1.2,
                      }}
                    >
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Candidate Tickets */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Target Ticket
            </label>
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search ticket title or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 30px",
                  fontSize: "13px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>

            {/* Candidate List */}
            <div
              style={{
                maxHeight: "160px",
                overflowY: "auto",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              {candidateTickets.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                  No matching tickets found
                </div>
              ) : (
                candidateTickets.map((cand) => {
                  const isSelected = selectedTargetId === cand.id;
                  return (
                    <div
                      key={cand.id}
                      onClick={() => {
                        setSelectedTargetId(cand.id);
                        setErrorMessage(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: isSelected ? "var(--bg-subtle)" : "transparent",
                        transition: "background-color var(--transition-fast)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: "var(--accent-primary)",
                          }}
                        >
                          {cand.identifier}
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cand.title}
                        </span>
                      </div>
                      {isSelected && <Check size={14} color="var(--accent-primary)" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              style={{ fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedTargetId}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "none",
                backgroundColor: selectedTargetId ? "var(--accent-primary)" : "var(--bg-subtle)",
                color: selectedTargetId ? "#FFFFFF" : "var(--text-muted)",
                cursor: selectedTargetId ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Link2 size={13} />
              Link Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
