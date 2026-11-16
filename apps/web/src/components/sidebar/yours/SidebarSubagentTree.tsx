import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { ChevronRightIcon } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { resolveThreadRouteTarget } from "~/threadRoutes";
import { useSubagentTree } from "./subagentTree.state";
import {
  countSubagents,
  resolveSubagentExpanded,
  subagentTreeContains,
  type SubagentNode,
  type SubagentStatus,
} from "./subagentTree.logic";

const EXPANDED_KEY_PREFIX = "t3code:sidebar:subagents-expanded:";
const StoredExpanded = Schema.NullOr(Schema.Boolean);

const STATUS_DOT: Record<SubagentStatus, string> = {
  working: "bg-info",
  attention: "bg-warning",
  failed: "bg-error",
  done: "bg-success",
  idle: "bg-sidebar-muted-foreground/40",
};

const STATUS_LABEL: Record<SubagentStatus, string> = {
  working: "Working",
  attention: "Needs you",
  failed: "Failed",
  done: "Done",
  idle: "Idle",
};

// Rows sit inside a sortable parent; a press here must open a child, not drag the parent.
const stopDragStart = (event: ReactPointerEvent) => event.stopPropagation();

function useRouteThreadKey(): string | null {
  return useParams({
    strict: false,
    select: (params) => {
      const target = resolveThreadRouteTarget(params);
      return target?.kind === "server" ? scopedThreadKey(target.threadRef) : null;
    },
  });
}

function useStoredExpanded(key: string) {
  return useLocalStorage<boolean | null, boolean | null>(
    `${EXPANDED_KEY_PREFIX}${key}`,
    null,
    StoredExpanded,
  );
}

/** Subagents and delegated tasks nested under their parent's sidebar row. */
export function SidebarSubagentTree(props: {
  parentKey: string;
  onActivate: (threadRef: ScopedThreadRef) => void;
}) {
  const enabled = useClientSettings((settings) => settings.sidebarShowSubagents);
  if (!enabled) return null;
  return <SubagentTreeRoot {...props} />;
}

function SubagentTreeRoot(props: {
  parentKey: string;
  onActivate: (threadRef: ScopedThreadRef) => void;
}) {
  const nodes = useSubagentTree(props.parentKey);
  if (nodes.length === 0) return null;
  return <SubagentDisclosure nodes={nodes} {...props} />;
}

function SubagentDisclosure(props: {
  parentKey: string;
  nodes: ReadonlyArray<SubagentNode>;
  onActivate: (threadRef: ScopedThreadRef) => void;
}) {
  const { nodes } = props;
  const [stored, setStored] = useStoredExpanded(props.parentKey);
  const routeKey = useRouteThreadKey();
  const expanded = resolveSubagentExpanded(stored, nodes, subagentTreeContains(nodes, routeKey));
  const total = countSubagents(nodes);
  const summary = nodes.some((node) => node.status === "attention")
    ? "attention"
    : nodes.some((node) => node.working)
      ? "working"
      : nodes.some((node) => node.status === "failed")
        ? "failed"
        : null;
  return (
    <div
      data-thread-selection-safe
      onPointerDown={stopDragStart}
      className="ps-(--sidebar-row-content-inset) pe-1 pb-0.5"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setStored(!expanded)}
        className="flex h-6 cursor-pointer items-center gap-1.5 rounded-sm pe-1.5 text-xs text-sidebar-muted-foreground outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "size-3 shrink-0 transition-transform motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
        <span className="rounded-sm bg-sidebar-row-hover px-1 text-2xs font-medium tabular-nums text-sidebar-foreground/80">
          {total}
        </span>
        <span>{total === 1 ? "subagent" : "subagents"}</span>
        {!expanded && summary !== null ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[summary])}>
            <span className="sr-only">, {STATUS_LABEL[summary]}</span>
          </span>
        ) : null}
      </button>
      {expanded ? (
        <SubagentList nodes={nodes} routeKey={routeKey} onActivate={props.onActivate} />
      ) : null}
    </div>
  );
}

function SubagentList(props: {
  nodes: ReadonlyArray<SubagentNode>;
  routeKey: string | null;
  onActivate: (threadRef: ScopedThreadRef) => void;
}) {
  return (
    <ul role="group" className="ms-1.5">
      {props.nodes.map((node) => (
        <SubagentItem
          key={node.key}
          node={node}
          routeKey={props.routeKey}
          onActivate={props.onActivate}
        />
      ))}
    </ul>
  );
}

function SubagentItem(props: {
  node: SubagentNode;
  routeKey: string | null;
  onActivate: (threadRef: ScopedThreadRef) => void;
}) {
  const { node, routeKey } = props;
  const [stored, setStored] = useStoredExpanded(node.key);
  const hasChildren = node.children.length > 0;
  const expanded =
    hasChildren &&
    resolveSubagentExpanded(stored, node.children, subagentTreeContains(node.children, routeKey));
  const isRoute = node.key === routeKey;
  const title = node.title.trim() || "Subagent";
  return (
    <li
      className={cn(
        "relative list-none ps-3.5",
        // Connector: a rail down the siblings that stops at the last child's row.
        "before:absolute before:start-0 before:top-0 before:h-full before:w-px before:bg-sidebar-border last:before:h-3.5",
      )}
    >
      <span aria-hidden className="absolute start-0 top-3.5 h-px w-2.5 bg-sidebar-border" />
      <div
        className={cn(
          "group/subagent flex h-7 items-center gap-1.5 rounded-md ps-1.5 pe-1",
          isRoute
            ? "bg-sidebar-row-active text-sidebar-foreground"
            : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
        )}
      >
        <button
          type="button"
          aria-current={isRoute ? "page" : undefined}
          onClick={() => props.onActivate(node.ref)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-xs outline-none focus-visible:underline"
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[node.status])}>
            <span className="sr-only">{STATUS_LABEL[node.status]}: </span>
          </span>
          <span dir="auto" className="min-w-0 flex-1 truncate">
            {title}
          </span>
        </button>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onClick={() => setStored(!expanded)}
            className="flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-2xs tabular-nums text-sidebar-muted-foreground outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {node.children.length}
            <ChevronRightIcon
              aria-hidden
              className={cn(
                "size-3 transition-transform motion-reduce:transition-none",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <SubagentList nodes={node.children} routeKey={routeKey} onActivate={props.onActivate} />
      ) : null}
    </li>
  );
}
