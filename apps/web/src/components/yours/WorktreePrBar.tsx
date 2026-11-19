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
import { cn } from "~/lib/utils";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { useRightPanelStore } from "~/rightPanelStore";
import { useEnvironmentScope } from "~/state/session";
import { Button } from "../ui/button";
import { PullRequestStackPopover } from "../pullRequest/PullRequestStackPopover";
import {
  classifyPullRequestChecks,
  resolveThreadPanelPullRequestAction,
} from "../pullRequest/pullRequestDetail.logic";
import { usePullRequestDetail } from "../pullRequest/usePullRequestDetail";

type BarProps = {
  thread: ScopedThreadRef;
  projectId: ProjectId;
  pr: VcsStatusResult["pr"];
  onPrompt: (prompt: string) => void;
};

function LinkedActions({
  thread,
  reference,
  onPrompt,
}: Pick<BarProps, "thread" | "onPrompt"> & { reference: PullRequestRef }) {
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
  if (!detail) return null;
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
  return (
    <>
      {membership && (
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
      )}
      <span
        className={cn(
          "ml-auto truncate text-xs text-muted-foreground",
          blocked && "text-warning",
          ready && "text-success",
        )}
      >
        {detail.state !== "open"
          ? detail.state === "merged"
            ? gt("Merged")
            : gt("Closed")
          : blocked
            ? blocked
            : ready
              ? gt("Ready to merge")
              : detail.isDraft
                ? gt("Draft")
                : gt("Open")}
      </span>
      {action &&
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
    </>
  );
}

export function WorktreePrBar({ thread, projectId, pr, onPrompt }: BarProps) {
  const gt = useGT();
  const open = useOpenPrLink(thread);
  const canWrite = useEnvironmentScope(thread.environmentId, AuthSourceControlWriteScope);
  const link = pr && sourceControlClients.parseChangeRequestUrl(pr.url)?.link;
  if (!pr && !canWrite) return null;
  return (
    <div className="flex min-h-9 shrink-0 items-center justify-end gap-2 border-b border-border px-3 py-1">
      {pr ? (
        <>
          <Button
            size="compact"
            variant="ghost"
            title={pr.title}
            onClick={(event) => open(event, pr.url)}
          >
            <PullRequestGlyph.pullRequest />#{pr.number}
          </Button>
          {link && (
            <LinkedActions
              thread={thread}
              reference={{
                projectId,
                host: link.host,
                repository: link.repository,
                number: pr.number,
              }}
              onPrompt={onPrompt}
            />
          )}
        </>
      ) : (
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
      )}
    </div>
  );
}
