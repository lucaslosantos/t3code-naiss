import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { T, useGT, useMessages } from "gt-react";

import { useClientSettings } from "../../hooks/useSettings";
import { SettingResetButton, SettingsRow } from "../settings/settingsLayout";
import { useSearchableSetting } from "../settings/settingsSearch";
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
  const gt = useGT();
  const m = useMessages();
  const setting = useSearchableSetting();
  return (
    <SettingsRow
      {...setting("terminal-placement")}
      description={
        <T>
          Show the thread terminal docked at the bottom of the right panel, below the chat, or under
          the thread list.
        </T>
      }
      resetAction={
        placement !== defaultPlacement ? (
          <SettingResetButton
            ariaLabel={gt("Reset terminal position to default")}
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
            <SelectTrigger
              size="sm"
              className="w-full min-w-0"
              aria-label={gt("Terminal position")}
            >
              <SelectValue>{m(TERMINAL_PLACEMENT_LABELS[placement])}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {TERMINAL_PLACEMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {m(TERMINAL_PLACEMENT_LABELS[value])}
                  {value === defaultPlacement ? ` ${gt("(default)")}` : ""}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      }
    />
  );
}
