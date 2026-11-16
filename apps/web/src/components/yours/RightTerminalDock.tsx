import {
  AuthTerminalOperateScope,
  type ProjectScript,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { resolveTerminalSessionLabel } from "@t3tools/shared/terminalLabels";
import { ChevronDownIcon, PlayIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import { confirmTerminalClose } from "../../lib/terminalCloseConfirm";
import { focusActiveDrawerTerminal, focusTerminal } from "../../lib/terminalFocus";
import { cn } from "../../lib/utils";
import { primaryProjectScript } from "../../projectScripts";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import {
  useKnownTerminalSessions,
  useThreadRunningTerminalIds,
} from "../../state/terminalSessions";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import { ScriptIcon } from "../projectScriptEditor";
import { useThreadTerminalActions } from "../terminal/useThreadTerminalActions";
import { Button } from "../ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  dockTerminalTabs,
  RIGHT_DOCK_SPLIT,
  RUN_TERMINAL_ID,
  type DockTerminalTab,
} from "./rightTerminalDock.logic";
import {
  updateRightTerminalDockLayout,
  useRightTerminalDockLayout,
} from "./rightTerminalDockStore";
import { setRightDockTerminalHost } from "./terminalHosts";
import { TerminalPlacementMenu } from "./TerminalPlacementMenu";
import { clampTerminalPaneRatio, terminalPaneRatioFromDrag } from "./terminalPlacement.logic";

interface RightTerminalDockInput {
  readonly threadRef: ScopedThreadRef | null;
  /** Whether the panel shows any tab above the dock. */
  readonly hasSurfaces: boolean;
  readonly scripts: ReadonlyArray<ProjectScript>;
  readonly preferredScriptId: string | null;
  readonly onRunScript: (script: ProjectScript) => void;
}

/**
 * The right panel's terminal dock while the terminal is placed on the right: the element to put
 * under the panel body, and whether it takes the whole panel (no other tab is open).
 */
export function useRightTerminalDock(input: RightTerminalDockInput): {
  readonly element: ReactNode;
  readonly fills: boolean;
} {
  const placement = useClientSettings((settings) => settings.terminalPlacement);
  const terminalOpen = useTerminalUiStateStore(
    (state) =>
      selectThreadTerminalUiState(state.terminalUiStateByThreadKey, input.threadRef).terminalOpen,
  );
  const { collapsed } = useRightTerminalDockLayout();
  if (placement !== "right" || !input.threadRef || !terminalOpen) {
    return { element: null, fills: false };
  }
  const fills = !collapsed && !input.hasSurfaces;
  return {
    element: (
      <RightTerminalDock
        threadRef={input.threadRef}
        fills={fills}
        scripts={input.scripts}
        preferredScriptId={input.preferredScriptId}
        onRunScript={input.onRunScript}
      />
    ),
    fills,
  };
}

function RightTerminalDock(props: {
  threadRef: ScopedThreadRef;
  fills: boolean;
  scripts: ReadonlyArray<ProjectScript>;
  preferredScriptId: string | null;
  onRunScript: (script: ProjectScript) => void;
}) {
  const { threadRef } = props;
  const { collapsed, ratio: storedRatio } = useRightTerminalDockLayout();
  const ratio = clampTerminalPaneRatio(storedRatio, 0, RIGHT_DOCK_SPLIT);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startRatio: number;
    containerHeight: number;
    ratio: number;
  } | null>(null);
  const resizable = !collapsed && !props.fills;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const containerHeight = paneRef.current?.parentElement?.getBoundingClientRect().height ?? 0;
    if (containerHeight <= 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startRatio = clampTerminalPaneRatio(ratio, containerHeight, RIGHT_DOCK_SPLIT);
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
    const next = terminalPaneRatioFromDrag({
      startRatio: drag.startRatio,
      startY: drag.startY,
      pointerY: event.clientY,
      containerHeight: drag.containerHeight,
      split: RIGHT_DOCK_SPLIT,
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
    if (drag.ratio !== drag.startRatio) updateRightTerminalDockLayout({ ratio: drag.ratio });
  };

  return (
    <div
      ref={paneRef}
      data-right-terminal-dock=""
      data-collapsed={collapsed ? "true" : undefined}
      className={cn(
        "relative flex min-h-0 flex-col border-t border-border bg-background",
        props.fills ? "flex-1" : "shrink-0",
        resizable && "max-h-[calc(100%-10rem)] min-h-30",
      )}
      style={resizable ? { flexBasis: `${ratio * 100}%` } : undefined}
    >
      {resizable ? (
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
              `${RIGHT_DOCK_SPLIT.defaultRatio * 100}%`,
            );
            updateRightTerminalDockLayout({ ratio: RIGHT_DOCK_SPLIT.defaultRatio });
          }}
        />
      ) : null}
      <RightTerminalDockHeader
        threadRef={threadRef}
        collapsed={collapsed}
        scripts={props.scripts}
        preferredScriptId={props.preferredScriptId}
        onRunScript={props.onRunScript}
      />
      {/* Stays mounted while folded so the terminals keep their viewports. */}
      <div className={cn("relative min-h-0 flex-1", collapsed && "hidden")}>
        <div ref={setRightDockTerminalHost} className="absolute inset-0 flex flex-col" />
      </div>
    </div>
  );
}

