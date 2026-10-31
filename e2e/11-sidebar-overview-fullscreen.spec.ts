import { test, expect } from '@playwright/test';

test.describe('Sidebar Stretch & Collapse, Left Sidebar Clickability & Clickable Project Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `sidebar_qa_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    const modalCard = page.locator('.modal-card');
    await expect(modalCard).toBeVisible();

    const registerTab = page.locator('[data-testid="auth-tab-register"]');
    await registerTab.click();
    await expect(page.locator('input[placeholder="Your Name"]')).toBeVisible();

    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Sidebar QA Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');

    // Wait for workspace to load
    await expect(page.locator('[data-testid="workspace-switcher-btn"]')).toBeVisible();

    // Create a project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Test Platform Engineering');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Test Platform Engineering' })).toBeVisible();
  });

  test('Sidebar can be collapsed, expanded, and resized via drag handle', async ({ page }) => {
    // Sidebar should be initially visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check resizer divider is present
    const resizer = page.locator('[data-testid="sidebar-resizer"]');
    await expect(resizer).toBeVisible();

    // Toggle collapse button in titlebar
    const toggleSidebarBtn = page.locator('[data-testid="toggle-sidebar-btn"]');
    await expect(toggleSidebarBtn).toBeVisible();
    await toggleSidebarBtn.click();

    // Sidebar should be collapsed / hidden
    await expect(sidebar).not.toBeVisible();

    // Toggle again to expand
    await toggleSidebarBtn.click();
    await expect(sidebar).toBeVisible();

    // Test keyboard shortcut Cmd+\ or Ctrl+\ to toggle
    await page.keyboard.press('Control+\\');
    await expect(sidebar).not.toBeVisible();
    await page.keyboard.press('Control+\\');
    await expect(sidebar).toBeVisible();
  });

  test('Left sidebar navigation works when ticket or notepad tab is open', async ({ page }) => {
    // Create a ticket
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Sidebar Navigation Bug Reproduction');
    await page.click('button:has-text("Create Ticket")');

    const ticketCard = page.locator('text=Sidebar Navigation Bug Reproduction').first();
    await expect(ticketCard).toBeVisible();

    // Open ticket details tab
    await ticketCard.click();
    await expect(page.locator('[data-testid="ticket-breadcrumbs"]')).toBeVisible();
    await expect(page.locator('.header-tab.active')).toContainText('Sidebar Navigation Bug');

    // While in Ticket tab, click "All Projects" in sidebar
    await page.locator('.sidebar-item:has-text("All Projects")').click();

    // Verify it switched back to Home tab and loads All Projects
    await expect(page.locator('.header-tab.active')).toContainText('Home');
    await expect(page.locator('text=Test Platform Engineering').first()).toBeVisible();

    // Now open Notepad & Canvas from sidebar
    await page.locator('[data-testid="sidebar-notepad-link"]').click();
    await expect(page.locator('[data-testid="notepad-view-container"]')).toBeVisible();
    await expect(page.locator('.header-tab.active')).toContainText('Notepad');

    // While in Notepad tab, click "Test Platform Engineering" project in sidebar
    await page.locator('.sidebar-item:has-text("Test Platform Engineering")').first().click();

    // Verify it switched back to Home tab showing the project
    await expect(page.locator('.header-tab.active')).toContainText('Home');
    await expect(page.getByRole('heading', { name: 'Test Platform Engineering' })).toBeVisible();
  });

  test('Project overview metric cards and epics are clickable with interactive filtering', async ({ page }) => {
    // Navigate to Overview tab
    await page.click('button:has-text("Overview")');
    await expect(page.locator('[data-testid="metric-card-total-tickets"]')).toBeVisible();

    // Metric cards should exist with clickable testids
    const totalTicketsCard = page.locator('[data-testid="metric-card-total-tickets"]');
    const inProgressCard = page.locator('[data-testid="metric-card-in-progress"]');
    const openCard = page.locator('[data-testid="metric-card-open"]');
    const completedCard = page.locator('[data-testid="metric-card-completed"]');
    const completionCard = page.locator('[data-testid="metric-card-completion"]');
    const epicsCard = page.locator('[data-testid="metric-card-epics"]');

    await expect(totalTicketsCard).toBeVisible();
    await expect(inProgressCard).toBeVisible();
    await expect(openCard).toBeVisible();
    await expect(completedCard).toBeVisible();

    // Clicking "Total Tickets" navigates to List view
    await totalTicketsCard.click();
    await expect(page.locator('h2:has-text("All Tickets")')).toBeVisible();

    // Return to Overview
    await page.click('button:has-text("Overview")');

    // Clicking "In Progress" navigates to List view filtered to In Progress
    await inProgressCard.click();
    await expect(page.locator('h2:has-text("All Tickets")')).toBeVisible();
    await expect(page.locator('[data-testid="list-category-filter-pill"]')).toContainText('In Progress');

    // Clear filter via category filter pill
    await page.locator('[data-testid="list-category-filter-pill"] button').click();
    await expect(page.locator('[data-testid="list-category-filter-pill"]')).not.toBeVisible();

    // Return to Overview
    await page.click('button:has-text("Overview")');

    // Clicking "Completion" navigates to Kanban Board
    await completionCard.click();
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Return to Overview and click "Epics"
    await page.click('button:has-text("Overview")');
    await epicsCard.click();
    await expect(page.getByRole('heading', { name: 'Epics & Milestones' })).toBeVisible();
  });

  test('Notepad supports collapsible notes list and Zen full screen mode', async ({ page }) => {
    // Open Notepad tab
    await page.locator('[data-testid="sidebar-notepad-link"]').click();
    await expect(page.locator('[data-testid="notepad-view-container"]')).toBeVisible();

    // Create a note so active note and tools are loaded
    await page.locator('[data-testid="new-note-btn"]').click();
    await expect(page.locator('[data-testid="note-title-input"]')).toBeVisible();

    // Check notes list resizer is present
    const notesResizer = page.locator('[data-testid="notes-list-resizer"]');
    await expect(notesResizer).toBeVisible();

    // Collapse notes list
    const collapseNotesBtn = page.locator('[data-testid="collapse-notes-list-btn"]');
    await expect(collapseNotesBtn).toBeVisible();
    await collapseNotesBtn.click();

    // Notes resizer should be hidden when notes list is collapsed
    await expect(notesResizer).not.toBeVisible();

    // Expand button in note header should restore notes list
    const expandNotesBtn = page.locator('[data-testid="expand-notes-list-btn"]');
    await expect(expandNotesBtn).toBeVisible();
    await expandNotesBtn.click();
    await expect(notesResizer).toBeVisible();

    // Toggle Zen Mode
    const zenBtn = page.locator('[data-testid="toggle-zen-mode-btn"]');
    await expect(zenBtn).toBeVisible();
    await zenBtn.click();

    // In Zen mode, the container takes fixed full screen
    const notepadContainer = page.locator('[data-testid="notepad-view-container"]');
    await expect(notepadContainer).toHaveCSS('position', 'fixed');

    // Press Escape to exit Zen mode
    await page.keyboard.press('Escape');
    await expect(notepadContainer).toHaveCSS('position', 'relative');

    // Open Whiteboard and test its fullscreen toggle
    await page.locator('[data-testid="toggle-whiteboard-btn"]').click();
    const whiteboardModal = page.locator('[data-testid="whiteboard-canvas-modal"]');
    await expect(whiteboardModal).toBeVisible();

    const whiteboardFullscreenBtn = page.locator('[data-testid="whiteboard-toggle-fullscreen-btn"]');
    await expect(whiteboardFullscreenBtn).toBeVisible();
    await whiteboardFullscreenBtn.click();

    await expect(whiteboardModal).toHaveCSS('position', 'fixed');

    // Exit fullscreen
    await whiteboardFullscreenBtn.click();
    await expect(whiteboardModal).toHaveCSS('position', 'relative');
  });
});
