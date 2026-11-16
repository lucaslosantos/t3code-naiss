import { useSyncExternalStore } from "react";

import { RIGHT_DOCK_SPLIT } from "./rightTerminalDock.logic";

// Per device, like the sidebar split: how tall the dock is, and whether it is folded to its header.
const STORAGE_KEY = "t3code:yours:right-terminal-dock";

export interface RightTerminalDockLayout {
  readonly ratio: number;
  readonly collapsed: boolean;
}

const DEFAULT_LAYOUT: RightTerminalDockLayout = {
  ratio: RIGHT_DOCK_SPLIT.defaultRatio,
  collapsed: false,
};

function readStored(): RightTerminalDockLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_LAYOUT;
    const { ratio, collapsed } = parsed as Record<string, unknown>;
    return {
      ratio: typeof ratio === "number" && Number.isFinite(ratio) ? ratio : DEFAULT_LAYOUT.ratio,
      collapsed: collapsed === true,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

let layout: RightTerminalDockLayout | null = null;
const listeners = new Set<() => void>();

export function getRightTerminalDockLayout(): RightTerminalDockLayout {
  layout ??= typeof window === "undefined" ? DEFAULT_LAYOUT : readStored();
  return layout;
}

export function updateRightTerminalDockLayout(patch: Partial<RightTerminalDockLayout>): void {
  const current = getRightTerminalDockLayout();
  const next = { ...current, ...patch };
  if (next.ratio === current.ratio && next.collapsed === current.collapsed) return;
  layout = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the layout still applies for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerLayout = () => DEFAULT_LAYOUT;

export function useRightTerminalDockLayout(): RightTerminalDockLayout {
  return useSyncExternalStore(subscribe, getRightTerminalDockLayout, getServerLayout);
}
