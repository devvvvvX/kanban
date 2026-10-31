import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs/screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function capture() {
  console.log('Launching headless Chrome...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // 2x Retina resolution
  });

  const page = await context.newPage();

  // 1. Reset storage & load app
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof indexedDB !== 'undefined') {
      try { indexedDB.deleteDatabase('kanban_local_storage'); } catch {}
    }
  });

  await page.reload();
  await page.waitForTimeout(600);

  // 2. Register account
  console.log('Registering account Alex Rivera...');
  const createTab = page.locator('button:has-text("Create Account")');
  await createTab.click();
  await page.waitForTimeout(300);

  await page.fill('input[placeholder="Your Name"]', 'Alex Rivera');
  await page.fill('input[placeholder="name@company.com"]', 'alex@kanban.local');
  const passInputs = page.locator('input[type="password"]');
  await passInputs.nth(0).fill('Password123!Secure');
  await passInputs.nth(1).fill('Password123!Secure');
  await page.click('button[type="submit"]:has-text("Create Account & Get Key")');

  // Recovery Key
  const recoveryDisplay = page.locator('.recovery-key-display');
  await recoveryDisplay.waitFor({ state: 'visible', timeout: 8000 });
  const key = ((await recoveryDisplay.textContent()) || '').trim();
  await page.fill('input[placeholder*="REC-"]', key);
  await page.click('button:has-text("Confirm & Activate")');

  console.log('Workspace activated.');
  await page.waitForSelector("text=Alex Rivera's Workspace", { timeout: 8000 });

  // 3. Create Project: Core Infrastructure
  console.log('Creating project: Core Infrastructure...');
  const newProjBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project")').first();
  await newProjBtn.click();
  await page.waitForTimeout(400);

  await page.fill('input[placeholder*="Distributed KV Store"]', 'Core Infrastructure');
  const descArea = page.locator('textarea[placeholder*="Brief description"]');
  if (await descArea.isVisible()) {
    await descArea.fill('High-throughput SQLite storage engine, Model Context Protocol stdio server, and macOS native window shell.');
  }
  await page.click('button[type="submit"]:has-text("Create Project")');
  await page.waitForTimeout(800);

  // Switch to Board View
  console.log('Switching to Kanban Board...');
  await page.click('button:has-text("Board")');
  await page.waitForTimeout(500);

  // Helper to create tickets cleanly
  async function createTicket({ title, state, priority, labels, desc }) {
    const addBtn = page.locator(`button[title*="Add ticket to ${state}" i], button[title*="${state}" i]`).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
    } else {
      await page.keyboard.press('Meta+n');
    }
    await page.waitForTimeout(300);

    const titleInput = page.locator('input[placeholder*="What needs to be done?"]');
    await titleInput.fill(title);

    const addDetailsBtn = page.locator('button:has-text("Add details")');
    if (await addDetailsBtn.isVisible()) {
      await addDetailsBtn.click();
      await page.waitForTimeout(200);
    }

    if (desc) {
      const descField = page.locator('.modal-card textarea');
      if (await descField.isVisible()) {
        await descField.fill(desc);
      }
    }

    if (labels && labels.length > 0) {
      const labelInput = page.locator('input[placeholder*="Add label"]');
      if (await labelInput.isVisible()) {
        for (const l of labels) {
          await labelInput.fill(l);
          await page.keyboard.press('Enter');
        }
      }
    }

    if (priority && priority !== 'none') {
      const prioTrigger = page.locator('.modal-card .custom-select-trigger').nth(1);
      if (await prioTrigger.isVisible()) {
        await prioTrigger.click();
        await page.locator(`.custom-select-item:has-text("${priority}")`).click();
      }
    }

    await page.click('button:has-text("Create Ticket")');
    await page.waitForTimeout(500);
  }

  console.log('Seeding tickets across columns...');
  // Backlog
  await createTicket({
    title: 'Research SQLite WAL auto-checkpoint threshold tuning',
    state: 'Backlog',
    priority: 'Medium',
    labels: ['sqlite', 'perf'],
  });
  await createTicket({
    title: 'Benchmark reciprocal rank fusion against BM25 index',
    state: 'Backlog',
    priority: 'Low',
    labels: ['search', 'algorithm'],
  });
  await createTicket({
    title: 'Draft Model Context Protocol v2 tool schema extension',
    state: 'Backlog',
    priority: 'Low',
    labels: ['mcp', 'spec'],
  });

  // Todo
  await createTicket({
    title: 'Implement sub-100ms visual query expression compiler',
    state: 'Todo',
    priority: 'High',
    labels: ['query', 'compiler', 'sqlite'],
  });
  await createTicket({
    title: 'Add Argon2id client-side exponential rate limiter',
    state: 'Todo',
    priority: 'Urgent',
    labels: ['security', 'crypto'],
  });
  await createTicket({
    title: 'Refactor native macOS traffic light offset geometry',
    state: 'Todo',
    priority: 'Medium',
    labels: ['ui/ux', 'tauri'],
  });

  // In Progress
  const richMarkdownDesc = `### Summary & Architecture
Wire up the multi-process SQLite sync event polling worker so external MCP agents (Claude Desktop, Cursor) immediately reflect ticket mutations in the running desktop Kanban application.

#### Implementation Checklist
- [x] Create atomic \`sync_events\` table schema with incremental event sequence
- [x] Wire in-process React broadcast event channel (\`useSyncEvents\`)
- [ ] Connect polling coordinator to active workspace tabs

\`\`\`typescript
interface SyncEventRecord {
  id: number;
  user_id: string;
  entity_type: "ticket" | "project" | "state";
  action: "create" | "update" | "delete";
  timestamp: string;
}
\`\`\`

> **Invariant**: MCP stdio server must strictly isolate logging output to \`stderr\` to guarantee zero frame corruption on JSON-RPC 2.0 communication.`;

  await createTicket({
    title: 'Wire real-time SQLite sync event polling to React tab state',
    state: 'In Progress',
    priority: 'High',
    labels: ['mcp', 'real-time'],
    desc: richMarkdownDesc,
  });

  // Done
  await createTicket({
    title: 'Bootstrap Tauri 2 desktop shell and overlay titlebar',
    state: 'Done',
    priority: 'High',
    labels: ['tauri', 'macos'],
  });
  await createTicket({
    title: 'Design Linear Precision Slate theme tokens and 12px floor',
    state: 'Done',
    priority: 'Medium',
    labels: ['design-system'],
  });
  await createTicket({
    title: 'Implement 256-bit cryptographic recovery phrase generation',
    state: 'Done',
    priority: 'High',
    labels: ['security'],
  });

  console.log('Tickets seeded. Waiting for render settle...');
  await page.waitForTimeout(800);

  // SCREENSHOT 1: board-dark.png
  console.log('Capturing board-dark.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'board-dark.png'),
    fullPage: false,
  });

  // SCREENSHOT 2: ticket-drawer-markdown.png
  console.log('Opening ticket drawer with Markdown...');
  const inProgCard = page.locator('.kanban-card:has-text("Wire real-time SQLite sync event")');
  await inProgCard.click();
  await page.waitForTimeout(600);

  // Add subtasks in drawer to make it look even richer
  const subtaskInput = page.locator('.ticket-drawer-body input[placeholder*="Add subtask" i], .subtask-add-input');
  if (await subtaskInput.isVisible()) {
    await subtaskInput.fill('Verify SQLite sync_events table schema');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await subtaskInput.fill('Wire polling hook in TicketContext');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    // Check first subtask
    const firstCheckbox = page.locator('.subtask-item input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.click();
    }
  }

  await page.waitForTimeout(400);
  console.log('Capturing ticket-drawer-markdown.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'ticket-drawer-markdown.png'),
    fullPage: false,
  });

  // Close drawer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // SCREENSHOT 3: command-palette.png
  console.log('Opening Command Palette...');
  const searchBtn = page.locator('.titlebar-search-btn');
  if (await searchBtn.isVisible()) {
    await searchBtn.click();
  } else {
    await page.keyboard.press('Meta+k');
  }
  await page.waitForTimeout(400);
  await page.keyboard.type('compiler');
  await page.waitForTimeout(500);

  console.log('Capturing command-palette.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'command-palette.png'),
    fullPage: false,
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // SCREENSHOT 4: focus-timer.png
  console.log('Navigating to Focus Timer...');
  const focusLink = page.locator('[data-testid="sidebar-focus-link"]');
  await focusLink.click();
  await page.waitForTimeout(600);

  // Click 40 min preset
  const preset40 = page.locator('button:has-text("40 min"), button:has-text("40m")').first();
  if (await preset40.isVisible()) {
    await preset40.click();
    await page.waitForTimeout(300);
  }
  // Start focus timer
  const startBtn = page.locator('button:has-text("Start Focus"), button:has-text("Start")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(400);
  }

  console.log('Capturing focus-timer.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'focus-timer.png'),
    fullPage: false,
  });

  // SCREENSHOT 5: settings-gradients.png
  console.log('Opening Preferences...');
  const settingsBtn = page.locator('[data-testid="sidebar-settings-link"]');
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
  } else {
    await page.keyboard.press('Meta+,');
  }
  await page.waitForTimeout(500);

  // Click Appearance tab
  const appTab = page.locator('[data-testid="settings-tab-appearance"]');
  if (await appTab.isVisible()) {
    await appTab.click();
    await page.waitForTimeout(400);
  }

  console.log('Capturing settings-gradients.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'settings-gradients.png'),
    fullPage: false,
  });

  // SCREENSHOT 6: mcp-settings.png
  console.log('Navigating to MCP Agent settings...');
  const mcpTab = page.locator('[data-testid="settings-tab-mcp"]');
  if (await mcpTab.isVisible()) {
    await mcpTab.click();
    await page.waitForTimeout(500);
  }

  console.log('Capturing mcp-settings.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'mcp-settings.png'),
    fullPage: false,
  });

  // Close Settings
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // SCREENSHOT 7: project-overview.png
  console.log('Navigating to Project Overview...');
  // Click Core Infrastructure project in sidebar to open project tabs
  const projLink = page.locator('.sidebar-container').locator('text=Core Infrastructure').first();
  if (await projLink.isVisible()) {
    await projLink.click();
    await page.waitForTimeout(400);
  }
  const overviewTab = page.locator('button:has-text("Overview")').first();
  if (await overviewTab.isVisible()) {
    await overviewTab.click();
    await page.waitForTimeout(600);
  }

  console.log('Capturing project-overview.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'project-overview.png'),
    fullPage: false,
  });

  // SCREENSHOT 8: board-light.png
  console.log('Switching to Light Mode Board...');
  const boardTab = page.locator('button:has-text("Board")').first();
  await boardTab.click();
  await page.waitForTimeout(400);

  // Switch to light theme via document attribute
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.removeAttribute('data-gradient');
  });
  await page.waitForTimeout(500);

  console.log('Capturing board-light.png...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'board-light.png'),
    fullPage: false,
  });

  // Reset to dark theme
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(300);

  // SCREENSHOT 9: archived-tickets.png
  console.log('Opening Archived Tickets...');
  const archivedLink = page.locator('[data-testid="sidebar-archived-tickets-link"]');
  if (await archivedLink.isVisible()) {
    await archivedLink.click();
    await page.waitForTimeout(600);
    console.log('Capturing archived-tickets.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'archived-tickets.png'),
      fullPage: false,
    });
  }

  console.log('All 9 screenshots generated successfully in docs/screenshots/!');
  await browser.close();
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});

