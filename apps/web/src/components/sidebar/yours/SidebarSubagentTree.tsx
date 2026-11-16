import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { ChevronRightIcon } from "lucide-react";
import { memo, useId, type PointerEvent as ReactPointerEvent } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useNowMinute } from "~/hooks/useNowMinute";
import { useClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { resolveThreadRouteTarget } from "~/threadRoutes";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import {
  resolveSidebarTopStatus,
  TopStatusIcon,
  WorkingDuration,
  type SidebarTopStatus,
} from "../SidebarThreadRow";
import { useHasSubagents, useSubagentTree } from "./subagentTree.state";
import {
  countSubagents,
  resolveSubagentExpanded,
  subagentTreeContains,
  type SubagentNode,
} from "./subagentTree.logic";

const EXPANDED_KEY_PREFIX = "t3code:sidebar:subagents-expanded:";
const StoredExpanded = Schema.NullOr(Schema.Boolean);

const topStatusOf = (node: SubagentNode): SidebarTopStatus | null =>
  resolveSidebarTopStatus({
    status: node.rowStatus,
    goalActive: node.goalActive,
    isWoke: false,
    isUnread: node.unread,
  });

// Most urgent first, like the card's own status precedence.
const SUMMARY_ORDER: ReadonlyArray<SidebarTopStatus["icon"]> = [
  "approval",
  "input",
  "request",
  "failed",
  "working",
  "waiting",
  "done",
];

type SummaryPart = { status: SidebarTopStatus; count: number };

/** "1 working · 1 waiting" for a closed tree, in the card's labels, glyphs and colors. */
function summarizeSubagents(nodes: ReadonlyArray<SubagentNode>): SummaryPart[] {
  const byLabel = new Map<string, SummaryPart>();
  const visit = (list: ReadonlyArray<SubagentNode>) => {
    for (const node of list) {
      const status = topStatusOf(node);
      if (status !== null) {
        const part = byLabel.get(status.label);
        if (part) part.count += 1;
        else byLabel.set(status.label, { status, count: 1 });
      }
      visit(node.children);
    }
  };
  visit(nodes);
  return [...byLabel.values()].toSorted(
    (left, right) =>
      SUMMARY_ORDER.indexOf(left.status.icon) - SUMMARY_ORDER.indexOf(right.status.icon),
  );
}

/**
 * The parent row's surface states, mirrored onto the card frame. While a row has subagents its
 * own surface goes clear and the `<li>` paints one surface behind the row and its tree, so the
 * pair reads as a single card.
 */
export interface SubagentCardTone {
  readonly variant: "card" | "row";
  readonly active: boolean;
  readonly selected: boolean;
  readonly draft: boolean;
  readonly dragging: boolean;
  readonly fileDragOver: boolean;
}

const FRAME_BASE = cn(
  "relative before:pointer-events-none before:absolute before:inset-x-0 before:rounded-md",
  // The row keeps its focus ring and hover controls; only its fill and border move to the frame.
  "[&_[data-sidebar-row]]:bg-transparent! [&_[data-sidebar-row]]:bg-none!",
  "[&_[data-sidebar-row]:not(:focus-visible)]:[box-shadow:none]!",
);
const ROW_HOVER = "has-[[data-sidebar-row]:hover]:before:bg-sidebar-row-hover";
const LIGHT_EDGE =
  "light:before:ring-1 light:before:ring-inset light:before:ring-sidebar-border/70";

function frameClassName(tone: SubagentCardTone): string {
  return cn(
    FRAME_BASE,
    tone.variant === "card" ? "before:inset-y-0.5" : "before:inset-y-0",
    tone.dragging
      ? "before:bg-sidebar before:bg-linear-to-b before:from-sidebar-row-active before:to-sidebar-row-active before:shadow-lg"
      : tone.active
        ? cn("before:bg-sidebar-row-active", LIGHT_EDGE)
        : tone.selected
          ? cn("before:bg-sidebar-row-selected", LIGHT_EDGE)
          : tone.draft
            ? "before:bg-warning/4 has-[[data-sidebar-row]:hover]:before:bg-warning/8"
            : ROW_HOVER,
    tone.fileDragOver && "before:ring-1 before:ring-inset before:ring-primary/70",
    tone.fileDragOver && !tone.active && !tone.selected && "before:bg-sidebar-row-hover",
  );
}

/** Classes for the parent `<li>`: the shared card surface, or nothing when there is no tree. */
export function useSubagentCardClassName(
  parentKey: string,
  tone: SubagentCardTone,
): string | undefined {
  const enabled = useClientSettings((settings) => settings.sidebarShowSubagents);
  const hasSubagents = useHasSubagents(parentKey, enabled);
  return hasSubagents ? frameClassName(tone) : undefined;
}

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

function compactRelativeTime(timestamp: string, nowMinute: string): string {
  const label = formatRelativeTimeLabel(timestamp, Date.parse(`${nowMinute}:00.000Z`));
  if (label === "just now") return "now";
  return label.endsWith(" ago") ? label.slice(0, -4) : label;
}

function RelativeTime(props: { timestamp: string }) {
  const nowMinute = useNowMinute();
  return compactRelativeTime(props.timestamp, nowMinute);
}

type TreeProps = {
  parentKey: string;
  onActivate: (threadRef: ScopedThreadRef) => void;
  /** Where the parent's text starts, so the disclosure lines up under its title. */
  inset: "card" | "row" | "folder";
};

/** Subagents and delegated tasks, nested inside their parent's sidebar card. */
export const SidebarSubagentTree = memo(function SidebarSubagentTree(props: TreeProps) {
  const enabled = useClientSettings((settings) => settings.sidebarShowSubagents);
  if (!enabled) return null;
  return <SubagentTreeRoot {...props} />;
});

function SubagentTreeRoot(props: TreeProps) {
  const nodes = useSubagentTree(props.parentKey);
  if (nodes.length === 0) return null;
  return <SubagentDisclosure nodes={nodes} {...props} />;
}

function SubagentDisclosure(props: TreeProps & { nodes: ReadonlyArray<SubagentNode> }) {
  const { nodes } = props;
  const listId = useId();
  const [stored, setStored] = useStoredExpanded(props.parentKey);
  const routeKey = useRouteThreadKey();
  const expanded = resolveSubagentExpanded(stored, nodes, subagentTreeContains(nodes, routeKey));
  const total = countSubagents(nodes);
  const summary = expanded ? null : summarizeSubagents(nodes);
  return (
    <div
      data-thread-selection-safe
      onPointerDown={stopDragStart}
      className={cn(
        // Above the row's raised content, which the pull-up overlaps.
        "relative z-10 pe-1.5",
        props.inset === "card"
          ? "-mt-1.5 ps-(--sidebar-row-content-inset) pb-2"
          : props.inset === "folder"
            ? "-mt-1 ps-9 pb-1.5"
            : "-mt-1 ps-2.5 pb-1.5",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        onClick={() => setStored(!expanded)}
        className="-ms-0.5 flex h-5 max-w-full cursor-pointer items-center gap-1 overflow-hidden rounded-sm px-0.5 text-xs text-sidebar-muted-foreground outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "size-3 shrink-0 transition-transform motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
        <span className="shrink-0 tabular-nums">
          {total} {total === 1 ? "subagent" : "subagents"}
        </span>
        {summary !== null && summary.length > 0 ? (
          // Glyph and count per state, most urgent first; the words are for screen readers.
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="text-sidebar-muted-foreground/70">
              ·
            </span>
            {summary.map((part) => {
              const words = `${part.count} ${part.status.label.toLowerCase()}`;
              return (
                <span
                  key={part.status.label}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums",
                    part.status.className,
                  )}
                >
                  <TopStatusIcon icon={part.status.icon} className="size-3" />
                  <span aria-hidden>{part.count}</span>
                  <span className="sr-only">, {words}</span>
                </span>
              );
            })}
          </span>
        ) : null}
      </button>
      {expanded ? (
        <SubagentList
          id={listId}
          nodes={nodes}
          routeKey={routeKey}
          onActivate={props.onActivate}
          className="mt-0.5 ms-1.25"
        />
      ) : null}
    </div>
  );
}

function SubagentList(props: {
  id?: string;
  nodes: ReadonlyArray<SubagentNode>;
  routeKey: string | null;
  onActivate: (threadRef: ScopedThreadRef) => void;
  className?: string;
}) {
  return (
    // Preflight strips list styling, which drops list semantics in Safari; role restores them.
    <ul id={props.id} role="list" aria-label="Subagents" className={props.className}>
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
  const listId = useId();
  const [stored, setStored] = useStoredExpanded(node.key);
  const hasChildren = node.children.length > 0;
  const expanded =
    hasChildren &&
    resolveSubagentExpanded(stored, node.children, subagentTreeContains(node.children, routeKey));
  const isRoute = node.key === routeKey;
  const title = node.title.trim() || "Subagent";
  const topStatus = topStatusOf(node);
  return (
    <li
      className={cn(
        "relative ps-3",
        // Connector: a rail down the siblings that stops at the last child's elbow.
        "before:absolute before:start-0 before:top-0 before:h-full before:w-px before:bg-sidebar-border last:before:h-3",
      )}
    >
      <span aria-hidden className="absolute start-0 top-3 h-px w-2 bg-sidebar-border" />
      <div
        className={cn(
          "@container flex h-6 items-center rounded-md transition-colors motion-reduce:transition-none",
          isRoute
            ? "bg-sidebar-row-active text-sidebar-foreground light:ring-1 light:ring-inset light:ring-sidebar-border/70"
            : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover/60 hover:text-sidebar-foreground",
        )}
      >
        <button
          type="button"
          aria-current={isRoute ? "page" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            props.onActivate(node.ref);
          }}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md ps-1.5 pe-1 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span dir="auto" className="min-w-0 flex-1 truncate">
            {title}
          </span>
          {topStatus !== null ? (
            // The card's status slot, one size down: glyph always, words when they fit.
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-2xs font-medium",
                topStatus.className,
              )}
            >
              <TopStatusIcon icon={topStatus.icon} className="size-3" />
              <span className="sr-only @[9rem]:not-sr-only">{topStatus.label}</span>
              {node.since !== null ? (
                <span aria-hidden className="hidden @[11rem]:inline">
                  <WorkingDuration environmentId={node.ref.environmentId} startedAt={node.since} />
                </span>
              ) : null}
            </span>
          ) : node.activityAt !== null ? (
            <span
              aria-hidden
              className="hidden shrink-0 text-2xs tabular-nums text-secondary-label @[9rem]:inline"
            >
              <RelativeTime timestamp={node.activityAt} />
            </span>
          ) : null}
        </button>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              setStored(!expanded);
            }}
            className="me-0.5 flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-2xs tabular-nums text-sidebar-muted-foreground outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {countSubagents(node.children)}
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
        <SubagentList
          id={listId}
          nodes={node.children}
          routeKey={routeKey}
          onActivate={props.onActivate}
          className="ms-2"
        />
      ) : null}
    </li>
  );
}
