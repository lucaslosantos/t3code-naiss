import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import {
  AuthSourceControlWriteScope,
  type ProjectId,
  type PullRequestRef,
  type ScopedThreadRef,
  type VcsStatusResult,
} from "@t3tools/contracts";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { usePullRequestStack } from "~/state/usePullRequestStack";
import { useGT } from "gt-react";
import type { ReactNode } from "react";
import "./worktreePrBar.css";
import { ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";
import { openOnHostLabel } from "../pullRequest/pullRequestLinkContextMenu";
import { readLocalApi } from "~/localApi";
import { Group, GroupSeparator } from "../ui/group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { useRightPanelStore } from "~/rightPanelStore";
import { useEnvironmentScope } from "~/state/session";
import { Button } from "../ui/button";
import { PullRequestStackPopover } from "../pullRequest/PullRequestStackPopover";
import {
  classifyPullRequestChecks,
  resolveThreadPanelPullRequestAction,
} from "../pullRequest/pullRequestDetail.logic";
import { usePullRequestDetail } from "../pullRequest/usePullRequestDetail";
import { ContinueWorktreeButton } from "./ContinueWorktreeButton";
import { useQuietThreadShell } from "~/state/entities";
import { useThreadDisplayedPullRequest } from "../ThreadStatusIndicators";
import { resolveWorktreeBarPr } from "./worktreePrBar.logic";

type BarProps = {
  thread: ScopedThreadRef;
  projectId: ProjectId;
  pr: VcsStatusResult["pr"];
  branch: string | null;
  onPrompt: (prompt: string) => void;
};

type RowTone = "merged" | "closed" | "blocked" | "ready" | "neutral" | "draft" | "danger" | "open";

function PrRow({ tone, children }: { tone: RowTone; children: ReactNode }) {
  return (
    <div
      data-worktree-pr-tone={tone}
      className="flex min-h-12 shrink-0 items-center flex-wrap justify-start gap-2 border-b border-border px-4 py-2.5"
    >
      {children}
    </div>
  );
}

function BranchPrRow({
  thread,
  pr,
  children,
}: {
  thread: ScopedThreadRef;
  pr: NonNullable<BarProps["pr"]>;
  children: ReactNode;
}) {
  const gt = useGT();
  const tone = pr.state === "open" && pr.isDraft ? "draft" : pr.state;
  const label = {
    open: gt("Open"),
    draft: gt("Draft"),
    merged: gt("Merged"),
    closed: gt("Closed"),
  }[tone];
  return (
    <PrRow tone={tone}>
      {children}
      <div className="ml-auto flex items-center gap-2">
        {tone === "merged" && <ContinueWorktreeButton thread={thread} />}
        <span data-worktree-pr-state>{label}</span>
      </div>
    </PrRow>
  );
}

function LinkedActions({
  thread,
  reference,
  pr,
  children,
  onPrompt,
}: Pick<BarProps, "thread" | "onPrompt"> & {
  reference: PullRequestRef;
  pr: NonNullable<BarProps["pr"]>;
  children: ReactNode;
}) {
  const gt = useGT();
  const { detail, sharedSummary, canWriteSourceControl, detailQuery } = usePullRequestDetail(
    thread.environmentId,
    reference,
    null,
  );
  const stackQuery = usePullRequestStack(
    thread.environmentId,
    detail?.capabilities.stacks ? reference : null,
  );
  if (!detail)
    return (
      <BranchPrRow thread={thread} pr={pr}>
        {children}
      </BranchPrRow>
    );
  const stack = stackQuery.data;
  const index = stack?.layers.findIndex((layer) => layer.number === reference.number) ?? -1;
  const membership =
    stack && index >= 0
      ? { number: stack.number, position: index + 1, size: stack.layers.length, base: stack.base }
      : sharedSummary?.stack;
  const prerequisite = stack?.layers
    .slice(0, Math.max(0, index))
    .find((layer) => layer.state !== "merged");
  const checks = classifyPullRequestChecks(detail.checks);
  const blocked = prerequisite
    ? gt("Merge #{number} first", { number: prerequisite.number })
    : sharedSummary?.reviewDecision === "changes-requested"
      ? gt("Changes requested")
      : sharedSummary?.reviewDecision === "review-required"
        ? gt("Review required")
        : checks === "pending"
          ? gt("Checks running")
          : checks === "failing"
            ? gt("Checks failing")
            : detail.rebaseRequired
              ? gt("Update required")
              : null;
  const action = resolveThreadPanelPullRequestAction(detail);
  const ready =
    action === "merge" &&
    !blocked &&
    detail.mergeability === "mergeable" &&
    detailQuery.isSuccess &&
    (!detail.capabilities.stacks || stackQuery.isFresh);
  const labels = {
    resolve: gt("Resolve conflicts"),
    fix: gt("Fix checks"),
    ready: gt("Mark ready"),
    merge: gt("Merge"),
  };
  const prompts = {
    resolve: "Resolve the merge conflicts for",
    fix: "Investigate and fix the failing checks for",
    ready: "Mark this draft ready for review:",
    merge:
      "Verify required checks, reviews and stack dependencies, then merge this pull request if ready:",
  };
  const state = ((): { tone: RowTone; label: string } => {
    if (detail.state === "merged") return { tone: "merged", label: gt("Merged") };
    if (detail.state === "closed") return { tone: "closed", label: gt("Closed") };
    if (detail.mergeability === "conflicting") return { tone: "danger", label: gt("Conflicts") };
    if (detail.isInMergeQueue) return { tone: "blocked", label: gt("Queued") };
    if (checks === "failing") return { tone: "danger", label: gt("Checks failing") };
    if (blocked) return { tone: "blocked", label: blocked };
    if (detail.isDraft) return { tone: "draft", label: gt("Draft") };
    if (ready) return { tone: "ready", label: gt("Ready to merge") };
    return { tone: "open", label: gt("Open") };
  })();
  return (
    <PrRow tone={state.tone}>
      {children}
      {membership && (
        <div data-worktree-pr-stack>
          <PullRequestStackPopover
            environmentId={thread.environmentId}
            reference={reference}
            membership={membership}
            onSelect={(target) =>
              useRightPanelStore.getState().openPullRequest(thread, {
                projectId: target.projectId,
                repository: target.repository,
                number: target.number,
                ...(target.host ? { host: target.host } : {}),
              })
            }
          />
        </div>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {action &&
          !detail.isInMergeQueue &&
          (action !== "merge" || ready) &&
          canWriteSourceControl &&
          detailQuery.isSuccess && (
            <Button
              size="compact"
              variant="outline"
              onClick={() => onPrompt(`${prompts[action]} ${detail.url}`)}
            >
              {labels[action]}
            </Button>
          )}
        {detail.state === "merged" && <ContinueWorktreeButton thread={thread} />}
        <span data-worktree-pr-state>{state.label}</span>
      </div>
    </PrRow>
  );
}

export function WorktreePrBar({ thread, projectId, pr: branchPr, branch, onPrompt }: BarProps) {
  const gt = useGT();
  const shell = useQuietThreadShell(thread);
  const linked = useThreadDisplayedPullRequest(thread.environmentId, shell).pr;
  const pr = resolveWorktreeBarPr(branchPr, linked, branch);
  const canWrite = useEnvironmentScope(thread.environmentId, AuthSourceControlWriteScope);
  const parsed = pr && sourceControlClients.parseChangeRequestUrl(pr.url);
  const prLink = parsed?.link;
  if (!pr && !canWrite) return null;
  if (pr) {
    const hostLabel = openOnHostLabel(parsed?.definition ?? sourceControlClients.get(undefined));
    const openExternal = () => void readLocalApi()?.shell.openExternal(pr.url);
    const number = (
      <Group>
        <Button
          size="compact"
          variant="outline"
          title={pr.title}
          onClick={() =>
            prLink
              ? useRightPanelStore.getState().openPullRequest(thread, {
                  projectId,
                  host: prLink.host,
                  repository: prLink.repository,
                  number: pr.number,
                  url: pr.url,
                })
              : openExternal()
          }
        >
          <PullRequestGlyph.pullRequest />#{pr.number}
        </Button>
        <GroupSeparator />
        <Menu>
          <MenuTrigger
            aria-label={gt("Pull request options")}
            render={<Button size="compact" variant="outline" />}
          >
            <ChevronDownIcon />
          </MenuTrigger>
          <MenuPopup align="start">
            <MenuItem onClick={openExternal}>
              <ArrowUpRightIcon />
              {hostLabel}
            </MenuItem>
          </MenuPopup>
        </Menu>
      </Group>
    );
    if (!prLink)
      return (
        <BranchPrRow thread={thread} pr={pr}>
          {number}
        </BranchPrRow>
      );
    return (
      <LinkedActions
        thread={thread}
        pr={pr}
        reference={{
          projectId,
          host: prLink.host,
          repository: prLink.repository,
          number: pr.number,
        }}
        onPrompt={onPrompt}
      >
        {number}
      </LinkedActions>
    );
  }
  return (
    <PrRow tone="neutral">
      <div className="ml-auto">
        <Button
          size="compact"
          variant="outline"
          onClick={() =>
            onPrompt(
              "Review the changes in this worktree and create a pull request against its intended base branch. If this branch belongs to a stack, preserve its base. Link the pull request to this thread.",
            )
          }
        >
          <PullRequestGlyph.pullRequest />
          {gt("Create PR")}
        </Button>
      </div>
    </PrRow>
  );
}
