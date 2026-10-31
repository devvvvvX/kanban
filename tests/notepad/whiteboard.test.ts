import { describe, it, expect } from "vitest";
import {
  isWhiteboardDesignJson,
  parseWhiteboardDesign,
  type WhiteboardDesign,
} from "../../src/components/notepad/whiteboardTypes";
import {
  getWhiteboardBounds,
  pointsToSvgPath,
} from "../../src/components/notepad/whiteboardRenderer";

describe("Whiteboard Vector Engine", () => {
  it("validates and parses valid WhiteboardDesign JSON", () => {
    const validJson = JSON.stringify({
      type: "whiteboard-design",
      version: 1,
      elements: [
        {
          id: "el_1",
          type: "pen",
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 30 },
            { x: 40, y: 50 },
          ],
          color: "#3B82F6",
          strokeWidth: 3,
        },
      ],
    });

    expect(isWhiteboardDesignJson(validJson)).toBe(true);
    const parsed = parseWhiteboardDesign(validJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.elements.length).toBe(1);
    expect(parsed?.elements[0].type).toBe("pen");
    expect(parsed?.elements[0].points.length).toBe(3);
  });

  it("handles empty or invalid JSON gracefully", () => {
    expect(isWhiteboardDesignJson("")).toBe(false);
    expect(isWhiteboardDesignJson("not json")).toBe(false);
    expect(isWhiteboardDesignJson("data:image/png;base64,...")).toBe(false);
    expect(parseWhiteboardDesign("invalid json")).toBeNull();
  });

  it("computes bounding boxes accurately with padding", () => {
    const elements: WhiteboardDesign["elements"] = [
      {
        id: "rect_1",
        type: "rect",
        points: [
          { x: 50, y: 50 },
          { x: 250, y: 150 },
        ],
        color: "#10B981",
        strokeWidth: 2,
      },
    ];

    const bounds = getWhiteboardBounds(elements);
    expect(bounds.minX).toBeLessThanOrEqual(50);
    expect(bounds.minY).toBeLessThanOrEqual(50);
    expect(bounds.width).toBeGreaterThanOrEqual(200);
    expect(bounds.height).toBeGreaterThanOrEqual(100);
  });

  it("generates smooth SVG paths with quadratic Bézier curves", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 15 },
      { x: 40, y: 25 },
    ];
    const path = pointsToSvgPath(points);
    expect(path).toContain("M 10 10");
    expect(path).toContain("Q");
    expect(path).toContain("L 40 25");
  });

  it("NoteService correctly persists and updates whiteboard_data via both snake_case and camelCase", async () => {
    const { resetTestDb, closeDb } = await import("../../src/lib/db/connection");
    const { runMigrations } = await import("../../src/lib/db/migrations");
    const { AuthService } = await import("../../src/lib/auth/authService");
    const { NoteService } = await import("../../src/lib/notes/noteService");

    const db = await resetTestDb();
    runMigrations(db);
    const authService = new AuthService(db);
    const reg = await authService.register("whiteboard-test@mac.local", "Password123!");
    const userId = reg.user.id;
    const noteService = new NoteService(db);

    // Create note
    const note = noteService.createNote(
      {
        title: "Architecture Sketch",
        content: "Draft note",
      },
      userId
    );
    expect(note.whiteboard_data).toBeNull();

    // 1. Update with snake_case whiteboard_data
    const strokeData1 = JSON.stringify({
      type: "whiteboard-design",
      version: 1,
      elements: [{ id: "1", type: "pen", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "#000", strokeWidth: 2 }],
    });
    const updated1 = noteService.updateNote(note.id, { whiteboard_data: strokeData1 } as any, userId);
    expect(updated1.whiteboard_data).toBe(strokeData1);

    // Verify persisted in DB
    const fetched1 = noteService.getNote(note.id, userId);
    expect(fetched1?.whiteboard_data).toBe(strokeData1);

    // 2. Update with camelCase whiteboardData
    const strokeData2 = JSON.stringify({
      type: "whiteboard-design",
      version: 1,
      elements: [
        { id: "1", type: "pen", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "#000", strokeWidth: 2 },
        { id: "2", type: "rect", points: [{ x: 20, y: 20 }, { x: 80, y: 80 }], color: "#3B82F6", strokeWidth: 3 },
      ],
    });
    const updated2 = noteService.updateNote(note.id, { whiteboardData: strokeData2 }, userId);
    expect(updated2.whiteboard_data).toBe(strokeData2);

    const fetched2 = noteService.getNote(note.id, userId);
    expect(fetched2?.whiteboard_data).toBe(strokeData2);

    closeDb();
  });
});
