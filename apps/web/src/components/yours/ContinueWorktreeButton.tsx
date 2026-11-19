import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  GitCommandError,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useGT } from "gt-react";
import { FastForwardIcon } from "lucide-react";
import { useState } from "react";
import { m } from "~/i18n/messages";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { vcsEnvironment } from "~/state/vcs";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";

const isGitCommandError = Schema.is(GitCommandError);

/** Fork-only: Conductor's "Continue" — keep this worktree and chat, start over from the latest main. */
export function ContinueWorktreeButton({ thread }: { thread: ScopedThreadRef }) {
  const gt = useGT();
  const shell = useQuietThreadShell(thread);
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const continueFromDefault = useAtomCommand(vcsEnvironment.continueFromDefault, {
    reportFailure: false,
  });
  const updateMetadata = useAtomCommand(threadEnvironment.updateMetadata, "thread metadata update");
  const [pending, setPending] = useState(false);
  const worktreePath = shell?.worktreePath ?? null;
  if (!worktreePath || !canOperate) return null;

  const run = async () => {
    setPending(true);
    const result = await continueFromDefault({
      environmentId: thread.environmentId,
      input: { cwd: worktreePath },
    });
    setPending(false);
    if (result._tag === "Success") {
      const { refName, baseRefName } = result.value;
      void updateMetadata({
        environmentId: thread.environmentId,
        input: { threadId: thread.threadId, branch: refName, worktreePath },
      });
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: gt("Continuing on {branch}", { branch: refName }),
          description: gt("Fresh from the latest {base}.", { base: baseRefName }),
        }),
      );
      return;
    }
    if (isAtomCommandInterrupted(result)) return;
    const error = squashAtomCommandFailure(result);
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: gt("Couldn't continue."),
        description: isGitCommandError(error)
          ? error.detail
          : (thrownErrorMessage(error, m) ?? undefined),
      }),
    );
  };

  return (
    <Button
      size="compact"
      variant="outline"
      disabled={pending}
      title={gt("Start a new branch from the latest main in this worktree")}
      onClick={() => void run()}
      data-worktree-pr-continue
    >
      <FastForwardIcon />
      {gt("Continue")}
    </Button>
  );
}
