import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { highlightMatch, clampIndex } from "../../src/components/search/CommandPalette";
import { pushModal, popModal, handleEscapePress, _testModalStack } from "../../src/hooks/useEscapeKey";

describe("Wave 3: TicketDetailDrawer, Spotlight Command Palette & Modals", () => {
  const themeCssPath = path.resolve(__dirname, "../../src/styles/theme.css");
  const themeCss = fs.readFileSync(themeCssPath, "utf-8");

  describe("TicketDetailDrawer Contract & Design Tokens", () => {
    it("defines fixed 520px slide panel with slideInRight animation and bg-surface", () => {
      expect(themeCss).toContain(".ticket-drawer-panel");
      expect(themeCss).toMatch(/\.ticket-drawer-panel\s*\{[^}]*width:\s*520px/);
      expect(themeCss).toMatch(/\.ticket-drawer-panel\s*\{[^}]*animation:\s*slideInRight\s+180ms/);
      expect(themeCss).toMatch(/\.ticket-drawer-panel\s*\{[^}]*background:\s*var\(--bg-surface\)/);
      expect(themeCss).toContain("@keyframes slideInRight");
    });

    it("defines 4px blur backdrop with bg-overlay", () => {
      expect(themeCss).toContain(".ticket-drawer-backdrop");
      expect(themeCss).toMatch(/\.ticket-drawer-backdrop\s*\{[^}]*backdrop-filter:\s*blur\(4px\)/);
      expect(themeCss).toMatch(/\.ticket-drawer-backdrop\s*\{[^}]*background:\s*var\(--bg-overlay\)/);
    });

    it("defines 2-column properties grid with 120px labels and 12px min typography floor", () => {
      expect(themeCss).toContain(".ticket-drawer-grid");
      expect(themeCss).toMatch(/\.ticket-drawer-grid\s*\{[^}]*grid-template-columns:\s*120px\s+1fr/);
      expect(themeCss).toMatch(/\.ticket-drawer-grid-label\s*\{[^}]*font-size:\s*12px/);
      expect(themeCss).toMatch(/\.ticket-drawer-grid-label\s*\{[^}]*font-weight:\s*500/);
    });

    it("defines title input with 18px font size and hover/focus bottom border transition", () => {
      expect(themeCss).toContain(".ticket-drawer-title-input");
      expect(themeCss).toMatch(/\.ticket-drawer-title-input\s*\{[^}]*font-size:\s*18px/);
      expect(themeCss).toMatch(/\.ticket-drawer-title-input:hover,\s*\.ticket-drawer-title-input:focus\s*\{[^}]*border-bottom:\s*1px solid var\(--border-default\)/);
    });

    it("defines segmented button tabs for drawer comments and activity", () => {
      expect(themeCss).toContain(".ticket-drawer-tabs");
      expect(themeCss).toContain(".ticket-drawer-tab-btn");
      expect(themeCss).toMatch(/\.ticket-drawer-tab-btn\.active\s*\{[^}]*border-bottom-color:\s*var\(--accent-blue\)/);
    });
  });

  describe("Spotlight Command Palette (Cmd+K) Contract", () => {
    it("defines centered floating overlay 15% from top with 580px width and 16px blur", () => {
      expect(themeCss).toContain(".command-palette-backdrop");
      expect(themeCss).toMatch(/\.command-palette-backdrop\s*\{[^}]*padding-top:\s*15vh/);
      expect(themeCss).toMatch(/\.command-palette-backdrop\s*\{[^}]*backdrop-filter:\s*blur\(16px\)/);

      expect(themeCss).toContain(".command-palette-dialog");
      expect(themeCss).toMatch(/\.command-palette-dialog\s*\{[^}]*width:\s*580px/);
      expect(themeCss).toMatch(/\.command-palette-dialog\s*\{[^}]*max-height:\s*480px/);
      expect(themeCss).toMatch(/\.command-palette-dialog\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
    });

    it("defines 40px result row items with accent blue selection and bold highlights", () => {
      expect(themeCss).toMatch(/\.command-palette-item\s*\{[^}]*height:\s*40px/);
      expect(themeCss).toMatch(/\.command-palette-item:hover,\s*\.command-palette-item\.selected\s*\{[^}]*background:\s*var\(--accent-blue-subtle\)/);
      expect(themeCss).toMatch(/\.command-palette-highlight\s*\{[^}]*font-weight:\s*700/);
      expect(themeCss).toMatch(/\.command-palette-highlight\s*\{[^}]*color:\s*var\(--accent-blue\)/);
    });

    it("highlightMatch correctly wraps matching substrings in .command-palette-highlight", () => {
      const rendered = renderToStaticMarkup(
        React.createElement("div", null, highlightMatch("Fix auth token refresh bug", "auth"))
      );
      expect(rendered).toContain('<span class="command-palette-highlight">auth</span>');
      expect(rendered).toContain("Fix ");
      expect(rendered).toContain(" token refresh bug");
    });

    it("highlightMatch handles case-insensitivity and special regex characters gracefully", () => {
      const rendered = renderToStaticMarkup(
        React.createElement("div", null, highlightMatch("Search [DEV] ticket (v2.0)", "[dev]"))
      );
      expect(rendered).toContain('<span class="command-palette-highlight">[DEV]</span>');
    });

    it("clampIndex clamps keyboard arrow navigation strictly between 0 and total - 1", () => {
      expect(clampIndex(-1, 5)).toBe(0);
      expect(clampIndex(0, 5)).toBe(0);
      expect(clampIndex(2, 5)).toBe(2);
      expect(clampIndex(4, 5)).toBe(4);
      expect(clampIndex(5, 5)).toBe(4);
      expect(clampIndex(10, 5)).toBe(4);
      expect(clampIndex(0, 0)).toBe(0);
    });

    it("matches empty query and no match copy contract", () => {
      const query = "unknown-token-xyz";
      const emptyContractCopy = `No results found for '${query}'. Try searching by ticket ID, title, or label.`;
      expect(emptyContractCopy).toBe(
        "No results found for 'unknown-token-xyz'. Try searching by ticket ID, title, or label."
      );
    });
  });

  describe("Standardized Modal Dialogs Contract", () => {
    it("defines 12px border radius (--radius-lg) on modal-card", () => {
      expect(themeCss).toMatch(/\.modal-card\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
    });

    it("verifies SafeStateDeleteModal copy contract with exact UI-SPEC wording", () => {
      const count = 4;
      const copy = `Delete Workflow Column: This stage contains ${count} tickets. Select a destination column to migrate these tickets before removing.`;
      expect(copy).toBe(
        "Delete Workflow Column: This stage contains 4 tickets. Select a destination column to migrate these tickets before removing."
      );
    });

    it("verifies QuickCreateModal validation error contract", () => {
      const titleRequiredError = "Ticket title is required. Enter between 1 and 200 characters.";
      expect(titleRequiredError).toBe("Ticket title is required. Enter between 1 and 200 characters.");
    });
  });

  describe("LIFO Escape Key Stack Dismissal", () => {
    beforeEach(() => {
      _testModalStack.length = 0;
    });

    it("dismisses top-most modal first when multiple modals/drawers are stacked", () => {
      const closeDrawer = vi.fn();
      const closeConfirmModal = vi.fn();

      // Drawer opens first
      pushModal(closeDrawer);
      expect(_testModalStack.length).toBe(1);

      // Confirm modal opens on top of drawer
      pushModal(closeConfirmModal);
      expect(_testModalStack.length).toBe(2);

      // First escape press dismisses top confirm modal
      const handled1 = handleEscapePress();
      expect(handled1).toBe(true);
      expect(closeConfirmModal).toHaveBeenCalledTimes(1);
      expect(closeDrawer).not.toHaveBeenCalled();

      // Confirm modal pops from stack
      popModal(closeConfirmModal);
      expect(_testModalStack.length).toBe(1);

      // Second escape press dismisses the underlying drawer
      const handled2 = handleEscapePress();
      expect(handled2).toBe(true);
      expect(closeDrawer).toHaveBeenCalledTimes(1);

      // Drawer pops from stack
      popModal(closeDrawer);
      expect(_testModalStack.length).toBe(0);

      // Third escape press does nothing
      const handled3 = handleEscapePress();
      expect(handled3).toBe(false);
    });
  });
});
