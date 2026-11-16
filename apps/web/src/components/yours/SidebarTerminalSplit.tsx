import { resolveTerminalSessionLabel } from "@t3tools/shared/terminalLabels";
import * as Schema from "effect/Schema";
import { XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { focusTerminal } from "../../lib/terminalFocus";
import { cn } from "../../lib/utils";
import { useKnownTerminalSessions } from "../../state/terminalSessions";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { setSidebarTerminalHost } from "./sidebarTerminalHost";
import { TerminalPlacementMenu } from "./TerminalPlacementMenu";
import {
  clampSidebarTerminalRatio,
  SIDEBAR_TERMINAL_DEFAULT_RATIO,
  sidebarTerminalRatioFromDrag,
} from "./terminalPlacement.logic";
import { useRouteThreadRef } from "./useRouteThreadRef";

const RATIO_STORAGE_KEY = "t3code:yours:sidebar-terminal-ratio";

/** The sidebar's lower row while the terminal is placed there: tabs, then the terminal itself. */
export function SidebarTerminalSplit() {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const { isMobile } = useSidebar();
  // The mobile sheet unmounts with its sidebar; the drawer stays in the chat column there.
  if (placement !== "sidebar" || isMobile) return null;
  return <SidebarTerminalPane />;
}

function SidebarTerminalPane() {
  const threadRef = useRouteThreadRef();
  const terminalUiState = useTerminalUiStateStore((state) =>
    selectThreadTerminalUiState(state.terminalUiStateByThreadKey, threadRef),
  );
  const setTerminalOpen = useTerminalUiStateStore((state) => state.setTerminalOpen);
  const setActiveTerminal = useTerminalUiStateStore((state) => state.setActiveTerminal);
  const sessions = useKnownTerminalSessions({
    environmentId: threadRef?.environmentId ?? null,
    threadId: threadRef?.threadId ?? null,
  });
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const open = threadRef !== null && terminalUiState.terminalOpen;

  const [storedRatio, setStoredRatio] = useLocalStorage(
    RATIO_STORAGE_KEY,
    SIDEBAR_TERMINAL_DEFAULT_RATIO,
    Schema.Number,
  );
  const ratio = clampSidebarTerminalRatio(storedRatio, 0);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startRatio: number;
    containerHeight: number;
    ratio: number;
  } | null>(null);

  // Only an opening reveals it; collapsing the sidebar afterwards keeps it collapsed.
  const revealSidebar = useEffectEvent(() => {
    if (!sidebarOpen) setSidebarOpen(true);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- opening the terminal from a shortcut or the palette reveals the collapsed sidebar that holds it
  useEffect(() => {
    if (open) revealSidebar();
  }, [open]);

  const labelFor = (terminalId: string) =>
    resolveTerminalSessionLabel(
      terminalId,
      sessions?.find((session) => session.target.terminalId === terminalId)?.state.summary,
    );
  const tabs = terminalUiState.terminalGroups.flatMap((group) => {
    const terminalId = group.terminalIds.includes(terminalUiState.activeTerminalId)
      ? terminalUiState.activeTerminalId
      : group.terminalIds[0];
    if (!terminalId) return [];
    const extra = group.terminalIds.length - 1;
    return [
      {
        id: group.id,
        terminalId,
        label: extra > 0 ? `${labelFor(terminalId)} +${extra}` : labelFor(terminalId),
        active: group.id === terminalUiState.activeTerminalGroupId,
      },
    ];
  });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const containerHeight = paneRef.current?.parentElement?.getBoundingClientRect().height ?? 0;
    if (containerHeight <= 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startRatio = clampSidebarTerminalRatio(ratio, containerHeight);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startRatio,
      containerHeight,
      ratio: startRatio,
    };
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = sidebarTerminalRatioFromDrag({
      startRatio: drag.startRatio,
      startY: drag.startY,
      pointerY: event.clientY,
      containerHeight: drag.containerHeight,
    });
    if (next === drag.ratio) return;
    drag.ratio = next;
    // A drag writes the style only; the stored ratio hears it once, at pointerup.
    paneRef.current?.style.setProperty("flex-basis", `${next * 100}%`);
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.ratio !== drag.startRatio) setStoredRatio(drag.ratio);
  };

  return (
    <div
      ref={paneRef}
      data-sidebar-terminal=""
      className={cn(
        "relative shrink-0 flex-col border-t border-sidebar-border",
        "max-h-[calc(100%-10rem)] min-h-30",
        open ? "flex" : "hidden",
      )}
      style={{ flexBasis: `${ratio * 100}%` }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        className="absolute inset-x-0 -top-1 z-20 h-2 cursor-row-resize touch-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:transition-colors hover:after:bg-foreground/25 any-pointer-coarse:-top-2 any-pointer-coarse:h-4"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onDoubleClick={() => {
          paneRef.current?.style.setProperty(
            "flex-basis",
            `${SIDEBAR_TERMINAL_DEFAULT_RATIO * 100}%`,
          );
          setStoredRatio(SIDEBAR_TERMINAL_DEFAULT_RATIO);
        }}
      />
      <div className="flex h-8 shrink-0 items-center gap-1 ps-2 pe-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {tabs.length > 1 ? (
            tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "h-6 max-w-32 shrink-0 truncate rounded-md px-2 text-xs transition-colors",
                  tab.active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
                onClick={() => {
                  if (!threadRef) return;
                  setActiveTerminal(threadRef, tab.terminalId);
                  focusTerminal(threadRef, tab.terminalId);
                }}
              >
                {tab.label}
              </button>
            ))
          ) : (
            <span className="truncate px-1 text-xs font-medium text-muted-foreground">
              {tabs[0]?.label ?? "Terminal"}
            </span>
          )}
        </div>
        {threadRef ? (
          <TerminalPlacementMenu threadRef={threadRef} current="sidebar" variant="header" />
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Hide terminal"
                size="icon-xs"
                variant="ghost-muted"
                onClick={() => {
                  if (threadRef) setTerminalOpen(threadRef, false);
                }}
              />
            }
          >
            <XIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">Hide terminal</TooltipPopup>
        </Tooltip>
      </div>
      <div className="relative min-h-0 flex-1">
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground/70">
          Open a thread to use its terminal here.
        </p>
        <div ref={setSidebarTerminalHost} className="absolute inset-0 flex flex-col" />
      </div>
    </div>
  );
}
