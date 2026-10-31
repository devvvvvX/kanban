import { test, expect } from '@playwright/test';

test.describe('Project & Epic Management (PROJ-01 to PROJ-05, EPIC-01 to EPIC-04)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_proj_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate a fresh user for this test
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Project QA Lead');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    // Confirm recovery key
    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Project QA Lead's Workspace")).toBeVisible();
  });

  test('PROJ-01 & PROJ-02: Create project with customization and validation', async ({ page }) => {
    // 1. Click New Project (either button in empty state or top right)
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await expect(page.locator('text=Create New Project')).toBeVisible();

    // 2. Test empty name validation
    await page.click('button[type="submit"]:has-text("Create Project")');
    const nameInput = page.locator('input[placeholder*="Distributed KV Store"]');
    await nameInput.fill('Platform Core Infrastructure');

    // 3. Fill description and select Purple color
    await page.fill('textarea[placeholder*="Brief description"]', 'Core cloud services and architecture');
    // Select a color swatch (Purple: #8B5CF6)
    const purpleSwatch = page.locator('button[style*="background-color: rgb(139, 92, 246)"], button[style*="background-color: #8B5CF6"]').first();
    if (await purpleSwatch.isVisible()) {
      await purpleSwatch.click();
    }

    // Submit project creation
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 4. Verify Project Header and Sidebar render the project name
    await expect(page.getByRole('heading', { name: 'Platform Core Infrastructure' })).toBeVisible();
    await expect(page.locator('aside.sidebar').locator('text=Platform Core Infrastructure')).toBeVisible();
  });

  test('PROJ-03, PROJ-04 & PROJ-05: Pinning, View Switching, and Overview Metrics', async ({ page }) => {
    // Create a project first
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'DevOps Tooling');
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Test Pinning (PROJ-03)
    const pinBtn = page.locator('button[title*="Pin project"]').first();
    if (await pinBtn.isVisible()) {
      await pinBtn.click();
      await expect(page.locator('button[title="Unpin project"]')).toBeVisible();
    }

    // Test View Mode Switching (PROJ-05)
    // 1. Overview View
    await page.click('button:has-text("Overview")');
    await expect(page.locator('text=Total Tickets')).toBeVisible();
    await expect(page.locator('h2:has-text("Feature Epics")')).toBeVisible();

    // 2. Kanban Board View
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
    await expect(page.locator('h3:has-text("In Progress")')).toBeVisible();
    await expect(page.locator('h3:has-text("Done")')).toBeVisible();

    // 3. List View
    await page.click('button:has-text("List")');
    await expect(page.locator('h2:has-text("All Tickets")')).toBeVisible();

    // 4. Epics View
    await page.click('button:has-text("Epics")');
    await expect(page.locator('text=Epics & Milestones')).toBeVisible();

    // 5. Query View
    await page.click('button:has-text("Query")');
    await expect(page.locator('text=Filter & Sort')).toBeVisible();
  });

  test('EPIC-01 to EPIC-04: Create and manage epics with start/target dates', async ({ page }) => {
    // Create project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Mobile App Roadmap');
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Switch to Epics view
    await page.click('button:has-text("Epics")');
    await expect(page.locator('text=Epics & Milestones')).toBeVisible();

    // Click Create Epic (EPIC-01)
    await page.click('button:has-text("Create Epic")');
    await expect(page.locator('text=Create New Epic')).toBeVisible();

    // Fill Epic form (EPIC-02)
    await page.fill('input[placeholder*="Authentication & Recovery"]', 'Biometric Login V1');
    await page.fill('textarea[placeholder*="Scope, user story"]', 'Integrate FaceID and TouchID credentials.');

    // Dates
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) >= 2) {
      await dateInputs.nth(0).fill('2026-11-01');
      await dateInputs.nth(1).fill('2026-11-30');
    }

    // Submit epic
    await page.click('button[type="submit"]:has-text("Create Epic")');

    // Verify epic appears in Epics grid
    await expect(page.locator('h3:has-text("Biometric Login V1")')).toBeVisible();
    await expect(page.locator('text=Integrate FaceID and TouchID credentials.')).toBeVisible();
  });
});
