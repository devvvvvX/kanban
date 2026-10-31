export interface Point {
  x: number;
  y: number;
}

export type WhiteboardTool = "pen" | "eraser" | "line" | "arrow" | "rect" | "circle";

export interface WhiteboardElement {
  id: string;
  type: WhiteboardTool;
  points: Point[];
  color: string;
  strokeWidth: number;
}

export interface WhiteboardDesign {
  type: "whiteboard-design";
  version: 1;
  elements: WhiteboardElement[];
  width?: number;
  height?: number;
}

/**
 * Check if a string is a serialized WhiteboardDesign JSON.
 */
export function isWhiteboardDesignJson(data: string | null | undefined): boolean {
  if (!data || typeof data !== "string") return false;
  const trimmed = data.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && parsed.type === "whiteboard-design" && Array.isArray(parsed.elements);
  } catch {
    return false;
  }
}

/**
 * Safely parse a WhiteboardDesign JSON string.
 */
export function parseWhiteboardDesign(data: string | null | undefined): WhiteboardDesign | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data.trim());
    if (parsed && (parsed.type === "whiteboard-design" || Array.isArray(parsed.elements))) {
      return {
        type: "whiteboard-design",
        version: 1,
        elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        width: parsed.width,
        height: parsed.height,
      };
    }
  } catch {}
  return null;
}
