import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface SyncEvent {
  id: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: any;
  createdAt: string;
}

type SyncListener = (event: SyncEvent) => void;

class SyncBroadcaster {
  private inMemoryListeners = new Set<SyncListener>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel("kanban_mcp_sync_channel");
        this.channel.onmessage = (msg) => {
          if (msg.data && typeof msg.data === "object") {
            this.notifyLocalListeners(msg.data as SyncEvent);
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  private notifyLocalListeners(event: SyncEvent): void {
    for (const listener of this.inMemoryListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[SyncBroadcaster] Listener error:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("kanban-mcp-sync", { detail: event }));
      } catch {
        // Ignore if window is not standard DOM
      }
    }
  }

  /**
   * Broadcast an event to local listeners, the BroadcastChannel, and record it in SQLite.
   */
  broadcast(event: SyncEvent, dbInstance?: ISqlDatabase): void {
    // 1. Persist to sync_events table in SQLite
    const db = dbInstance ?? (typeof window !== "undefined" ? getDb() : undefined);
    if (db) {
      try {
        const payloadStr = JSON.stringify(event.payload ?? {});
        db.prepare(`
          INSERT INTO sync_events (id, user_id, event_type, entity_type, entity_id, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          event.id,
          event.userId,
          event.eventType,
          event.entityType,
          event.entityId,
          payloadStr,
          event.createdAt
        );
      } catch {
        // Table may not exist yet or connection closed
      }
    }

    // 2. Notify in-memory listeners
    this.notifyLocalListeners(event);

    // 3. Post to BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch {
        // Ignore channel transfer errors
      }
    }
  }

  /**
   * Subscribe a callback to receive sync events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: SyncListener): () => void {
    this.inMemoryListeners.add(listener);
    return () => {
      this.inMemoryListeners.delete(listener);
    };
  }

  /**
   * Starts a poller that queries SQLite sync_events table to detect
   * mutations made by external processes (e.g. MCP stdio process).
   */
  startPoller(
    userId: string,
    onNewEvent: SyncListener,
    pollIntervalMs = 1500,
    dbInstance?: ISqlDatabase
  ): () => void {
    let active = true;
    let lastSeenIso = new Date().toISOString();
    const seenIds = new Set<string>();

    const checkEvents = () => {
      if (!active) return;
      try {
        const db = dbInstance ?? getDb();
        const rows = db.prepare(`
          SELECT id, user_id, event_type, entity_type, entity_id, payload, created_at
          FROM sync_events
          WHERE user_id = ? AND created_at >= ?
          ORDER BY created_at ASC
        `).all(userId, lastSeenIso) as Array<{
          id: string;
          user_id: string;
          event_type: string;
          entity_type: string;
          entity_id: string;
          payload: string | null;
          created_at: string;
        }>;

        for (const row of rows) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id);
            lastSeenIso = row.created_at;
            let parsedPayload = null;
            try {
              parsedPayload = row.payload ? JSON.parse(row.payload) : null;
            } catch {
              parsedPayload = null;
            }

            const evt: SyncEvent = {
              id: row.id,
              userId: row.user_id,
              eventType: row.event_type,
              entityType: row.entity_type,
              entityId: row.entity_id,
              payload: parsedPayload,
              createdAt: row.created_at,
            };

            onNewEvent(evt);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    const intervalId = setInterval(checkEvents, pollIntervalMs);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }
}

export const syncBroadcaster = new SyncBroadcaster();
