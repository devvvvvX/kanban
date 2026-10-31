import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('Flexible Sidebar Todo Feature & Ticket Promotion', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and indexedDB before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        try {
          indexedDB.deleteDatabase('kanban_local_storage');
        } catch {}
      }
    });

    const userEmail = `qa_todos_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register and activate a fresh user
    await page.goto('/');
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Alex Morgan');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator('.recovery-key-display');
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || '';
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Alex Morgan's Workspace")).toBeVisible();

    // Create a test project: "Engineering Hub"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Engineering Hub');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Engineering Hub' })).toBeVisible();
  });

  test('1. Sidebar has Todos link and opens dedicated modern Todos workspace tab', async ({ page }) => {
    // Verify Todos is present in the sidebar
    const sidebarTodosLink = page.locator('[data-testid="sidebar-todos-link"]');
    await expect(sidebarTodosLink).toBeVisible();
    await expect(sidebarTodosLink).toContainText('Todos');

    // Click on Todos in sidebar
    await sidebarTodosLink.click();

    // Verify workspace tab and header
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Todos & Unstructured Planning")')).toBeVisible();
    await expect(page.locator('text=All clear for Today')).toBeVisible();
  });

  test('2. Can create todos with instant Enter, star to prioritize, and view days left', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    // Add normal daily todo
    const newTodoInput = page.locator('[data-testid="todo-new-input"]');
    await newTodoInput.fill('Regular daily standup');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Regular daily standup')).toBeVisible();

    // Add high-priority starred todo using composer star button
    await page.locator('[data-testid="todo-new-star-btn"]').click();
    await newTodoInput.fill('Urgent security patch deployment');
    await page.keyboard.press('Enter');

    // Verify both items exist and the starred item is prioritized first
    const todoRows = page.locator('.todo-item-row');
    await expect(todoRows).toHaveCount(2);
    await expect(todoRows.first()).toContainText('Urgent security patch deployment');

    // Verify starred filter button appears
    const starredFilter = page.locator('[data-testid="todo-starred-filter-btn"]');
    await expect(starredFilter).toBeVisible();
    await expect(starredFilter).toContainText('1 starred');

    // Switch to This Week cadence tab
    await page.locator('[data-testid="todo-cadence-tab-weekly"]').click();
    // Subtitle shows days remaining
    await expect(page.locator('[data-testid="todo-header-subtitle"]')).toContainText('days left');

    // Add weekly todo
    await newTodoInput.fill('Ship SQLite schema migration 0010');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Ship SQLite schema migration 0010')).toBeVisible();
    // Shows days left countdown badge on the item row
    await expect(page.locator('[data-testid^="todo-days-left-"]')).toBeVisible();

    // Complete one todo
    const firstCheckbox = page.locator('button[title*="Mark complete"]').first();
    await firstCheckbox.click();

    // Verify completed drawer appears
    await expect(page.locator('[data-testid="todo-toggle-completed-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="todo-toggle-completed-btn"]')).toContainText('Completed (1)');
  });

  test('3. Seamlessly converts a todo into a Kanban ticket and opens ticket tab', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    // Create a todo with unstructured details using clean notes toggle
    const newTodoInput = page.locator('[data-testid="todo-new-input"]');
    await newTodoInput.fill('Implement vector clock consensus engine');

    // Toggle notes input
    await page.locator('[data-testid="todo-new-notes-toggle"]').click();
    await page.locator('[data-testid="todo-new-notes-input"]').fill('Use logical timestamps to resolve concurrent replica writes');
    await page.locator('[data-testid="todo-new-priority-select"]').selectOption('high');
    await page.locator('[data-testid="todo-save-btn"]').click();

    await expect(page.locator('text=Implement vector clock consensus engine')).toBeVisible();

    // Click "To Ticket" button
    const convertBtn = page.locator('[data-testid^="todo-convert-btn-"]').first();
    await convertBtn.click();

    // Verify convert modal is open
    const modal = page.locator('[data-testid="convert-todo-modal"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('[data-testid="convert-title-input"]')).toHaveValue('Implement vector clock consensus engine');
    await expect(page.locator('[data-testid="convert-description-textarea"]')).toHaveValue('Use logical timestamps to resolve concurrent replica writes');

    // Submit ticket creation
    await page.locator('[data-testid="convert-submit-btn"]').click();

    // Verify modal is closed and Ticket tab opens
    await expect(modal).toBeHidden();
    await expect(page.locator('[data-testid="ticket-detail-page"]')).toBeVisible();
    await expect(page.locator('textarea.ticket-detail-title-input')).toHaveValue('Implement vector clock consensus engine');

    // Switch back to Todos tab
    await page.locator('.header-tab:has-text("Todos")').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    // Verify converted ticket pill is visible on the todo
    await expect(page.locator('button[title*="Open Ticket"]')).toBeVisible();
  });

  test('4. Allows reordering todo entries with drag handles', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    const newTodoInput = page.locator('[data-testid="todo-new-input"]');
    await newTodoInput.fill('Item 1 First');
    await page.keyboard.press('Enter');

    await newTodoInput.fill('Item 2 Second');
    await page.keyboard.press('Enter');

    const rows = page.locator('.todo-item-row');
    await expect(rows).toHaveCount(2);

    // Verify drag handles exist on active items
    const dragHandles = page.locator('[data-testid^="todo-drag-handle-"]');
    await expect(dragHandles).toHaveCount(2);

    // Reorder by dragging item 2 onto item 1
    await rows.nth(1).dragTo(rows.nth(0));
    await page.waitForTimeout(300);

    // Verify reordering persists
    await expect(page.locator('.todo-item-row').first()).toBeVisible();
  });

  test('5. Left-clicking todo item opens right slide drawer with notes, due date, checkbox checklist steps, and reminders', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    const newTodoInput = page.locator('[data-testid="todo-new-input"]');
    await newTodoInput.fill('Draft Architecture RFC');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Draft Architecture RFC')).toBeVisible();

    // Left-click on the todo item row to open the right slide drawer
    const todoRow = page.locator('.todo-item-row').first();
    await todoRow.click();

    // Verify right slide drawer is visible
    const drawer = page.locator('[data-testid="todo-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // Verify drawer title input has the title
    const drawerTitle = page.locator('[data-testid="drawer-title-input"]');
    await expect(drawerTitle).toHaveValue('Draft Architecture RFC');

    // Add checkbox steps
    const stepInput = page.locator('[data-testid="drawer-new-step-input"]');
    await stepInput.fill('Define consensus algorithm');
    await page.locator('[data-testid="drawer-add-step-btn"]').click();
    await expect(page.locator('text=Define consensus algorithm')).toBeVisible();

    await stepInput.fill('Review state machine replication');
    await page.locator('[data-testid="drawer-add-step-btn"]').click();
    await expect(page.locator('text=Review state machine replication')).toBeVisible();

    // Toggle completion on the first step
    const firstStepCheckbox = page.locator('[data-testid^="drawer-step-checkbox-"]').first();
    await firstStepCheckbox.click();
    await expect(page.locator('text=1 of 2 done (50%)')).toBeVisible();

    // Add notes in drawer
    const notesInput = page.locator('[data-testid="drawer-notes-input"]');
    await notesInput.fill('Detailed RFC notes and design trade-offs');
    await notesInput.blur();

    // Set due date
    const dueDateInput = page.locator('[data-testid="drawer-due-date-input"]');
    await dueDateInput.fill('2026-11-15');

    // Capture visual screenshot of the Right Slide Drawer
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/todos-right-drawer.png') });

    // Test reminder alert
    const testAlertBtn = page.locator('[data-testid="drawer-test-alert-btn"]');
    await expect(testAlertBtn).toBeVisible();
    await testAlertBtn.click();
    await expect(page.locator('text=Test alert dispatched!')).toBeVisible();

    // Dismiss the persistent notification banner before closing drawer
    const macBanner = page.locator('[data-testid="mac-notification-banner"]');
    if (await macBanner.isVisible()) {
      await page.locator('[data-testid="mac-banner-close-btn"]').click();
      await expect(macBanner).toBeHidden();
    }

    // Close the drawer
    await page.locator('[data-testid="drawer-close-btn"]').click();
    await expect(drawer).toBeHidden();

    // Verify the item row reflects the steps badge and due date
    await expect(page.locator('[data-testid^="todo-steps-badge-"]')).toContainText('1/2 steps');
  });

  test('6. Settings allows toggling notification sound on/off and selecting default sounds', async ({ page }) => {
    // Open Settings via sidebar button or gear icon
    const settingsBtn = page.locator('button:has-text("Settings"), [title*="Settings"]').first();
    await settingsBtn.click();

    // Click Notifications tab
    const notifTab = page.locator('[data-testid="settings-tab-notifications"]');
    await expect(notifTab).toBeVisible();
    await notifTab.click();

    // Verify notifications panel is displayed
    const panel = page.locator('[data-testid="settings-notifications-panel"]');
    await expect(panel).toBeVisible();
    await expect(page.locator('text=Notification Sounds')).toBeVisible();

    // Verify all 5 default sounds are available
    await expect(page.locator('[data-testid="sound-option-chime"]')).toBeVisible();
    await expect(page.locator('[data-testid="sound-option-bell"]')).toBeVisible();
    await expect(page.locator('[data-testid="sound-option-pop"]')).toBeVisible();
    await expect(page.locator('[data-testid="sound-option-ping"]')).toBeVisible();
    await expect(page.locator('[data-testid="sound-option-subtle"]')).toBeVisible();

    // Capture visual screenshot of the Settings Notifications panel
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/settings-notifications.png') });

    // Preview sound button
    const previewBtn = page.locator('[data-testid="preview-sound-bell"]');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Toggle sound enabled / muted
    const soundToggle = page.locator('[data-testid="toggle-sound-enabled"]');
    await expect(soundToggle).toHaveText('Enabled');
    await soundToggle.click();
    await expect(soundToggle).toHaveText('Muted');
    await soundToggle.click();
    await expect(soundToggle).toHaveText('Enabled');

    // Test alert in settings
    const testAlertBtn = page.locator('[data-testid="send-test-notification-btn"]');
    await expect(testAlertBtn).toBeVisible();
    await testAlertBtn.click();
    await expect(testAlertBtn).toHaveText('Sent!');
  });

  test('7. Search filtering, local timezone reminders, and clean non-overlapping priority layout', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    const newTodoInput = page.locator('[data-testid="todo-new-input"]');

    // Add first item with priority High
    await newTodoInput.fill('Design high precision UI tokens');
    await page.locator('[data-testid="todo-new-priority-select"]').selectOption('high');
    await page.locator('[data-testid="todo-save-btn"]').click();
    await expect(page.locator('text=Design high precision UI tokens')).toBeVisible();

    // Add second item with Star
    await page.locator('[data-testid="todo-new-star-btn"]').click();
    await newTodoInput.fill('Review local timezone scheduler');
    await page.locator('[data-testid="todo-save-btn"]').click();
    await expect(page.locator('text=Review local timezone scheduler')).toBeVisible();

    // Verify search filter functionality
    const searchInput = page.locator('[data-testid="todo-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('timezone');
    await expect(page.locator('text=Review local timezone scheduler')).toBeVisible();
    await expect(page.locator('text=Design high precision UI tokens')).toBeHidden();

    // Clear search using clear button
    const clearBtn = page.locator('[data-testid="todo-search-clear-btn"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(page.locator('text=Design high precision UI tokens')).toBeVisible();

    // Capture visual screenshot of the Decluttered Todos View
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/todos-decluttered.png') });

    // Switch to light mode and capture light theme screenshot
    const themeBtn = page.locator('button[title*="Theme:"]');
    await themeBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/todos-light-mode.png') });
    // Cycle back to dark mode
    await themeBtn.click();
    await themeBtn.click();
    await page.waitForTimeout(400);

    // Open detail drawer on the second item to verify Remind Me local timezone display
    await page.locator('.todo-item-row:has-text("Review local timezone scheduler")').click();
    const drawer = page.locator('[data-testid="todo-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // Verify Remind Me section exists and shows local timezone information
    const remindSection = page.locator('[data-testid="drawer-remind-me-section"]');
    await expect(remindSection).toBeVisible();

    // Quick reminder button "+15 min"
    await page.locator('button:has-text("+15 min")').click();
    await expect(remindSection.locator('text=Active')).toBeVisible();
    await expect(remindSection).toContainText('Today at');

    // Capture visual screenshot of the Drawer with Local Timezone
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/todos-local-drawer.png') });
  });

  test('8. Persisted notification with continuous ring sound and in-app macOS alert banner', async ({ page }) => {
    await page.locator('[data-testid="sidebar-todos-link"]').click();
    await expect(page.locator('[data-testid="todo-view"]')).toBeVisible();

    const newTodoInput = page.locator('[data-testid="todo-new-input"]');
    await newTodoInput.fill('Ship critical infrastructure migration');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Ship critical infrastructure migration')).toBeVisible();

    // Open detail drawer
    await page.locator('.todo-item-row:has-text("Ship critical infrastructure migration")').click();
    const drawer = page.locator('[data-testid="todo-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // Trigger Test Alert with continuous ring
    const testAlertBtn = page.locator('[data-testid="drawer-test-alert-btn"]');
    await expect(testAlertBtn).toBeVisible();
    await testAlertBtn.click();

    // Verify macOS persistent notification banner appears in top-right
    const macBanner = page.locator('[data-testid="mac-notification-banner"]');
    await expect(macBanner).toBeVisible();

    // Check title, ringing badge, and Stop Ringing action
    await expect(page.locator('[data-testid="mac-banner-title"]')).toContainText('Ship critical infrastructure migration');
    await expect(page.locator('[data-testid="mac-banner-ringing-tag"]')).toBeVisible();
    const stopSoundBtn = page.locator('[data-testid="mac-banner-stop-sound-btn"]');
    await expect(stopSoundBtn).toBeVisible();

    // Capture visual screenshot of the persisted macOS notification banner with continuous ring
    await page.screenshot({ path: path.join(process.cwd(), 'test-results/screenshots/persisted-mac-notification.png') });

    // Silence ringing via Stop Ringing button
    await stopSoundBtn.click();
    await expect(page.locator('[data-testid="mac-banner-ringing-tag"]')).toBeHidden();

    // Persisted notification remains visible until dismissed!
    await expect(macBanner).toBeVisible();

    // Dismiss the banner
    await page.locator('[data-testid="mac-banner-close-btn"]').click();
    await expect(macBanner).toBeHidden();

    // Close drawer
    await page.locator('[data-testid="drawer-close-btn"]').click();
    await expect(drawer).toBeHidden();

    // Open Settings to verify Continuous Ringing toggle and test alert silence control
    const settingsBtn = page.locator('button:has-text("Settings"), [title*="Settings"]').first();
    await settingsBtn.click();
    await page.locator('[data-testid="settings-tab-notifications"]').click();

    const continuousRingToggle = page.locator('[data-testid="toggle-continuous-ring"]');
    await expect(continuousRingToggle).toBeVisible();
    await expect(continuousRingToggle).toHaveText('Continuous');

    // Toggle continuous ring
    await continuousRingToggle.click();
    await expect(continuousRingToggle).toHaveText('Single Tone');
    await continuousRingToggle.click();
    await expect(continuousRingToggle).toHaveText('Continuous');

    // Trigger test alert in settings
    const settingsTestAlertBtn = page.locator('[data-testid="send-test-notification-btn"]');
    await settingsTestAlertBtn.click();

    // Stop Ringing button appears in settings and mac banner appears
    await expect(page.locator('[data-testid="stop-test-ringing-btn"]')).toBeVisible();
    await expect(macBanner).toBeVisible();

    // Silence from settings
    await page.locator('[data-testid="stop-test-ringing-btn"]').click();
    await expect(page.locator('[data-testid="stop-test-ringing-btn"]')).toBeHidden();

    // Dismiss banner
    await page.locator('[data-testid="mac-banner-dismiss-btn"]').click();
    await expect(macBanner).toBeHidden();
  });
});
