import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AttachmentService } from "../../src/lib/tickets/attachmentService";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("AttachmentService (Image & Video Media Support)", () => {
  let db: ISqlDatabase;
  let service: AttachmentService;

  const USER_A = "usr_att_a";
  const USER_B = "usr_att_b";
  const TICKET_1 = "tkt_sample_1";

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    service = new AttachmentService(db);

    // Seed test users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(USER_A, "usera@test.com", "hash", "User A", "active", "2026-01-01", "2026-01-01");

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(USER_B, "userb@test.com", "hash", "User B", "active", "2026-01-01", "2026-01-01");

    // Seed test project & state & ticket
    db.prepare(`
      INSERT INTO projects (id, user_id, name, created_at, updated_at)
      VALUES ('proj_1', ?, 'Project 1', '2026-01-01', '2026-01-01')
    `).run(USER_A);

    db.prepare(`
      INSERT INTO workflow_states (id, user_id, project_id, name, color, category, position, created_at, updated_at)
      VALUES ('state_1', ?, 'proj_1', 'Todo', '#3B82F6', 'backlog', 0, '2026-01-01', '2026-01-01')
    `).run(USER_A);

    db.prepare(`
      INSERT INTO tickets (id, project_id, user_id, workflow_state_id, ticket_number, identifier, title, created_at, updated_at)
      VALUES (?, 'proj_1', ?, 'state_1', 1, 'KAN-1', 'Test Ticket', '2026-01-01', '2026-01-01')
    `).run(TICKET_1, USER_A);
  });

  afterEach(() => {
    closeDb();
  });

  it("adds and retrieves image and video attachments", () => {
    const imgAtt = service.addAttachment(
      {
        ticketId: TICKET_1,
        fileName: "architecture_diagram.png",
        fileType: "image/png",
        fileSize: 1048576,
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      },
      USER_A
    );

    const videoAtt = service.addAttachment(
      {
        ticketId: TICKET_1,
        fileName: "demo_walkthrough.mp4",
        fileType: "video/mp4",
        fileSize: 5242880,
        dataUrl: "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQ==",
      },
      USER_A
    );

    expect(imgAtt.id).toBeDefined();
    expect(videoAtt.id).toBeDefined();

    const list = service.listAttachments(TICKET_1, USER_A);
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.file_name)).toContain("architecture_diagram.png");
    expect(list.map((a) => a.file_name)).toContain("demo_walkthrough.mp4");
  });

  it("deletes attachment cleanly", () => {
    const att = service.addAttachment(
      {
        ticketId: TICKET_1,
        fileName: "to_delete.png",
        fileType: "image/png",
        fileSize: 1024,
        dataUrl: "data:image/png;base64,abc",
      },
      USER_A
    );

    expect(service.listAttachments(TICKET_1, USER_A)).toHaveLength(1);
    service.deleteAttachment(att.id, USER_A);
    expect(service.listAttachments(TICKET_1, USER_A)).toHaveLength(0);
  });

  it("strictly enforces multi-account isolation for attachments", () => {
    const att = service.addAttachment(
      {
        ticketId: TICKET_1,
        fileName: "private_secrets.png",
        fileType: "image/png",
        fileSize: 2048,
        dataUrl: "data:image/png;base64,secret",
      },
      USER_A
    );

    // User B querying the ticket's attachments gets nothing
    const listB = service.listAttachments(TICKET_1, USER_B);
    expect(listB).toHaveLength(0);

    // User B getting attachment directly by ID gets null
    const directB = service.getAttachment(att.id, USER_B);
    expect(directB).toBeNull();

    // User B cannot delete User A's attachment
    service.deleteAttachment(att.id, USER_B);
    expect(service.getAttachment(att.id, USER_A)).not.toBeNull();
  });
});
