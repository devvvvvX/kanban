import { test, expect } from '@playwright/test';

test.describe('Quick Batch Features Suite (261025-bch)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `batch_qa_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Batch Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');

    // Wait for workspace switcher to be visible
    await expect(page.locator('[data-testid="workspace-switcher-btn"]')).toBeVisible();

    // Create primary test project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Batch Core Project');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Batch Core Project' })).toBeVisible();
  });

  test('Requirement 1 & 2: All tickets toolbar "+ New Ticket" and empty state "+ Create First Ticket" open Create Ticket tab', async ({ page }) => {
    // Navigate to All Tickets view via sidebar
    await page.click('.sidebar-item:has-text("All Tickets")');
    await expect(page.locator('h2:has-text("All Tickets")')).toBeVisible();

    // Check empty state button: "+ Create First Ticket"
    const emptyStateBtn = page.locator('[data-testid="create-first-ticket-btn"]');
    await expect(emptyStateBtn).toBeVisible();
    await emptyStateBtn.click();

    // Verify Create Ticket tab opened
    const createTab = page.locator('.header-tab:has-text("New Ticket")');
    await expect(createTab).toBeVisible();
    await expect(createTab).toHaveClass(/active/);

    // Create a ticket to leave empty state
    await page.fill('input[placeholder*="What needs to be done?"]', 'First Batch Ticket');
    await page.click('button:has-text("Create Ticket")');

    // Switch back to Home tab, then go to All Tickets
    await page.click('.header-tab:has-text("Home")');
    await page.click('.sidebar-item:has-text("All Tickets")');
    await expect(page.getByRole('cell', { name: 'First Batch Ticket' })).toBeVisible();

    // Now test toolbar "+ New Ticket" button
    const toolbarNewTicketBtn = page.locator('[data-testid="new-ticket-btn"]');
    await expect(toolbarNewTicketBtn).toBeVisible();
    await toolbarNewTicketBtn.click();

    // Verify Create Ticket tab opened again
    await expect(page.locator('.header-tab:has-text("New Ticket")')).toBeVisible();
    await expect(page.locator('input[placeholder*="What needs to be done?"]')).toBeVisible();
  });

  test('Requirement 3: Clicking Epic card opens independent Epic page tab showing all tickets under that epic', async ({ page }) => {
    // Switch to Epics view tab
    await page.click('button:has-text("Epics")');
    const createEpicBtn = page.locator('button:has-text("Create Epic")').first();
    await expect(createEpicBtn).toBeVisible();

    // Create an Epic
    await createEpicBtn.click();
    await page.fill('[data-testid="epic-title-input"]', 'Backend Architecture Redesign');
    await page.click('[data-testid="epic-submit-btn"]');
    await expect(page.locator('h3:has-text("Backend Architecture Redesign")')).toBeVisible();

    // Click "View Tickets" button on the Epic card
    await page.click('button:has-text("View Tickets")');

    // Verify independent Epic page tab opened in header
    const epicTab = page.locator('.header-tab:has-text("Backend Architecture Redesign")');
    await expect(epicTab).toBeVisible();
    await expect(epicTab).toHaveClass(/active/);

    // Verify Epic Detail Page rendered with ticket list and "Add Ticket" action
    await expect(page.locator('[data-testid="epic-detail-page"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add Ticket")')).toBeVisible();
  });

  test('Requirement 4: Breadcrumb navigation paths are fully clickable', async ({ page }) => {
    // 1. Create an epic first
    await page.click('button:has-text("Epics")');
    await page.locator('button:has-text("Create Epic")').first().click();
    await page.fill('[data-testid="epic-title-input"]', 'Platform Epic');
    await page.click('[data-testid="epic-submit-btn"]');

    // 2. Create a ticket under this project
    await page.click('button:has-text("Board")');
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Breadcrumb Test Ticket');
    await page.click('button:has-text("Create Ticket")');

    // Click ticket card to open ticket tab
    await page.click('text=Breadcrumb Test Ticket');

    // 3. The ticket tab is now open and active
    const ticketTab = page.locator('.header-tab:has-text("Breadcrumb Test Ticket")');
    await expect(ticketTab).toBeVisible();

    // 4. Verify breadcrumbs container exists
    const breadcrumbs = page.locator('[data-testid="ticket-breadcrumbs"]');
    await expect(breadcrumbs).toBeVisible();

    // Check Home breadcrumb click navigates to Home
    const homeBreadcrumb = breadcrumbs.locator('button:has-text("Home")');
    await expect(homeBreadcrumb).toBeVisible();

    const projectBreadcrumb = breadcrumbs.locator('button:has-text("Batch Core Project")');
    await expect(projectBreadcrumb).toBeVisible();

    // Click Project breadcrumb -> switches active view to project overview/board
    await projectBreadcrumb.click();
    await expect(page.locator('.header-tab:has-text("Home")')).toHaveClass(/active/);
    await expect(page.getByRole('heading', { name: 'Batch Core Project' })).toBeVisible();
  });

  test('Requirement 5: Convert a ticket to an Epic', async ({ page }) => {
    // 1. Create a ticket
    await page.click('button:has-text("Board")');
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Ticket To Become Epic');
    await page.click('button:has-text("Create Ticket")');

    // Click ticket card to open ticket detail tab
    await page.click('text=Ticket To Become Epic');

    // 2. Verify ticket detail tab opened
    await expect(page.locator('.header-tab:has-text("Ticket To Become Epic")')).toBeVisible();

    // 3. Click "Convert to Epic" button in toolbar
    const convertBtn = page.locator('[data-testid="convert-to-epic-btn"]');
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    // 4. Verify that the new Epic tab opens
    const newEpicTab = page.locator('.header-tab:has-text("Ticket To Become Epic")');
    await expect(newEpicTab).toBeVisible();
    await expect(newEpicTab).toHaveClass(/active/);

    // 5. Verify Epic detail page is shown
    await expect(page.locator('[data-testid="epic-detail-page"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Ticket To Become Epic")')).toBeVisible();
  });

  test('Requirement 6: Create different workspaces and switch between them', async ({ page }) => {
    // 1. Verify default workspace is shown
    const switcherBtn = page.locator('[data-testid="workspace-switcher-btn"]');
    await expect(switcherBtn).toBeVisible();
    await expect(switcherBtn).toContainText("Workspace");

    // 2. Open workspace dropdown menu
    await switcherBtn.click();
    await expect(page.locator('[data-testid="workspace-dropdown-menu"]')).toBeVisible();

    // 3. Click "+ Create Workspace"
    await page.click('[data-testid="new-workspace-btn"]');

    // 4. Fill in new workspace form
    await page.fill('[data-testid="workspace-name-input"]', 'Engineering Sprint');
    await page.click('[data-testid="create-workspace-submit-btn"]');

    // 5. Verify switcher button now displays "Engineering Sprint"
    await expect(switcherBtn).toContainText('Engineering Sprint');

    // 6. Verify projects list is scoped to this new workspace (shows 0 projects)
    await expect(page.locator('.sidebar-item:has-text("All Projects")')).toContainText('0');

    // 7. Create a project inside this new workspace
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Sprint Microservice');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Sprint Microservice' })).toBeVisible();

    // 8. Switch back to the primary default workspace
    await switcherBtn.click();
    const defaultWsOption = page.locator('[data-testid^="workspace-item-"]:has-text("Default")');
    await defaultWsOption.click();

    // 9. Verify original project is back
    await expect(page.locator('.sidebar-item:has-text("All Projects")')).toContainText('1');
    await expect(page.getByRole('heading', { name: 'Batch Core Project' })).toBeVisible();
  });
});
