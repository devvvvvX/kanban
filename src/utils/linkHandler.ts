import { openUrl } from "@tauri-apps/plugin-opener";

export type LinkOpenTarget = "tab" | "browser";

export const LINK_OPEN_TARGET_KEY = "kanban_link_open_target";

/**
 * Returns current link opening preference.
 * Defaults to "tab" (open in new tab as web view).
 */
export function getLinkOpenTarget(): LinkOpenTarget {
  try {
    const saved = localStorage.getItem(LINK_OPEN_TARGET_KEY);
    if (saved === "browser" || saved === "tab") {
      return saved;
    }
  } catch {}
  return "tab";
}

/**
 * Updates link opening preference.
 */
export function setLinkOpenTarget(target: LinkOpenTarget): void {
  try {
    localStorage.setItem(LINK_OPEN_TARGET_KEY, target);
  } catch {}
}

/**
 * Opens a link in the system default browser.
 */
export async function openInDefaultBrowser(url: string): Promise<void> {
  if (!url) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
    return;
  } catch (tauriErr) {
    // If running in browser or plugin-opener fallback
    try {
      await openUrl(url);
      return;
    } catch {}
  }

  // Final browser fallback
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Opens a link according to user settings:
 * - Always opens in a new in-app Webview tab when tab navigation is available.
 * - Falls back to system default browser if tab navigation is unavailable.
 */
export async function handleLinkOpen(
  url: string,
  title?: string,
  openWebviewTab?: (url: string, title?: string) => void
): Promise<void> {
  if (!url) return;
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Requirement: Clicking any link should always open in a new tab
  if (openWebviewTab) {
    openWebviewTab(normalizedUrl, title);
    return;
  }

  const target = getLinkOpenTarget();
  if (target === "browser") {
    await openInDefaultBrowser(normalizedUrl);
  } else {
    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  }
}
