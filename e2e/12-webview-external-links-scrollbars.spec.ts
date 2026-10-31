import { test, expect } from '@playwright/test';

test.describe('Webview Tabs, External Links & Hidden Scrollbars', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_links_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Links QA Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Links QA Lead's Workspace").first()).toBeVisible();

    // Create a project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await expect(page.locator('text=Create New Project')).toBeVisible();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Links & Scrollbar Project');
    await page.click('.modal-card button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Links & Scrollbar Project' })).toBeVisible();
  });

  test('Scrollbars are globally hidden via scrollbar-width none', async ({ page }) => {
    const scrollbarWidth = await page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      const htmlStyle = window.getComputedStyle(document.documentElement);
      return {
        body: bodyStyle.scrollbarWidth,
        html: htmlStyle.scrollbarWidth,
      };
    });

    expect(scrollbarWidth.body).toBe('none');
    expect(scrollbarWidth.html).toBe('none');
  });

  test('Link opening setting can be toggled between tab and browser', async ({ page }) => {
    // Open Settings Modal via sidebar item
    const settingsItem = page.locator('.sidebar-item:has-text("Settings")');
    await settingsItem.scrollIntoViewIfNeeded();
    await settingsItem.click();
    await expect(page.locator('text=Preferences').first()).toBeVisible();

    // Click Workspace Defaults tab in macOS Sonoma settings
    await page.click('.settings-tab-btn:has-text("Workspace Defaults")');

    // Verify Link Opening Preference options exist
    const tabOption = page.locator('text=Open in In-App Webview Tab');
    const browserOption = page.locator('text=Open in Default macOS Browser');

    await expect(tabOption).toBeVisible();
    await expect(browserOption).toBeVisible();

    // Switch to browser
    await browserOption.click();
    const storedSetting = await page.evaluate(() => localStorage.getItem('kanban_link_open_target'));
    expect(storedSetting).toBe('browser');

    // Switch back to tab
    await tabOption.click();
    const restoredSetting = await page.evaluate(() => localStorage.getItem('kanban_link_open_target'));
    expect(restoredSetting).toBe('tab');

    // Close settings modal
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Preferences').first()).not.toBeVisible();
  });

  test('Clicking a markdown link opens an in-app Webview tab with YouTube embed conversion', async ({ page }) => {
    // Switch to Board
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Create a ticket with markdown link
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Ticket with Video Link');
    await page.click('button:has-text("Create Ticket")');

    // Open ticket details
    const ticketCard = page.locator('text=Ticket with Video Link').first();
    await ticketCard.click();

    // Edit description
    await page.click('button:has-text("Edit")');
    const descInput = page.locator('textarea[data-testid="ticket-description-input"]');
    await expect(descInput).toBeVisible();
    await descInput.fill('Watch the guide here: [LLD Video Guide](https://www.youtube.com/watch?v=treOXPGXrXQ)');
    await page.click('button:has-text("Preview")');

    // Click the markdown link
    const link = page.locator('a:has-text("LLD Video Guide")');
    await expect(link).toBeVisible();
    await link.click();

    // Verify a Webview tab opened in the header
    const webviewTab = page.locator('.header-tab:has-text("LLD Video Guide"), .header-tab:has-text("youtube")').first();
    await expect(webviewTab).toBeVisible();

    // Verify the WebviewToolbar is visible
    await expect(page.locator('button[title="Open in default system browser"]')).toBeVisible();

    // Verify the iframe src has been converted to embed format
    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toContain('youtube-nocookie.com/embed/treOXPGXrXQ');
  });

  test('Header bar elements are properly aligned with 44px titlebar', async ({ page }) => {
    const header = page.locator('header[data-tauri-drag-region]').first();
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeCloseTo(44, 1);

    const toggleSidebarBtn = page.locator('[data-testid="toggle-sidebar-btn"]');
    if (await toggleSidebarBtn.isVisible()) {
      const btnBox = await toggleSidebarBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      const relativeCenterY = btnBox!.y - box!.y + btnBox!.height / 2;
      expect(relativeCenterY).toBeCloseTo(21.5, 0.5);
    }
  });
});
