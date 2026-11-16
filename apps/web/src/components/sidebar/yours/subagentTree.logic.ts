import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  hasUnseenCompletion,
  resolveSidebarRowStatus,
  resolveSidebarThreadStatus,
  resolveWorkingStartedAt,
  type SidebarThreadStatus,
} from "../../Sidebar.logic";

export type SubagentStatus = "working" | "attention" | "failed" | "done" | "idle";

export interface SubagentNode {
  readonly key: string;
  readonly ref: ScopedThreadRef;
  readonly title: string;
  readonly status: SubagentStatus;
  /** The row status a thread card would show, so children speak the card's status language. */
  readonly rowStatus: SidebarThreadStatus;
  /** A finished run the user has not opened yet ("Done"). */
  readonly unread: boolean;
  readonly goalActive: boolean;
  /** When the current working or waiting stretch began, for "Working 2m" / "Waiting 5m". */
  readonly since: string | null;
  /** Last send or run time, shown when the status has nothing to say. */
  readonly activityAt: string | null;
  readonly children: ReadonlyArray<SubagentNode>;
  /** Whether this node or anything below it is working. */
  readonly working: boolean;
}

export const NO_SUBAGENTS: ReadonlyArray<SubagentNode> = Object.freeze([]);

type LineageThread = Pick<
  EnvironmentThreadShell,
  | "environmentId"
  | "id"
  | "title"
  | "lineage"
  | "delegatedFrom"
  | "archivedAt"
  | "runtime"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "blockedOnThreadWait"
  | "latestRun"
  | "latestUserMessageAt"
  | "updatedAt"
  | "lastVisitedAt"
  | "goal"
  | "interactionMode"
  | "hasActionableProposedPlan"
>;

function subagentStatus(thread: LineageThread): SubagentStatus {
  switch (resolveSidebarThreadStatus(thread)) {
    case "approval":
    case "input":
    case "request":
    case "limited":
      return "attention";
    case "preparing":
    case "working":
      return "working";
    case "failed":
      return "failed";
    case "waiting":
      // An idle runtime is a parked child; a run blocked on its own children is still working.
      return thread.runtime?.status === "running" ? "working" : "idle";
    default:
      return thread.latestRun === null ? "idle" : "done";
  }
}

/**
 * The listed parent a child thread nests under: a subagent under the thread that spawned it,
 * or a delegated task under the thread that delegated it when that parent is listed
 * (`delegatedUnderParent`). Side chats and forks stay out: side chats live in the parent's view,
 * forks are threads of their own.
 */
function subagentParentKey(
  thread: LineageThread,
  delegatedUnderParent: ReadonlySet<string>,
): string | null {
  if (thread.archivedAt !== null || thread.lineage.sideChat === true) return null;
  if (thread.lineage.relationshipToParent === "subagent") {
    const parentId = thread.lineage.parentThreadId;
    return parentId === null
      ? null
      : scopedThreadKey(scopeThreadRef(thread.environmentId, parentId));
  }
  const from = thread.delegatedFrom;
  if (from == null) return null;
  const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
  return delegatedUnderParent.has(key)
    ? scopedThreadKey(scopeThreadRef(from.environmentId, from.threadId))
    : null;
}

export interface SubagentIndex {
  readonly childrenByParent: ReadonlyMap<string, ReadonlyArray<LineageThread>>;
}

export function buildSubagentIndex(
  threads: ReadonlyArray<LineageThread>,
  delegatedUnderParent: ReadonlySet<string>,
): SubagentIndex {
  const childrenByParent = new Map<string, LineageThread[]>();
  for (const thread of threads) {
    const parentKey = subagentParentKey(thread, delegatedUnderParent);
    if (parentKey === null) continue;
    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(thread);
    else childrenByParent.set(parentKey, [thread]);
  }
  return { childrenByParent };
}

/** The nested children of `parentKey`, in spawn order. Cycles end at the first repeat. */
export function buildSubagentTree(
  index: SubagentIndex,
  parentKey: string,
  seen: Set<string> = new Set([parentKey]),
): ReadonlyArray<SubagentNode> {
  const children = index.childrenByParent.get(parentKey);
  if (children === undefined) return NO_SUBAGENTS;
  const nodes: SubagentNode[] = [];
  for (const thread of children) {
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    const key = scopedThreadKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    const grandchildren = buildSubagentTree(index, key, seen);
    const status = subagentStatus(thread);
    const rowStatus = resolveSidebarRowStatus(thread);
    nodes.push({
      key,
      ref,
      title: thread.title,
      status,
      rowStatus,
      unread: hasUnseenCompletion(thread),
      goalActive: thread.goal?.status === "active",
      since:
        rowStatus === "preparing" || rowStatus === "working"
          ? resolveWorkingStartedAt(thread)
          : rowStatus === "waiting"
            ? (thread.latestRun?.completedAt ?? null)
            : null,
      activityAt: resolveThreadActivityTimestamp(thread),
      children: grandchildren,
      working: status === "working" || grandchildren.some((child) => child.working),
    });
  }
  return nodes.length === 0 ? NO_SUBAGENTS : nodes;
}

export function countSubagents(nodes: ReadonlyArray<SubagentNode>): number {
  return nodes.reduce((count, node) => count + 1 + countSubagents(node.children), 0);
}

/** Equal trees render the same, so atoms keep the previous value and rows skip rendering. */
export function sameSubagentTree(
  left: ReadonlyArray<SubagentNode>,
  right: ReadonlyArray<SubagentNode>,
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((node, index) => {
        const other = right[index]!;
        return (
          node.key === other.key &&
          node.title === other.title &&
          node.status === other.status &&
          node.rowStatus === other.rowStatus &&
          node.unread === other.unread &&
          node.goalActive === other.goalActive &&
          node.since === other.since &&
          node.activityAt === other.activityAt &&
          node.working === other.working &&
          sameSubagentTree(node.children, other.children)
        );
      }))
  );
}

/** Rows start collapsed and open on their own while a child works, until the user chooses. */
export function resolveSubagentExpanded(
  stored: boolean | null,
  nodes: ReadonlyArray<SubagentNode>,
  containsRouteThread: boolean,
): boolean {
  if (stored !== null) return stored;
  return containsRouteThread || nodes.some((node) => node.working);
}

export function subagentTreeContains(
  nodes: ReadonlyArray<SubagentNode>,
  key: string | null,
): boolean {
  if (key === null) return false;
  return nodes.some((node) => node.key === key || subagentTreeContains(node.children, key));
}
