import { test, expect } from '@playwright/test';

test.describe('Escape Key Modal Dismissal & Stacking Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `esc_qa_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Escape Test User');
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
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Escape Test Project');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Escape Test Project' })).toBeVisible();
  });

  test('Closes QuickCreateModal when Escape key is pressed', async ({ page }) => {
    // Open Quick Create Modal via keyboard shortcut Cmd+N / Ctrl+N
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+n' : 'Control+n');

    const modal = page.locator('.modal-card:has-text("Create Ticket")');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('Closes SettingsModal when Escape key is pressed', async ({ page }) => {
    // Open Settings modal from sidebar
    await page.locator('.sidebar-item:has-text("Settings")').click();

    const heading = page.locator('h3:has-text("Theme & Appearance")');
    await expect(heading).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify Settings modal is closed
    await expect(heading).not.toBeVisible();
  });

  test('Closes McpSettingsModal when Escape key is pressed', async ({ page }) => {
    // Open MCP settings from sidebar
    await page.locator('.sidebar-item:has-text("MCP Agent")').click();

    const mcpHeading = page.locator('h2:has-text("Model Context Protocol (MCP) Agent")');
    await expect(mcpHeading).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify MCP modal is closed
    await expect(mcpHeading).not.toBeVisible();
  });

  test('Closes CommandPalette when Escape key is pressed', async ({ page }) => {
    // Press Cmd+K or Ctrl+K to open Command Palette
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');

    const paletteInput = page.locator('input[placeholder*="Search tickets, epics, projects"]');
    await expect(paletteInput).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify Command Palette is closed
    await expect(paletteInput).not.toBeVisible();
  });

  test('Closes NewProjectModal when Escape key is pressed', async ({ page }) => {
    const newProjectBtn = page.locator('button[title*="New Project"]').first();
    await newProjectBtn.click();

    const modalHeading = page.locator('h2:has-text("Create New Project")');
    await expect(modalHeading).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(modalHeading).not.toBeVisible();
  });

  test('Closes delete confirmation modal without closing the base view', async ({ page }) => {
    // Open project action menu
    const menuBtn = page.locator('button[aria-label="Project actions"], button:has(.lucide-more-horizontal)').first();
    await menuBtn.click();

    // Click Delete Project in dropdown
    const deleteOption = page.locator('button:has-text("Delete Project")');
    await deleteOption.click();

    // Delete confirmation modal should appear
    const confirmModal = page.locator('.modal-card:has-text("Delete Project")');
    await expect(confirmModal).toBeVisible();

    // Press Escape to dismiss confirmation
    await page.keyboard.press('Escape');

    // Confirmation modal should be dismissed, project remains
    await expect(confirmModal).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Escape Test Project' })).toBeVisible();
  });
});
