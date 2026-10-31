import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushModal, popModal, handleEscapePress, _testModalStack } from "../../src/hooks/useEscapeKey";

describe("useEscapeKey modal stack management", () => {
  beforeEach(() => {
    _testModalStack.length = 0;
  });

  it("returns false from handleEscapePress when no modals are open", () => {
    const handled = handleEscapePress();
    expect(handled).toBe(false);
  });

  it("calls the close handler on Escape press when one modal is open", () => {
    const closeModal = vi.fn();
    pushModal(closeModal);

    const handled = handleEscapePress();
    expect(handled).toBe(true);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("respects LIFO stack order when multiple modals are stacked", () => {
    const closeBaseModal = vi.fn();
    const closeDialogModal = vi.fn();

    pushModal(closeBaseModal);
    pushModal(closeDialogModal);

    // Escape should close top-most dialog modal first
    const handled1 = handleEscapePress();
    expect(handled1).toBe(true);
    expect(closeDialogModal).toHaveBeenCalledTimes(1);
    expect(closeBaseModal).not.toHaveBeenCalled();

    // Dialog closes and pops from stack
    popModal(closeDialogModal);

    // Next escape closes the underlying base modal
    const handled2 = handleEscapePress();
    expect(handled2).toBe(true);
    expect(closeBaseModal).toHaveBeenCalledTimes(1);
  });

  it("removes handler correctly with popModal", () => {
    const closeModal = vi.fn();
    pushModal(closeModal);
    expect(_testModalStack.length).toBe(1);

    popModal(closeModal);
    expect(_testModalStack.length).toBe(0);

    const handled = handleEscapePress();
    expect(handled).toBe(false);
    expect(closeModal).not.toHaveBeenCalled();
  });
});
