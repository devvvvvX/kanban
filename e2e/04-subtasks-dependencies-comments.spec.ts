import { test, expect } from "@playwright/test";

test.describe("Subtasks, Dependencies, Comments, and Activity Audit Log (SUBT-01..04, RELN-01..03, COMM-01..02)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_subt_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = "Password123!Secure";

    // Register and activate a fresh user
    await page.goto("/");
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', "Subtasks QA Lead");
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator(".recovery-key-display");
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || "";
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Subtasks QA Lead's Workspace")).toBeVisible();

    // Create a test project: "Subtask Workflow"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', "Subtask Workflow");
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole("heading", { name: "Subtask Workflow" })).toBeVisible();

    // Switch to Kanban Board view
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test("SUBT-01..04: Subtasks creation, progress calculation, completion toggle, and card badge", async ({
    page,
  }) => {
    // 1. Create a ticket using column + button
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', "Implement Auth Middleware");
    await page.keyboard.press("Enter");

    const card = page.locator(".kanban-card").filter({ hasText: "Implement Auth Middleware" });
    await expect(card).toBeVisible();

    // 2. Open ticket detail
    await card.click();
    await expect(page.locator('button[aria-label="Close detail"]')).toBeVisible();

    // 3. Add first subtask using targeted input & Enter
    const subtaskInput = page.locator('input[placeholder*="Add a subtask"]');
    await subtaskInput.fill("Verify bearer token syntax");
    await subtaskInput.press("Enter");
    await expect(page.getByText("Verify bearer token syntax")).toBeVisible();

    // 4. Add second subtask
    await subtaskInput.fill("Check expired JWT claims");
    await subtaskInput.press("Enter");
    await expect(page.getByText("Check expired JWT claims")).toBeVisible();

    // Verify subtasks progress indicator: (0/2) 0%
    await expect(page.getByText("Subtasks (0/2)")).toBeVisible();
    await expect(page.getByText("0%")).toBeVisible();

    // 5. Complete first subtask
    const firstCheckbox = page.locator('button[title="Mark complete"]').first();
    await firstCheckbox.click();

    // Verify progress updates to (1/2) 50%
    await expect(page.getByText("Subtasks (1/2)")).toBeVisible();
    await expect(page.getByText("50%")).toBeVisible();

    // 6. Close drawer and verify KanbanCard subtask badge (1/2)
    await page.click('button[aria-label="Close detail"]');
    await expect(card.locator('span[title="Subtasks: 1 of 2 completed"]')).toBeVisible();
    await expect(card.getByText("1/2")).toBeVisible();

    // Verify parent ticket is still in "Todo" column
    const todoColumn = page.locator(".kanban-column").filter({ hasText: "Todo" });
    await expect(todoColumn.locator(".kanban-card").filter({ hasText: "Implement Auth Middleware" })).toBeVisible();

    // 7. Reopen drawer and delete a subtask
    await card.click();
    await expect(page.locator('button[aria-label="Close detail"]')).toBeVisible();
    const deleteSubtaskBtn = page.locator('button[title="Delete subtask"]').last();
    await deleteSubtaskBtn.click();

    // Verify now 1 subtask, 100% complete
    await expect(page.getByText("Subtasks (1/1)")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();

    await page.click('button[aria-label="Close detail"]');
  });

  test("RELN-01..03: Ticket dependencies, bidirectional linking, and cycle prevention", async ({
    page,
  }) => {
    // 1. Create Ticket A
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', "Core DB Schema Setup");
    await page.keyboard.press("Enter");

    // 2. Create Ticket B
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', "Run Database Migrations");
    await page.keyboard.press("Enter");

    const cardA = page.locator(".kanban-card").filter({ hasText: "Core DB Schema Setup" });
    const cardB = page.locator(".kanban-card").filter({ hasText: "Run Database Migrations" });
    await expect(cardA).toBeVisible();
    await expect(cardB).toBeVisible();

    // 3. Open Ticket A and add link: Core DB Schema Setup 'blocks' Run Database Migrations
    await cardA.click();
    await page.locator('button:has-text("Add Link")').click();

    // In AddLinkModal, select 'Blocks' relationship
    const linkModal = page.locator(".add-link-modal");
    await expect(linkModal).toBeVisible();
    await linkModal.locator('button:has-text("Blocks")').first().click();
    // Select Ticket B candidate
    await linkModal.locator('div:has-text("Run Database Migrations")').last().click();
    await linkModal.locator('button[type="submit"]:has-text("Link Ticket")').click();

    // Verify Ticket A shows Blocks section with Ticket B
    await expect(page.locator('div:has-text("Blocks")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Run Database Migrations")').first()).toBeVisible();

    // 4. Click target ticket inside dependency list to navigate to Ticket B
    await page.locator('span:has-text("Run Database Migrations")').first().click();

    // Verify Ticket B is now open and reciprocal link 'Blocked by' shows Ticket A
    await expect(page.locator('div:has-text("Blocked by")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Core DB Schema Setup")').first()).toBeVisible();

    // 5. Test Cycle Prevention: In Ticket B, try to link 'blocks' Ticket A
    await page.locator('button:has-text("Add Link")').click();
    await expect(linkModal).toBeVisible();
    await linkModal.locator('button:has-text("Blocks")').first().click();
    await linkModal.locator('div:has-text("Core DB Schema Setup")').last().click();
    await linkModal.locator('button[type="submit"]:has-text("Link Ticket")').click();

    // Verify cycle detection error message is displayed
    await expect(
      linkModal.getByText("Circular dependency detected: ticket cannot block a ticket that it depends on.")
    ).toBeVisible();

    // Close Add Link modal
    await linkModal.locator('button:has-text("Cancel")').click();

    // 6. Test link removal
    const removeLinkBtn = page.locator('button[title="Remove link"]').first();
    await removeLinkBtn.click();
    await expect(page.getByText("No linked tickets")).toBeVisible();

    await page.click('button[aria-label="Close detail"]');
  });

  test("COMM-01..02: Markdown comments, preview toggle, editing, and activity audit timeline", async ({
    page,
  }) => {
    // 1. Create a ticket
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', "Docker Container Tuning");
    await page.keyboard.press("Enter");

    const card = page.locator(".kanban-card").filter({ hasText: "Docker Container Tuning" });
    await card.click();
    await expect(page.locator('button[aria-label="Close detail"]')).toBeVisible();

    // 2. Comments tab: Enter Markdown text inside .comment-form
    const commentForm = page.locator("form.comment-form");
    const commentInput = commentForm.locator('textarea[placeholder*="Write a comment"]');
    await commentInput.fill("Please test with alpine:latest and verify memory limits.");

    // Toggle Preview within comment form
    await commentForm.locator('button:has-text("Preview")').click();
    await expect(commentForm.getByText("Please test with alpine:latest and verify memory limits.")).toBeVisible();

    // Toggle back to Edit and Submit
    await commentForm.locator('button:has-text("Edit")').click();
    await commentForm.locator('button[type="submit"]:has-text("Comment")').click();

    // Verify comment created
    await expect(page.getByText("Please test with alpine:latest and verify memory limits.")).toBeVisible();
    await expect(page.getByText("User").first()).toBeVisible();

    // 3. Edit comment
    await page.locator('button[title="Edit comment"]').click();
    const editTextarea = page.locator('textarea[style*="accent-primary"]');
    await editTextarea.fill("Updated note: verified on ARM64 macOS.");
    await page.click('button:has-text("Save")');

    await expect(page.getByText("Updated note: verified on ARM64 macOS.")).toBeVisible();
    await expect(page.getByText("(edited)")).toBeVisible();

    // 4. Switch to Activity tab
    await page.click('button:has-text("Activity")');
    await expect(page.getByText(/Activity Audit Log/i)).toBeVisible();
    await expect(page.getByText(/Created ticket/i)).toBeVisible();
    await expect(page.getByText(/Added a comment/i)).toBeVisible();

    // 5. Delete comment
    await page.click('button:has-text("Comments")');
    await page.locator('button[title="Delete comment"]').click();
    await expect(page.getByText("No comments yet. Start the conversation!")).toBeVisible();

    await page.click('button[aria-label="Close detail"]');
  });
});
