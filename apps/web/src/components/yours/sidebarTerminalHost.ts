import { useSyncExternalStore } from "react";

import { useClientSettings } from "../../hooks/useSettings";

// The sidebar's terminal pane registers its body here; ChatView portals its terminal drawers
// into it, so the sidebar shows the same sessions with the same launch context and shortcuts.
let host: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function setSidebarTerminalHost(next: HTMLElement | null): void {
  if (host === next) return;
  host = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getHost = () => host;
const getServerHost = () => null;

/** The element terminals render into while placed in the sidebar, or null for the drawer. */
export function useSidebarTerminalHost(): HTMLElement | null {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const current = useSyncExternalStore(subscribe, getHost, getServerHost);
  return placement === "sidebar" ? current : null;
}
