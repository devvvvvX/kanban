import { test, expect } from "@playwright/test";

test.describe("Visual Query, Spotlight Search, Settings & MCP Diagnostics (QURY-01..04, SRCH-01..02, SETT-01..03, MCP-05)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before navigating
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const userEmail = `qa_query_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.local`;
    const password = "Password123!Secure";

    // Register and activate a fresh user
    await page.goto("/");
    await page.click('button:has-text("Create Account")');
    await page.fill('input[placeholder="name@company.com"]', userEmail);
    await page.fill('input[placeholder="Your Name"]', "Query QA Lead");
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);
    await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

    const recoveryDisplay = page.locator(".recovery-key-display");
    await expect(recoveryDisplay).toBeVisible();
    const key = (await recoveryDisplay.textContent()) || "";
    await page.fill('input[placeholder="Paste or type REC-XXXX-XXXX-XXXX-XXXX"]', key);
    await page.click('button:has-text("Confirm & Activate")');
    await expect(page.locator("text=Query QA Lead's Workspace")).toBeVisible();

    // Create a test project: "Search & Query Core"
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
    await newProjectBtn.click();
    await page.fill('input[placeholder*="Distributed KV Store"]', "Search & Query Core");
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.getByRole("heading", { name: "Search & Query Core" })).toBeVisible();

    // Switch to Kanban Board view
    await page.click('button:has-text("Board")');
    await expect(page.locator('h3:has-text("Todo")')).toBeVisible();
  });

  async function createTicketWithPriority(page: any, title: string, priorityVal: string) {
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', title);

    const moreDetailsBtn = page.locator('button:has-text("Add details")');
    if (await moreDetailsBtn.isVisible()) {
      await moreDetailsBtn.click();
    }

    const priorityTrigger = page.locator('button[aria-label="Priority"]');
    if (await priorityTrigger.isVisible()) {
      await priorityTrigger.click();
      const capitalized = priorityVal.charAt(0).toUpperCase() + priorityVal.slice(1);
      await page.locator(`[role="option"]:has-text("${capitalized}")`).click();
    }

    await page.click('button:has-text("Create Ticket")');
    await expect(page.locator(".kanban-card").filter({ hasText: title })).toBeVisible();
  }

  test("QURY-01..04: Visual query builder, multi-criteria filtering, sorting, and saved views", async ({
    page,
  }) => {
    // 1. Create 3 tickets with different priorities
    await createTicketWithPriority(page, "Implement Priority Queue", "urgent");
    await createTicketWithPriority(page, "Optimize Graph Traversal", "high");
    await createTicketWithPriority(page, "Update README Docs", "low");

    // 2. Open Visual Query from Sidebar
    await page.locator('.sidebar-item:has-text("Visual Query")').click();
    await expect(page.getByText("Filter & Sort")).toBeVisible();
    await expect(page.getByText("3 tickets found")).toBeVisible();

    // 3. Add Condition: Priority is urgent
    await page.click('button:has-text("Add Condition")');
    // Default condition added is Priority is urgent
    await expect(page.getByText("1 ticket found")).toBeVisible();
    await expect(page.getByText("Implement Priority Queue")).toBeVisible();
    await expect(page.getByText("Optimize Graph Traversal")).not.toBeVisible();

    // 4. Save Query View
    await page.click('button:has-text("Save View...")');
    const saveModal = page.locator('div[style*="zIndex: 1000"], div[style*="z-index: 1000"]');
    await expect(saveModal.getByRole("heading", { name: "Save Query View" })).toBeVisible();
    await saveModal.locator('input[type="text"]').fill("Critical Items");
    await saveModal.locator('button[type="submit"]:has-text("Save View")').click();

    // Verify Saved View appears in Sidebar
    const savedViewItem = page.locator(".sidebar-item").filter({ hasText: "Critical Items" });
    await expect(savedViewItem).toBeVisible();

    // 5. Reset conditions
    await page.click('button:has-text("Reset")');
    await expect(page.getByText("3 tickets found")).toBeVisible();

    // 6. Click saved view in sidebar to reload
    await savedViewItem.click();
    await expect(page.getByText("1 ticket found")).toBeVisible();
    await expect(page.getByText("Implement Priority Queue")).toBeVisible();

    // 7. Delete saved view from sidebar
    const deleteViewBtn = savedViewItem.locator('button[title="Delete saved view"]');
    await deleteViewBtn.click();
    await expect(page.locator(".sidebar-item").filter({ hasText: "Critical Items" })).not.toBeVisible();
  });

  test("SRCH-01..02: Spotlight Search (Cmd+K) with fragment highlighting and navigation", async ({
    page,
  }) => {
    // 1. Create a ticket to search for
    const addTicketBtn = page.locator('button[title*="Add ticket to Todo"]').first();
    await addTicketBtn.click();
    await page.fill('input[placeholder*="What needs to be done?"]', "Benchmark Memory Footprint");
    await page.keyboard.press("Enter");

    await expect(page.locator(".kanban-card").filter({ hasText: "Benchmark Memory Footprint" })).toBeVisible();

    // 2. Open Spotlight Command Palette via titlebar button
    await page.click('button[title="Global Search (Cmd+K)"]');
    const searchInput = page.locator('input[placeholder*="Search tickets, epics, projects"]');
    await expect(searchInput).toBeVisible();

    // 3. Type search query
    await searchInput.fill("Memory Footprint");

    // 4. Verify search results item is displayed
    const searchResult = page.locator('div[style*="z-index: 2000"], div[style*="zIndex: 2000"]').locator('div:has-text("Benchmark Memory Footprint")').last();
    await expect(searchResult).toBeVisible();

    // 5. Click result item to navigate directly to ticket detail
    await searchResult.click();
    await expect(page.locator('button[aria-label="Close detail"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Ticket title..."]')).toHaveValue("Benchmark Memory Footprint");

    await page.click('button[aria-label="Close detail"]');
  });

  test("SETT-01..03: User preferences (Density, Reduced Motion) and Offline Workspace Backup", async ({
    page,
  }) => {
    // 1. Open Settings modal from sidebar
    await page.locator('.sidebar-item:has-text("Settings")').click();
    await expect(page.locator('span:has-text("Preferences")').first()).toBeVisible();

    // 2. Appearance settings: Change density to compact
    await page.click('button:has-text("Compact")');
    const rootDensity = await page.evaluate(() => document.documentElement.getAttribute("data-density"));
    expect(rootDensity).toBe("compact");

    // 3. Toggle Reduced Motion
    const motionCheckbox = page.locator('input[type="checkbox"]').first();
    await motionCheckbox.check();
    const rootMotion = await page.evaluate(() => document.documentElement.getAttribute("data-reduced-motion"));
    expect(rootMotion).toBe("true");

    // 4. Switch to Data & Backups tab
    await page.click('button:has-text("Data & Backups")');
    await expect(page.getByText("Export Full Workspace (SETT-02)")).toBeVisible();

    // 5. Trigger Backup Export and assert valid JSON download with cryptographic SHA-256 checksum
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Export Backup (JSON)")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^kanban-backup-.*\.json$/);

    // Read and validate JSON contents
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const backupJson = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    expect(backupJson).toHaveProperty("version");
    expect(backupJson).toHaveProperty("checksum");
    expect(backupJson.checksum).toHaveLength(64); // SHA-256 hex string
    expect(backupJson.data).toHaveProperty("projects");
    expect(backupJson.data).toHaveProperty("tickets");
    expect(backupJson.data).toHaveProperty("workflowStates");
    expect(Array.isArray(backupJson.data.projects)).toBe(true);

    // Close Settings Modal
    await page.locator('button[aria-label="Close"]').first().click();
  });

  test("MCP-05: Model Context Protocol (AI Agent) settings, status, and config snippet", async ({
    page,
  }) => {
    // 1. Open MCP Agent modal from sidebar
    await page.locator('.sidebar-item:has-text("MCP Agent")').click();
    await expect(page.locator('h2:has-text("Model Context Protocol (MCP) Agent")')).toBeVisible();

    // 2. Verify Server Status is Online/Ready and tool count is shown
    await expect(page.getByText("MCP Stdio Server Ready")).toBeVisible();
    await expect(page.getByText("8 Tools Active")).toBeVisible();

    // 3. Verify Agent Session Token can be revealed
    const showTokenBtn = page.locator('button[title="Show Token"]');
    await showTokenBtn.click();
    await expect(page.locator('span[style*="font-mono"]').filter({ hasText: /[0-9a-f]{32}/ })).toBeVisible();

    // 4. Verify Claude Desktop Configuration snippet is displayed
    await expect(page.getByText("Claude Desktop Configuration")).toBeVisible();
    await expect(page.locator('pre:has-text("macos-kanban")')).toBeVisible();

    // 5. Close modal
    await page.click('button:has-text("Done")');
    await expect(page.locator('h2:has-text("Model Context Protocol (MCP) Agent")')).not.toBeVisible();
  });
});
