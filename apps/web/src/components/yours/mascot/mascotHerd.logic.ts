import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  effectiveSnoozed,
  type ThreadSnoozeShell,
} from "@t3tools/client-runtime/state/thread-settled";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { isLatestRunSettled } from "../../../session-logic";
import { hasUnseenCompletion, resolveSidebarRowStatus } from "../../Sidebar.logic";

export type MascotMood = "idle" | "working" | "waiting" | "failed" | "unread";
type BusyMood = Exclude<MascotMood, "idle">;

export interface HerdMember {
  readonly key: string;
  readonly ref: ScopedThreadRef;
  readonly title: string;
  readonly mood: MascotMood;
}

type HerdThread = Pick<
  EnvironmentThreadShell,
  | "environmentId"
  | "id"
  | "title"
  | "lineage"
  | "delegatedFrom"
  | "archivedAt"
  | "settledOverride"
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
  | "interactionMode"
  | "hasActionableProposedPlan"
> &
  ThreadSnoozeShell;

function resolveHerdMood(thread: HerdThread): BusyMood | null {
  switch (resolveSidebarRowStatus(thread)) {
    case "approval":
    case "input":
    case "request":
    case "limited":
      return "waiting";
    case "preparing":
    case "working":
      return "working";
    case "waiting":
      return thread.runtime?.status === "running" ? "working" : null;
    case "failed":
      return "failed";
    case "ready":
      if (
        thread.interactionMode === "plan" &&
        thread.hasActionableProposedPlan &&
        isLatestRunSettled(thread.latestRun, thread.runtime)
      )
        return "waiting";
      return hasUnseenCompletion(thread) ? "unread" : null;
  }
}

const moodOrder: Record<MascotMood, number> = {
  waiting: 0,
  failed: 1,
  unread: 2,
  working: 3,
  idle: 4,
};

/** Moods that want the user: they peek out of the stack, count on the badge and come up next. */
export function wantsYou(mood: MascotMood): boolean {
  return mood === "waiting" || mood === "failed" || mood === "unread";
}

/**
 * Every top-level thread that is not settled, so the stack is whole from the first render after a
 * restart. Threads that want you come first, longest waiting first so none goes stale; the rest
 * follow by most recent visit, then latest activity. Subagents, side chats and snoozed threads stay
 * out. `visits` holds thread keys, most recent first.
 */
export function buildMascotHerd(
  threads: ReadonlyArray<HerdThread>,
  visits: ReadonlyArray<string> = [],
  now: string = new Date().toISOString(),
): ReadonlyArray<HerdMember> {
  const visitRank = (key: string) => {
    const index = visits.indexOf(key);
    return index === -1 ? visits.length : index;
  };
  return threads
    .flatMap((thread) => {
      if (
        thread.archivedAt !== null ||
        thread.settledOverride === "settled" ||
        thread.lineage.sideChat === true ||
        thread.lineage.relationshipToParent === "subagent" ||
        thread.delegatedFrom != null ||
        effectiveSnoozed(thread, { now })
      )
        return [];
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      const key = scopedThreadKey(ref);
      return [
        {
          key,
          ref,
          title: thread.title,
          mood: resolveHerdMood(thread) ?? ("idle" as MascotMood),
          at: resolveThreadActivityTimestamp(thread) ?? "",
        },
      ];
    })
    .toSorted(
      (a, b) =>
        moodOrder[a.mood] - moodOrder[b.mood] ||
        (wantsYou(a.mood)
          ? a.at.localeCompare(b.at)
          : visitRank(a.key) - visitRank(b.key) || b.at.localeCompare(a.at)),
    )
    .map(({ at: _at, ...member }) => member);
}

/** The thread "Next unread" opens: the first one in the herd that wants you, other than the open one. */
export function nextForYou(
  herd: ReadonlyArray<HerdMember>,
  currentKey: string | null,
): HerdMember | null {
  return herd.find((member) => member.key !== currentKey && wantsYou(member.mood)) ?? null;
}

export function sameHerd(left: ReadonlyArray<HerdMember>, right: ReadonlyArray<HerdMember>) {
  return (
    left.length === right.length &&
    left.every((member, index) => {
      const other = right[index]!;
      return member.key === other.key && member.title === other.title && member.mood === other.mood;
    })
  );
}