function RightTerminalDockHeader(props: {
  threadRef: ScopedThreadRef;
  collapsed: boolean;
  scripts: ReadonlyArray<ProjectScript>;
  preferredScriptId: string | null;
  onRunScript: (script: ProjectScript) => void;
}) {
  const { threadRef } = props;
  const terminalUiState = useTerminalUiStateStore((state) =>
    selectThreadTerminalUiState(state.terminalUiStateByThreadKey, threadRef),
  );
  const setActiveTerminal = useTerminalUiStateStore((state) => state.setActiveTerminal);
  const newTerminal = useTerminalUiStateStore((state) => state.newTerminal);
  const closeTerminal = useTerminalUiStateStore((state) => state.closeTerminal);
  const sessions = useKnownTerminalSessions({
    environmentId: threadRef.environmentId,
    threadId: threadRef.threadId,
  });
  const runningTerminalIds = useThreadRunningTerminalIds({
    environmentId: threadRef.environmentId,
    threadId: threadRef.threadId,
  });
  const canOperate = useEnvironmentScope(threadRef.environmentId, AuthTerminalOperateScope);
  const terminalActions = useThreadTerminalActions(threadRef);

  const labelFor = (terminalId: string) =>
    resolveTerminalSessionLabel(
      terminalId,
      sessions?.find((session) => session.target.terminalId === terminalId)?.state.summary,
    );
  const tabs = dockTerminalTabs(terminalUiState, labelFor);

  const activate = (tab: DockTerminalTab) => {
    setActiveTerminal(threadRef, tab.terminalId);
    if (props.collapsed) updateRightTerminalDockLayout({ collapsed: false });
    focusTerminal(threadRef, tab.terminalId);
  };
  const requestClose = (tab: DockTerminalTab) => {
    if (!canOperate) return;
    const [first, ...rest] = tab.terminalIds.map(labelFor);
    void confirmTerminalClose([first ?? tab.label, ...rest]).then((confirmed) => {
      if (!confirmed || !readEnvironmentScope(threadRef.environmentId, AuthTerminalOperateScope)) {
        return;
      }
      for (const terminalId of tab.terminalIds) {
        terminalActions.closeTerminalSession(terminalId, threadRef);
        closeTerminal(threadRef, terminalId);
      }
      focusActiveDrawerTerminal(threadRef);
    });
  };
  const addTerminal = () => {
    const launched = terminalActions.launchTerminal({
      place: (terminalId) => newTerminal(threadRef, terminalId),
    });
    if (!launched) return;
    focusTerminal(threadRef, launched.terminalId);
    void launched.result;
  };

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 ps-1 pe-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={props.collapsed ? "Expand terminal" : "Collapse terminal"}
              aria-expanded={!props.collapsed}
              size="icon-xs"
              variant="ghost-muted"
              onClick={() => updateRightTerminalDockLayout({ collapsed: !props.collapsed })}
            />
          }
        >
          <ChevronDownIcon className={cn("size-3.5", props.collapsed && "rotate-180")} />
        </TooltipTrigger>
        <TooltipPopup side="top">
          {props.collapsed ? "Expand terminal" : "Collapse terminal"}
        </TooltipPopup>
      </Tooltip>
      <div
        role="tablist"
        aria-label="Terminals"
        className="flex h-full min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="presentation"
            className={cn(
              "group/tab relative flex shrink-0 items-center gap-0.5 ps-2 pe-1 text-xs transition-colors",
              tab.active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab.active}
              className="max-w-32 cursor-pointer truncate outline-none focus-visible:underline"
              onClick={() => activate(tab)}
              onAuxClick={(event) => {
                if (event.button === 1) requestClose(tab);
              }}
            >
              {tab.label}
            </button>
            <button
              type="button"
              aria-label={`Close ${tab.label}`}
              disabled={!canOperate}
              className={cn(
                "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:opacity-100 disabled:hidden",
                tab.active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
              )}
              onClick={() => requestClose(tab)}
            >
              <XIcon className="size-3" />
            </button>
            {tab.active ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </div>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="New terminal"
              className="shrink-0"
              disabled={!canOperate}
              size="icon-xs"
              variant="ghost-muted"
              onClick={addTerminal}
            />
          }
        >
          <PlusIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="top">New terminal</TooltipPopup>
      </Tooltip>
      <div className="min-w-2 flex-1" />
      <TerminalPlacementMenu threadRef={threadRef} current="right" variant="header" />
      <RunScriptControl
        scripts={props.scripts}
        preferredScriptId={props.preferredScriptId}
        busy={runningTerminalIds.includes(RUN_TERMINAL_ID)}
        canOperate={canOperate}
        onRunScript={props.onRunScript}
        onStop={() => void terminalActions.writeToTerminal(RUN_TERMINAL_ID, "\u0003")}
      />
    </div>
  );
}

