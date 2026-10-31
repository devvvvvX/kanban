import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export type DependencyRelationshipType =
  | "relates_to"
  | "blocks"
  | "is_blocked_by"
  | "duplicates"
  | "is_duplicated_by";

export interface TicketDependency {
  id: string;
  user_id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relationship_type: DependencyRelationshipType;
  created_at: string;
}

export interface EnrichedDependency extends TicketDependency {
  target_ticket_identifier: string;
  target_ticket_title: string;
  target_ticket_priority: string;
  target_workflow_state_name: string;
  target_workflow_state_category: string;
  target_workflow_state_color: string;
}

export function getReciprocalRelationship(
  type: DependencyRelationshipType
): DependencyRelationshipType {
  switch (type) {
    case "blocks":
      return "is_blocked_by";
    case "is_blocked_by":
      return "blocks";
    case "duplicates":
      return "is_duplicated_by";
    case "is_duplicated_by":
      return "duplicates";
    case "relates_to":
    default:
      return "relates_to";
  }
}

export class DependencyService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  /**
   * Performs DFS traversal over 'blocks' relationships to detect if a path exists
   * from startTicketId to destinationTicketId.
   */
  public hasBlocksPath(
    userId: string,
    startTicketId: string,
    destinationTicketId: string
  ): boolean {
    if (startTicketId === destinationTicketId) {
      return true;
    }

    const visited = new Set<string>();
    const stack: string[] = [startTicketId];

    const stmt = this.db.prepare(
      `SELECT target_ticket_id FROM ticket_dependencies
       WHERE user_id = ? AND source_ticket_id = ? AND relationship_type = 'blocks'`
    );

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === destinationTicketId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const rows = stmt.all(userId, current) as Array<{ target_ticket_id: string }>;
      for (const row of rows) {
        if (row.target_ticket_id === destinationTicketId) {
          return true;
        }
        if (!visited.has(row.target_ticket_id)) {
          stack.push(row.target_ticket_id);
        }
      }
    }

    return false;
  }

  /**
   * Links two tickets with a relationship type, storing reciprocal relationships
   * and preventing circular blocking dependencies via DFS cycle detection.
   */
  public linkTickets(
    userId: string,
    sourceTicketId: string,
    targetTicketId: string,
    relationshipType: DependencyRelationshipType
  ): { link: TicketDependency; reciprocalLink: TicketDependency } {
    if (sourceTicketId === targetTicketId) {
      throw new Error("A ticket cannot depend on itself.");
    }

    // Verify both tickets exist and belong to the user
    const checkStmt = this.db.prepare("SELECT id FROM tickets WHERE id = ? AND user_id = ?");
    const sourceTicket = checkStmt.get(sourceTicketId, userId);
    const targetTicket = checkStmt.get(targetTicketId, userId);

    if (!sourceTicket || !targetTicket) {
      throw new Error("One or both tickets not found or unauthorized");
    }

    // Cycle check:
    // If source 'blocks' target, then adding source -> target means target must not already reach source.
    if (relationshipType === "blocks") {
      if (this.hasBlocksPath(userId, targetTicketId, sourceTicketId)) {
        throw new Error("Circular dependency detected: ticket cannot block a ticket that it depends on.");
      }
    } else if (relationshipType === "is_blocked_by") {
      // 'source is_blocked_by target' means target -> source in blocking graph.
      // So source must not already reach target.
      if (this.hasBlocksPath(userId, sourceTicketId, targetTicketId)) {
        throw new Error("Circular dependency detected: ticket cannot block a ticket that it depends on.");
      }
    }

    const reciprocalType = getReciprocalRelationship(relationshipType);
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(
      `INSERT OR REPLACE INTO ticket_dependencies
       (id, user_id, source_ticket_id, target_ticket_id, relationship_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const txn = this.db.transaction(() => {
      insertStmt.run(id1, userId, sourceTicketId, targetTicketId, relationshipType, now);
      insertStmt.run(id2, userId, targetTicketId, sourceTicketId, reciprocalType, now);
    });

    txn();

    return {
      link: {
        id: id1,
        user_id: userId,
        source_ticket_id: sourceTicketId,
        target_ticket_id: targetTicketId,
        relationship_type: relationshipType,
        created_at: now,
      },
      reciprocalLink: {
        id: id2,
        user_id: userId,
        source_ticket_id: targetTicketId,
        target_ticket_id: sourceTicketId,
        relationship_type: reciprocalType,
        created_at: now,
      },
    };
  }

  /**
   * Removes a dependency link and its reciprocal counterpart.
   */
  public unlinkTickets(userId: string, linkId: string): void {
    const existing = this.db
      .prepare(
        "SELECT source_ticket_id, target_ticket_id, relationship_type FROM ticket_dependencies WHERE id = ? AND user_id = ?"
      )
      .get(linkId, userId) as {
        source_ticket_id: string;
        target_ticket_id: string;
        relationship_type: DependencyRelationshipType;
      } | undefined;

    if (!existing) {
      throw new Error("Dependency link not found or unauthorized");
    }

    const reciprocalType = getReciprocalRelationship(existing.relationship_type);

    const txn = this.db.transaction(() => {
      // Delete forward
      this.db
        .prepare("DELETE FROM ticket_dependencies WHERE id = ? AND user_id = ?")
        .run(linkId, userId);

      // Delete reciprocal
      this.db
        .prepare(
          `DELETE FROM ticket_dependencies
           WHERE user_id = ? AND source_ticket_id = ? AND target_ticket_id = ? AND relationship_type = ?`
        )
        .run(userId, existing.target_ticket_id, existing.source_ticket_id, reciprocalType);
    });

    txn();
  }

  /**
   * Retrieves all dependencies for a ticket enriched with target ticket information.
   */
  public getDependencies(userId: string, ticketId: string): EnrichedDependency[] {
    const rows = this.db
      .prepare(
        `SELECT
           td.id,
           td.user_id,
           td.source_ticket_id,
           td.target_ticket_id,
           td.relationship_type,
           td.created_at,
           t.identifier AS target_ticket_identifier,
           t.title AS target_ticket_title,
           t.priority AS target_ticket_priority,
           ws.name AS target_workflow_state_name,
           ws.category AS target_workflow_state_category,
           ws.color AS target_workflow_state_color
         FROM ticket_dependencies td
         JOIN tickets t ON t.id = td.target_ticket_id
         JOIN workflow_states ws ON ws.id = t.workflow_state_id
         WHERE td.user_id = ? AND td.source_ticket_id = ?
         ORDER BY td.created_at ASC`
      )
      .all(userId, ticketId) as EnrichedDependency[];

    return rows;
  }
}
