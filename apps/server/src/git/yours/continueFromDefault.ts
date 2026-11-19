import * as Effect from "effect/Effect";

import {
  GitCommandError,
  type VcsContinueFromDefaultInput,
  type VcsContinueFromDefaultResult,
} from "@t3tools/contracts";

import type * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";

/** `feature` → `feature-2`, `feature-2` → `feature-3`, skipping names already taken. */
export function nextContinuationBranchName(
  current: string,
  existingBranchNames: readonly string[],
): string {
  const taken = new Set(existingBranchNames.map((name) => name.toLowerCase()));
  const match = /^(.*?)-(\d+)$/.exec(current);
  const stem = match?.[1] || current;
  let suffix = match ? Number(match[2]) + 1 : 2;
  while (taken.has(`${stem}-${suffix}`.toLowerCase())) suffix += 1;
  return `${stem}-${suffix}`;
}

const refuse = (cwd: string, detail: string) =>
  new GitCommandError({
    operation: "GitWorkflowService.continueFromDefault",
    command: "git",
    cwd,
    detail,
  });

/**
 * Fork-only: Conductor's "Continue" for a merged worktree. Keeps the checkout (and the thread's
 * chat and ignored files) but moves it onto a new branch cut from the freshly fetched default branch.
 */
export const continueFromDefault = Effect.fn("GitWorkflowService.continueFromDefault")(function* (
  git: GitVcsDriver.GitVcsDriver["Service"],
  input: VcsContinueFromDefaultInput,
) {
  const { cwd } = input;
  const status = yield* git.statusDetails(cwd);
  if (status.hasWorkingTreeChanges)
    return yield* refuse(cwd, "Commit or discard the changes in this worktree first.");
  if (!status.branch) return yield* refuse(cwd, "This worktree is not on a branch.");

  const remoteName = yield* git.resolvePrimaryRemoteName(cwd);
  const defaultBranch = yield* git.resolveDefaultBranchName(cwd, remoteName);
  if (!defaultBranch) return yield* refuse(cwd, "Could not find the repository's default branch.");
  const base = yield* git.fetchWorktreeBaseCommit({
    cwd,
    refName: defaultBranch,
    remote: { remoteName, branchName: defaultBranch },
  });
  if (!base) return yield* refuse(cwd, `Could not fetch ${remoteName}/${defaultBranch}.`);

  const refName = nextContinuationBranchName(status.branch, yield* git.listLocalBranchNames(cwd));
  // A commit start point leaves the branch without an upstream, so a push publishes it.
  yield* git.createBranch({ cwd, branch: refName, startPoint: base.commitSha });
  // Same keys createWorktree records, so diffs and PRs compare against the default branch.
  yield* git.writeConfigValue({
    cwd,
    key: `branch.${refName}.t3-merge-base`,
    value: defaultBranch,
  });
  yield* git.writeConfigValue({
    cwd,
    key: `branch.${refName}.t3-merge-base-ref`,
    value: `refs/remotes/${base.remoteRefName}`,
  });
  yield* Effect.scoped(git.switchRef({ cwd, refName }));
  return { refName, baseRefName: defaultBranch } satisfies VcsContinueFromDefaultResult;
});
