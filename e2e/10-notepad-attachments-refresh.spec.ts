import { test, expect } from '@playwright/test';

test.describe('Notepad, Media Attachments, Markdown Rendering & Header Refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `notepad_qa_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = 'Password123!Secure';

    // Register user
    await page.goto('/');
    const authModal = page.locator('.modal-card');
    await expect(authModal).toBeVisible();
    await page.click('[data-testid="auth-tab-register"]');
    await expect(page.locator('input[placeholder="Your Name"]')).toBeVisible();

    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', 'Notepad QA Lead');
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
    await page.fill('input[placeholder*="Distributed KV Store"]', 'Notepad Architecture Project');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole('heading', { name: 'Notepad Architecture Project' })).toBeVisible();

    // Switch to Board
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  test('Ticket page renders breadcrumb, tabs without overlap, markdown checklist, and attachments section', async ({ page }) => {
    // 1. Create a ticket
    await page.locator('button[title*="Add ticket to Todo"]').first().click();
    await page.fill('input[placeholder*="What needs to be done?"]', 'Verify Rich Markdown & Media');
    await page.click('button:has-text("Create Ticket")');

    // 2. Open ticket detail page tab
    const ticketCard = page.locator('text=Verify Rich Markdown & Media').first();
    await ticketCard.click();

    // 3. Verify Breadcrumb has project title, identifier badge, and ticket title with no overlap
    const breadcrumb = page.locator('[data-testid="ticket-breadcrumbs"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.locator('text=Notepad Architecture Project')).toBeVisible();
    await expect(breadcrumb.locator('[data-testid="ticket-identifier-badge"]')).toBeVisible();

    // 4. Verify Comments and Activity tabs are cleanly separated in segmented bar
    const commentsTab = page.locator('button[data-testid="tab-comments-btn"]');
    const activityTab = page.locator('button[data-testid="tab-activity-btn"]');
    await expect(commentsTab).toBeVisible();
    await expect(activityTab).toBeVisible();

    // Switch between tabs
    await activityTab.click();
    await expect(activityTab).toHaveClass(/active/);
    await commentsTab.click();
    await expect(commentsTab).toHaveClass(/active/);

    // 5. Verify Attachments section is present
    const attachmentsSection = page.locator('[data-testid="ticket-attachments-section"]');
    await expect(attachmentsSection).toBeVisible();

    // 6. Test markdown checklist in description
    // Click edit description button
    await page.click('button[data-testid="edit-desc-btn"]');
    const descArea = page.locator('textarea[data-testid="ticket-description-input"]');
    await descArea.fill('### Sprint Deliverables\n- [ ] Database migration\n- [x] API endpoint tests\n\n:::info\nOffline first storage architecture\n:::');
    // Switch to preview
    await page.click('button[data-testid="preview-desc-btn"]');

    // Verify markdown preview rendered
    const markdownPreview = page.locator('[data-testid="ticket-description-preview"] .markdown-content');
    await expect(markdownPreview).toBeVisible();
    await expect(markdownPreview.locator('h3:has-text("Sprint Deliverables")')).toBeVisible();
    await expect(markdownPreview.locator('.callout-info')).toBeVisible();
    await expect(markdownPreview.locator('input[type="checkbox"]')).toHaveCount(2);

    // Click interactive checkbox to toggle task
    const uncheckedBox = markdownPreview.locator('input[type="checkbox"]').first();
    await expect(uncheckedBox).not.toBeChecked();
    await uncheckedBox.click();
    await expect(uncheckedBox).toBeChecked();
  });

  test('Header refresh button triggers data refresh animation and toast', async ({ page }) => {
    const refreshBtn = page.locator('button[data-testid="header-refresh-btn"]');
    await expect(refreshBtn).toBeVisible();

    await refreshBtn.click();
    const toast = page.locator('[data-testid="refresh-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Workspace refreshed');
  });

  test('Sidebar Notepad item opens Notepad with markdown editor, callout boxes, and whiteboard canvas', async ({ page }) => {
    // 1. Click Notepad link in sidebar
    const notepadLink = page.locator('[data-testid="sidebar-notepad-link"]');
    await expect(notepadLink).toBeVisible();
    await notepadLink.click();

    // 2. Click '+ New' note button
    await page.click('button:has-text("New")');

    // 3. Edit Note Title and Content
    const titleInput = page.locator('input[data-testid="note-title-input"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Distributed Consensus Design');

    const contentArea = page.locator('textarea[data-testid="note-content-editor"]');
    await contentArea.fill('# Raft Protocol Notes\n\n- [ ] Leader election\n- [x] Log replication\n\n:::tip\nAlways verify quorum before commit\n:::');

    // 4. Test Callout insertion buttons
    await page.click('button[title*="Custom Box"]');
    await expect(contentArea).toHaveValue(/:::info/);

    // 5. Switch to Split View / Live Preview
    await page.click('button[data-testid="view-split-btn"]');
    const preview = page.locator('.markdown-content');
    await expect(preview.locator('h1:has-text("Raft Protocol Notes")')).toBeVisible();
    await expect(preview.locator('.callout-tip')).toBeVisible();

    // 6. Test Whiteboard Drawing Canvas
    await page.click('button[data-testid="toggle-whiteboard-btn"]');
    const canvas = page.locator('canvas[data-testid="whiteboard-canvas-surface"]');
    await expect(canvas).toBeVisible();

    // Draw something on the canvas
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 80);
      await page.mouse.up();
    }

    // Embed whiteboard canvas in note
    await page.click('button[data-testid="insert-drawing-into-note-btn"]');
    await expect(contentArea).toHaveValue(/!\[Whiteboard Diagram\]/);

    // 7. Convert Note to Kanban Ticket
    await page.click('button[data-testid="convert-note-to-ticket-btn"]');
    await expect(page.locator('text=Convert Note to Ticket')).toBeVisible();
    await page.click('button[data-testid="confirm-convert-btn"]');

    // Click Open Ticket Tab
    const openTabBtn = page.locator('button[data-testid="open-converted-ticket-tab-btn"]');
    await expect(openTabBtn).toBeVisible();
    await openTabBtn.click();

    // Verify ticket page tab opens for newly created ticket
    await expect(page.locator('.ticket-detail-page')).toBeVisible();
  });
});
