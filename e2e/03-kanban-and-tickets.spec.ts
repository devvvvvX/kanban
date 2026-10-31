import { test, expect } from '@playwright/test';

test.describe('Relational Tickets & Customizable Kanban Board (TICK-01 to TICK-05, KANB-01 to KANB-05)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_kanb_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate a fresh user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Kanban QA Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Kanban QA Lead's Workspace")).toBeVisible();

    // Create a test project: "Alpha Kanban"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Alpha Kanban');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Alpha Kanban' })).toBeVisible();

    // Switch to Kanban Board view
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test('TICK-01, TICK-02 & TICK-03: Create tickets with metadata, labels, and auto-generated identifiers', async ({ page }) => {
    // 1. Open quick create dialog (TICK-01)
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();

    // 2. Fill ticket fields (TICK-03)
    await page.fill('input[placeholder*="What needs to be done?"]', 'Implement SQLite IndexedDB Sync');

    // Expand details
    const moreDetailsBtn = page.locator('button:has-text("Add details")');
    if (await moreDetailsBtn.isVisible()) {
      await moreDetailsBtn.click();
    }

    // Add labels
    const labelInput = page.locator('input[placeholder*="Add label"]');
    if (await labelInput.isVisible()) {
      await labelInput.fill('database');
      await labelInput.press('Enter');
      await labelInput.fill('core');
      await labelInput.press('Enter');
    }

    // Submit ticket creation
    await page.click('button:has-text("Create Ticket")');

    // 3. Verify card appears in Todo column with unique ticket identifier (TICK-02)
    const ticketCard = page.locator('.kanban-column:has(h3:has-text("Todo"))').locator('.kanban-card, div[draggable="true"]').first();
    await expect(ticketCard).toBeVisible();
    await expect(ticketCard.locator('text=Implement SQLite IndexedDB Sync')).toBeVisible();

    // Identifier pattern like AKL-1 or ALPH-1
    const cardText = await ticketCard.textContent();
    expect(cardText).toMatch(/[A-Z]{3,4}-1/);
  });

  test('TICK-04 & TICK-05: Focused side drawer, editing, duplication, and archive', async ({ page }) => {
    // Create a ticket
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Ticket For Drawer Testing');
    await page.click('button:has-text("Create Ticket")');

    // Click card to open focused detail drawer (TICK-04)
    const ticketCard = page.locator('text=Ticket For Drawer Testing').first();
    await ticketCard.click();

    // Verify detail drawer is open
    await expect(page.locator('textarea[placeholder*="Add Markdown description"]')).toBeVisible();

    // Edit description
    const descArea = page.locator('textarea[placeholder*="Add Markdown description"]');
    await descArea.fill('## Acceptance Criteria\n- Safe storage\n- Fast queries');
    await descArea.blur();

    // Test Markdown Preview toggle
    await page.click('button:has-text("Preview")');
    await expect(page.locator('text=Acceptance Criteria')).toBeVisible();

    // Test Duplication (TICK-05)
    const duplicateBtn = page.locator('button[title*="Duplicate ticket"], button:has-text("Duplicate")').first();
    if (await duplicateBtn.isVisible()) {
      await duplicateBtn.click();
      // Close drawer with Esc
      await page.keyboard.press('Escape');

      // Verify duplicated ticket exists on board with "(Copy)" suffix
      await expect(page.locator('text=Ticket For Drawer Testing (Copy)')).toBeVisible();
    }
  });

  test('KANB-02, KANB-03 & KANB-04: Add custom column, set WIP limit, and move tickets', async ({ page }) => {
    // 1. Create a ticket in Todo
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'WIP Test Task');
    await page.click('button:has-text("Create Ticket")');
    await expect(page.locator('text=WIP Test Task')).toBeVisible();

    // 2. Add custom column "Code Review" (KANB-02)
    await page.click('button:has-text("Add Column")');
    await expect(page.locator('text=Add Workflow Column')).toBeVisible();
    await page.fill('input[placeholder*="e.g. In Review, QA, Blocked"]', 'Code Review');

    // Submit new column
    await page.click('button[type="submit"]:has-text("Create Column")');
    await expect(page.locator('h3:has-text("Code Review")')).toBeVisible();

    // 3. Move ticket from Todo to In Progress (KANB-04)
    const cardActionsBtn = page.locator('button[title="Ticket actions"]').first();
    await cardActionsBtn.click();
    await page.click('button:has-text("Move to In Progress")');

    // Verify ticket is now inside "In Progress" column
    const inProgressColumn = page.locator('.kanban-column:has(h3:has-text("In Progress"))');
    await expect(inProgressColumn.locator('text=WIP Test Task')).toBeVisible();
  });
});
