import { test, expect } from '@playwright/test';

test.describe('Webview Tab State Persistence & Link Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_persist_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Sarah Connor');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Sarah Connor's Workspace").first()).toBeVisible();

    // Create a project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Webview Persistence Project');
    await page.click('.modal-card button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Webview Persistence Project' })).toBeVisible();
  });

  test('1. Clicking any link always opens in a new tab without reloading', async ({ page }) => {
    // Switch to Board
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Create a ticket with a link
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Ticket with YouTube Link');
    await page.click('button:has-text("Create Ticket")');

    const ticketCard = page.locator('text=Ticket with YouTube Link').first();
    await ticketCard.click();

    // Open ticket drawer and edit description with a markdown link
    await page.click('button:has-text("Edit")');
    const descInput = page.locator('textarea[data-testid="ticket-description-input"]');
    await expect(descInput).toBeVisible();
    await descInput.fill('Check out this video: [System Design Video](https://www.youtube.com/watch?v=xpZlsg-5LGs)');
    await page.click('button:has-text("Preview")');

    // Click the markdown link
    const link = page.locator('a:has-text("System Design Video")');
    await expect(link).toBeVisible();
    await link.click();

    // Verify a new Webview tab opens in the header
    const webviewTab = page.locator('.header-tab:has-text("System Design Video"), .header-tab:has-text("youtube")').first();
    await expect(webviewTab).toBeVisible();

    // Verify iframe exists with embed URL
    const iframe = page.locator('iframe').first();
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toContain('youtube-nocookie.com/embed/xpZlsg-5LGs');
  });

  test('2. Webview tab persists iframe DOM state and does not refresh when switching tabs', async ({ page }) => {
    // Switch to Board
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Create a ticket with a YouTube link
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'YouTube Watch Session');
    await page.click('button:has-text("Create Ticket")');

    const ticketCard = page.locator('text=YouTube Watch Session').first();
    await ticketCard.click();

    // Add description with YouTube link and preview
    await page.click('button:has-text("Edit")');
    const descInput = page.locator('textarea[data-testid="ticket-description-input"]');
    await descInput.fill('[Architecture Deep Dive](https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
    await page.click('button:has-text("Preview")');

    // Click link to open Webview tab
    await page.locator('a:has-text("Architecture Deep Dive")').click();

    // Verify Webview tab is active
    const webviewTab = page.locator('.header-tab:has-text("Architecture Deep Dive"), .header-tab:has-text("youtube")').first();
    await expect(webviewTab).toBeVisible();

    const iframeLocator = page.locator('iframe').first();
    await expect(iframeLocator).toBeVisible();

    // Attach custom runtime state to the iframe DOM element to track persistence
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      if (iframe) {
        (iframe as any).__kanban_persisted_session_timestamp = 99887766;
        (iframe as any).__kanban_custom_playback_time = '04:20';
      }
    });

    // Verify the state was attached
    let storedSession = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return (iframe as any)?.__kanban_persisted_session_timestamp;
    });
    expect(storedSession).toBe(99887766);

    // Now switch away to the Home tab
    const homeTab = page.locator('.header-tab:has-text("Home")');
    await homeTab.click();

    // Verify we are back on the Home Kanban board
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // Verify that the iframe element STILL EXISTS in the DOM (it was NOT unmounted!)
    const iframeInDom = page.locator('iframe');
    await expect(iframeInDom).toBeAttached();

    // Verify its container is hidden with display: none
    const isVisibleWhileOnHome = await iframeInDom.isVisible();
    expect(isVisibleWhileOnHome).toBe(false);

    // Verify that the iframe DOM node retained its state while hidden
    const stateWhileOnHome = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return (iframe as any)?.__kanban_persisted_session_timestamp;
    });
    expect(stateWhileOnHome).toBe(99887766);

    // Switch to another tab (Notepad)
    const notepadLink = page.locator('[data-testid="sidebar-notepad-link"]');
    await notepadLink.click();
    await expect(page.locator('[data-testid="notepad-view-container"]')).toBeVisible();

    // Verify iframe still remains attached in DOM
    await expect(iframeInDom).toBeAttached();

    // Switch BACK to the Webview tab
    await webviewTab.click();

    // Verify Webview is visible again
    await expect(iframeLocator).toBeVisible();

    // Verify that the iframe NEVER reloaded and still holds the exact persisted state!
    const stateAfterReturn = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return {
        timestamp: (iframe as any)?.__kanban_persisted_session_timestamp,
        playbackTime: (iframe as any)?.__kanban_custom_playback_time,
      };
    });

    expect(stateAfterReturn.timestamp).toBe(99887766);
    expect(stateAfterReturn.playbackTime).toBe('04:20');
  });
});
