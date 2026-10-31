import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { CustomSelect } from "../../src/components/ui/Select";
import { HeaderTabBar } from "../../src/components/layout/HeaderTabBar";
import { TabContext, type TabContextValue, type WorkspaceTab } from "../../src/context/TabContext";

describe("Design System Foundations & Tokens (08-UI-SPEC)", () => {
  const themeCssPath = path.resolve(process.cwd(), "src/styles/theme.css");
  const themeCss = fs.readFileSync(themeCssPath, "utf-8");

  describe("Typography Floor Rule (>= 12px)", () => {
    it("ensures no font-size token is configured below 12px", () => {
      // Find all --text-xs, --text-sm definitions in theme.css
      const textXsMatches = [...themeCss.matchAll(/--text-xs:\s*([0-9]+)px/g)];
      const textSmMatches = [...themeCss.matchAll(/--text-sm:\s*([0-9]+)px/g)];

      expect(textXsMatches.length).toBeGreaterThanOrEqual(1);
      expect(textSmMatches.length).toBeGreaterThanOrEqual(1);

      for (const match of textXsMatches) {
        const size = parseInt(match[1], 10);
        expect(size).toBeGreaterThanOrEqual(12);
      }

      for (const match of textSmMatches) {
        const size = parseInt(match[1], 10);
        expect(size).toBeGreaterThanOrEqual(12);
      }
    });

    it("verifies compact density does not violate the 12px floor rule", () => {
      const compactSectionMatch = themeCss.match(/:root\[data-density="compact"\]\s*\{([^}]+)\}/);
      expect(compactSectionMatch).not.toBeNull();
      const compactBody = compactSectionMatch![1];

      const xsMatch = compactBody.match(/--text-xs:\s*([0-9]+)px/);
      const smMatch = compactBody.match(/--text-sm:\s*([0-9]+)px/);

      expect(xsMatch).not.toBeNull();
      expect(smMatch).not.toBeNull();

      expect(parseInt(xsMatch![1], 10)).toBeGreaterThanOrEqual(12);
      expect(parseInt(smMatch![1], 10)).toBeGreaterThanOrEqual(12);
    });

    it("ensures no micro-font sizes (10px or 11px) exist in theme.css declarations", () => {
      const forbiddenSizes = [/font-size:\s*10px/i, /font-size:\s*11px/i];
      for (const pattern of forbiddenSizes) {
        expect(pattern.test(themeCss)).toBe(false);
      }
    });
  });

  describe("Spacing Scale (multiples of 4)", () => {
    it("verifies all base --space-* tokens are multiples of 4", () => {
      const spacingMatches = [...themeCss.matchAll(/--space-([0-9]+):\s*([0-9]+)px/g)];
      expect(spacingMatches.length).toBeGreaterThanOrEqual(8);

      for (const match of spacingMatches) {
        const value = parseInt(match[2], 10);
        expect(value % 4).toBe(0);
      }
    });

    it("verifies specific required spacing tokens exist", () => {
      expect(themeCss).toContain("--space-1: 4px;");
      expect(themeCss).toContain("--space-2: 8px;");
      expect(themeCss).toContain("--space-3: 12px;");
      expect(themeCss).toContain("--space-4: 16px;");
      expect(themeCss).toContain("--space-6: 24px;");
      expect(themeCss).toContain("--space-8: 32px;");
      expect(themeCss).toContain("--space-12: 48px;");
      expect(themeCss).toContain("--space-16: 64px;");
    });
  });

  describe("Semantic Border Radius Scale", () => {
    it("strictly verifies the semantic radii values per 08-UI-SPEC", () => {
      expect(themeCss).toContain("--radius-xs: 4px;");
      expect(themeCss).toContain("--radius-sm: 6px;");
      expect(themeCss).toContain("--radius-md: 8px;");
      expect(themeCss).toContain("--radius-lg: 12px;");
      expect(themeCss).toContain("--radius-full: 9999px;");
    });
  });

  describe("Color Palettes (60/30/10 Rule)", () => {
    it("verifies Dark Theme 60/30/10 tokens exist with required values", () => {
      expect(themeCss).toContain("--bg-app: #0D0F12;");
      expect(themeCss).toContain("--bg-surface: #15181E;");
      expect(themeCss).toContain("--bg-card: #1C2028;");
      expect(themeCss).toContain("--bg-subtle: #232834;");
      expect(themeCss).toContain("--bg-muted: #2A303E;");
      expect(themeCss).toContain("--accent-blue: #3B82F6;");
      expect(themeCss).toContain("--color-danger: #EF4444;");
      expect(themeCss).toContain("--color-success: #10B981;");
      expect(themeCss).toContain("--color-warning: #F59E0B;");
    });

    it("verifies Light Theme 60/30/10 tokens exist with required values", () => {
      expect(themeCss).toContain("--bg-app: #F8F9FA;");
      expect(themeCss).toContain("--bg-surface: #FFFFFF;");
      expect(themeCss).toContain("--bg-card: #FFFFFF;");
      expect(themeCss).toContain("--bg-subtle: #F1F3F5;");
      expect(themeCss).toContain("--bg-muted: #E9ECEF;");
      expect(themeCss).toContain("--accent-blue: #2563EB;");
      expect(themeCss).toContain("--color-danger: #DC2626;");
    });
  });

  describe("macOS Window Chrome & Accessibility Overrides", () => {
    it("defines 44px titlebar height and 78px traffic lights clearance", () => {
      expect(themeCss).toContain("--titlebar-height: 44px;");
      expect(themeCss).toContain("--traffic-lights-padding-left: 78px;");
    });

    it("enforces accessible focus-visible outline and reduced motion clamping", () => {
      expect(themeCss).toContain(":focus-visible");
      expect(themeCss).toContain("box-shadow: 0 0 0 2px var(--accent-ring);");
      expect(themeCss).toContain(':root[data-reduced-motion="true"]');
      expect(themeCss).toContain("animation-duration: 0.001ms !important;");
      expect(themeCss).toContain("transition-duration: 0.001ms !important;");
    });

    it("provides macOS desktop window drag regions", () => {
      expect(themeCss).toContain("-webkit-app-region: drag;");
      expect(themeCss).toContain("-webkit-app-region: no-drag;");
    });
  });
});

