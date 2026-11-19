import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { resolveSidebarRowStatus } from "../../Sidebar.logic";

export type MascotMood = "idle" | "working" | "waiting" | "failed";
export type BusyMood = Exclude<MascotMood, "idle">;

export interface HerdMember {
  readonly key: string;
  readonly ref: ScopedThreadRef;
  readonly title: string;
  readonly mood: BusyMood;
}

type HerdThread = Pick<
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

const moodOrder: Record<BusyMood, number> = { waiting: 0, failed: 1, working: 2 };

/** Top-level threads that need a glance, most urgent first; subagents and side chats stay with their parent. */
export function buildMascotHerd(threads: ReadonlyArray<HerdThread>): ReadonlyArray<HerdMember> {
  return threads
    .flatMap((thread) => {
      if (
        thread.archivedAt !== null ||
        thread.lineage.sideChat === true ||
        thread.lineage.relationshipToParent === "subagent" ||
        thread.delegatedFrom != null
      )
        return [];
      const mood = resolveHerdMood(thread);
      if (mood === null) return [];
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      return [
        {
          key: scopedThreadKey(ref),
          ref,
          title: thread.title,
          mood,
          at: resolveThreadActivityTimestamp(thread) ?? "",
        },
      ];
    })
    .toSorted((a, b) => moodOrder[a.mood] - moodOrder[b.mood] || b.at.localeCompare(a.at))
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
