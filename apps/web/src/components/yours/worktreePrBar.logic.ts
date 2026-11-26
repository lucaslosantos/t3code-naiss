import type { VcsStatusResult } from "@t3tools/contracts";

type Pr = VcsStatusResult["pr"];

/**
 * Fork-only: the bar describes the branch the worktree is on now. The branch's own PR wins; a
 * thread-linked PR counts only while it is open or was opened from this branch, so a merged PR
 * from earlier work doesn't stand in for a new branch that has none yet.
 */
export function resolveWorktreeBarPr(branchPr: Pr, linkedPr: Pr, branch: string | null): Pr {
  if (branchPr) return branchPr;
  if (!linkedPr) return null;
  return linkedPr.state === "open" || linkedPr.headRef === branch ? linkedPr : null;
}
