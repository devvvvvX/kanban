import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string;
  actor_name: string;
  action_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export class ActivityService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public recordActivity(
    userId: string,
    ticketId: string,
    actorName: string,
    actionType: string,
    details: Record<string, unknown> = {}
  ): TicketActivity {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const detailsJson = JSON.stringify(details);

    this.db
      .prepare(
        `INSERT INTO ticket_activity (id, ticket_id, user_id, actor_name, action_type, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, ticketId, userId, actorName, actionType, detailsJson, now);

    return {
      id,
      ticket_id: ticketId,
      user_id: userId,
      actor_name: actorName,
      action_type: actionType,
      details,
      created_at: now,
    };
  }

  public listActivity(userId: string, ticketId: string): TicketActivity[] {
    const rows = this.db
      .prepare(
        `SELECT id, ticket_id, user_id, actor_name, action_type, details, created_at
         FROM ticket_activity
         WHERE user_id = ? AND ticket_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId, ticketId) as Array<{
        id: string;
        ticket_id: string;
        user_id: string;
        actor_name: string;
        action_type: string;
        details: string;
        created_at: string;
      }>;

    return rows.map((r) => {
      let parsed = {};
      try {
        parsed = JSON.parse(r.details);
      } catch {
        parsed = {};
      }
      return {
        ...r,
        details: parsed,
      };
    });
  }
}
