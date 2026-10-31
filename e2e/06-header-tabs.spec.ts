import { test, expect } from '@playwright/test';

test.describe('Header Tabs & Independent Ticket Page Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_tabs_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Tab QA Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Tab QA Lead's Workspace").first()).toBeVisible();

    // Create a project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Tab Workspace Project');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Tab Workspace Project' })).toBeVisible();

    // Switch to Board
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test('Home tab is fixed and cannot be closed', async ({ page }) => {
    const homeTab = page.locator('.header-tab:has-text("Home")');
    await expect(homeTab).toBeVisible();
    await expect(homeTab).toHaveClass(/active/);

    // Ensure Home tab does not contain a close button
    const closeBtn = homeTab.locator('.tab-close-btn');
    await expect(closeBtn).toHaveCount(0);
  });

  test('Clicking a ticket opens its independent page tab in the header', async ({ page }) => {
    // 1. Create a ticket
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Tab E2E Independent Ticket');
    await page.click('button:has-text("Create Ticket")');

    // 2. Click the ticket card to open independent page tab
    const ticketCard = page.locator('text=Tab E2E Independent Ticket').first();
    await ticketCard.click();

    // 3. Verify independent page tab appears in the header and becomes active
    const ticketTab = page.locator('.header-tab').filter({ hasText: 'Tab E2E Independent Ticket' });
    await expect(ticketTab).toBeVisible();
    await expect(ticketTab).toHaveClass(/active/);

    // 4. Verify independent ticket page is rendered with full editing capabilities
    await expect(page.locator('textarea[placeholder="Ticket title..."]')).toHaveValue('Tab E2E Independent Ticket');
    await expect(page.locator('.custom-select-trigger:has-text("Todo")')).toBeVisible();

    // 5. Click Home tab in the header -> board view returns
    const homeTab = page.locator('.header-tab:has-text("Home")');
    await homeTab.click();
    await expect(homeTab).toHaveClass(/active/);
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();

    // 6. Click ticket tab in the header again -> switches back to independent ticket page
    await ticketTab.click();
    await expect(ticketTab).toHaveClass(/active/);
    await expect(page.locator('textarea[placeholder="Ticket title..."]')).toHaveValue('Tab E2E Independent Ticket');
  });

  test('Create tab can be created from header and closed from header', async ({ page }) => {
    // 1. Click "+" button in the header tab bar to create a new tab
    const addTabBtn = page.locator('button[aria-label="Create tab"]');
    await expect(addTabBtn).toBeVisible();
    await addTabBtn.click();

    // 2. Verify "New Ticket" tab is created in the header
    const createTab = page.locator('.header-tab:has-text("New Ticket")');
    await expect(createTab).toBeVisible();
    await expect(createTab).toHaveClass(/active/);

    // 3. Verify independent Create Ticket page is displayed
    await expect(page.locator('input[placeholder*="What needs to be done?"]')).toBeVisible();

    // 4. Close the create tab directly from the header via close button
    const closeCreateBtn = createTab.locator('.tab-close-btn');
    await expect(closeCreateBtn).toBeVisible();
    await closeCreateBtn.click();

    // 5. Verify create tab is closed and Home tab is restored
    await expect(createTab).toHaveCount(0);
    const homeTab = page.locator('.header-tab:has-text("Home")');
    await expect(homeTab).toHaveClass(/active/);
  });

  test('Multiple create tabs can be opened, persist drafts independently, and only commit on submit', async ({ page }) => {
    const addTabBtn = page.locator('button[aria-label="Create tab"]');

    // 1. Open first create tab
    await addTabBtn.click();
    const titleInput1 = page.locator('input[placeholder*="What needs to be done?"]');
    await expect(titleInput1).toBeVisible();
    await titleInput1.fill('Draft Ticket Alpha');

    const descInput1 = page.locator('textarea[placeholder*="Add Markdown description"]');
    await descInput1.fill('Alpha notes and acceptance criteria');

    // Verify first tab title updated to "Draft Ticket Alpha"
    const tabAlpha = page.locator('.header-tab').filter({ hasText: 'Draft Ticket Alpha' });
    await expect(tabAlpha).toBeVisible();

    // 2. Open second create tab by clicking "+" again
    await addTabBtn.click();
    const titleInput2 = page.locator('input[placeholder*="What needs to be done?"]');
    await expect(titleInput2).toBeVisible();
    await expect(titleInput2).toHaveValue(''); // Fresh blank draft
    await titleInput2.fill('Draft Ticket Beta');

    const descInput2 = page.locator('textarea[placeholder*="Add Markdown description"]');
    await descInput2.fill('Beta notes for second task');

    // Verify second tab title updated to "Draft Ticket Beta"
    const tabBeta = page.locator('.header-tab').filter({ hasText: 'Draft Ticket Beta' });
    await expect(tabBeta).toBeVisible();

    // Both create tabs exist in header simultaneously!
    await expect(tabAlpha).toBeVisible();
    await expect(tabBeta).toBeVisible();

    // 3. Switch back to first create tab (Alpha) -> verify draft data persisted
    await tabAlpha.click();
    await expect(page.locator('input[placeholder*="What needs to be done?"]')).toHaveValue('Draft Ticket Alpha');
    await expect(page.locator('textarea[placeholder*="Add Markdown description"]')).toHaveValue('Alpha notes and acceptance criteria');

    // 4. Switch to Home tab -> verify neither ticket appears on board yet (uncommitted)
    const homeTab = page.locator('.header-tab:has-text("Home")');
    await homeTab.click();
    await expect(page.locator('.kanban-card:has-text("Draft Ticket Alpha")')).toHaveCount(0);
    await expect(page.locator('.kanban-card:has-text("Draft Ticket Beta")')).toHaveCount(0);

    // 5. Switch back to Alpha and commit it
    await tabAlpha.click();
    await page.click('button[type="submit"]:has-text("Create Ticket")');

    // Alpha create tab closes and opens ticket detail
    await expect(page.locator('textarea[placeholder="Ticket title..."]')).toHaveValue('Draft Ticket Alpha');

    // Beta tab is STILL present and intact!
    await tabBeta.click();
    await expect(page.locator('input[placeholder*="What needs to be done?"]')).toHaveValue('Draft Ticket Beta');
    await expect(page.locator('textarea[placeholder*="Add Markdown description"]')).toHaveValue('Beta notes for second task');

    // 6. Close Beta tab via close button
    const closeBetaBtn = tabBeta.locator('.tab-close-btn');
    await closeBetaBtn.click();
    await expect(tabBeta).toHaveCount(0);

    // Verify in Home board that Alpha is committed but Beta was never committed
    await homeTab.click();
    await expect(page.locator('.kanban-card:has-text("Draft Ticket Alpha")')).toBeVisible();
    await expect(page.locator('.kanban-card:has-text("Draft Ticket Beta")')).toHaveCount(0);
  });
});
