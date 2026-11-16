import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "../../rightPanelStore";
import {
  clampSidebarTerminalRatio,
  drawerTerminalGroupsForPanel,
  panelTerminalGroupsForDrawer,
  resolveRightPanelTerminalToggle,
  sidebarTerminalRatioFromDrag,
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

describe("drawerTerminalGroupsForPanel", () => {
  it("keeps groups, splits and the active terminal, and adopts ungrouped ids", () => {
    expect(
      drawerTerminalGroupsForPanel({
        terminalIds: ["a", "b", "c", "d"],
        activeTerminalId: "c",
        terminalGroups: [
          { id: "group-a", terminalIds: ["a"] },
          { id: "group-b", terminalIds: ["b", "c", "gone"], splitDirection: "vertical" },
        ],
      }),
    ).toEqual({
      groups: [
        { terminalIds: ["a"], activeTerminalId: "a", splitDirection: "horizontal" },
        { terminalIds: ["b", "c"], activeTerminalId: "c", splitDirection: "vertical" },
        { terminalIds: ["d"], activeTerminalId: "d", splitDirection: "horizontal" },
      ],
      activeIndex: 1,
    });
  });
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

describe("resolveRightPanelTerminalToggle", () => {
  const diff: RightPanelSurface = { id: "diff", kind: "diff" };
  it.each([
    ["hides a shown terminal", true, "terminal:a", [terminalSurface(["a"])], { kind: "hide" }],
    [
      "shows the active terminal of a closed panel",
      false,
      "terminal:a",
      [terminalSurface(["a"]), terminalSurface(["b"])],
      { kind: "show", surfaceId: "terminal:a" },
    ],
    [
      "switches to the last terminal tab from another tab",
      true,
      "diff",
      [terminalSurface(["a"]), diff, terminalSurface(["b"])],
      { kind: "show", surfaceId: "terminal:b" },
    ],
    ["opens one when there is none", true, "diff", [diff], { kind: "open" }],
  ] as const)("%s", (_name, isOpen, activeSurfaceId, surfaces, expected) => {
    expect(resolveRightPanelTerminalToggle({ isOpen, activeSurfaceId, surfaces })).toEqual(
      expected,
    );
  });
});

describe("sidebar terminal ratio", () => {
  it("keeps both rows above their minimum heights", () => {
    expect(clampSidebarTerminalRatio(0.05, 800)).toBe(120 / 800);
    expect(clampSidebarTerminalRatio(0.95, 800)).toBe(1 - 160 / 800);
    expect(clampSidebarTerminalRatio(0.4, 800)).toBe(0.4);
    expect(clampSidebarTerminalRatio(Number.NaN, 800)).toBe(0.4);
    // Too short for both minimums: neither row wins outright.
    expect(clampSidebarTerminalRatio(0.9, 200)).toBeCloseTo(0.4);
  });

  it("grows the terminal row when the divider moves up", () => {
    const drag = { startRatio: 0.4, startY: 500, containerHeight: 1000 };
    expect(sidebarTerminalRatioFromDrag({ ...drag, pointerY: 400 })).toBeCloseTo(0.5);
    expect(sidebarTerminalRatioFromDrag({ ...drag, pointerY: 600 })).toBeCloseTo(0.3);
    expect(sidebarTerminalRatioFromDrag({ ...drag, pointerY: -2000 })).toBeCloseTo(0.84);
    expect(sidebarTerminalRatioFromDrag({ ...drag, pointerY: 0, containerHeight: 0 })).toBe(0.4);
  });
});
