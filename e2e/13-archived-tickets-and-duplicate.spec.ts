import { test, expect } from '@playwright/test';

test.describe('Duplicate Ticket Tab & Archived Tickets Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_archived_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate a fresh user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Jordan Lee');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Jordan Lee's Workspace")).toBeVisible();

    // Create a test project: "Core Systems"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Core Systems');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Core Systems' })).toBeVisible();

    // Switch to Kanban Board view
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Add Ticket 1 to Todo
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Distributed Cache Engine');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kanban-card:has-text("Distributed Cache Engine")')).toBeVisible();

    // Add Ticket 2 to Todo
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'WAL Persistence Layer');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kanban-card:has-text("WAL Persistence Layer")')).toBeVisible();
  });

  test('1. Duplicating a ticket from slide drawer opens duplicate in new tab', async ({ page }) => {
    // Click on "Distributed Cache Engine" card to open drawer
    await page.locator('.kanban-card:has-text("Distributed Cache Engine")').click();
    await expect(page.locator('.ticket-drawer-panel')).toBeVisible();

    // Click Duplicate ticket in drawer header
    await page.locator('button[title="Duplicate ticket"]').click();

    // Verify slide drawer is closed
    await expect(page.locator('.ticket-drawer-panel')).toBeHidden();

    // Verify new tab is opened with duplicate title
    const headerTabs = page.locator('.header-tab');
    await expect(headerTabs).toHaveCount(2);
    await expect(headerTabs.nth(1)).toContainText('Distributed Cache Engine (Copy)');

    // Verify ticket detail page is open and shows duplicate title
    await expect(page.locator('[data-testid="ticket-detail-page"]')).toBeVisible();
    await expect(page.locator('textarea.ticket-detail-title-input')).toHaveValue('Distributed Cache Engine (Copy)');
  });

  test('2. Duplicating a ticket from context menu opens duplicate in new tab', async ({ page }) => {
    // Right click on "WAL Persistence Layer" card to open context menu
    await page.locator('.kanban-card:has-text("WAL Persistence Layer")').click({ button: 'right' });
    await expect(page.locator('.ticket-context-menu')).toBeVisible();

    // Click "Duplicate Ticket" in context menu
    await page.locator('[data-testid="context-menu-duplicate-btn"]').click();

    // Verify new tab is opened with duplicate title
    const headerTabs = page.locator('.header-tab');
    await expect(headerTabs).toHaveCount(2);
    await expect(headerTabs.nth(1)).toContainText('WAL Persistence Layer (Copy)');

    // Verify ticket detail page is open
    await expect(page.locator('[data-testid="ticket-detail-page"]')).toBeVisible();
  });

  test('3. Archiving, viewing in modal, restoring and deleting tickets', async ({ page }) => {
    // Step A: Archive "Distributed Cache Engine" via context menu
    await page.locator('.kanban-card:has-text("Distributed Cache Engine")').click({ button: 'right' });
    await page.locator('[data-testid="context-menu-archive-btn"]').click();

    // Card should no longer be on active Kanban board
    await expect(page.locator('.kanban-card:has-text("Distributed Cache Engine")')).toBeHidden();
    // "WAL Persistence Layer" should still be visible
    await expect(page.locator('.kanban-card:has-text("WAL Persistence Layer")')).toBeVisible();

    // Step B: Open Archived Tickets Modal from Sidebar
    await page.locator('[data-testid="sidebar-archived-tickets-link"]').click();
    await expect(page.locator('[data-testid="archived-tickets-modal"]')).toBeVisible();
    await expect(page.locator('text=Distributed Cache Engine')).toBeVisible();

    // Step C: Test search filter in modal
    const searchInput = page.locator('[data-testid="archived-tickets-modal"] input');
    await searchInput.fill('NonExistentQuery');
    await expect(page.locator('text=No archived tickets match')).toBeVisible();
    await searchInput.fill('Distributed');
    await expect(page.locator('text=Distributed Cache Engine')).toBeVisible();

    // Step D: Restore the ticket to active board
    await page.locator('[data-testid*="restore-ticket-"]').first().click();
    // Modal should now show empty state
    await expect(page.locator('text=No archived tickets')).toBeVisible();

    // Close modal
    await page.locator('[data-testid="archived-tickets-modal"] button:has-text("Close")').click();
    await expect(page.locator('[data-testid="archived-tickets-modal"]')).toBeHidden();

    // Verify "Distributed Cache Engine" is back on the board!
    await expect(page.locator('.kanban-card:has-text("Distributed Cache Engine")')).toBeVisible();

    // Step E: Archive via Slide Drawer and Permanently Delete in Modal
    await page.locator('.kanban-card:has-text("Distributed Cache Engine")').click();
    await expect(page.locator('.ticket-drawer-panel')).toBeVisible();
    await page.locator('[data-testid="drawer-archive-btn"]').click();

    // Close slide drawer
    await page.locator('.ticket-drawer-panel button[aria-label="Close detail"]').click();
    await expect(page.locator('.ticket-drawer-panel')).toBeHidden();

    // Card is gone from board
    await expect(page.locator('.kanban-card:has-text("Distributed Cache Engine")')).toBeHidden();

    // Open Archived Tickets Modal from List View
    await page.click('button:has-text("List")');
    await page.locator('[data-testid="list-view-archived-btn"]').click();
    await expect(page.locator('[data-testid="archived-tickets-modal"]')).toBeVisible();

    // Click Delete permanently
    await page.locator('[data-testid*="delete-archived-"]').first().click();
    await expect(page.locator('text=Delete permanently?')).toBeVisible();
    await page.locator('[data-testid*="confirm-delete-"]').click();

    // Modal should be empty now
    await expect(page.locator('text=No archived tickets')).toBeVisible();
    await page.locator('[data-testid="archived-tickets-modal"] button:has-text("Close")').click();
  });
});

