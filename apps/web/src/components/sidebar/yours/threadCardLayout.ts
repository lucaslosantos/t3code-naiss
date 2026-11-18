import { msg, useMessages } from "gt-react";
import type { ContextMenuItem } from "@t3tools/contracts";
import { getClientSettings, updateClientSettings } from "../../../hooks/useSettings";

const modes = ["default", "compact", "original"] as const;
const labels = {
  default: msg("Follow sidebar setting"),
  compact: msg("Compact"),
  original: msg("Original"),
};

export function useThreadCardLayoutMenu() {
  const translate = useMessages();
  return (threadKey: string): ContextMenuItem<string> => {
    const override = getClientSettings().threadCardLayoutOverrides[threadKey];
    return {
      id: "card-layout",
      label: translate(msg("Thread card layout")),
      children: modes.map((mode) => ({
        id: `card-layout:${mode}`,
        label: translate(labels[mode]),
        checked: mode === (override ?? "default"),
      })),
    };
  };
}

export function applyThreadCardLayout(action: string, threadKey: string): boolean {
  const mode = modes.find((value) => action === `card-layout:${value}`);
  if (!mode) return false;
  const overrides = { ...getClientSettings().threadCardLayoutOverrides };
  if (mode === "default") delete overrides[threadKey];
  else overrides[threadKey] = mode;
  void updateClientSettings({ threadCardLayoutOverrides: overrides });
  return true;
}
