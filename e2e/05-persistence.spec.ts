import { test, expect } from "@playwright/test";

test.describe("Data Persistence & Factory Reset (SETT-PERSIST)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("Settings modal shows local database persistence and supports resetting workspace data while preserving users", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 1. Switch to Register tab
    await page.click('button:has-text("Create Account")');

    const testEmail = `dev-persist-${Date.now()}@mac.local`;
    const testPassword = "Password123!Valid";

    await page.fill('input[placeholder="Your Name"]', "Persistence Test User");
    await page.fill('input[placeholder="name@company.com"]', testEmail);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(testPassword);
    await passwordInputs.nth(1).fill(testPassword);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    // Confirm recovery key
    await expect(page.locator("text=Save Your Recovery Key")).toBeVisible({ timeout: 5000 });
    const recoveryDisplay = page.locator(".recovery-key-display");
    await expect(recoveryDisplay).toBeVisible();
    const recoveryKey = (await recoveryDisplay.textContent())?.trim() || "";

    const confirmInput = page.locator('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]');
    await confirmInput.fill(recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');

    // Wait for workspace to load
    await expect(page.locator("text=Persistence Test User's Workspace")).toBeVisible({ timeout: 5000 });

    // 2. Open Settings modal
    const settingsButton = page.locator('.sidebar-item:has-text("Settings")');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // 3. Switch to Data & Backups tab
    await page.click('button:has-text("Data & Backups")');

    // 4. Verify Local Database Storage section
    await expect(page.locator("text=Local Database Storage & Persistence")).toBeVisible();
    await expect(page.locator("text=Export Database (.sqlite)")).toBeVisible();

    // 5. Test Reset Workspace Data (Keep Users & Accounts)
    await expect(page.locator("text=Reset Workspace Data (Keep Users & Accounts)")).toBeVisible();
    const resetInput = page.locator('input[placeholder="Type \'RESET DATA\'"]');
    await resetInput.fill("RESET DATA");
    await page.click('button:has-text("Reset Data")');

    // 6. Verify reset success banner
    await expect(page.locator("text=Cleaned workspace data")).toBeVisible({ timeout: 5000 });

    // Close Settings
    await page.click('button[aria-label="Close"]');

    // 7. Verify user is still authenticated and default project is active
    await expect(page.locator("text=Personal Projects").first()).toBeVisible({ timeout: 5000 });
  });
});
