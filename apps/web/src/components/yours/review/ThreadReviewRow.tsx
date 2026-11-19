// Fork-only: the Review row in the thread details card. It asks the thread's agent to start
// parallel reviewers with `delegate_task` and merge what they find.
import { useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import { AuthOrchestrationOperateScope, type ScopedThreadRef } from "@t3tools/contracts";
import { msg, T, useGT } from "gt-react";
import { ChevronDownIcon, PlusIcon, ScanSearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentSettings } from "~/hooks/useSettings";
import { m } from "~/i18n/messages";
import { newMessageId } from "~/lib/utils";
import { getCustomModelOptionsByInstance } from "~/modelSelection";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { useQuietThreadShell } from "~/state/entities";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { useEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { DEFAULT_INTERACTION_MODE } from "~/types";
import { ProviderInstanceIcon } from "../../chat/ProviderInstanceIcon";
import { ProviderModelPicker } from "../../chat/ProviderModelPicker";
import { ThreadDetailsControl } from "../../chat/ThreadDetailsControl";
import {
  THREAD_DETAILS_PANEL_CHEVRON_CLASS,
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
} from "../../chat/threadDetailsPanelStyles";
import { SETTINGS_PICKER_TRIGGER_CLASSNAME } from "../../settings/settingsLayout";
import { Button } from "../../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../../ui/popover";
import { toastManager } from "../../ui/toast";
import { Toggle, ToggleGroup } from "../../ui/toggle-group";
import {
  buildReviewPrompt,
  MAX_REVIEWERS,
  REVIEW_FLOWS,
  type ReviewFlowId,
  type ReviewSquad,
} from "./reviewSquad.logic";
import { saveReviewSquad, useSavedReviewSquad } from "./reviewSquadStore";

const FLOW_COPY: Record<ReviewFlowId, { label: string; hint: string }> = {
  standards: {
    label: msg("Standards"),
    hint: msg("Holds the changes to the repo's agent instructions and conventions."),
  },
  bugs: {
    label: msg("Bugs"),
    hint: msg("Hunts for regressions, edge cases and race conditions."),
  },
  security: {
    label: msg("Security"),
    hint: msg("Looks for auth gaps, leaked secrets and unsafe input."),
  },
  simplify: {
    label: msg("Simplify"),
    hint: msg("Finds dead code, duplication and needless abstraction."),
  },
};

export function ThreadReviewRow({ thread }: { thread: ScopedThreadRef }) {
  const gt = useGT();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const shell = useQuietThreadShell(thread);
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const settings = useEnvironmentSettings(thread.environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(thread.environmentId)) ??
    EMPTY_SERVER_PROVIDERS;
  const saved = useSavedReviewSquad();
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });

  if (!shell || !canOperate) return null;

  const fallback = {
    instanceId: shell.modelSelection.instanceId,
    model: shell.modelSelection.model,
  };
  const squad: ReviewSquad = {
    flow: saved?.flow ?? "standards",
    reviewers: saved?.reviewers.length ? saved.reviewers : [fallback],
  };
  const entries = providerInstanceEntriesFor(providers, settings, shell.projectId);
  const entryFor = (instanceId: string) => entries.find((entry) => entry.instanceId === instanceId);
  const update = (patch: Partial<ReviewSquad>) => saveReviewSquad({ ...squad, ...patch });
  const count = squad.reviewers.length;

  const start = async () => {
    setStarting(true);
    const result = await startTurn({
      environmentId: thread.environmentId,
      input: {
        threadId: thread.threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: buildReviewPrompt(squad),
          attachments: [],
        },
        runtimeMode: shell.runtimeMode,
        interactionMode: DEFAULT_INTERACTION_MODE,
        dispatchMode: "queue",
      },
    });
    setStarting(false);
    if (result._tag === "Failure") {
      toastManager.add({
        type: "error",
        title: gt("Could not start the review"),
        description: thrownErrorMessage(squashAtomCommandFailure(result), m) ?? undefined,
      });
      return;
    }
    setOpen(false);
    toastManager.add({
      type: "success",
      title: gt("Review started"),
      description: gt(
        "{count, plural, one {# reviewer reports} other {# reviewers report}} back in this thread.",
        { count },
      ),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<ThreadDetailsControl size="xs" variant="ghost" part="row" panel />}>
        <ScanSearchIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} aria-hidden />
        <span className={THREAD_DETAILS_PANEL_LABEL_CLASS}>
          <T>Review</T>
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <span className="flex -space-x-1" aria-hidden>
            {squad.reviewers.map((reviewer, index) => {
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
                  size="compact"
                  className="rounded-full bg-card ring-2 ring-card"
                />
              ) : null;
            })}
          </span>
          <ChevronDownIcon className={THREAD_DETAILS_PANEL_CHEVRON_CLASS} aria-hidden />
        </span>
      </PopoverTrigger>
      <PopoverPopup align="end" width="md" padding="compact">
        <div className="flex flex-col gap-3 py-1">
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              <T>Flow</T>
            </span>
            <ToggleGroup
              aria-label={gt("Review flow")}
              className="w-full *:flex-1"
              value={[squad.flow]}
              onValueChange={(values) => {
                const flow = REVIEW_FLOWS.find((candidate) => candidate.id === values[0])?.id;
                if (flow) update({ flow });
              }}
            >
              {REVIEW_FLOWS.map((flow) => (
                <Toggle key={flow.id} value={flow.id}>
                  {m(FLOW_COPY[flow.id].label)}
                </Toggle>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{m(FLOW_COPY[squad.flow].hint)}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              <T>Reviewers</T>
            </span>
            {squad.reviewers.map((reviewer, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- the same model can repeat
              <div key={index} className="flex items-center gap-1">
                <div className="min-w-0 flex-1 *:w-full">
                  <ProviderModelPicker
                    environmentId={thread.environmentId}
                    activeInstanceId={reviewer.instanceId}
                    model={reviewer.model}
                    lockedProvider={null}
                    instanceEntries={entries}
                    modelOptionsByInstance={getCustomModelOptionsByInstance(
                      settings,
                      providers,
                      reviewer.instanceId,
                      reviewer.model,
                    )}
                    isComposerOwned={false}
                    triggerClassName={`${SETTINGS_PICKER_TRIGGER_CLASSNAME} w-full`}
                    onInstanceModelChange={(instanceId, model) =>
                      update({
                        reviewers: squad.reviewers.map((current, at) =>
                          at === index ? { instanceId, model } : current,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost-muted"
                  aria-label={gt("Remove reviewer")}
                  disabled={count === 1}
                  onClick={() =>
                    update({ reviewers: squad.reviewers.filter((_, at) => at !== index) })
                  }
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {count < MAX_REVIEWERS ? (
              <Button
                size="sm"
                variant="ghost-muted"
                className="justify-start"
                onClick={() =>
                  update({ reviewers: [...squad.reviewers, squad.reviewers.at(-1) ?? fallback] })
                }
              >
                <PlusIcon />
                <T>Add reviewer</T>
              </Button>
            ) : null}
          </div>

          <Button disabled={starting} onClick={() => void start()}>
            {gt("{count, plural, one {Start # reviewer} other {Start # reviewers}}", { count })}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
