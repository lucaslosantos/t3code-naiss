import { describe, expect, it } from "vite-plus/test";

import {
  dockChangeWantsReveal,
  dockTerminalTabs,
  panelClosedUnderOpenDock,
  projectScriptRunTerminalId,
  resolveRightDockToggle,
} from "./rightTerminalDock.logic";

describe("dockTerminalTabs", () => {
  it("shows one tab per group, the Run tab first, splits counted", () => {
    const tabs = dockTerminalTabs(
      {
        terminalIds: ["term-1", "term-2", "run", "term-3"],
        activeTerminalId: "term-2",
        terminalGroups: [
          { id: "g1", terminalIds: ["term-1", "term-2"] },
          { id: "g2", terminalIds: ["run"] },
          { id: "g3", terminalIds: ["term-3"] },
          { id: "empty", terminalIds: [] },
        ],
        activeTerminalGroupId: "g1",
      },
      (terminalId) => terminalId.replace("term-", "Terminal "),
    );
    expect(
      tabs.map(({ id, terminalId, label, active, run }) => ({
        id,
        terminalId,
        label,
        active,
        run,
      })),
    ).toEqual([
      { id: "g2", terminalId: "run", label: "Run", active: false, run: true },
      { id: "g1", terminalId: "term-2", label: "Terminal 2 +1", active: true, run: false },
      { id: "g3", terminalId: "term-3", label: "Terminal 3", active: false, run: false },
    ]);
  });
});

describe("resolveRightDockToggle", () => {
  const base = { panelOpen: true, terminalOpen: true, collapsed: false, hasOtherSurfaces: true };
  it.each([
    ["opens a terminal when none is open", { terminalOpen: false }, { kind: "open" }],
    ["reveals a dock hidden by a closed panel", { panelOpen: false }, { kind: "reveal" }],
    ["unfolds a collapsed dock", { collapsed: true }, { kind: "reveal" }],
    ["hides a shown dock, keeping other tabs", {}, { kind: "hide", closePanel: false }],
    [
      "closes the panel when the dock was all it showed",
      { hasOtherSurfaces: false },
      { kind: "hide", closePanel: true },
    ],
  ] as const)("%s", (_name, patch, expected) => {
    expect(resolveRightDockToggle({ ...base, ...patch })).toEqual(expected);
  });
});

describe("dockChangeWantsReveal", () => {
  const open = { terminalOpen: true, terminalIds: ["a", "b"], activeTerminalId: "a" };
  it.each([
    ["opening the terminal", undefined, open, true],
    ["opening it again", { ...open, terminalOpen: false }, open, true],
    ["picking another terminal", open, { ...open, activeTerminalId: "b" }, true],
    [
      "starting a new terminal",
      open,
      { ...open, terminalIds: ["a", "b", "c"], activeTerminalId: "c" },
      true,
    ],
    [
      "a server removal moving the active terminal",
      open,
      { ...open, terminalIds: ["b"], activeTerminalId: "b" },
      false,
    ],
    ["hiding the terminal", open, { ...open, terminalOpen: false }, false],
    ["an unrelated update", open, { ...open, terminalIds: ["a", "b", "c"] }, false],
  ] as const)("%s", (_name, previous, next, expected) => {
    expect(dockChangeWantsReveal(previous, next)).toBe(expected);
  });
});

describe("panelClosedUnderOpenDock", () => {
  it("only catches the panel closing because its last tab closed", () => {
    const withTab = { isOpen: true, surfaces: [{}] };
    const emptyClosed = { isOpen: false, surfaces: [] };
    expect(panelClosedUnderOpenDock(withTab, emptyClosed, true)).toBe(true);
    expect(panelClosedUnderOpenDock(withTab, emptyClosed, false)).toBe(false);
    expect(panelClosedUnderOpenDock({ isOpen: true, surfaces: [] }, emptyClosed, true)).toBe(false);
    expect(panelClosedUnderOpenDock(withTab, { isOpen: false, surfaces: [{}] }, true)).toBe(false);
  });
});

describe("projectScriptRunTerminalId", () => {
  const base = {
    docked: true,
    stopOnSettle: false,
    preferNewTerminal: false,
    runningTerminalIds: [],
    closingTerminalIds: [],
  };
  it.each([
    ["uses the Run tab while docked", {}, "run"],
    ["leaves other placements alone", { docked: false }, null],
    ["keeps settle scripts in their own terminal", { stopOnSettle: true }, null],
    ["honours a new-terminal request", { preferNewTerminal: true }, null],
    ["does not type into a busy Run tab", { runningTerminalIds: ["run"] }, null],
    ["waits out a closing Run tab", { closingTerminalIds: ["run"] }, null],
  ] as const)("%s", (_name, patch, expected) => {
    expect(projectScriptRunTerminalId({ ...base, ...patch })).toBe(expected);
  });
});
