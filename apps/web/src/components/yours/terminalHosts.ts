import { useSyncExternalStore } from "react";

import { useClientSettings } from "../../hooks/useSettings";

// The sidebar's terminal pane and the right panel's terminal dock register their bodies here;
// ChatView portals its terminal drawers into the one the placement picks, so they show the same
// sessions with the same launch context and shortcuts.
const hosts: { sidebar: HTMLElement | null; right: HTMLElement | null } = {
  sidebar: null,
  right: null,
};
const listeners = new Set<() => void>();

function setHost(kind: keyof typeof hosts, next: HTMLElement | null): void {
  if (hosts[kind] === next) return;
  hosts[kind] = next;
  for (const listener of listeners) listener();
}

export const setSidebarTerminalHost = (next: HTMLElement | null) => setHost("sidebar", next);
export const setRightDockTerminalHost = (next: HTMLElement | null) => setHost("right", next);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSidebarHost = () => hosts.sidebar;
const getRightHost = () => hosts.right;
const getServerHost = () => null;

export type TerminalDrawerHost =
  | { readonly kind: "drawer" }
  | { readonly kind: "portal"; readonly element: HTMLElement }
  /** Docked in a right panel that is closed: the shells keep running, nothing renders. */
  | { readonly kind: "none" };

const DRAWER: TerminalDrawerHost = { kind: "drawer" };
const NONE: TerminalDrawerHost = { kind: "none" };

/** Where ChatView's terminal drawers render for the current placement. */
export function useTerminalDrawerHost(): TerminalDrawerHost {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const sidebar = useSyncExternalStore(subscribe, getSidebarHost, getServerHost);
  const right = useSyncExternalStore(subscribe, getRightHost, getServerHost);
  if (placement === "sidebar" && sidebar) return { kind: "portal", element: sidebar };
  if (placement === "right") return right ? { kind: "portal", element: right } : NONE;
  return DRAWER;
}
