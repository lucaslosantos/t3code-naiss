// Fork-only: the review row in the thread details card. Like project scripts, the main part runs
// the project's default workflow and the chevron lists every workflow. A run asks the thread's
// agent to start one reviewer per model with `delegate_task` and merge what they find.
import { useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import {
  AuthOrchestrationOperateScope,
  type ProviderInstanceId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { T, useGT, Var } from "gt-react";
import { ChevronDownIcon, PlusIcon, ScanSearchIcon, SettingsIcon, StarIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useEnvironmentSettings } from "~/hooks/useSettings";
import { m } from "~/i18n/messages";
import { cn, newMessageId, randomUUID } from "~/lib/utils";
import { providerInstanceEntriesFor, type ProviderInstanceEntry } from "~/providerInstances";
import { useQuietThreadShell } from "~/state/entities";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { useEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { DEFAULT_INTERACTION_MODE } from "~/types";
import { ProviderInstanceIcon } from "../../chat/ProviderInstanceIcon";
import { ThreadDetailsControl } from "../../chat/ThreadDetailsControl";
import {
  THREAD_DETAILS_PANEL_CHEVRON_CLASS,
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS,
} from "../../chat/threadDetailsPanelStyles";
import { Button } from "../../ui/button";
import {
  Menu,
  MenuItem,
  MenuItemLabel,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../../ui/menu";
import { toastManager } from "../../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";
import { ReviewWorkflowDialog, type ReviewWorkflowEditorRequest } from "./ReviewWorkflowDialog";
import {
  buildReviewPrompt,
  defaultReviewWorkflow,
  STANDARD_REVIEW_PROMPT,
  STANDARD_WORKFLOW_ID,
  type ReviewWorkflow,
} from "./reviewWorkflows.logic";
import { useProjectReviewWorkflows } from "./reviewWorkflowsStore";

function ReviewerIcons({
  workflow,
  entryFor,
}: {
  workflow: ReviewWorkflow;
  entryFor: (instanceId: ProviderInstanceId) => ProviderInstanceEntry | undefined;
}) {
  return (
    <span className="flex shrink-0 -space-x-1" aria-hidden>
      {workflow.reviewers.map((reviewer, index) => {
        const entry = entryFor(reviewer.instanceId);
        return entry ? (
          <ProviderInstanceIcon
            // oxlint-disable-next-line react/no-array-index-key -- the same model can repeat
            key={index}
            driverKind={entry.driverKind}
            displayName={entry.displayName}
            accentColor={entry.accentColor}
            acpRegistryAgentId={entry.acpRegistryAgentId}
            acpRegistryIconUrl={entry.acpRegistryIconUrl}
            className="size-4 rounded-full bg-popover ring-2 ring-popover"
            iconClassName="size-4"
          />
        ) : null;
      })}
    </span>
  );
}

export function ThreadReviewRow({ thread }: { thread: ScopedThreadRef }) {
  const shell = useQuietThreadShell(thread);
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  if (!shell || !canOperate) return null;
  return <ProjectReviewRow thread={thread} shell={shell} />;
}

function ProjectReviewRow({
  thread,
  shell,
}: {
  thread: ScopedThreadRef;
  shell: NonNullable<ReturnType<typeof useQuietThreadShell>>;
}) {
  const gt = useGT();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [editor, setEditor] = useState<ReviewWorkflowEditorRequest | null>(null);
  const settings = useEnvironmentSettings(thread.environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(thread.environmentId)) ??
    EMPTY_SERVER_PROVIDERS;
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  const setInteractionMode = useOrchestrationCommand(threadEnvironment.setInteractionMode, {
    reportFailure: false,
  });
  const threadModel = {
    instanceId: shell.modelSelection.instanceId,
    model: shell.modelSelection.model,
  };
  const { state, save, remove } = useProjectReviewWorkflows(thread.environmentId, shell.projectId, {
    id: STANDARD_WORKFLOW_ID,
    name: gt("Standard", { $context: "name of the built-in review workflow" }),
    prompt: STANDARD_REVIEW_PROMPT,
    afterReview: "",
    reviewers: [threadModel],
  });

  const entries = providerInstanceEntriesFor(providers, settings, shell.projectId);
  const entryFor = (instanceId: ProviderInstanceId) =>
    entries.find((entry) => entry.instanceId === instanceId);
  const primary = defaultReviewWorkflow(state) ?? state.workflows[0];
  if (!primary) return null;

  const openEditor = (workflow: ReviewWorkflow, isNew: boolean) => {
    setMenuOpen(false);
    setEditor({
      workflow,
      isNew,
      isDefault: !isNew && workflow.id === primary.id,
      isOnly: !isNew && state.workflows.length === 1,
    });
  };

  const failed = (result: Parameters<typeof squashAtomCommandFailure>[0]) =>
    toastManager.add({
      type: "error",
      title: gt("Could not request the review"),
      description: thrownErrorMessage(squashAtomCommandFailure(result), m) ?? undefined,
    });

  const request = async (workflow: ReviewWorkflow) => {
    // A thread left in Plan mode would only plan the review instead of starting it.
    if (shell.interactionMode !== DEFAULT_INTERACTION_MODE) {
      const modeResult = await setInteractionMode({
        environmentId: thread.environmentId,
        input: {
          threadId: thread.threadId,
          interactionMode: DEFAULT_INTERACTION_MODE,
          createdAt: new Date().toISOString(),
        },
      });
      if (modeResult._tag === "Failure") {
        failed(modeResult);
        return;
      }
    }
    const result = await startTurn({
      environmentId: thread.environmentId,
      input: {
        threadId: thread.threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: buildReviewPrompt(workflow),
          attachments: [],
        },
        runtimeMode: shell.runtimeMode,
        interactionMode: DEFAULT_INTERACTION_MODE,
        dispatchMode: "queue",
      },
    });
    if (result._tag === "Failure") {
      failed(result);
      return;
    }
    toastManager.add({
      type: "success",
      title: gt("{name} review requested", { name: workflow.name }),
      description: gt("The agent starts the reviewers and merges what they find."),
    });
  };

  const run = async (workflow: ReviewWorkflow) => {
    if (running) return;
    const missing = workflow.reviewers.filter((reviewer) => {
      const entry = entryFor(reviewer.instanceId);
      return !entry || !entry.enabled || !entry.isAvailable;
    });
    if (missing.length > 0) {
      toastManager.add({
        type: "error",
        title: gt("Some models are not available here"),
        description: missing
          .map((reviewer) => entryFor(reviewer.instanceId)?.displayName ?? reviewer.instanceId)
          .join(", "),
      });
      openEditor(workflow, false);
      return;
    }
    setRunning(true);
    await request(workflow);
    setRunning(false);
  };

  return (
    <>
      <div
        role="group"
        aria-label={gt("Review workflows")}
        className={THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS}
        ref={anchorRef}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <ThreadDetailsControl
                size="xs"
                variant="ghost"
                part="primary"
                panel
                aria-label={gt("Run {name} review", { name: primary.name })}
                aria-disabled={running || undefined}
                onClick={() => void run(primary)}
              />
            }
          >
            <ScanSearchIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} aria-hidden />
            <span className={cn("min-w-0 truncate", THREAD_DETAILS_PANEL_LABEL_CLASS)}>
              <T>
                Review ·{" "}
                <span className="text-muted-foreground">
                  <Var>{primary.name}</Var>
                </span>
              </T>
            </span>
            <span className="ms-auto flex">
              <ReviewerIcons workflow={primary} entryFor={entryFor} />
            </span>
          </TooltipTrigger>
          <TooltipPopup side="top">{gt("Run {name} review", { name: primary.name })}</TooltipPopup>
        </Tooltip>
        <span aria-hidden="true" className={THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS} />
        <Menu open={menuOpen} onOpenChange={setMenuOpen}>
          <MenuTrigger
            render={
              <ThreadDetailsControl
                size="sm"
                variant="ghost"
                part="secondary"
                panel
                aria-label={gt("Review workflows")}
              />
            }
          >
            <ChevronDownIcon className={THREAD_DETAILS_PANEL_CHEVRON_CLASS} />
          </MenuTrigger>
          <MenuPopup align="end" anchor={anchorRef} className="w-(--anchor-width)">
            {state.workflows.map((workflow) => (
              <MenuItem
                key={workflow.id}
                className="group"
                disabled={running}
                onClick={() => void run(workflow)}
              >
                {workflow.id === primary.id ? (
                  <StarIcon className="size-4 fill-current text-muted-foreground" />
                ) : (
                  <ScanSearchIcon className="size-4" />
                )}
                <MenuItemLabel>{workflow.name}</MenuItemLabel>
                <span className="relative ms-auto flex h-6 min-w-6 items-center justify-end">
                  <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                    <ReviewerIcons workflow={workflow} entryFor={entryFor} />
                  </span>
                  <span className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-6"
                      aria-label={gt("Edit {name}", { name: workflow.name })}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openEditor(workflow, false);
                      }}
                    >
                      <SettingsIcon className="size-3.5" />
                    </Button>
                  </span>
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              onClick={() =>
                openEditor(
                  {
                    id: randomUUID(),
                    name: "",
                    prompt: primary.prompt,
                    afterReview: "",
                    reviewers: [threadModel],
                  },
                  true,
                )
              }
            >
              <PlusIcon className="size-4" />
              <MenuItemLabel>
                <T>New workflow</T>
              </MenuItemLabel>
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <ReviewWorkflowDialog
        environmentId={thread.environmentId}
        projectId={shell.projectId}
        request={editor}
        onSave={save}
        onDelete={remove}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
