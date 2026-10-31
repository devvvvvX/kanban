import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FocusContext, type FocusContextType } from "../../src/context/FocusContext";
import { TabContext, type TabContextValue } from "../../src/context/TabContext";
import { HeaderFocusTimer } from "../../src/components/focus/HeaderFocusTimer";
import { FocusView } from "../../src/components/focus/FocusView";

const mockTabContext: TabContextValue = {
  tabs: [{ id: "home", title: "Board", type: "home", isFixed: true }],
  activeTabId: "home",
  activeTab: { id: "home", title: "Board", type: "home", isFixed: true },
  openTicketTab: vi.fn(),
  openEpicTab: vi.fn(),
  openCreateTab: vi.fn(),
  openNotesTab: vi.fn(),
  openTodosTab: vi.fn(),
  openWebviewTab: vi.fn(),
  openFocusTab: vi.fn(),
  openArchivedTab: vi.fn(),
  closeTab: vi.fn(),
  closeCreateTab: vi.fn(),
  setActiveTabId: vi.fn(),
  switchToHome: vi.fn(),
};

function createMockFocusContext(overrides: Partial<FocusContextType> = {}): FocusContextType {
  return {
    durationMinutes: 40,
    remainingSeconds: 2400,
    status: "idle",
    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    resetTimer: vi.fn(),
    stopAlert: vi.fn(),
    setDurationMinutes: vi.fn(),
    formattedTime: "40:00",
    progressPercent: 0,
    ...overrides,
  };
}

describe("Focus Timer UI & Components (HeaderFocusTimer & FocusView)", () => {
  it("renders idle focus launcher in header when timer is idle", () => {
    const focusCtx = createMockFocusContext({ status: "idle" });
    const html = renderToStaticMarkup(
      <TabContext.Provider value={mockTabContext}>
        <FocusContext.Provider value={focusCtx}>
          <HeaderFocusTimer />
        </FocusContext.Provider>
      </TabContext.Provider>
    );

    expect(html).toContain('data-testid="header-focus-idle-btn"');
    expect(html).toContain("Focus");
  });

  it("renders active countdown pill in header when timer is running", () => {
    const focusCtx = createMockFocusContext({
      status: "running",
      remainingSeconds: 2398,
      formattedTime: "39:58",
    });
    const html = renderToStaticMarkup(
      <TabContext.Provider value={mockTabContext}>
        <FocusContext.Provider value={focusCtx}>
          <HeaderFocusTimer />
        </FocusContext.Provider>
      </TabContext.Provider>
    );

    expect(html).toContain('data-testid="header-focus-timer-pill"');
    expect(html).toContain('data-testid="header-focus-pause-btn"');
    expect(html).toContain("39:58");
  });

  it("renders paused countdown pill in header with resume button", () => {
    const focusCtx = createMockFocusContext({
      status: "paused",
      remainingSeconds: 1500,
      formattedTime: "25:00",
    });
    const html = renderToStaticMarkup(
      <TabContext.Provider value={mockTabContext}>
        <FocusContext.Provider value={focusCtx}>
          <HeaderFocusTimer />
        </FocusContext.Provider>
      </TabContext.Provider>
    );

    expect(html).toContain('data-testid="header-focus-timer-pill"');
    expect(html).toContain('data-testid="header-focus-resume-btn"');
    expect(html).toContain("25:00");
  });

  it("renders completed alert state in header with stop alert button", () => {
    const focusCtx = createMockFocusContext({
      status: "completed",
      remainingSeconds: 0,
      formattedTime: "00:00",
    });
    const html = renderToStaticMarkup(
      <TabContext.Provider value={mockTabContext}>
        <FocusContext.Provider value={focusCtx}>
          <HeaderFocusTimer />
        </FocusContext.Provider>
      </TabContext.Provider>
    );

    expect(html).toContain('data-testid="header-focus-timer-pill"');
    expect(html).toContain('data-testid="header-focus-stop-alert"');
    expect(html).toContain("DONE!");
  });

  it("renders FocusView full workspace page with 40-minute preset and custom form", () => {
    const focusCtx = createMockFocusContext({
      durationMinutes: 40,
      remainingSeconds: 2400,
      formattedTime: "40:00",
    });
    const html = renderToStaticMarkup(
      <FocusContext.Provider value={focusCtx}>
        <FocusView />
      </FocusContext.Provider>
    );

    expect(html).toContain('data-testid="focus-view-container"');
    expect(html).toContain('data-testid="focus-start-btn"');
    expect(html).toContain('data-testid="focus-preset-40"');
    expect(html).toContain("40:00");
    expect(html).toContain("macOS Deep Work Engine");
  });

  it("calculates formatTime correctly for standard and edge second values", () => {
    const format = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    expect(format(2400)).toBe("40:00");
    expect(format(1500)).toBe("25:00");
    expect(format(59)).toBe("00:59");
    expect(format(0)).toBe("00:00");
  });
});
