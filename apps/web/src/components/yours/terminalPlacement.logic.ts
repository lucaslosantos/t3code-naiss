import { msg } from "gt-react";
import type { TerminalPlacement } from "@t3tools/contracts/settings";

import type { RightPanelSurface } from "../../rightPanelStore";

export const TERMINAL_PLACEMENTS = [
  "right",
  "bottom",
  "sidebar",
] as const satisfies ReadonlyArray<TerminalPlacement>;

export const TERMINAL_PLACEMENT_LABELS: Record<TerminalPlacement, string> = {
  right: msg("Right panel", { $context: "terminal position" }),
  bottom: msg("Bottom", { $context: "terminal position" }),
  sidebar: msg("Sidebar", { $context: "terminal position" }),
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

/** How a resizable terminal pane shares its container with the row above it. */
export interface TerminalPaneSplit {
  /** Share of the container the terminal pane takes before the user drags. */
  readonly defaultRatio: number;
  readonly minPaneHeight: number;
  readonly minRestHeight: number;
}

export const SIDEBAR_TERMINAL_SPLIT: TerminalPaneSplit = {
  defaultRatio: 0.4,
  minPaneHeight: 120,
  minRestHeight: 160,
};

export function clampTerminalPaneRatio(
  ratio: number,
  containerHeight: number,
  split: TerminalPaneSplit,
): number {
  const value = Number.isFinite(ratio) ? ratio : split.defaultRatio;
  if (!(containerHeight > 0)) return Math.min(0.85, Math.max(0.15, value));
  const min = split.minPaneHeight / containerHeight;
  const max = 1 - split.minRestHeight / containerHeight;
  // Too short for both minimums: split what there is.
  if (min > max) return Math.min(1, Math.max(0, (min + max) / 2));
  return Math.min(max, Math.max(min, value));
}

/** The ratio a divider drag lands on; dragging up grows the terminal pane. */
export function terminalPaneRatioFromDrag(input: {
  readonly startRatio: number;
  readonly startY: number;
  readonly pointerY: number;
  readonly containerHeight: number;
  readonly split: TerminalPaneSplit;
}): number {
  if (!(input.containerHeight > 0)) return input.startRatio;
  return clampTerminalPaneRatio(
    input.startRatio + (input.startY - input.pointerY) / input.containerHeight,
    input.containerHeight,
    input.split,
  );
}