describe("Core UI Primitives", () => {
  describe("Button Primitive Component", () => {
    it("renders default secondary button with correct classes and accessibility", () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, null, "Click Me")
      );
      expect(html).toContain('class="btn btn-secondary btn-md"');
      expect(html).toContain('type="button"');
      expect(html).toContain("<span>Click Me</span>");
    });

    it("supports all semantic variants (primary, secondary, danger, ghost)", () => {
      const variants = ["primary", "secondary", "danger", "ghost"] as const;
      for (const variant of variants) {
        const html = renderToStaticMarkup(
          React.createElement(Button, { variant }, variant)
        );
        expect(html).toContain(`btn-${variant}`);
      }
    });

    it("supports sizes sm and md", () => {
      const smHtml = renderToStaticMarkup(
        React.createElement(Button, { size: "sm" }, "Small")
      );
      expect(smHtml).toContain("btn-sm");

      const mdHtml = renderToStaticMarkup(
        React.createElement(Button, { size: "md" }, "Medium")
      );
      expect(mdHtml).toContain("btn-md");
    });

    it("renders icon-only button with btn-icon class when no children are provided", () => {
      const icon = React.createElement("span", { id: "test-icon" }, "★");
      const html = renderToStaticMarkup(
        React.createElement(Button, { icon, size: "sm" })
      );
      expect(html).toContain("btn-icon");
      expect(html).toContain("btn-sm");
      expect(html).toContain('id="test-icon"');
    });

    it("handles loading state by disabling button, setting aria-busy, and rendering spin animation", () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { loading: true }, "Submit")
      );
      expect(html).toContain("disabled");
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("spin-animation");
      expect(html).toContain("loading");
    });

    it("applies btn-full class when fullWidth is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { fullWidth: true }, "Full Width")
      );
      expect(html).toContain("btn-full");
    });
  });

  describe("Badge Primitive Component", () => {
    it("renders default badge with required typography and structure", () => {
      const html = renderToStaticMarkup(
        React.createElement(Badge, null, "Default Badge")
      );
      expect(html).toContain('class="badge badge-default badge-md"');
      expect(html).toContain("<span>Default Badge</span>");
    });

    it("supports semantic variants (accent, success, warning, danger, subtle)", () => {
      const variants = [
        "accent",
        "success",
        "warning",
        "danger",
        "subtle",
      ] as const;
      for (const variant of variants) {
        const html = renderToStaticMarkup(
          React.createElement(Badge, { variant }, variant)
        );
        expect(html).toContain(`badge-${variant}`);
      }
    });

    it("renders indicator dot with optional custom color", () => {
      const html = renderToStaticMarkup(
        React.createElement(Badge, { dot: true, dotColor: "#10B981" }, "Active")
      );
      expect(html).toContain('class="badge-dot"');
      expect(html).toContain("background-color:#10B981");
    });

    it("applies badge-pill class when pill prop is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(Badge, { pill: true }, "Pill Tag")
      );
      expect(html).toContain("badge-pill");
    });
  });

  describe("CustomSelect Accessibility & Class-based Styling", () => {
    const mockOptions = [
      { value: "todo", label: "To Do", badge: 3 },
      { value: "in_progress", label: "In Progress", color: "#3B82F6" },
      { value: "done", label: "Done", disabled: true },
    ];

    it("renders combobox with accessible ARIA attributes and zero micro-fonts", () => {
      const html = renderToStaticMarkup(
        React.createElement(CustomSelect, {
          options: mockOptions,
          value: "todo",
          onChange: () => {},
          labelPrefix: "Status:",
        })
      );

      // ARIA Combobox contracts
      expect(html).toContain('role="combobox"');
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain('aria-expanded="false"');

      // Uses modern CSS classes
      expect(html).toContain("custom-select-container");
      expect(html).toContain("custom-select-trigger");
      expect(html).toContain("custom-select-prefix");
      expect(html).toContain("custom-select-badge");
      expect(html).toContain("custom-select-chevron");

      // Verify no hardcoded 10px or 11px font sizes exist in output
      expect(html).not.toContain("10px");
      expect(html).not.toContain("11px");
    });

    it("supports md size trigger class", () => {
      const html = renderToStaticMarkup(
        React.createElement(CustomSelect, {
          options: mockOptions,
          value: "todo",
          size: "md",
          onChange: () => {},
        })
      );
      expect(html).toContain("custom-select-trigger md");
    });

    it("applies full-width container class when fullWidth is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(CustomSelect, {
          options: mockOptions,
          value: "todo",
          fullWidth: true,
          onChange: () => {},
        })
      );
      expect(html).toContain("custom-select-container full-width");
    });
  });

  describe("HeaderTabBar Window Shell Ergonomics", () => {
    const mockTabs: WorkspaceTab[] = [
      { id: "home", type: "home", title: "Home", isFixed: true },
      {
        id: "ticket-1",
        type: "ticket",
        title: "PROJ-101: Implement Core Primitives",
        identifier: "PROJ-101",
        ticketId: "1",
      },
    ];

    const mockTabContextValue: TabContextValue = {
      tabs: mockTabs,
      activeTabId: "ticket-1",
      activeTab: mockTabs[1],
      openTicketTab: () => {},
      openEpicTab: () => {},
      openCreateTab: () => {},
      openNotesTab: () => {},
      openTodosTab: () => {},
      openFocusTab: () => {},
      openArchivedTab: () => {},
      openWebviewTab: () => {},
      closeTab: () => {},
      closeCreateTab: () => {},
      setActiveTabId: () => {},
      switchToHome: () => {},
    };

    it("ensures Home tab is permanent, fixed, and uncloseable without close button", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TabContext.Provider,
          { value: mockTabContextValue },
          React.createElement(HeaderTabBar)
        )
      );

      // Home tab rendered
      expect(html).toContain("header-tab-home");
      expect(html).toContain("Home");

      // Home tab does NOT have a close button
      expect(html).not.toContain('aria-label="Close Home tab"');
    });

    it("renders close button for dynamic ticket tabs with header-tab-close class", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TabContext.Provider,
          { value: mockTabContextValue },
          React.createElement(HeaderTabBar)
        )
      );

      // Ticket tab has close button
      expect(html).toContain('aria-label="Close PROJ-101: Implement Core Primitives tab"');
      expect(html).toContain("header-tab-close");
    });

    it("applies active styling to the currently active tab", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TabContext.Provider,
          { value: mockTabContextValue },
          React.createElement(HeaderTabBar)
        )
      );

      // Active tab is ticket-1
      expect(html).toContain('header-tab no-drag active"');
      // Contains identifier badge
      expect(html).toContain("header-tab-identifier");
      expect(html).toContain("PROJ-101");
    });

    it("provides the Plus button to open new tabs with Cmd+N hint", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TabContext.Provider,
          { value: mockTabContextValue },
          React.createElement(HeaderTabBar)
        )
      );

      expect(html).toContain("header-tab-new-btn");
      expect(html).toContain('title="Create new ticket tab (Cmd+N)"');
    });
  });
});
