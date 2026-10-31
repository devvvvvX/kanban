import { test, expect } from '@playwright/test';

test.describe('Authentication & Multi-Account Isolation (AUTH-01 to AUTH-07)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating so each test starts in a clean unauthenticated state
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('AUTH-01 & AUTH-02: User can register account, sees recovery key, and confirms it', async ({ page }) => {
    await page.goto('/');

    // Wait for the auth modal
    const authModal = page.locator('.modal-card');
    await expect(authModal).toBeVisible();

    // Switch to Register tab
    const createAccountTab = page.locator('button:has-text("Create Account")');
    await createAccountTab.click();

    const uniqueEmail = `qa_reg_${Date.now()}@example.local`;
    const password = 'Password123!Valid';

    // Test password mismatch validation
    await page.fill('input[placeholder="Your Name"]', 'QA Register User');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(password);
    await passInputs.nth(1).fill('Mismatch999!');
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    await expect(page.locator('text=Passwords do not match')).toBeVisible();

    // Fill matching password
    await passInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    // Recovery Key modal (AUTH-02)
    await expect(page.locator('text=Save Your Recovery Key')).toBeVisible();
    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const recoveryKey = (await recoveryDisplay.textContent())?.trim() || '';
    expect(recoveryKey).toMatch(/^REC-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    // Test invalid recovery key input
    const confirmInput = page.locator('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]');
    await confirmInput.fill('REC-WRONG-KEY0-TEST-FAKE');
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator('text=The entered recovery key does not match')).toBeVisible();

    // Enter correct key
    await confirmInput.fill(recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');

    // Verify workspace loaded
    await expect(page.locator("text=QA Register User's Workspace")).toBeVisible();
  });

  test('AUTH-03 & AUTH-07: Login with Argon2id and Secure Logout', async ({ page }) => {
    await page.goto('/');

    const uniqueEmail = `qa_login_${Date.now()}@example.local`;
    const password = 'Password123!Secure';

    // Register user first
    const createAccountTab = page.locator('button:has-text("Create Account")');
    await createAccountTab.click();
    await page.fill('input[placeholder="Your Name"]', 'QA Login User');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(password);
    await passInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const recoveryKey = (await recoveryDisplay.textContent())?.trim() || '';
    const confirmInput = page.locator('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]');
    await confirmInput.fill(recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=QA Login User's Workspace")).toBeVisible();

    // Test Logout (AUTH-07)
    const accountBtn = page.locator('header').locator('button.btn-secondary:has(span:has-text("QA Login User"))');
    await accountBtn.click();
    await expect(page.locator('text=Local Accounts on this Mac')).toBeVisible();
    await page.click('button:has-text("Sign Out")');

    // After sign out, AuthModal appears
    await expect(page.locator('.modal-card')).toBeVisible();

    // Test failed login attempt (AUTH-03)
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    await page.locator('input[type="password"]').fill('WrongPassword123!');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('text=Invalid email or password')).toBeVisible();

    // Test successful login (AUTH-03)
    await page.locator('input[type="password"]').fill(password);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator("text=QA Login User's Workspace")).toBeVisible();
  });

  test('AUTH-04: Offline password reset using recovery key', async ({ page }) => {
    await page.goto('/');

    const uniqueEmail = `qa_reset_${Date.now()}@example.local`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'BrandNewPassword456!';

    // Register user first
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="Your Name"]', 'QA Reset User');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(oldPassword);
    await passInputs.nth(1).fill(oldPassword);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const recoveryKey = (await recoveryDisplay.textContent())?.trim() || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=QA Reset User's Workspace")).toBeVisible();

    // Logout
    const accountBtn = page.locator('header').locator('button.btn-secondary:has(span:has-text("QA Reset User"))');
    await accountBtn.click();
    await page.click('button:has-text("Sign Out")');

    // Click Forgot Password?
    await expect(page.locator('.modal-card')).toBeVisible();
    await page.click('button:has-text("Forgot password?")');
    await expect(page.locator('text=Reset Password Offline')).toBeVisible();

    // Fill reset form
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    await page.fill('input[placeholder="REC-XXXX-XXXX-XXXX-XXXX"]', recoveryKey);
    const resetPassInputs = page.locator('input[type="password"]');
    await resetPassInputs.nth(0).fill(newPassword);
    await resetPassInputs.nth(1).fill(newPassword);
    await page.click('button[type="submit"]:has-text("Reset Password")');

    // Success message and switched to Sign In tab
    await expect(page.locator('text=Password successfully reset!')).toBeVisible();

    // Login with new password
    await page.locator('input[type="password"]').fill(newPassword);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator("text=QA Reset User's Workspace")).toBeVisible();
  });

  test('AUTH-PENDING: User with unconfirmed pending registration can view recovery key and complete activation', async ({ page }) => {
    await page.goto('/');

    const uniqueEmail = `qa_pending_${Date.now()}@example.local`;
    const password = 'Password123!Pending';

    // 1. Start registration
    await expect(page.locator('.modal-card')).toBeVisible();
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="Your Name"]', 'QA Pending User');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(password);
    await passInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    // Recovery modal appears
    await expect(page.locator('text=Save Your Recovery Key')).toBeVisible();

    // 2. Click Cancel to simulate interrupting or missing confirmation
    await page.click('button:has-text("Cancel")');

    // Now back on Sign In tab
    await expect(page.locator('.modal-card')).toBeVisible();

    // 3. Try to Sign In with credentials
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Error informs user that account is pending with an activation button
    await expect(page.locator('text=Account registration is pending recovery key confirmation')).toBeVisible();
    const resumeBtn = page.locator('button:has-text("View Recovery Key & Complete Activation")');
    await expect(resumeBtn).toBeVisible();

    // 4. Click button to view recovery key and activate
    await resumeBtn.click();
    await expect(page.locator('text=Save Your Recovery Key')).toBeVisible();

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const recoveryKey = (await recoveryDisplay.textContent())?.trim() || '';
    expect(recoveryKey).toMatch(/^REC-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    // 5. Confirm key and activate
    const confirmInput = page.locator('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]');
    await confirmInput.fill(recoveryKey);
    await page.click('button:has-text("Confirm & Activate")');

    // 6. Verified: Workspace successfully loaded!
    await expect(page.locator("text=QA Pending User's Workspace")).toBeVisible();
  });
});
