import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { DEFAULT_CLIENT_SETTINGS, type TerminalPlacement } from "@t3tools/contracts/settings";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { __setClientSettingsForTests } from "../../hooks/useSettings";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  installTerminalPlacementGuard,
  moveDrawerTerminalsToPanel,
  movePanelTerminalsToDrawer,
} from "./terminalPlacement";

const THREAD_REF = scopeThreadRef("environment-a" as never, ThreadId.make("thread-1"));

function setup(placement: TerminalPlacement) {
  __setClientSettingsForTests({ ...DEFAULT_CLIENT_SETTINGS, terminalPlacement: placement });
  useTerminalUiStateStore.setState({
    terminalUiStateByThreadKey: {},
    suppressedTerminalIdsByThreadKey: {},
  });
  useRightPanelStore.setState({ byThreadKey: {} });
}

const drawer = () =>
  selectThreadTerminalUiState(
    useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
    THREAD_REF,
  );
const panel = () =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, THREAD_REF);

describe("terminal placement moves", () => {
  it("carries drawer groups to right-panel tabs and back without losing splits or height", () => {
    setup("bottom");
    const terminals = useTerminalUiStateStore.getState();
    terminals.newTerminal(THREAD_REF, "a");
    terminals.splitTerminalVertical(THREAD_REF, "b");
    terminals.newTerminal(THREAD_REF, "c");
    terminals.setActiveTerminal(THREAD_REF, "b");
    terminals.setTerminalHeight(THREAD_REF, 420);

    expect(moveDrawerTerminalsToPanel(THREAD_REF)).toBe(true);
    expect(drawer()).toMatchObject({ terminalOpen: false, terminalIds: [], terminalHeight: 420 });
    expect(panel()).toMatchObject({
      isOpen: true,
      activeSurfaceId: "terminal:a",
      surfaces: [
        {
          id: "terminal:a",
          terminalIds: ["a", "b"],
          activeTerminalId: "b",
          splitDirection: "vertical",
        },
        { id: "terminal:c", terminalIds: ["c"], activeTerminalId: "c" },
      ],
    });

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

  it("sends drawer openings to the right panel only while the terminal is placed there", () => {
    setup("bottom");
    installTerminalPlacementGuard();
    useTerminalUiStateStore.getState().ensureTerminal(THREAD_REF, "script", { open: true });
    expect(drawer().terminalIds).toEqual(["script"]);
    expect(panel().surfaces).toEqual([]);

    setup("right");
    useTerminalUiStateStore.getState().ensureTerminal(THREAD_REF, "script", { open: true });
    expect(drawer()).toMatchObject({ terminalOpen: false, terminalIds: [] });
    expect(panel()).toMatchObject({ isOpen: true, activeSurfaceId: "terminal:script" });
  });
});
