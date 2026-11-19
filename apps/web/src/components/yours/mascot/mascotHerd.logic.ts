import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { resolveSidebarRowStatus } from "../../Sidebar.logic";

export type MascotMood = "idle" | "working" | "waiting" | "failed";
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
>;

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
    default:
      return null;
  }
}

const moodOrder: Record<MascotMood, number> = { waiting: 0, failed: 1, working: 2, idle: 2 };

/**
 * Top-level threads that are busy or were just visited and not settled, most urgent first, then most recently
 * visited, so the thread you leave takes a place in the stack. Subagents and side chats stay with
 * their parent. `visits` holds thread keys, most recent first.
 */
export function buildMascotHerd(
  threads: ReadonlyArray<HerdThread>,
  visits: ReadonlyArray<string> = [],
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
        thread.delegatedFrom != null
      )
        return [];
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      const key = scopedThreadKey(ref);
      const mood: MascotMood | null =
        resolveHerdMood(thread) ?? (visits.includes(key) ? "idle" : null);
      if (mood === null) return [];
      return [
        {
          key,
          ref,
          title: thread.title,
          mood,
          at: resolveThreadActivityTimestamp(thread) ?? "",
        },
      ];
    })
    .toSorted(
      (a, b) =>
        moodOrder[a.mood] - moodOrder[b.mood] ||
        visitRank(a.key) - visitRank(b.key) ||
        b.at.localeCompare(a.at),
    )
    .map(({ at: _at, ...member }) => member);
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
