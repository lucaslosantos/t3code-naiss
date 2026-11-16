import type { TerminalPlacement } from "@t3tools/contracts/settings";

import type { RightPanelSurface } from "../../rightPanelStore";
import type { ThreadTerminalGroup } from "../../types";

export const TERMINAL_PLACEMENTS = [
  "right",
  "bottom",
  "sidebar",
] as const satisfies ReadonlyArray<TerminalPlacement>;

export const TERMINAL_PLACEMENT_LABELS: Record<TerminalPlacement, string> = {
  right: "Right panel",
  bottom: "Bottom",
  sidebar: "Sidebar",
};

export function isTerminalPlacement(value: unknown): value is TerminalPlacement {
  return value === "right" || value === "bottom" || value === "sidebar";
}

/** One set of side-by-side terminals: a drawer group, or one right-panel terminal tab. */
export interface TerminalPaneGroup {
  readonly terminalIds: readonly string[];
  readonly activeTerminalId: string;
  readonly splitDirection: "horizontal" | "vertical";
}

interface DrawerTerminalLayout {
  readonly terminalIds: readonly string[];
  readonly activeTerminalId: string;
  readonly terminalGroups: readonly ThreadTerminalGroup[];
}

/** The drawer's terminals as right-panel tabs, keeping each group's split and the active one. */
export function drawerTerminalGroupsForPanel(layout: DrawerTerminalLayout): {
  readonly groups: readonly TerminalPaneGroup[];
  readonly activeIndex: number;
} {
  const known = new Set(layout.terminalIds);
  const assigned = new Set<string>();
  const groups: TerminalPaneGroup[] = [];
  const pushGroup = (ids: readonly string[], splitDirection: "horizontal" | "vertical") => {
    const terminalIds = ids.filter((id) => known.has(id) && !assigned.has(id));
    if (terminalIds.length === 0) return;
    for (const id of terminalIds) assigned.add(id);
    groups.push({
      terminalIds,
      activeTerminalId: terminalIds.includes(layout.activeTerminalId)
        ? layout.activeTerminalId
        : terminalIds[0]!,
      splitDirection,
    });
  };
  for (const group of layout.terminalGroups) {
    pushGroup(group.terminalIds, group.splitDirection ?? "horizontal");
  }
  for (const id of layout.terminalIds) pushGroup([id], "horizontal");
  const activeIndex = groups.findIndex((group) =>
    group.terminalIds.includes(layout.activeTerminalId),
  );
  return { groups, activeIndex: Math.max(0, activeIndex) };
}

/** The right panel's terminal tabs as drawer groups, and the terminal to leave active. */
export function panelTerminalGroupsForDrawer(
  surfaces: readonly RightPanelSurface[],
  activeSurfaceId: string | null,
): { readonly groups: readonly TerminalPaneGroup[]; readonly activeTerminalId: string | null } {
  const groups: TerminalPaneGroup[] = [];
  const seen = new Set<string>();
  let activeTerminalId: string | null = null;
  for (const surface of surfaces) {
    if (surface.kind !== "terminal") continue;
    const terminalIds = surface.terminalIds.filter((id) => !seen.has(id));
    if (terminalIds.length === 0) continue;
    for (const id of terminalIds) seen.add(id);
    const groupActive = terminalIds.includes(surface.activeTerminalId)
      ? surface.activeTerminalId
      : terminalIds[0]!;
    groups.push({
      terminalIds,
      activeTerminalId: groupActive,
      splitDirection: surface.splitDirection ?? "horizontal",
    });
    if (surface.id === activeSurfaceId) activeTerminalId = groupActive;
  }
  return { groups, activeTerminalId: activeTerminalId ?? groups[0]?.activeTerminalId ?? null };
}

export type RightPanelTerminalToggle =
  | { readonly kind: "hide" }
  | { readonly kind: "show"; readonly surfaceId: string }
  | { readonly kind: "open" };

/** What the terminal toggle does when the terminal lives in the right panel. */
export function resolveRightPanelTerminalToggle(panel: {
  readonly isOpen: boolean;
  readonly activeSurfaceId: string | null;
  readonly surfaces: readonly RightPanelSurface[];
}): RightPanelTerminalToggle {
  const active = panel.surfaces.find((surface) => surface.id === panel.activeSurfaceId);
  if (panel.isOpen && active?.kind === "terminal") return { kind: "hide" };
  if (active?.kind === "terminal") return { kind: "show", surfaceId: active.id };
  const lastTerminal = panel.surfaces.findLast((surface) => surface.kind === "terminal");
  return lastTerminal ? { kind: "show", surfaceId: lastTerminal.id } : { kind: "open" };
}

/** Share of the sidebar height the terminal pane takes. */
export const SIDEBAR_TERMINAL_DEFAULT_RATIO = 0.4;
const SIDEBAR_TERMINAL_MIN_HEIGHT = 120;
const SIDEBAR_THREAD_LIST_MIN_HEIGHT = 160;

export function clampSidebarTerminalRatio(ratio: number, containerHeight: number): number {
  const value = Number.isFinite(ratio) ? ratio : SIDEBAR_TERMINAL_DEFAULT_RATIO;
  if (!(containerHeight > 0)) return Math.min(0.85, Math.max(0.15, value));
  const min = SIDEBAR_TERMINAL_MIN_HEIGHT / containerHeight;
  const max = 1 - SIDEBAR_THREAD_LIST_MIN_HEIGHT / containerHeight;
  // Too short for both minimums: split what there is.
  if (min > max) return Math.min(1, Math.max(0, (min + max) / 2));
  return Math.min(max, Math.max(min, value));
}

/** The ratio a divider drag lands on; dragging up grows the terminal pane. */
export function sidebarTerminalRatioFromDrag(input: {
  readonly startRatio: number;
  readonly startY: number;
  readonly pointerY: number;
  readonly containerHeight: number;
}): number {
  if (!(input.containerHeight > 0)) return input.startRatio;
  return clampSidebarTerminalRatio(
    input.startRatio + (input.startY - input.pointerY) / input.containerHeight,
    input.containerHeight,
  );
}
