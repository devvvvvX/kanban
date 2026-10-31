import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { SavedQueryService } from "../../src/lib/query/savedQueryService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("SavedQueryService (QURY-03)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let savedQueryService: SavedQueryService;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    savedQueryService = new SavedQueryService(db);

    const u1 = await authService.register("saved-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("saved-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("creates, retrieves, and lists saved queries with custom filters (QURY-03)", () => {
    const q1 = savedQueryService.createSavedQuery({
      userId: user1Id,
      name: "High Priority Bugs",
      icon: "alert-circle",
      color: "#EF4444",
      filter: {
        operator: "AND",
        conditions: [
          { field: "priority", operator: "is", value: "urgent" },
          { field: "label", operator: "contains", value: "bug" },
        ],
      },
      sort: { field: "due_date", direction: "ASC" },
    });

    expect(q1.name).toBe("High Priority Bugs");
    expect(q1.icon).toBe("alert-circle");
    expect(q1.filter.conditions).toHaveLength(2);

    const list = savedQueryService.listSavedQueries(user1Id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(q1.id);
  });

  it("updates and deletes saved queries cleanly", () => {
    const q1 = savedQueryService.createSavedQuery({
      userId: user1Id,
      name: "Pending Reviews",
      filter: { operator: "AND", conditions: [] },
    });

    const updated = savedQueryService.updateSavedQuery(q1.id, user1Id, {
      name: "Code Reviews Needed",
      color: "#10B981",
    });

    expect(updated.name).toBe("Code Reviews Needed");
    expect(updated.color).toBe("#10B981");

    savedQueryService.deleteSavedQuery(q1.id, user1Id);
    const list = savedQueryService.listSavedQueries(user1Id);
    expect(list).toHaveLength(0);
  });

  it("strictly isolates saved queries across different user accounts", () => {
    const q1 = savedQueryService.createSavedQuery({
      userId: user1Id,
      name: "Confidential Roadmap",
      filter: { operator: "AND", conditions: [] },
    });

    expect(savedQueryService.listSavedQueries(user2Id)).toHaveLength(0);

    expect(() =>
      savedQueryService.updateSavedQuery(q1.id, user2Id, { name: "Hacked" })
    ).toThrow(/Saved query not found or unauthorized/);

    expect(() =>
      savedQueryService.deleteSavedQuery(q1.id, user2Id)
    ).toThrow(/Saved query not found or unauthorized/);
  });
});
