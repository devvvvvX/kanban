import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { syncBroadcaster, type SyncEvent } from "../../src/lib/mcp/syncBroadcast";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Real-Time UI Sync & Multi-Account Broadcasting (MCP-05)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);

    const u1 = await authService.register("sync-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("sync-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("delivers in-process broadcast events to all active subscribers", () => {
    const receivedEvents: SyncEvent[] = [];
    const unsubscribe = syncBroadcaster.subscribe((event) => {
      receivedEvents.push(event);
    });

    const mockEvent: SyncEvent = {
      id: crypto.randomUUID(),
      userId: user1Id,
      eventType: "ticket_created",
      entityType: "ticket",
      entityId: "ticket-123",
      payload: { identifier: "KAN-1", title: "Test Ticket" },
      createdAt: new Date().toISOString(),
    };

    syncBroadcaster.broadcast(mockEvent, db);

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].id).toBe(mockEvent.id);
    expect(receivedEvents[0].payload.identifier).toBe("KAN-1");

    unsubscribe();

    // After unsubscription, no further events delivered
    syncBroadcaster.broadcast(
      { ...mockEvent, id: crypto.randomUUID(), entityId: "ticket-456" },
      db
    );
    expect(receivedEvents.length).toBe(1);
  });

  it("polls and detects external SQLite sync_events inserted by external processes", async () => {
    const detectedEvents: SyncEvent[] = [];

    // Start poller simulating desktop UI background listener
    const stopPoller = syncBroadcaster.startPoller(
      user1Id,
      (evt) => detectedEvents.push(evt),
      50, // fast polling for test
      db
    );

    // Simulate external process (CLI MCP Server) writing directly to SQLite database
    const externalEventId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sync_events (id, user_id, event_type, entity_type, entity_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      externalEventId,
      user1Id,
      "ticket_moved",
      "ticket",
      "ticket-789",
      JSON.stringify({ identifier: "APP-5", title: "External Task" }),
      now
    );

    // Wait for poller interval to pick up the event
    await new Promise((r) => setTimeout(r, 150));

    stopPoller();

    expect(detectedEvents.length).toBeGreaterThanOrEqual(1);
    const found = detectedEvents.find((e) => e.id === externalEventId);
    expect(found).toBeDefined();
    expect(found?.eventType).toBe("ticket_moved");
    expect(found?.payload?.identifier).toBe("APP-5");
  });

  it("strictly enforces multi-account isolation on polled sync events", async () => {
    const user1Events: SyncEvent[] = [];

    // Poller scoped to User 1
    const stopPoller = syncBroadcaster.startPoller(
      user1Id,
      (evt) => user1Events.push(evt),
      50,
      db
    );

    // Insert an event belonging to User 2
    const u2EventId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sync_events (id, user_id, event_type, entity_type, entity_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      u2EventId,
      user2Id, // User 2!
      "ticket_created",
      "ticket",
      "u2-ticket",
      JSON.stringify({ identifier: "SEC-1", title: "Secret User 2 Ticket" }),
      now
    );

    await new Promise((r) => setTimeout(r, 150));

    stopPoller();

    // User 1 must NEVER receive User 2's sync events
    expect(user1Events.length).toBe(0);
  });
});
