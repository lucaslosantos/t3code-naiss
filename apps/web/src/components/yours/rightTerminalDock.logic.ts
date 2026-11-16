import type { TerminalPaneSplit } from "./terminalPlacement.logic";

/** Project scripts run in this terminal while the terminal is docked in the right panel. */
export const RUN_TERMINAL_ID = "run";
const RUN_TERMINAL_LABEL = "Run";

export const RIGHT_DOCK_SPLIT: TerminalPaneSplit = {
  defaultRatio: 0.4,
  minPaneHeight: 140,
  minRestHeight: 160,
};

interface DockTerminalLayout {
  readonly terminalIds: readonly string[];
  readonly activeTerminalId: string;
  readonly terminalGroups: ReadonlyArray<{
    readonly id: string;
    readonly terminalIds: readonly string[];
  }>;
  readonly activeTerminalGroupId: string;
}

export interface DockTerminalTab {
  /** The drawer group the tab stands for; splits share one tab. */
  readonly id: string;
  /** The terminal a click activates: the group's active one. */
  readonly terminalId: string;
  readonly terminalIds: readonly string[];
  readonly label: string;
  readonly active: boolean;
  readonly run: boolean;
}

/** One tab per drawer group, the Run terminal's first. */
export function dockTerminalTabs(
  layout: DockTerminalLayout,
  labelFor: (terminalId: string) => string,
): DockTerminalTab[] {
  const tabs = layout.terminalGroups.flatMap((group): DockTerminalTab[] => {
    const terminalId = group.terminalIds.includes(layout.activeTerminalId)
      ? layout.activeTerminalId
      : group.terminalIds[0];
    if (!terminalId) return [];
    const run = group.terminalIds.includes(RUN_TERMINAL_ID);
    const base = run ? RUN_TERMINAL_LABEL : labelFor(terminalId);
    const extra = group.terminalIds.length - 1;
    return [
      {
        id: group.id,
        terminalId,
        terminalIds: group.terminalIds,
        label: extra > 0 ? `${base} +${extra}` : base,
        active: group.id === layout.activeTerminalGroupId,
        run,
      },
    ];
  });
  return [...tabs.filter((tab) => tab.run), ...tabs.filter((tab) => !tab.run)];
}

export type RightDockToggle =
  /** Hide the dock; also close the panel when the dock was all it showed. */
  | { readonly kind: "hide"; readonly closePanel: boolean }
  /** The terminal is open but out of sight: show the panel and expand the dock. */
  | { readonly kind: "reveal" }
  /** No open terminal yet: open one the usual way. */
  | { readonly kind: "open" };

export function resolveRightDockToggle(input: {
  readonly panelOpen: boolean;
  readonly terminalOpen: boolean;
  readonly collapsed: boolean;
  readonly hasOtherSurfaces: boolean;
}): RightDockToggle {
  if (!input.terminalOpen) return { kind: "open" };
  if (!input.panelOpen || input.collapsed) return { kind: "reveal" };
  return { kind: "hide", closePanel: !input.hasOtherSurfaces };
}

interface DockRevealState {
  readonly terminalOpen: boolean;
  readonly terminalIds: readonly string[];
  readonly activeTerminalId: string;
}

/**
 * Whether a drawer change asks to be seen: the terminal opened, or someone picked or started a
 * terminal. A server-side removal that moves the active terminal does not.
 */
export function dockChangeWantsReveal(
  previous: DockRevealState | undefined,
  next: DockRevealState,
): boolean {
  if (!next.terminalOpen) return false;
  if (!previous?.terminalOpen) return true;
  return (
    next.activeTerminalId !== previous.activeTerminalId &&
    next.terminalIds.includes(previous.activeTerminalId)
  );
}

/**
 * Closing the panel's last tab closes the panel. While the dock is open it should stay,
 * with the dock filling it.
 */
export function panelClosedUnderOpenDock(
  previous: { readonly isOpen: boolean; readonly surfaces: readonly unknown[] },
  next: { readonly isOpen: boolean; readonly surfaces: readonly unknown[] },
  terminalOpen: boolean,
): boolean {
  return (
    terminalOpen &&
    previous.isOpen &&
    previous.surfaces.length > 0 &&
    !next.isOpen &&
    next.surfaces.length === 0
  );
}

/**
 * The terminal a project script should run in, or null for the usual choice (an idle drawer
 * terminal, else a new one). Docked on the right, scripts share the Run tab unless it is busy.
 */
export function projectScriptRunTerminalId(input: {
  readonly docked: boolean;
  readonly stopOnSettle: boolean;
  readonly preferNewTerminal: boolean;
  readonly runningTerminalIds: ReadonlyArray<string>;
  readonly closingTerminalIds: ReadonlyArray<string>;
}): string | null {
  if (!input.docked || input.stopOnSettle || input.preferNewTerminal) return null;
  if (input.runningTerminalIds.includes(RUN_TERMINAL_ID)) return null;
  if (input.closingTerminalIds.includes(RUN_TERMINAL_ID)) return null;
  return RUN_TERMINAL_ID;
}
