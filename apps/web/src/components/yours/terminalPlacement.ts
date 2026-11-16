import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { TerminalPlacement } from "@t3tools/contracts/settings";

import {
  getClientSettings,
  isClientSettingsHydrated,
  subscribeClientSettings,
  updateClientSettings,
} from "../../hooks/useSettings";
import { focusActiveDrawerTerminal } from "../../lib/terminalFocus";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  dockChangeWantsReveal,
  panelClosedUnderOpenDock,
  resolveRightDockToggle,
} from "./rightTerminalDock.logic";
import {
  getRightTerminalDockLayout,
  updateRightTerminalDockLayout,
} from "./rightTerminalDockStore";
import { panelTerminalGroupsForDrawer } from "./terminalPlacement.logic";

// Every placement shows the drawer's terminals: below the chat, portaled into the sidebar, or
// portaled into the right panel's dock. Sessions are keyed by thread and terminal id on the
// server, so a move only changes where the viewport mounts; the shell keeps running.

let moving = false;

function withMoving(run: () => void): void {
  if (moving) return;
  moving = true;
  try {
    run();
  } finally {
    moving = false;
  }
}

/**
 * Turns the right panel's terminal tabs into open drawer terminals. Returns whether there were
 * any. `keepPanelOpen` keeps the panel showing when they were its last tabs, for the dock.
 */
export function movePanelTerminalsToDrawer(
  threadRef: ScopedThreadRef,
  options?: { readonly keepPanelOpen?: boolean },
): boolean {
  const panel = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
  const { groups, activeTerminalId } = panelTerminalGroupsForDrawer(
    panel.surfaces,
    panel.activeSurfaceId,
  );
  if (groups.length === 0) return false;
  withMoving(() => {
    const terminals = useTerminalUiStateStore.getState();
    for (const group of groups) {
      const [first, ...rest] = group.terminalIds;
      terminals.ensureTerminal(threadRef, first!, { open: true });
      for (const terminalId of rest) {
        if (group.splitDirection === "vertical") {
          terminals.splitTerminalVertical(threadRef, terminalId);
        } else {
          terminals.splitTerminal(threadRef, terminalId);
        }
      }
    }
    if (activeTerminalId) terminals.setActiveTerminal(threadRef, activeTerminalId);
    const panels = useRightPanelStore.getState();
    for (const surface of panel.surfaces) {
      if (surface.kind === "terminal") panels.closeSurface(threadRef, surface.id);
    }
    if (options?.keepPanelOpen && panel.isOpen) showPanel(threadRef);
  });
  return true;
}

function showPanel(threadRef: ScopedThreadRef): void {
  const panels = useRightPanelStore.getState();
  // show() counts as a user action even when the panel is open, which holds back proactive tabs.
  if (!selectThreadRightPanelState(panels.byThreadKey, threadRef).isOpen) panels.show(threadRef);
}

/** Opens the right panel, if needed, and unfolds the dock. */
function revealDock(threadRef: ScopedThreadRef): void {
  showPanel(threadRef);
  updateRightTerminalDockLayout({ collapsed: false });
}

/**
 * The terminal toggle while the terminal is docked on the right. Returns false when the thread
 * has no open terminal yet, so the caller opens one the usual way and the guard reveals the dock.
 */
export function toggleRightDockTerminal(threadRef: ScopedThreadRef): boolean {
  const panel = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
  const drawer = selectThreadTerminalUiState(
    useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
    threadRef,
  );
  const action = resolveRightDockToggle({
    panelOpen: panel.isOpen,
    terminalOpen: drawer.terminalOpen,
    collapsed: getRightTerminalDockLayout().collapsed,
    hasOtherSurfaces: panel.surfaces.length > 0,
  });
  if (action.kind === "open") return false;
  if (action.kind === "reveal") {
    revealDock(threadRef);
    focusActiveDrawerTerminal(threadRef);
    return true;
  }
  withMoving(() => useTerminalUiStateStore.getState().setTerminalOpen(threadRef, false));
  if (action.closePanel) useRightPanelStore.getState().close(threadRef);
  return true;
}

