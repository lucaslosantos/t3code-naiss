import { useClientSettings } from "../../hooks/useSettings";
import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "../CommandPalette.logic";
import { setTerminalPlacement } from "./terminalPlacement";
import { TERMINAL_PLACEMENT_ICONS } from "./TerminalPlacementMenu";
import { TERMINAL_PLACEMENTS } from "./terminalPlacement.logic";
import { useRouteThreadRef } from "./useRouteThreadRef";

const PALETTE_TITLES = {
  right: "Move terminal to the right panel",
  bottom: "Move terminal to the bottom",
  sidebar: "Move terminal to the sidebar",
} as const;

/** "Move terminal to …" actions for every placement but the current one. */
export function useTerminalPlacementPaletteItems(): CommandPaletteActionItem[] {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const threadRef = useRouteThreadRef();
  return TERMINAL_PLACEMENTS.filter((next) => next !== placement).map((next) => {
    const Icon = TERMINAL_PLACEMENT_ICONS[next];
    return {
      kind: "action",
      value: `action:terminal-placement:${next}`,
      title: PALETTE_TITLES[next],
      searchTerms: ["terminal", "move", "position", "placement", "panel", next],
      icon: <Icon className={ITEM_ICON_CLASS} />,
      run: async () => setTerminalPlacement(next, threadRef),
    };
  });
}
