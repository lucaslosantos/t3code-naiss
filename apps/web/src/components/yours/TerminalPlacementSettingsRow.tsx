import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";

import { useClientSettings } from "../../hooks/useSettings";
import { SettingResetButton, SettingsRow } from "../settings/settingsLayout";
import { searchableSetting } from "../settings/settingsSearch";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { setTerminalPlacement } from "./terminalPlacement";
import {
  isTerminalPlacement,
  TERMINAL_PLACEMENT_LABELS,
  TERMINAL_PLACEMENTS,
} from "./terminalPlacement.logic";

export function TerminalPlacementSettingsRow() {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const defaultPlacement = DEFAULT_CLIENT_SETTINGS.terminalPlacement;
  return (
    <SettingsRow
      {...searchableSetting("terminal-placement")}
      description="Show the thread terminal docked at the bottom of the right panel, below the chat, or under the thread list."
      resetAction={
        placement !== defaultPlacement ? (
          <SettingResetButton
            label="terminal position"
            onClick={() => setTerminalPlacement(defaultPlacement, null)}
          />
        ) : null
      }
      control={
        <div className="w-full sm:w-40">
          <Select
            value={placement}
            onValueChange={(value) => {
              if (isTerminalPlacement(value)) setTerminalPlacement(value, null);
            }}
          >
            <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Terminal position">
              <SelectValue>{TERMINAL_PLACEMENT_LABELS[placement]}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {TERMINAL_PLACEMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {TERMINAL_PLACEMENT_LABELS[value]}
                  {value === defaultPlacement ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      }
    />
  );
}
