import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { DEFAULT_CLIENT_SETTINGS, type TerminalPlacement } from "@t3tools/contracts/settings";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { __setClientSettingsForTests } from "../../hooks/useSettings";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  getRightTerminalDockLayout,
  updateRightTerminalDockLayout,
} from "./rightTerminalDockStore";
import {
  installTerminalPlacementGuard,
  movePanelTerminalsToDrawer,
  toggleRightDockTerminal,
} from "./terminalPlacement";

const THREAD_REF = scopeThreadRef("environment-a" as never, ThreadId.make("thread-1"));

function setup(placement: TerminalPlacement) {
  __setClientSettingsForTests({ ...DEFAULT_CLIENT_SETTINGS, terminalPlacement: placement });
  useTerminalUiStateStore.setState({
    terminalUiStateByThreadKey: {},
    suppressedTerminalIdsByThreadKey: {},
  });
  useRightPanelStore.setState({ byThreadKey: {} });
  updateRightTerminalDockLayout({ collapsed: false });
  installTerminalPlacementGuard();
}

const drawer = () =>
  selectThreadTerminalUiState(
    useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
    THREAD_REF,
  );
const panel = () =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, THREAD_REF);

describe("terminal placement", () => {
  it("carries right-panel terminal tabs to the drawer without losing splits or height", () => {
    setup("bottom");
    const terminals = useTerminalUiStateStore.getState();
    terminals.setTerminalHeight(THREAD_REF, 420);
    const panels = useRightPanelStore.getState();
    panels.openTerminal(THREAD_REF, "a");
    panels.splitTerminal(THREAD_REF, "terminal:a", "b", "vertical");
    panels.openTerminal(THREAD_REF, "c");
    panels.activateTerminal(THREAD_REF, "terminal:a", "b");
    panels.activateSurface(THREAD_REF, "terminal:a");

    expect(movePanelTerminalsToDrawer(THREAD_REF)).toBe(true);
    expect(panel().surfaces).toEqual([]);
    expect(drawer()).toMatchObject({
      terminalOpen: true,
      terminalIds: ["a", "b", "c"],
      activeTerminalId: "b",
      terminalHeight: 420,
      terminalGroups: [
        { terminalIds: ["a", "b"], splitDirection: "vertical" },
        { terminalIds: ["c"] },
      ],
    });
  });

  it("docks terminal tabs on the right, keeping the panel and its other tabs", () => {
    setup("bottom");
    const panels = useRightPanelStore.getState();
    panels.toggle(THREAD_REF, "diff");
    panels.openTerminal(THREAD_REF, "a");
    expect(panel().surfaces.map((surface) => surface.id)).toEqual(["diff", "terminal:a"]);

    setup("right");
    useRightPanelStore.getState().toggle(THREAD_REF, "diff");
    useRightPanelStore.getState().openTerminal(THREAD_REF, "a");
    expect(panel()).toMatchObject({ isOpen: true, surfaces: [{ id: "diff" }] });
    expect(drawer()).toMatchObject({ terminalOpen: true, terminalIds: ["a"] });

    // The dock alone keeps the panel open once its last other tab closes.
    useRightPanelStore.getState().closeSurface(THREAD_REF, "diff");
    expect(panel()).toMatchObject({ isOpen: true, surfaces: [] });
  });

  it("reveals the dock when a terminal opens, only while it is placed on the right", () => {
    setup("bottom");
    useTerminalUiStateStore.getState().ensureTerminal(THREAD_REF, "script", { open: true });
    expect(panel().isOpen).toBe(false);

    setup("right");
    updateRightTerminalDockLayout({ collapsed: true });
    useTerminalUiStateStore.getState().ensureTerminal(THREAD_REF, "script", { open: true });
    expect(drawer()).toMatchObject({ terminalOpen: true, terminalIds: ["script"] });
    expect(panel()).toMatchObject({ isOpen: true, surfaces: [] });
    expect(getRightTerminalDockLayout().collapsed).toBe(false);
  });

  it("toggles the dock: hide, reveal, and close a panel it alone filled", () => {
    setup("right");
    expect(toggleRightDockTerminal(THREAD_REF)).toBe(false);
    useTerminalUiStateStore.getState().ensureTerminal(THREAD_REF, "a", { open: true });
    expect(panel().isOpen).toBe(true);

    expect(toggleRightDockTerminal(THREAD_REF)).toBe(true);
    expect(drawer().terminalOpen).toBe(false);
    expect(panel().isOpen).toBe(false);

    useTerminalUiStateStore.getState().setTerminalOpen(THREAD_REF, true);
    useRightPanelStore.getState().close(THREAD_REF);
    expect(toggleRightDockTerminal(THREAD_REF)).toBe(true);
    expect(panel().isOpen).toBe(true);
    expect(drawer().terminalOpen).toBe(true);
  });
});
