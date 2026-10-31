import React, { useState } from "react";
import { X, Bookmark, Check } from "lucide-react";
import { useQuery } from "../../context/QueryContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";

const COLOR_PRESETS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

export function SaveQueryModal() {
  const { isSaveModalOpen, closeSaveModal, saveCurrentQuery } = useQuery();
  useEscapeKey(isSaveModalOpen, closeSaveModal);

  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [error, setError] = useState<string | null>(null);

  if (!isSaveModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name for this query view.");
      return;
    }

    try {
      saveCurrentQuery(trimmed, "filter", selectedColor);
      setName("");
      setError(null);
      closeSaveModal();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save query.");
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
      onClick={closeSaveModal}
    >
      <div
        style={{
          width: "420px",
          maxWidth: "92vw",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            <Bookmark size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
              Save Query View
            </h3>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "26px", height: "26px", padding: 0 }}
            onClick={closeSaveModal}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--accent-red)",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Query Name
            </label>
            <input
              type="text"
              placeholder="e.g. Critical Bugs, Q4 Deliverables"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "13px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-subtle)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Color Tag
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {COLOR_PRESETS.map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      border: isSelected ? "2px solid #FFFFFF" : "none",
                      boxShadow: isSelected ? "0 0 0 2px var(--accent-primary)" : "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={closeSaveModal}
              style={{ fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "none",
                backgroundColor: name.trim() ? "var(--accent-primary)" : "var(--bg-subtle)",
                color: name.trim() ? "#FFFFFF" : "var(--text-muted)",
                cursor: name.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save View
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
