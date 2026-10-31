import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Visual QA & Browser Screenshot Audit', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots');
  const consoleMessages: { type: string; text: string }[] = [];
  const pageErrors: string[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  });

  test('Capture screenshots across all views and interactions', async ({ page }) => {
    test.setTimeout(60000);

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        console.error(`[Browser Console Error]: ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
      console.error(`[Browser Page Error]: ${err.message}`);
    });

    // 1. Initial Auth Screen (Login)
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '01a-auth-login.png'), fullPage: true });

    // Switch to Register tab
    const registerTab = page.locator('button:has-text("Create Account")');
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '01b-auth-register.png'), fullPage: true });
    }

    // Register test account
    const uniqueEmail = `visual_qa_${Date.now()}@test.local`;
    const password = 'Password123!Secure';

    await page.fill('input[placeholder="Your Name"]', 'Visual QA Engineer');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(password);
    await passInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    // 2. Recovery Key Modal
    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '02-recovery-key-modal.png'), fullPage: true });

    const recoveryKey = ((await recoveryDisplay.textContent()) || '').trim();
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');

    // 3. Empty Workspace / Dashboard
    await page.waitForSelector("text=Visual QA Engineer's Workspace", { timeout: 6000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotsDir, '03-empty-workspace.png'), fullPage: true });

    // 4. Create Project Modal
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '04-create-project-modal.png'), fullPage: true });

    await page.fill('input[placeholder*="Distributed KV Store"]', 'macOS Core Experience');
    const descArea = page.locator('textarea[placeholder*="Brief description"]');
    if (await descArea.isVisible()) {
      await descArea.fill('Flagship desktop application redesign and performance polish');
    }
    await page.click('button[type="submit"]:has-text("Create Project")');
    await page.waitForTimeout(600);

    // 5. Default view is Project Overview
    await page.screenshot({ path: path.join(screenshotsDir, '05-project-overview.png'), fullPage: true });

    // 6. Switch to Board view
    const boardTab = page.locator('button:has-text("Board")').first();
    await expect(boardTab).toBeVisible();
    await boardTab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotsDir, '06-board-empty.png'), fullPage: true });

    // 7. Open Quick Create Ticket Modal
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"], button[title*="Add ticket" i]').first();
    await expect(addTicketBtn).toBeVisible();
    await addTicketBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '07-quick-create-modal.png'), fullPage: true });

    // Create Ticket 1: High priority
    await page.fill('input[placeholder*="What needs to be done?"]', 'Implement native macOS window vibration and acrylic backdrop styling');
    const addDetailsBtn = page.locator('button:has-text("Add details")');
    if (await addDetailsBtn.isVisible()) {
      await addDetailsBtn.click();
      await page.waitForTimeout(200);
    }
    const labelInput = page.locator('input[placeholder*="Add label"]');
    if (await labelInput.isVisible()) {
      await labelInput.fill('frontend');
      await page.keyboard.press('Enter');
      await labelInput.fill('ui/ux');
      await page.keyboard.press('Enter');
    }
    const prioTrigger = page.locator('.modal-card .custom-select-trigger').nth(1);
    if (await prioTrigger.isVisible()) {
      await prioTrigger.click();
      await page.locator('.custom-select-item:has-text("High")').click();
    }
    await page.click('button:has-text("Create Ticket")');
    await page.waitForTimeout(600);

    // Create Ticket 2: Urgent overdue ticket
    await addTicketBtn.click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="What needs to be done?"]', 'Fix race condition in SQLite IndexedDB synchronization layer');
    const addDetails2 = page.locator('button:has-text("Add details")');
    if (await addDetails2.isVisible()) {
      await addDetails2.click();
      await page.waitForTimeout(200);
    }
    const labelInput2 = page.locator('input[placeholder*="Add label"]');
    if (await labelInput2.isVisible()) {
      await labelInput2.fill('database');
      await page.keyboard.press('Enter');
    }
    const prioTrigger2 = page.locator('.modal-card .custom-select-trigger').nth(1);
    if (await prioTrigger2.isVisible()) {
      await prioTrigger2.click();
      await page.locator('.custom-select-item:has-text("Urgent")').click();
    }
    // Set overdue date
    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.isVisible()) {
      await dateInput.fill('2026-01-01');
    }
    await page.click('button:has-text("Create Ticket")');
    await page.waitForTimeout(600);

    // 8. Board with populated cards
    await page.screenshot({ path: path.join(screenshotsDir, '08-board-populated.png'), fullPage: true });

    // 9. Open Ticket Detail Drawer by clicking the first card
    const card = page.locator('.kanban-card').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '09-ticket-detail-drawer.png'), fullPage: true });

    // Close drawer via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 10. Command Palette (Spotlight Search)
    const searchBtn = page.locator('.titlebar-search-btn');
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await page.keyboard.press('Meta+k');
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '10a-command-palette.png'), fullPage: true });

    await page.keyboard.type('vibration');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, '10b-command-palette-highlight.png'), fullPage: true });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 11. Settings Modal
    const settingsBtn = page.locator('button[title="Application Settings"]');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, '11-settings-modal.png'), fullPage: true });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 12. Switch to List View
    const listBtn = page.locator('button:has-text("List")').first();
    await expect(listBtn).toBeVisible();
    await listBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '12-list-view.png'), fullPage: true });

    // 13. Light Theme Switch
    const themeBtn = page.locator('button[title*="Theme:"]');
    if (await themeBtn.isVisible()) {
      await themeBtn.click(); // switches to light
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, '13-light-theme-list.png'), fullPage: true });

      // Switch back to Board view in light theme
      const boardTabLight = page.locator('button:has-text("Board")').first();
      await boardTabLight.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, '14-light-theme-board.png'), fullPage: true });

      // Reset to dark theme
      await themeBtn.click();
      await page.waitForTimeout(300);
    }

    // Save logs
    const auditReport = {
      timestamp: new Date().toISOString(),
      pageErrors,
      consoleErrors: consoleMessages.filter((m) => m.type === 'error'),
      consoleWarnings: consoleMessages.filter((m) => m.type === 'warning'),
    };
    fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'test-results/audit-log.json'), JSON.stringify(auditReport, null, 2));

    console.log(`[QA Report] Page Errors: ${pageErrors.length}, Console Errors: ${auditReport.consoleErrors.length}`);
    expect(pageErrors).toHaveLength(0);
  });
});
