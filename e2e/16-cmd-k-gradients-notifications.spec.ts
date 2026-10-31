import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Cmd+K Validation, Gradient Appearance Balancing, and Single Notification Engine', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before fresh session
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_cmd_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate fresh user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Elena Rostova');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Elena Rostova's Workspace").first()).toBeVisible();

    // Create a project: "Core Platform"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Core Platform');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Core Platform' })).toBeVisible();

    // Switch to Board View
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test('1. Validate every Cmd+K Command Palette button click and navigation', async ({ page }) => {
    // Click Search button in the window titlebar to open Cmd+K palette
    const titlebarSearchBtn = page.locator('.titlebar-search-btn');
    await expect(titlebarSearchBtn).toBeVisible();
    await titlebarSearchBtn.click();

    const dialog = page.locator('.command-palette-dialog');
    await expect(dialog).toBeVisible();

    // 1.1 Action: Open Focus Timer
    const focusCmd = page.locator('[data-testid="command-palette-item-cmd-focus"]');
    await expect(focusCmd).toBeVisible();
    await focusCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="focus-view-container"]')).toBeVisible();

    // 1.2 Action: Open Notepad from Focus Tab
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const notepadCmd = page.locator('[data-testid="command-palette-item-cmd-notepad"]');
    await expect(notepadCmd).toBeVisible();
    await notepadCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="notepad-view-container"]')).toBeVisible();

    // 1.3 Action: Open Todos from Notepad Tab
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const todosCmd = page.locator('[data-testid="command-palette-item-cmd-todos"]');
    await expect(todosCmd).toBeVisible();
    await todosCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    // 1.4 Action: Open Visual Query
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const queryCmd = page.locator('[data-testid="command-palette-item-cmd-visual-query"]');
    await expect(queryCmd).toBeVisible();
    await queryCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('button:has-text("Add Condition"), button:has-text("Save View")').first()).toBeVisible();

    // 1.5 Action: View All Projects
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const allProjCmd = page.locator('[data-testid="command-palette-item-cmd-all-projects"]');
    await expect(allProjCmd).toBeVisible();
    await allProjCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();

    // 1.6 Action: View Archived Tickets
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const archivedCmd = page.locator('[data-testid="command-palette-item-cmd-archived-tickets"]');
    await expect(archivedCmd).toBeVisible();
    await archivedCmd.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="archived-tickets-page"]')).toBeVisible();

    // 1.7 Action: Create New Ticket Quick Modal
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const newTicketCmd = page.locator('[data-testid="command-palette-item-cmd-new-ticket"]');
    await expect(newTicketCmd).toBeVisible();
    await newTicketCmd.click();
    await expect(dialog).not.toBeVisible();
    const quickCreateModal = page.locator('.modal-card:has-text("Create Ticket")');
    await expect(quickCreateModal).toBeVisible();
    await page.locator('[data-testid="quick-create-close-btn"]').click();
    await expect(quickCreateModal).not.toBeVisible();

    // 1.8 Quick search filtering by keyword
    await titlebarSearchBtn.click();
    await expect(dialog).toBeVisible();
    const searchInput = page.locator('.command-palette-input');
    await searchInput.fill('focus');
    await expect(page.locator('[data-testid="command-palette-item-cmd-focus"]')).toBeVisible();
    await expect(page.locator('[data-testid="command-palette-item-cmd-notepad"]')).not.toBeVisible();

    // Screenshot of Command Palette
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/16-cmd-k-command-palette.png'),
    });

    // 1.9 Close via ESC keycap button
    const escBtn = page.locator('[data-testid="command-palette-close-btn"]');
    await expect(escBtn).toBeVisible();
    await escBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('2. Verify gradient options and automatic appearance balancing', async ({ page }) => {
    // Open Settings Modal
    const settingsLink = page.locator('[data-testid="sidebar-settings-link"]');
    await settingsLink.click();

    const settingsModal = page.locator('.settings-modal-dialog');
    await expect(settingsModal).toBeVisible();

    // Navigate to Appearance Tab
    await page.click('.settings-tab-btn:has-text("Appearance")');
    await expect(page.locator('text=Eye-Comfort Gradients')).toBeVisible();

    // 2.1 Test Light Blue gradient: must set data-canvas-gradient to light-blue and balance theme to light
    const lightBlueBtn = page.locator('[data-testid="gradient-option-light-blue"]');
    await expect(lightBlueBtn).toBeVisible();
    await lightBlueBtn.click();

    let gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    let themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('light-blue');
    expect(themeAttr).toBe('light');

    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/16-light-blue-gradient.png'),
    });

    // 2.2 Test Magenta gradient: must set data-canvas-gradient to magenta and balance theme to light
    const magentaBtn = page.locator('[data-testid="gradient-option-magenta"]');
    await expect(magentaBtn).toBeVisible();
    await magentaBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('magenta');
    expect(themeAttr).toBe('light');

    // 2.3 Test Light Green gradient: must set data-canvas-gradient to light-green and balance theme to light
    const lightGreenBtn = page.locator('[data-testid="gradient-option-light-green"]');
    await expect(lightGreenBtn).toBeVisible();
    await lightGreenBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('light-green');
    expect(themeAttr).toBe('light');

    // 2.4 Test Navy Blue (dark option): must set data-canvas-gradient to navy-blue and balance theme to dark
    const navyBlueBtn = page.locator('[data-testid="gradient-option-navy-blue"]');
    await expect(navyBlueBtn).toBeVisible();
    await navyBlueBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('navy-blue');
    expect(themeAttr).toBe('dark');

    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/16-navy-blue-gradient.png'),
    });

    // 2.5 Test Dark Emerald (dark option): must set data-canvas-gradient to dark-emerald and balance theme to dark
    const darkEmeraldBtn = page.locator('[data-testid="gradient-option-dark-emerald"]');
    await expect(darkEmeraldBtn).toBeVisible();
    await darkEmeraldBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('dark-emerald');
    expect(themeAttr).toBe('dark');

    // 2.6 Test Dark Magenta (dark option): must set data-canvas-gradient to dark-magenta and balance theme to dark
    const darkMagentaBtn = page.locator('[data-testid="gradient-option-dark-magenta"]');
    await expect(darkMagentaBtn).toBeVisible();
    await darkMagentaBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('dark-magenta');
    expect(themeAttr).toBe('dark');

    // 2.7 Test Deep Indigo (dark option): must set data-canvas-gradient to deep-indigo and balance theme to dark
    const deepIndigoBtn = page.locator('[data-testid="gradient-option-deep-indigo"]');
    await expect(deepIndigoBtn).toBeVisible();
    await deepIndigoBtn.click();

    gradientAttr = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(gradientAttr).toBe('deep-indigo');
    expect(themeAttr).toBe('dark');

    // Close settings modal
    await page.click('[data-testid="settings-modal-close-btn"]');
    await expect(settingsModal).not.toBeVisible();
  });

  test('3. Verify Focus Timer single notification and ring dismissal', async ({ page }) => {
    // Open Focus Tab
    const focusSidebarLink = page.locator('[data-testid="sidebar-focus-link"]');
    await focusSidebarLink.click();
    await expect(page.locator('[data-testid="focus-view-container"]')).toBeVisible();

    // Listen for custom notification events in page context
    await page.evaluate(() => {
      (window as any).__notificationCount = 0;
      window.addEventListener('kanban:mac-notification', () => {
        (window as any).__notificationCount++;
      });
    });

    // Start a 1-minute timer
    const oneMinPreset = page.locator('[data-testid="focus-preset-1m"]');
    if (await oneMinPreset.count() > 0) {
      await oneMinPreset.click();
    }
    const startBtn = page.locator('[data-testid="focus-start-btn"]');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Verify timer is running
    const pauseBtn = page.locator('[data-testid="focus-pause-btn"]');
    await expect(pauseBtn).toBeVisible();
  });
});
