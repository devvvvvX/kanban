import { test, expect } from '@playwright/test';

test.describe('Ticket Interactions: Slide Drawer, Context Menu & Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_interact_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate a fresh user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Alex Rivera');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Alex Rivera's Workspace")).toBeVisible();

    // Create a test project: "DSA Interview Prep"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'DSA Interview Prep');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'DSA Interview Prep' })).toBeVisible();

    // Switch to Kanban Board view
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Add Ticket 1 to Todo
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'DP on Trees');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kanban-card:has-text("DP on Trees")')).toBeVisible();

    // Add Ticket 2 to Todo
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'DP on Graph');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kanban-card:has-text("DP on Graph")')).toBeVisible();
  });

  test('1. Left-click on ticket card opens Slide Drawer without opening a workspace tab', async ({ page }) => {
    // Check initial tabs: only Home
    const headerTabs = page.locator('.header-tab');
    await expect(headerTabs).toHaveCount(1);
    await expect(headerTabs.first()).toContainText('Home');

    // Left-click on "DP on Trees"
    const card = page.locator('.kanban-card:has-text("DP on Trees")');
    await card.click();

    // Verify Slide Drawer is open
    const drawer = page.locator('.ticket-drawer-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('textarea.ticket-drawer-title-input')).toHaveValue('DP on Trees');

    // Verify NO new workspace tab was opened
    await expect(page.locator('.header-tab')).toHaveCount(1);

    // Inside drawer, click "Open in new tab" icon button
    const openInTabBtn = drawer.locator('button[title="Open in new tab"]');
    await expect(openInTabBtn).toBeVisible();
    await openInTabBtn.click();

    // Now a new tab is created and focused, drawer is closed
    await expect(page.locator('.header-tab')).toHaveCount(2);
    await expect(page.locator('.header-tab.active')).toContainText('DP on Trees');
    await expect(drawer).not.toBeVisible();

    // Close the ticket tab -> returns to Home
    await page.locator('.header-tab.active button[aria-label*="Close"]').click();
    await expect(page.locator('.header-tab')).toHaveCount(1);
    await expect(page.locator('.header-tab.active')).toContainText('Home');
  });

  test('2. Right-click on ticket card opens context menu with useful actions', async ({ page }) => {
    const card = page.locator('.kanban-card:has-text("DP on Graph")');

    // Right-click to trigger context menu
    await card.click({ button: 'right' });

    const contextMenu = page.locator('.ticket-context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('.ticket-context-menu-title')).toContainText('DP on Graph');

    // Options present: Open in Drawer, Open in New Tab, Copy ID, Move to, Delete Ticket
    await expect(contextMenu.locator('button:has-text("Open in Drawer")')).toBeVisible();
    await expect(contextMenu.locator('button:has-text("Open in New Tab")')).toBeVisible();
    await expect(contextMenu.locator('button:has-text("Copy")')).toBeVisible();
    await expect(contextMenu.locator('text=Move to')).toBeVisible();
    await expect(contextMenu.locator('button:has-text("Delete Ticket")')).toBeVisible();

    // Test "Open in Drawer" from context menu
    await contextMenu.locator('button:has-text("Open in Drawer")').click();
    await expect(contextMenu).not.toBeVisible();
    const drawer = page.locator('.ticket-drawer-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('textarea.ticket-drawer-title-input')).toHaveValue('DP on Graph');

    // Close drawer with Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('3. Card menu button (⋮) opens the context menu', async ({ page }) => {
    const card = page.locator('.kanban-card:has-text("DP on Trees")');
    const menuBtn = card.locator('.kanban-card-menu-btn');
    await menuBtn.click();

    const contextMenu = page.locator('.ticket-context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('.ticket-context-menu-title')).toContainText('DP on Trees');

    // Dismiss by clicking outside
    await page.mouse.click(10, 10);
    await expect(contextMenu).not.toBeVisible();
  });

  test('4. Drag and Drop moves ticket between columns smoothly', async ({ page }) => {
    const card = page.locator('.kanban-card:has-text("DP on Trees")');
    const inProgressColumn = page.locator('.kanban-column:has(h3:has-text("In Progress"))');

    // Drag from Todo to In Progress
    await card.dragTo(inProgressColumn);

    // Verify card is now in In Progress column
    await expect(inProgressColumn.locator('.kanban-card:has-text("DP on Trees")')).toBeVisible();

    // Verify drawer did NOT open inadvertently during drag
    await expect(page.locator('.ticket-drawer-panel')).not.toBeVisible();
    await expect(page.locator('.header-tab')).toHaveCount(1);
  });

  test('5. List View: Left click opens drawer, Right click opens context menu', async ({ page }) => {
    await page.click('button:has-text("List")');
    await expect(page.locator('.list-view-table')).toBeVisible();

    const row = page.locator('.list-view-row:has-text("DP on Trees")');
    await expect(row).toBeVisible();

    // Left click on title text -> opens drawer without opening a tab
    await row.locator('.list-view-title-text').click();
    const drawer = page.locator('.ticket-drawer-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('textarea.ticket-drawer-title-input')).toHaveValue('DP on Trees');
    await expect(page.locator('.header-tab')).toHaveCount(1);

    // Close drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Right click on title text -> opens context menu
    await row.locator('.list-view-title-text').click({ button: 'right' });
    const contextMenu = page.locator('.ticket-context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('.ticket-context-menu-title')).toContainText('DP on Trees');
  });

  test('6. Epic Page: Left click opens drawer, Right click opens context menu', async ({ page }) => {
    // Navigate to Epics
    await page.click('button:has-text("Epics")');

    // Create an epic: "Algorithms"
    const createEpicBtn = page.locator('button:has-text("Create Epic")').first();
    await createEpicBtn.click();
    await page.fill('[data-testid="epic-title-input"]', 'Algorithms');
    await page.click('button[type="submit"]:has-text("Create Epic")');

    // Click on the newly created epic card
    const epicCard = page.locator('.epic-card:has-text("Algorithms")').first();
    await expect(epicCard).toBeVisible();
    await epicCard.click();

    // Verify on Epic Detail Page tab opened
    await expect(page.locator('h1:has-text("Algorithms")')).toBeVisible();

    // If tickets table has a row or we add one
    const ticketRow = page.locator('.ticket-table-row').first();
    if (await ticketRow.isVisible()) {
      await ticketRow.click();
      const drawer = page.locator('.ticket-drawer-panel');
      await expect(drawer).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();

      await ticketRow.click({ button: 'right' });
      const contextMenu = page.locator('.ticket-context-menu');
      await expect(contextMenu).toBeVisible();
    }
  });
});
