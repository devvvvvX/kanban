import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { CommentService } from "../../src/lib/tickets/commentService";
import { ActivityService } from "../../src/lib/tickets/activityService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("CommentService & ActivityService (COMM-01, COMM-02)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let commentService: CommentService;
  let activityService: ActivityService;
  let user1Id: string;
  let user2Id: string;
  let ticket1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    commentService = new CommentService(db);
    activityService = new ActivityService(db);

    const u1 = await authService.register("comm-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("comm-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Comments & Activity Test",
    });
    const states = workflowStateService.ensureDefaultStates(p1.id, user1Id);
    const todoState = states.find((s) => s.category === "unstarted")!;

    const t1 = ticketService.createTicket({
      userId: user1Id,
      projectId: p1.id,
      workflowStateId: todoState.id,
      title: "Interactive Discussion Ticket",
    });
    ticket1Id = t1.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("allows creating, updating, listing, and deleting Markdown comments (COMM-01)", () => {
    const c1 = commentService.addComment(
      user1Id,
      ticket1Id,
      "Initial thought: we should use **Argon2id** for password hashing."
    );
    expect(c1.content).toContain("**Argon2id**");
    expect(c1.ticket_id).toBe(ticket1Id);

    const c2 = commentService.addComment(
      user1Id,
      ticket1Id,
      "Second thought: let's verify key derivation performance."
    );

    const comments = commentService.listComments(user1Id, ticket1Id);
    expect(comments).toHaveLength(2);
    expect(comments[0].id).toBe(c1.id);
    expect(comments[1].id).toBe(c2.id);

    // Update comment
    const updated = commentService.updateComment(
      user1Id,
      c1.id,
      "Initial thought: we should use **Argon2id** with 19MB memory cost."
    );
    expect(updated.content).toContain("19MB memory cost");

    // Delete comment
    commentService.deleteComment(user1Id, c2.id);
    const remaining = commentService.listComments(user1Id, ticket1Id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(c1.id);
  });

  it("records and retrieves structured activity audit entries (COMM-02)", () => {
    activityService.recordActivity(user1Id, ticket1Id, "Alice", "ticket_created", {
      title: "Interactive Discussion Ticket",
      state: "Todo",
    });

    activityService.recordActivity(user1Id, ticket1Id, "Alice", "state_changed", {
      from: "Todo",
      to: "In Progress",
    });

    activityService.recordActivity(user1Id, ticket1Id, "Alice", "dependency_added", {
      relatedTicketId: "TICK-99",
      relation: "blocks",
    });

    const activities = activityService.listActivity(user1Id, ticket1Id);
    expect(activities).toHaveLength(3);
    // Ordered DESC by created_at
    expect(activities[0].action_type).toBe("dependency_added");
    expect(activities[0].details).toEqual({ relatedTicketId: "TICK-99", relation: "blocks" });
    expect(activities[1].action_type).toBe("state_changed");
    expect(activities[2].action_type).toBe("ticket_created");
  });

  it("strictly enforces multi-account isolation on comments and activity", () => {
    const c1 = commentService.addComment(user1Id, ticket1Id, "Private note");

    expect(() =>
      commentService.addComment(user2Id, ticket1Id, "Intruder comment")
    ).toThrow(/Ticket not found or unauthorized/);

    expect(commentService.listComments(user2Id, ticket1Id)).toHaveLength(0);

    expect(() =>
      commentService.updateComment(user2Id, c1.id, "Malicious update")
    ).toThrow(/Comment not found or unauthorized/);

    expect(() =>
      commentService.deleteComment(user2Id, c1.id)
    ).toThrow(/Comment not found or unauthorized/);

    activityService.recordActivity(user1Id, ticket1Id, "Alice", "secret_action");
    expect(activityService.listActivity(user2Id, ticket1Id)).toHaveLength(0);
  });
});
