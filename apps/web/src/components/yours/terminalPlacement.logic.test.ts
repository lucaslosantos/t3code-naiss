import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "../../rightPanelStore";
import { RIGHT_DOCK_SPLIT } from "./rightTerminalDock.logic";
import {
  clampTerminalPaneRatio,
  panelTerminalGroupsForDrawer,
  SIDEBAR_TERMINAL_SPLIT,
  terminalPaneRatioFromDrag,
} from "./terminalPlacement.logic";

const terminalSurface = (
  terminalIds: string[],
  activeTerminalId = terminalIds[0]!,
  splitDirection?: "vertical",
): RightPanelSurface => ({
  id: `terminal:${terminalIds[0]!}`,
  kind: "terminal",
  resourceId: terminalIds[0]!,
  terminalIds,
  activeTerminalId,
  ...(splitDirection ? { splitDirection } : {}),
});

describe("panelTerminalGroupsForDrawer", () => {
  it("takes terminal tabs only and leaves the active tab's terminal active", () => {
    const surfaces: RightPanelSurface[] = [
      { id: "diff", kind: "diff" },
      terminalSurface(["a", "b"], "b", "vertical"),
      terminalSurface(["c"]),
    ];
    expect(panelTerminalGroupsForDrawer(surfaces, "terminal:a")).toEqual({
      groups: [
        { terminalIds: ["a", "b"], activeTerminalId: "b", splitDirection: "vertical" },
        { terminalIds: ["c"], activeTerminalId: "c", splitDirection: "horizontal" },
      ],
      activeTerminalId: "b",
    });
    expect(panelTerminalGroupsForDrawer(surfaces, "diff").activeTerminalId).toBe("b");
    expect(panelTerminalGroupsForDrawer([{ id: "diff", kind: "diff" }], null)).toEqual({
      groups: [],
      activeTerminalId: null,
    });
  });
});

describe("terminal pane ratio", () => {
  it("keeps both rows above their minimum heights", () => {
    const split = SIDEBAR_TERMINAL_SPLIT;
    expect(clampTerminalPaneRatio(0.05, 800, split)).toBe(120 / 800);
    expect(clampTerminalPaneRatio(0.95, 800, split)).toBe(1 - 160 / 800);
    expect(clampTerminalPaneRatio(0.4, 800, split)).toBe(0.4);
    expect(clampTerminalPaneRatio(Number.NaN, 800, split)).toBe(0.4);
    // Too short for both minimums: neither row wins outright.
    expect(clampTerminalPaneRatio(0.9, 200, split)).toBeCloseTo(0.4);
    expect(clampTerminalPaneRatio(0.05, 1000, RIGHT_DOCK_SPLIT)).toBe(0.14);
  });

  it("grows the terminal row when the divider moves up", () => {
    const drag = {
      startRatio: 0.4,
      startY: 500,
      containerHeight: 1000,
      split: SIDEBAR_TERMINAL_SPLIT,
    };
    expect(terminalPaneRatioFromDrag({ ...drag, pointerY: 400 })).toBeCloseTo(0.5);
    expect(terminalPaneRatioFromDrag({ ...drag, pointerY: 600 })).toBeCloseTo(0.3);
    expect(terminalPaneRatioFromDrag({ ...drag, pointerY: -2000 })).toBeCloseTo(0.84);
    expect(terminalPaneRatioFromDrag({ ...drag, pointerY: 0, containerHeight: 0 })).toBe(0.4);
  });
});