/**
 * Saves the placement and carries the thread's terminal along, without restarting it. `from`
 * is where that terminal is shown, which can differ from the setting: a terminal tab added to
 * the right panel while the setting is "bottom".
 */
export function setTerminalPlacement(
  next: TerminalPlacement,
  threadRef: ScopedThreadRef | null,
  from: TerminalPlacement = getClientSettings().terminalPlacement,
): void {
  if (getClientSettings().terminalPlacement !== next) {
    void updateClientSettings({ terminalPlacement: next });
  }
  if (!threadRef || from === next) return;
  // Docked terminals already live in the drawer; only loose panel tabs need carrying.
  if (from === "right") movePanelTerminalsToDrawer(threadRef);
  // Before settings save, the guard still reads the old placement; keep it out.
  withMoving(() => useTerminalUiStateStore.getState().setTerminalOpen(threadRef, true));
  if (next === "right") revealDock(threadRef);
  focusActiveDrawerTerminal(threadRef);
}

function guardActive(): boolean {
  // Until saved settings load, the placement reads as the default and could misplace terminals.
  return !moving && isClientSettingsHydrated() && getClientSettings().terminalPlacement === "right";
}

/** Terminal tabs added to the right panel (or kept from before the dock) move into the dock. */
function adoptPanelTerminalsIntoDock(): void {
  if (!guardActive()) return;
  const byThreadKey = useRightPanelStore.getState().byThreadKey;
  for (const [threadKey, state] of Object.entries(byThreadKey)) {
    if (!state.surfaces.some((surface) => surface.kind === "terminal")) continue;
    const threadRef = parseScopedThreadKey(threadKey);
    if (threadRef && movePanelTerminalsToDrawer(threadRef, { keepPanelOpen: true })) {
      updateRightTerminalDockLayout({ collapsed: false });
    }
  }
}

const CLOSED_EMPTY_PANEL = { isOpen: false, surfaces: [] } as const;

let guardInstalled = false;

/**
 * Idempotent; ChatView installs it once so the dock holds for every opening path (toggle,
 * shortcuts, scripts, chat code blocks, setup terminal links, the panel's own "Terminal" tab).
 * Opening runs synchronously in store updates, so this follows the stores rather than a render.
 */
export function installTerminalPlacementGuard(): void {
  if (guardInstalled) return;
  guardInstalled = true;
  useTerminalUiStateStore.subscribe((state, previous) => {
    if (state.terminalUiStateByThreadKey === previous.terminalUiStateByThreadKey) return;
    if (!guardActive()) return;
    for (const [threadKey, next] of Object.entries(state.terminalUiStateByThreadKey)) {
      const before = previous.terminalUiStateByThreadKey[threadKey];
      if (next === before || !dockChangeWantsReveal(before, next)) continue;
      const threadRef = parseScopedThreadKey(threadKey);
      if (threadRef) revealDock(threadRef);
    }
  });
  useRightPanelStore.subscribe((state, previous) => {
    if (state.byThreadKey === previous.byThreadKey) return;
    adoptPanelTerminalsIntoDock();
    if (!guardActive()) return;
    const terminals = useTerminalUiStateStore.getState().terminalUiStateByThreadKey;
    // An emptied, closed panel drops its entry, so look at the threads that had one.
    for (const [threadKey, before] of Object.entries(previous.byThreadKey)) {
      const next = state.byThreadKey[threadKey] ?? CLOSED_EMPTY_PANEL;
      if (next === before) continue;
      if (!panelClosedUnderOpenDock(before, next, terminals[threadKey]?.terminalOpen === true)) {
        continue;
      }
      const threadRef = parseScopedThreadKey(threadKey);
      if (threadRef) withMoving(() => useRightPanelStore.getState().show(threadRef));
    }
  });
  subscribeClientSettings(adoptPanelTerminalsIntoDock);
  adoptPanelTerminalsIntoDock();
}
