import type { ScopedThreadRef } from "@t3tools/contracts";
import type { TerminalPlacement } from "@t3tools/contracts/settings";
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon, type LucideIcon } from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  isTerminalPlacement,
  TERMINAL_PLACEMENT_LABELS,
  TERMINAL_PLACEMENTS,
} from "./terminalPlacement.logic";

export const TERMINAL_PLACEMENT_ICONS: Record<TerminalPlacement, LucideIcon> = {
  right: PanelRightIcon,
  bottom: PanelBottomIcon,
  sidebar: PanelLeftIcon,
};

const TRIGGER_CLASS_NAMES = {
  toolbar: "p-1 text-foreground/90 transition-colors hover:bg-accent data-popup-open:bg-accent",
  list: "inline-flex h-full items-center border-l border-border/70 px-1 text-foreground/90 transition-colors hover:bg-accent/70 data-popup-open:bg-accent/70",
} as const;

const LABEL = "Move terminal";

// Loaded on use: the drawer renders this menu, and its tests stub the settings module.
function moveTerminal(
  next: TerminalPlacement,
  threadRef: ScopedThreadRef,
  from: TerminalPlacement,
): void {
  void import("./terminalPlacement").then(({ setTerminalPlacement }) =>
    setTerminalPlacement(next, threadRef, from),
  );
}

/** Moves the terminal it sits on to another place, keeping its shell running. */
export function TerminalPlacementMenu(props: {
  threadRef: ScopedThreadRef;
  /** Where this terminal is shown now. */
  current: TerminalPlacement;
  variant: "toolbar" | "list" | "header";
}) {
  const CurrentIcon = TERMINAL_PLACEMENT_ICONS[props.current];
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                props.variant === "header" ? (
                  <Button aria-label={LABEL} size="icon-xs" variant="ghost-muted" />
                ) : (
                  <button
                    type="button"
                    aria-label={LABEL}
                    className={TRIGGER_CLASS_NAMES[props.variant]}
                  />
                )
              }
            />
          }
        >
          <CurrentIcon className={props.variant === "header" ? "size-3.5" : "size-3.25"} />
        </TooltipTrigger>
        <TooltipPopup side="bottom">{LABEL}</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" side="bottom" sideOffset={6}>
        <MenuGroup>
          <MenuGroupLabel>Show terminal in</MenuGroupLabel>
          <MenuRadioGroup
            value={props.current}
            onValueChange={(value) => {
              if (isTerminalPlacement(value) && value !== props.current) {
                moveTerminal(value, props.threadRef, props.current);
              }
            }}
          >
            {TERMINAL_PLACEMENTS.map((placement) => {
              const Icon = TERMINAL_PLACEMENT_ICONS[placement];
              return (
                <MenuRadioItem key={placement} value={placement} closeOnClick>
                  <span className="flex items-center gap-2">
                    <Icon className="text-muted-foreground" />
                    {TERMINAL_PLACEMENT_LABELS[placement]}
                    <MenuRadioItemIndicator className="ms-auto" />
                  </span>
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
