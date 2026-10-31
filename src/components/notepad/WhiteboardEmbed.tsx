import React, { useMemo, useState } from "react";
import { Edit3, Copy, Check, LayoutTemplate, Layers } from "lucide-react";
import { parseWhiteboardDesign, type WhiteboardDesign } from "./whiteboardTypes";
import { getWhiteboardBounds, renderElementsToSvg } from "./whiteboardRenderer";

export interface WhiteboardEmbedProps {
  rawContent: string;
  onEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const WhiteboardEmbed: React.FC<WhiteboardEmbedProps> = ({
  rawContent,
  onEdit,
  className = "",
  style,
}) => {
  const [copied, setCopied] = useState(false);

  const design: WhiteboardDesign | null = useMemo(() => {
    return parseWhiteboardDesign(rawContent);
  }, [rawContent]);

  const bounds = useMemo(() => {
    if (!design) return { minX: 0, minY: 0, width: 600, height: 350 };
    return getWhiteboardBounds(design.elements, design.width || 600, design.height || 350);
  }, [design]);

  if (!design) {
    return (
      <div
        className="whiteboard-embed-error"
        style={{
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border-default)",
          backgroundColor: "var(--bg-subtle)",
          color: "var(--text-secondary)",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 600 }}>
          <LayoutTemplate size={14} color="var(--accent-blue)" />
          <span>Whiteboard Diagram (Invalid JSON)</span>
        </div>
        <pre style={{ margin: 0, overflowX: "auto", fontSize: "var(--text-xs)" }}>{rawContent}</pre>
      </div>
    );
  }

  const elementsCount = design.elements.length;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={`whiteboard-embed-card ${className}`}
      style={{
        margin: "16px 0",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-surface)",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
        ...style,
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-app)",
          fontSize: "12px",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "var(--accent-blue)",
              fontWeight: 600,
            }}
          >
            <LayoutTemplate size={14} />
            <span>Whiteboard Diagram</span>
          </div>

          <span
            style={{
              fontSize: "var(--text-xs)",
              padding: "2px 8px",
              borderRadius: "10px",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Layers size={12} />
            {elementsCount} {elementsCount === 1 ? "stroke" : "strokes"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={handleCopyJson}
            className="btn-ghost"
            style={{ height: "26px", padding: "0 8px", fontSize: "var(--text-xs)", gap: 4 }}
            title="Copy raw JSON design"
          >
            {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy JSON"}</span>
          </button>

          {onEdit && (
            <button
              type="button"
              data-testid="edit-whiteboard-diagram-btn"
              onClick={onEdit}
              className="btn-primary"
              style={{
                height: "26px",
                padding: "0 10px",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                gap: 5,
                borderRadius: "var(--radius-md)",
              }}
              title="Open Whiteboard to edit this vector design"
            >
              <Edit3 size={12} />
              <span>Edit Diagram</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Preview Container */}
      <div
        onClick={onEdit}
        style={{
          padding: "20px",
          backgroundColor: "#FFFFFF",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: onEdit ? "pointer" : "default",
          position: "relative",
          minHeight: "180px",
          backgroundSize: "20px 20px",
          backgroundImage:
            "radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px)",
        }}
        title={onEdit ? "Click to edit whiteboard diagram" : undefined}
      >
        <svg
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          style={{
            width: "100%",
            maxWidth: `${Math.min(bounds.width, 800)}px`,
            height: "auto",
            display: "block",
            overflow: "visible",
          }}
        >
          {renderElementsToSvg(design.elements, "#FFFFFF")}
        </svg>

        {onEdit && (
          <div
            className="diagram-hover-hint"
            style={{
              position: "absolute",
              bottom: 8,
              right: 12,
              fontSize: "var(--text-xs)",
              color: "rgba(0, 0, 0, 0.4)",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "2px 8px",
              borderRadius: "4px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              pointerEvents: "none",
            }}
          >
            Click to edit
          </div>
        )}
      </div>
    </div>
  );
};
