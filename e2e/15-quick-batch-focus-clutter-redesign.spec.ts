import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Quick-Batch: Focus Timer, UI De-cluttering, Sonoma Preferences, Markdown Drawer, and Archived Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before fresh session
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_batch_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate fresh user
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
    await expect(page.locator("text=Alex Rivera's Workspace").first()).toBeVisible();

    // Create a project: "High-Performance Kanban"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'High-Performance Kanban');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'High-Performance Kanban' })).toBeVisible();

    // Switch to Board View
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test('1. Header & Titlebar UI de-cluttering verification', async ({ page }) => {
    const titlebar = page.locator('header.window-titlebar');
    await expect(titlebar).toBeVisible();

    // Brand title must say "Kanban" without version "v1.0" badge
    const brandName = titlebar.locator('.window-titlebar-brand-name');
    await expect(brandName).toHaveText('Kanban');
    const versionBadge = titlebar.locator('.window-titlebar-version');
    await expect(versionBadge).toHaveCount(0);

    // Header must NOT contain MCP Active pill button
    const mcpBtn = titlebar.locator('button:has-text("MCP")');
    await expect(mcpBtn).toHaveCount(0);

    // Header must NOT contain Appearance switch (sun/moon) button
    const appearanceBtn = titlebar.locator('button[title*="Theme"], button[title*="appearance" i]');
    await expect(appearanceBtn).toHaveCount(0);

    // Header must NOT contain Settings gear button
    const settingsGearBtn = titlebar.locator('button[title*="Settings" i]');
    await expect(settingsGearBtn).toHaveCount(0);

    // Refresh button must be present as icon-only (no "Refresh" text)
    const refreshBtn = page.locator('button[data-testid="header-refresh-btn"]');
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toHaveText('');

    // Search button must be present with Cmd+K
    const searchBtn = titlebar.locator('.titlebar-search-btn');
    await expect(searchBtn).toBeVisible();

    // Account switcher must NOT contain initials circle block
    const accountSwitcher = page.locator('button[data-testid="account-switcher-btn"]');
    await expect(accountSwitcher).toBeVisible();
    await expect(accountSwitcher).toContainText('Alex Rivera');
    const initialsBlock = accountSwitcher.locator('div[style*="borderRadius: 50%"], span[style*="border-radius: 50%"]');
    await expect(initialsBlock).toHaveCount(0);

    // Sidebar footer must NOT contain independent MCP Agent tab
    const sidebarMcpTab = page.locator('.sidebar-container .sidebar-item:has-text("MCP Agent")');
    await expect(sidebarMcpTab).toHaveCount(0);

    // Capture visual proof of clean header
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-decluttered-header-and-account.png'),
    });
  });

  test('2. Focus Timer full view, presets, custom minutes, and live header countdown pill', async ({ page }) => {
    // Open Focus Timer from sidebar
    const focusSidebarLink = page.locator('[data-testid="sidebar-focus-link"]');
    await expect(focusSidebarLink).toBeVisible();
    await focusSidebarLink.click();

    // Focus workspace tab view opens
    const focusContainer = page.locator('[data-testid="focus-view-container"]');
    await expect(focusContainer).toBeVisible();
    await expect(page.locator('h1:has-text("Focus Session")')).toBeVisible();

    // Default duration should be 40 mins
    const timerDigits = page.locator('[data-testid="focus-timer-digits"]');
    await expect(timerDigits).toHaveText('40:00');

    // Preset pills (25, 40, 50, 60)
    const preset40 = page.locator('[data-testid="focus-preset-40"]');
    await expect(preset40).toHaveClass(/active/);

    // Switch to 25 min Pomodoro preset
    const preset25 = page.locator('[data-testid="focus-preset-25"]');
    await preset25.click();
    await expect(timerDigits).toHaveText('25:00');

    // Switch back to 40 min Deep Focus
    await preset40.click();
    await expect(timerDigits).toHaveText('40:00');

    // Capture Focus Timer full view screenshot
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-focus-timer-full-view.png'),
    });

    // Start Focus Timer
    const startBtn = page.locator('[data-testid="focus-start-btn"]');
    await startBtn.click();

    // Header titlebar should now render live countdown timer pill
    const headerPill = page.locator('[data-testid="header-focus-timer-pill"]');
    await expect(headerPill).toBeVisible();

    // Pause timer from header pill
    const pauseBtn = page.locator('[data-testid="header-focus-pause-btn"]');
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    // Resume button appears in header pill
    const resumeBtn = page.locator('[data-testid="header-focus-resume-btn"]');
    await expect(resumeBtn).toBeVisible();

    // Resume timer
    await resumeBtn.click();
    await expect(pauseBtn).toBeVisible();

    // Capture Header Timer Running screenshot
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-header-focus-timer-running.png'),
    });

    // Reset timer
    const resetBtn = page.locator('[data-testid="header-focus-reset-btn"]');
    await resetBtn.click();
  });

  test('3. Ticket Drawer opens description in Markdown format by default', async ({ page }) => {
    // Add a ticket with rich Markdown description
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Implement Zero-Copy Engine');
    await page.keyboard.press('Enter');

    const card = page.locator('.kanban-card:has-text("Implement Zero-Copy Engine")');
    await expect(card).toBeVisible();
    await card.click();

    // Slide drawer opens
    const drawer = page.locator('.ticket-drawer-panel');
    await expect(drawer).toBeVisible();

    // Switch to Edit mode to fill Markdown content
    await page.click('.ticket-drawer-section-header button:has-text("Edit")');
    const descTextarea = page.locator('textarea.ticket-drawer-desc-edit');
    await expect(descTextarea).toBeVisible();
    await descTextarea.fill('### Architectural Specs\n- Non-blocking ring buffer\n- Memory mapped paging\n**Production Ready**');
    await descTextarea.blur();

    // Close drawer
    await page.locator('.ticket-drawer-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(drawer).not.toBeVisible();

    // Re-open ticket drawer -> Must automatically be in Markdown preview mode by default!
    await card.click();
    await expect(drawer).toBeVisible();

    const descPreview = page.locator('.ticket-drawer-desc-preview');
    await expect(descPreview).toBeVisible();
    await expect(descPreview.locator('h3')).toHaveText('Architectural Specs');
    await expect(descPreview.locator('strong')).toHaveText('Production Ready');
    await expect(page.locator('.ticket-drawer-section-header button:has-text("Preview")')).toHaveClass(/active/);

    // Capture visual proof of Markdown rendered by default
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-ticket-drawer-markdown-default.png'),
    });
  });

  test('4. Preferences Modal: authentic macOS sidebar, eye-comfort gradients, default + action, and MCP Agent panel', async ({ page }) => {
    // Open Preferences Settings modal from sidebar
    const settingsSidebarLink = page.locator('[data-testid="sidebar-settings-link"]');
    await settingsSidebarLink.click();

    const settingsModal = page.locator('.settings-modal-dialog');
    await expect(settingsModal).toBeVisible();

    // Verify macOS categorized sidebar tabs
    const sidebar = page.locator('.settings-tab-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('.settings-tab-category:has-text("General")')).toBeVisible();
    await expect(sidebar.locator('.settings-tab-category:has-text("Integrations")')).toBeVisible();
    await expect(sidebar.locator('.settings-tab-category:has-text("System & Data")')).toBeVisible();

    // 1. Appearance Tab: Eye-comfort gradients
    await page.click('.settings-tab-btn:has-text("Appearance")');
    await expect(page.locator('text=Eye-Comfort Gradients')).toBeVisible();

    // Select "Warm Sand" gradient
    const warmSandBtn = page.locator('[data-testid="gradient-option-warm-sand"]');
    await expect(warmSandBtn).toBeVisible();
    await warmSandBtn.click();

    // Verify document applied warm-sand gradient
    const canvasGradient = await page.evaluate(() => document.documentElement.getAttribute('data-canvas-gradient'));
    expect(canvasGradient).toBe('warm-sand');

    // 2. Workspace Defaults Tab: Configurable '+' button action
    await page.click('.settings-tab-btn:has-text("Workspace Defaults")');
    const plusOptionFocus = page.locator('[data-testid="default-plus-option-focus"]');
    await expect(plusOptionFocus).toBeVisible();
    await plusOptionFocus.click();

    // 3. MCP Agent Tab: Embedded clean configuration panel
    await page.click('.settings-tab-btn:has-text("MCP Agent")');
    const mcpPanel = page.locator('[data-testid="mcp-settings-panel"]');
    await expect(mcpPanel).toBeVisible();
    await expect(page.locator('[data-testid="mcp-status-pill"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-master-toggle"]')).toBeAttached();

    // Capture screenshot of settings modal with macOS sidebar and gradient picker
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-settings-sonoma-sidebar-and-gradients.png'),
    });

    // Close Settings modal via Close button
    await page.click('[data-testid="settings-modal-close-btn"]');
    await expect(settingsModal).not.toBeVisible();

    // Test '+' button in header bar: should now trigger configured default action ("focus")!
    const plusTabBtn = page.locator('button[data-testid="header-plus-btn"]');
    await expect(plusTabBtn).toBeVisible();
    await plusTabBtn.click();

    // Focus tab should open
    await expect(page.locator('[data-testid="focus-view-container"]')).toBeVisible();
  });

  test('5. Archived Tickets workspace page and multi-tab switching', async ({ page }) => {
    // Add a ticket to archive
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Legacy Telemetry Service');
    await page.keyboard.press('Enter');

    const card = page.locator('.kanban-card:has-text("Legacy Telemetry Service")');
    await expect(card).toBeVisible();
    await card.click();

    // Open drawer and archive ticket
    const drawer = page.locator('.ticket-drawer-panel');
    await expect(drawer).toBeVisible();
    await page.click('button[title="Archive ticket"]');
    await page.locator('.ticket-drawer-backdrop').click({ position: { x: 10, y: 10 } });

    // Open Archived Tickets workspace page from sidebar
    const archivedSidebarLink = page.locator('[data-testid="sidebar-archived-tickets-link"]');
    await archivedSidebarLink.click();

    // Archived Tickets page renders as a full workspace page tab
    const archivedPage = page.locator('[data-testid="archived-tickets-page"]');
    await expect(archivedPage).toBeVisible();
    await expect(archivedPage.locator('h1')).toHaveText('Archived Tickets');
    await expect(archivedPage.locator('text=Legacy Telemetry Service')).toBeVisible();

    // Verify workspace tab item exists in header tab bar
    const tabItem = page.locator('.header-tab:has-text("Archived Tickets")');
    await expect(tabItem).toBeVisible();

    // Switch between Board tab and Archived Tickets tab to verify multi-tab workspace switching
    const homeTab = page.locator('.header-tab-home').first();
    await homeTab.click();
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    await tabItem.click();
    await expect(archivedPage).toBeVisible();

    // Capture Archived Tickets Workspace Page screenshot
    await page.screenshot({
      path: path.join(process.cwd(), 'docs/screenshots/15-archived-tickets-workspace-page.png'),
    });
  });

  test('6. Remind Me section offers "Now" preset button in Todos', async ({ page }) => {
    // Open Todos tab from sidebar
    const todosSidebarLink = page.locator('[data-testid="sidebar-todos-link"]');
    await todosSidebarLink.click();

    // Add a quick todo
    const quickInput = page.locator('input[data-testid="todo-new-input"]').first();
    await quickInput.fill('Review Kernel Allocator Patch');
    await quickInput.press('Enter');

    // Click on todo item to open detail drawer
    const todoItem = page.locator('text=Review Kernel Allocator Patch').first();
    await expect(todoItem).toBeVisible();
    await todoItem.click();

    // Todo detail drawer opens
    const todoDrawer = page.locator('[data-testid="todo-detail-drawer"]');
    await expect(todoDrawer).toBeVisible();

    // Remind Me section must have "Now" preset button
    const remindNowBtn = page.locator('[data-testid="drawer-remind-now-btn"]');
    await expect(remindNowBtn).toBeVisible();
    await expect(remindNowBtn).toHaveText('Now');

    // Click "Now" to schedule immediate alert
    await remindNowBtn.click();
    await expect(page.locator('text=Active').first()).toBeVisible();
  });
});

