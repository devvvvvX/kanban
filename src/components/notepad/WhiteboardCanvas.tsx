import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Pen,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveRight,
  RotateCcw,
  RotateCw,
  Trash2,
  Check,
  X,
  Maximize2,
  Minimize2,
  Copy,
} from "lucide-react";
import type {
  WhiteboardTool,
  WhiteboardElement,
  WhiteboardDesign,
  Point,
} from "./whiteboardTypes";
import { parseWhiteboardDesign } from "./whiteboardTypes";
import { drawWhiteboardElement } from "./whiteboardRenderer";

export type { WhiteboardTool };

export interface WhiteboardCanvasProps {
  initialData?: string | null;
  onSaveData?: (dataString: string) => void;
  onInsertIntoNote?: (markdownBlock: string) => void;
  onClose?: () => void;
  title?: string;
  isEditingEmbedded?: boolean;
}

export function WhiteboardCanvas({
  initialData,
  onSaveData,
  onInsertIntoNote,
  onClose,
  title,
  isEditingEmbedded = false,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState("#3B82F6");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Vector elements state
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const elementsRef = useRef<WhiteboardElement[]>([]);
  const lastSavedJsonRef = useRef<string | null>(null);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[]>([]);

  // Active in-progress drawing element (tracked in ref to avoid re-rendering during drawing loop)
  const activeElementRef = useRef<WhiteboardElement | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const rafScheduledRef = useRef<boolean>(false);
  const legacyBackgroundImgRef = useRef<HTMLImageElement | null>(null);

  // Initialize from initialData (either JSON or legacy base64 image)
  useEffect(() => {
    // If the new initialData matches what this canvas just saved, do NOT wipe local elements
    if (initialData && initialData === lastSavedJsonRef.current) {
      return;
    }

    if (!initialData) {
      setElements([]);
      elementsRef.current = [];
      setRedoStack([]);
      legacyBackgroundImgRef.current = null;
      return;
    }

    const parsed = parseWhiteboardDesign(initialData);
    if (parsed) {
      setElements(parsed.elements);
      elementsRef.current = parsed.elements;
      setRedoStack([]);
      legacyBackgroundImgRef.current = null;
    } else if (initialData.startsWith("data:image/") || initialData.startsWith("http")) {
      // Legacy raster image fallback
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        legacyBackgroundImgRef.current = img;
        redraw();
      };
      img.src = initialData;
    }
  }, [initialData]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Canvas redraw routine (efficient, smooth, 60fps)
  const redraw = useCallback((elementsToDraw?: WhiteboardElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Ensure backing store dimensions match display size * DPR
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Fill crisp background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // 2. Subtle dot grid for native whiteboard feeling
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    const dotSpacing = 20;
    for (let x = dotSpacing; x < rect.width; x += dotSpacing) {
      for (let y = dotSpacing; y < rect.height; y += dotSpacing) {
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }

    // 3. Draw legacy background image if present
    if (legacyBackgroundImgRef.current) {
      ctx.drawImage(legacyBackgroundImgRef.current, 0, 0);
    }

    // 4. Draw all finalized elements (prefer passed elements or elementsRef.current)
    const list = elementsToDraw ?? elementsRef.current;
    for (const el of list) {
      drawWhiteboardElement(ctx, el, "#FFFFFF");
    }

    // 5. Draw active in-progress stroke
    if (activeElementRef.current) {
      drawWhiteboardElement(ctx, activeElementRef.current, "#FFFFFF");
    }

    ctx.restore();
  }, []);

  // Redraw when elements or fullscreen change
  useEffect(() => {
    redraw();
  }, [redraw, elements, isFullscreen]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => redraw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redraw]);

  // Coordinates helper (in logical CSS pixels)
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    const pos = getPointerPos(e);

    activeElementRef.current = {
      id: "el_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: tool,
      points: [pos],
      color,
      strokeWidth,
    };

    redraw();
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || !activeElementRef.current) return;
    const pos = getPointerPos(e);

    const active = activeElementRef.current;
    if (active.type === "pen" || active.type === "eraser") {
      active.points.push(pos);
    } else {
      // Shapes: replace the second endpoint
      if (active.points.length === 1) {
        active.points.push(pos);
      } else {
        active.points[1] = pos;
      }
    }

    // Throttle rendering with requestAnimationFrame for 60fps smoothness
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true;
      requestAnimationFrame(() => {
        rafScheduledRef.current = false;
        redraw();
      });
    }
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const completed = activeElementRef.current;
    activeElementRef.current = null;

    if (completed && completed.points.length > 0) {
      const updatedElements = [...elementsRef.current, completed];
      elementsRef.current = updatedElements;
      setElements(updatedElements);
      setRedoStack([]); // Clear redo stack on new action

      // Draw immediately with updated elements to guarantee stroke never flickers or disappears
      redraw(updatedElements);

      // Notify auto-save if handler provided
      if (onSaveData) {
        const design: WhiteboardDesign = {
          type: "whiteboard-design",
          version: 1,
          elements: updatedElements,
        };
        const jsonStr = JSON.stringify(design);
        lastSavedJsonRef.current = jsonStr;
        onSaveData(jsonStr);
      }
    } else {
      redraw();
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (elementsRef.current.length === 0) return;
    const last = elementsRef.current[elementsRef.current.length - 1];
    const newElements = elementsRef.current.slice(0, -1);
    elementsRef.current = newElements;
    setElements(newElements);
    setRedoStack((prev) => [...prev, last]);
    redraw(newElements);

    if (onSaveData) {
      const jsonStr = JSON.stringify({ type: "whiteboard-design", version: 1, elements: newElements });
      lastSavedJsonRef.current = jsonStr;
      onSaveData(jsonStr);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const newElements = [...elementsRef.current, restored];
    elementsRef.current = newElements;
    setRedoStack(newRedo);
    setElements(newElements);
    redraw(newElements);

    if (onSaveData) {
      const jsonStr = JSON.stringify({ type: "whiteboard-design", version: 1, elements: newElements });
      lastSavedJsonRef.current = jsonStr;
      onSaveData(jsonStr);
    }
  };

  const handleClear = () => {
    if (elementsRef.current.length === 0 && !legacyBackgroundImgRef.current) return;
    elementsRef.current = [];
    setElements([]);
    setRedoStack([]);
    legacyBackgroundImgRef.current = null;
    redraw([]);

    if (onSaveData) {
      const jsonStr = JSON.stringify({ type: "whiteboard-design", version: 1, elements: [] });
      lastSavedJsonRef.current = jsonStr;
      onSaveData(jsonStr);
    }
  };

  // Export / Insert into note
  const handleExportToNote = () => {
    const design: WhiteboardDesign = {
      type: "whiteboard-design",
      version: 1,
      elements: elementsRef.current,
    };
    const jsonStr = JSON.stringify(design, null, 2);
    const mdBlock = `\n\`\`\`whiteboard\n${jsonStr}\n\`\`\`\n`;

    if (onInsertIntoNote) {
      onInsertIntoNote(mdBlock);
    }
  };

  // Optional PNG copy to clipboard
  const handleCopyPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => {
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      });
    }, "image/png");
  };

  const colors = [
    "#000000",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#64748B",
  ];
  const widths = [2, 4, 8];

  return (
    <div
      ref={containerRef}
      data-testid="whiteboard-canvas-modal"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-surface)",
        border: isFullscreen ? "none" : "1px solid var(--border-subtle)",
        borderRadius: isFullscreen ? 0 : "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: isFullscreen ? "none" : "var(--shadow-lg)",
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 2000 : undefined,
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : "560px",
      }}
    >
      {/* Whiteboard Toolbar */}
      <div
        data-testid="whiteboard-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-app)",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {/* Left: Tools */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {title && (
            <span style={{ fontSize: "12px", fontWeight: 600, marginRight: 6, color: "var(--text-primary)" }}>
              {title}
            </span>
          )}

          <button
            type="button"
            className={`btn-ghost ${tool === "pen" ? "active" : ""}`}
            onClick={() => setTool("pen")}
            title="Smooth Pen"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "pen" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "pen" ? "var(--accent-blue)" : undefined,
            }}
          >
            <Pen size={14} />
          </button>

          <button
            type="button"
            className={`btn-ghost ${tool === "eraser" ? "active" : ""}`}
            onClick={() => setTool("eraser")}
            title="Eraser"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "eraser" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "eraser" ? "var(--accent-blue)" : undefined,
            }}
          >
            <Eraser size={14} />
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            type="button"
            className={`btn-ghost ${tool === "line" ? "active" : ""}`}
            onClick={() => setTool("line")}
            title="Straight Line"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "line" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "line" ? "var(--accent-blue)" : undefined,
            }}
          >
            <Minus size={14} />
          </button>

          <button
            type="button"
            className={`btn-ghost ${tool === "arrow" ? "active" : ""}`}
            onClick={() => setTool("arrow")}
            title="Arrow"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "arrow" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "arrow" ? "var(--accent-blue)" : undefined,
            }}
          >
            <MoveRight size={14} />
          </button>

          <button
            type="button"
            className={`btn-ghost ${tool === "rect" ? "active" : ""}`}
            onClick={() => setTool("rect")}
            title="Rectangle"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "rect" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "rect" ? "var(--accent-blue)" : undefined,
            }}
          >
            <Square size={14} />
          </button>

          <button
            type="button"
            className={`btn-ghost ${tool === "circle" ? "active" : ""}`}
            onClick={() => setTool("circle")}
            title="Circle"
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              backgroundColor: tool === "circle" ? "var(--accent-blue-subtle)" : undefined,
              color: tool === "circle" ? "var(--accent-blue)" : undefined,
            }}
          >
            <Circle size={14} />
          </button>
        </div>

        {/* Center: Color & Stroke Width */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Colors */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  backgroundColor: c,
                  border: color === c ? "2px solid var(--accent-blue)" : "1px solid rgba(0,0,0,0.2)",
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  cursor: "pointer",
                  padding: 0,
                  outline: "none",
                  transition: "transform var(--transition-fast)",
                }}
              />
            ))}
          </div>

          <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          {/* Widths */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {widths.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setStrokeWidth(w)}
                className="btn-ghost"
                style={{
                  width: "24px",
                  height: "24px",
                  padding: 0,
                  backgroundColor: strokeWidth === w ? "var(--accent-blue-subtle)" : undefined,
                  color: strokeWidth === w ? "var(--accent-blue)" : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: w * 2.5,
                    height: w * 2.5,
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleUndo}
            disabled={elements.length === 0}
            title="Undo (Cmd+Z)"
            style={{ width: "28px", height: "28px", padding: 0 }}
          >
            <RotateCcw size={13} />
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Cmd+Shift+Z)"
            style={{ width: "28px", height: "28px", padding: 0 }}
          >
            <RotateCw size={13} />
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleClear}
            title="Clear Canvas"
            style={{ width: "28px", height: "28px", padding: 0, color: "var(--color-danger)" }}
          >
            <Trash2 size={13} />
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            type="button"
            className="btn-ghost"
            onClick={handleCopyPng}
            title="Copy as PNG Image"
            style={{ height: "26px", padding: "0 8px", fontSize: "var(--text-xs)", gap: 4 }}
          >
            {copiedImage ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            <span>{copiedImage ? "Copied" : "Copy PNG"}</span>
          </button>

          {onInsertIntoNote && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportToNote}
              style={{
                height: "26px",
                fontSize: "var(--text-xs)",
                gap: "4px",
                padding: "0 10px",
                fontWeight: 600,
              }}
              title={
                isEditingEmbedded
                  ? "Update diagram inside markdown note"
                  : "Embed editable vector design into markdown note"
              }
            >
              <Check size={12} />
              <span>{isEditingEmbedded ? "Update Diagram" : "Embed in Note"}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="whiteboard-toggle-fullscreen-btn"
            className="btn-ghost"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Whiteboard"}
            style={{ width: "28px", height: "28px", padding: 0 }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {onClose && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              title="Close Whiteboard"
              style={{ width: "28px", height: "28px", padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas Drawing Surface */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          cursor: tool === "eraser" ? "cell" : "crosshair",
          touchAction: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="whiteboard-canvas-surface"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
          }}
        />
      </div>
    </div>
  );
}
