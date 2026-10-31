import { test, expect } from '@playwright/test';

test.describe('MCP Master On/Off Toggle & Architecture Clarification Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `mcp_toggle_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'MCP Toggle Lead');
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
  });

  test('Displays Stdio zero-port architecture details and toggles MCP on and off with live UI sync', async ({ page }) => {
    // 1. Initial sidebar badge is Active
    const sidebarBadge = page.locator('[data-testid="sidebar-mcp-status"]');
    await expect(sidebarBadge).toHaveText('Active');

    // 2. Open MCP Settings from sidebar
    await page.locator('.sidebar-item:has-text("MCP Agent")').click();

    const mcpHeading = page.locator('h2:has-text("Model Context Protocol (MCP) Agent")');
    await expect(mcpHeading).toBeVisible();

    // 3. Verify Transport Architecture & Zero Network Port Clarification
    const transportCard = page.locator('[data-testid="mcp-transport-info"]');
    await expect(transportCard).toBeVisible();
    await expect(transportCard).toContainText('Local Stdio (Zero Network Ports)');
    await expect(transportCard).toContainText('No background network ports or TCP sockets are opened');

    // 4. Verify initial Status Banner
    const statusBanner = page.locator('[data-testid="mcp-status-banner"]');
    await expect(statusBanner).toContainText('MCP Stdio Server Ready');
    await expect(statusBanner).toContainText('8 Tools Active');

    // 5. Toggle MCP OFF
    const masterToggle = page.locator('[data-testid="mcp-master-toggle"]');
    await expect(masterToggle).toBeChecked();

    // Click toggle wrapper
    await masterToggle.locator('..').click();
    await expect(masterToggle).not.toBeChecked();

    // Verify status changes to Disabled
    await expect(statusBanner).toContainText('MCP Agent Access Disabled');
    await expect(statusBanner).toContainText('Inactive');

    const warningBanner = page.locator('[data-testid="mcp-disabled-config-warning"]');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('MCP Access Disabled');

    // 6. Close modal and verify sidebar badge updates to Disabled
    await page.keyboard.press('Escape');
    await expect(mcpHeading).not.toBeVisible();
    await expect(sidebarBadge).toHaveText('Disabled');

    // 7. Re-open and toggle MCP back ON
    await page.locator('.sidebar-item:has-text("MCP Agent")').click();
    await expect(mcpHeading).toBeVisible();

    const masterToggleAgain = page.locator('[data-testid="mcp-master-toggle"]');
    await expect(masterToggleAgain).not.toBeChecked();

    await masterToggleAgain.locator('..').click();
    await expect(masterToggleAgain).toBeChecked();

    await expect(statusBanner).toContainText('MCP Stdio Server Ready');
    await expect(statusBanner).toContainText('8 Tools Active');
    await expect(warningBanner).not.toBeVisible();

    // Close modal and verify sidebar badge updates back to Active
    await page.keyboard.press('Escape');
    await expect(mcpHeading).not.toBeVisible();
    await expect(sidebarBadge).toHaveText('Active');
  });
});
