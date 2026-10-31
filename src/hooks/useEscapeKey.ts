import { useEffect, useRef } from "react";

// Modal stack for layered escape key handling (topmost modal closes first)
const modalStack: Array<() => void> = [];

let isListenerAttached = false;

export function pushModal(closeFn: () => void): void {
  modalStack.push(closeFn);
}

export function popModal(closeFn: () => void): void {
  const idx = modalStack.lastIndexOf(closeFn);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }
}

export function handleEscapePress(): boolean {
  if (modalStack.length > 0) {
    const topCloseFn = modalStack[modalStack.length - 1];
    if (typeof topCloseFn === "function") {
      topCloseFn();
      return true;
    }
  }
  return false;
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && modalStack.length > 0) {
    e.preventDefault();
    e.stopPropagation();
    handleEscapePress();
  }
}

function ensureListener() {
  if (!isListenerAttached && typeof window !== "undefined") {
    window.addEventListener("keydown", handleGlobalKeyDown);
    isListenerAttached = true;
  }
}

/**
 * Hook that registers a modal's close handler to the Escape key stack while open.
 * If multiple modals are stacked, only the top-most modal closes on Escape.
 */
export function useEscapeKey(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !onCloseRef.current) return;

    ensureListener();

    const handler = () => {
      onCloseRef.current?.();
    };

    pushModal(handler);

    return () => {
      popModal(handler);
    };
  }, [isOpen]);
}

export const _testModalStack = modalStack;