/** ▶ Run the project's main script in the Run tab, ▾ to pick another; Stop while one runs. */
function RunScriptControl(props: {
  scripts: ReadonlyArray<ProjectScript>;
  preferredScriptId: string | null;
  busy: boolean;
  canOperate: boolean;
  onRunScript: (script: ProjectScript) => void;
  onStop: () => void;
}) {
  const runnable = props.scripts.filter((script) => !script.runOnSettle);
  const primary =
    (props.preferredScriptId
      ? runnable.find((script) => script.id === props.preferredScriptId)
      : undefined) ?? primaryProjectScript(runnable);
  if (!primary) return null;
  return (
    <div className="ms-0.5 flex shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={props.busy ? "Stop the running script" : `Run ${primary.name}`}
              disabled={!props.canOperate}
              size="xs"
              variant="ghost-muted"
              onClick={() => (props.busy ? props.onStop() : props.onRunScript(primary))}
            />
          }
        >
          {props.busy ? <SquareIcon className="size-3" /> : <PlayIcon className="size-3" />}
          {props.busy ? "Stop" : "Run"}
        </TooltipTrigger>
        <TooltipPopup side="top">
          {props.busy ? "Stop the running script" : `Run ${primary.name}`}
        </TooltipPopup>
      </Tooltip>
      <Menu>
        <MenuTrigger
          render={
            <Button
              aria-label="Choose a script to run"
              disabled={!props.canOperate}
              size="icon-xs"
              variant="ghost-muted"
            />
          }
        >
          <ChevronDownIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" side="bottom" sideOffset={6} className="max-w-64">
          <MenuGroup>
            <MenuGroupLabel>
              {props.busy ? "Run in another terminal" : "Run in the Run tab"}
            </MenuGroupLabel>
            {runnable.map((script) => (
              <MenuItem key={script.id} onClick={() => props.onRunScript(script)}>
                <ScriptIcon icon={script.icon} />
                <span className="min-w-0 truncate">{script.name}</span>
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}
