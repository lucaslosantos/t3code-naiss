import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { TerminalPlacement } from "@t3tools/contracts/settings";

import {
  getClientSettings,
  isClientSettingsHydrated,
  subscribeClientSettings,
  updateClientSettings,
} from "../../hooks/useSettings";
import { focusActiveDrawerTerminal, focusActivePanelTerminal } from "../../lib/terminalFocus";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  drawerTerminalGroupsForPanel,
  panelTerminalGroupsForDrawer,
  resolveRightPanelTerminalToggle,
} from "./terminalPlacement.logic";

// Moves only re-home terminal ids between the drawer and right-panel stores. Sessions are keyed
// by thread and terminal id on the server, so the shell keeps running and the new viewport
// reattaches to it.

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

/** Turns the drawer's terminals into right-panel tabs. Returns whether there were any. */
export function moveDrawerTerminalsToPanel(threadRef: ScopedThreadRef): boolean {
  const drawer = selectThreadTerminalUiState(
    useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
    threadRef,
  );
  if (drawer.terminalIds.length === 0) return false;
  const { groups, activeIndex } = drawerTerminalGroupsForPanel(drawer);
  const threadKey = scopedThreadKey(threadRef);
  withMoving(() => {
    // Keeps the drawer's height; closeTerminal would reset it and mark the ids closed.
    useTerminalUiStateStore.setState((state) => {
      const current = state.terminalUiStateByThreadKey[threadKey];
      if (!current) return state;
      return {
        terminalUiStateByThreadKey: {
          ...state.terminalUiStateByThreadKey,
          [threadKey]: {
            ...current,
            terminalOpen: false,
            terminalIds: [],
            activeTerminalId: "",
            terminalGroups: [],
            activeTerminalGroupId: "",
          },
        },
      };
    });
    const panels = useRightPanelStore.getState();
    const surfaceIds = groups.map((group) => {
      const [first, ...rest] = group.terminalIds;
      const surfaceId = `terminal:${first!}`;
      panels.openTerminal(threadRef, first!);
      for (const terminalId of rest) {
        panels.splitTerminal(threadRef, surfaceId, terminalId, group.splitDirection);
      }
      panels.activateTerminal(threadRef, surfaceId, group.activeTerminalId);
      return surfaceId;
    });
    const activeSurfaceId = surfaceIds[activeIndex];
    if (activeSurfaceId) panels.activateSurface(threadRef, activeSurfaceId);
    panels.show(threadRef);
  });
  return true;
}

/** Turns the right panel's terminal tabs into open drawer terminals. Returns whether there were any. */
export function movePanelTerminalsToDrawer(threadRef: ScopedThreadRef): boolean {
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
  });
  return true;
}

/**
 * Hides or shows the right panel's terminal. Returns false when the thread has no terminal tab
 * yet, so the caller opens one the usual way and the placement guard brings it over.
 */
export function toggleRightPanelTerminal(threadRef: ScopedThreadRef): boolean {
  const panels = useRightPanelStore.getState();
  const action = resolveRightPanelTerminalToggle(
    selectThreadRightPanelState(panels.byThreadKey, threadRef),
  );
  if (action.kind === "open") {
    if (!moveDrawerTerminalsToPanel(threadRef)) return false;
  } else if (action.kind === "hide") {
    panels.close(threadRef);
    return true;
  } else {
    panels.activateSurface(threadRef, action.surfaceId);
    panels.show(threadRef);
  }
  focusActivePanelTerminal(threadRef);
  return true;
}

/** Whether the thread's right panel is open on a terminal tab. */
export function isRightPanelTerminalShown(threadRef: ScopedThreadRef | null): boolean {
  if (!threadRef) return false;
  return (
    resolveRightPanelTerminalToggle(
      selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef),
    ).kind === "hide"
  );
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
  const previous = from;
  if (getClientSettings().terminalPlacement !== next) {
    void updateClientSettings({ terminalPlacement: next });
  }
  if (!threadRef || previous === next) return;
  if (next === "right") {
    if (moveDrawerTerminalsToPanel(threadRef)) focusActivePanelTerminal(threadRef);
    return;
  }
  if (previous === "right") movePanelTerminalsToDrawer(threadRef);
  // Before settings hydrate the saved placement can still read "right"; keep the guard out.
  withMoving(() => useTerminalUiStateStore.getState().setTerminalOpen(threadRef, true));
  focusActiveDrawerTerminal(threadRef);
}

/**
 * With the terminal on the right, anything that opens the drawer (scripts, chat code blocks,
 * setup terminal links) lands in the right panel instead. Opening runs synchronously in store
 * updates, so this follows the store rather than a render.
 */
function adoptOpenDrawersIntoPanel(): void {
  // Until saved settings load, the placement reads as the default and could misplace terminals.
  if (moving || !isClientSettingsHydrated() || getClientSettings().terminalPlacement !== "right") {
    return;
  }
  const byThreadKey = useTerminalUiStateStore.getState().terminalUiStateByThreadKey;
  for (const [threadKey, state] of Object.entries(byThreadKey)) {
    if (!state.terminalOpen) continue;
    const threadRef = parseScopedThreadKey(threadKey);
    if (threadRef) moveDrawerTerminalsToPanel(threadRef);
  }
}

let guardInstalled = false;

/** Idempotent; ChatView installs it once so the placement holds for every opening path. */
export function installTerminalPlacementGuard(): void {
  if (guardInstalled) return;
  guardInstalled = true;
  useTerminalUiStateStore.subscribe((state, previous) => {
    if (state.terminalUiStateByThreadKey !== previous.terminalUiStateByThreadKey) {
      adoptOpenDrawersIntoPanel();
    }
  });
  subscribeClientSettings(adoptOpenDrawersIntoPanel);
  adoptOpenDrawersIntoPanel();
}
