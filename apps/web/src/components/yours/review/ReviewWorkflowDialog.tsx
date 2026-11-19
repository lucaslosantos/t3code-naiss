// Fork-only: create or edit a saved review workflow, like the project script editor.
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { msg, T, useGT } from "gt-react";
import { PlusIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { useEnvironmentSettings } from "~/hooks/useSettings";
import { m } from "~/i18n/messages";
import { getCustomModelOptionsByInstance } from "~/modelSelection";
import { providerInstanceEntriesFor } from "~/providerInstances";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { ProviderModelPicker } from "../../chat/ProviderModelPicker";
import { SETTINGS_PICKER_TRIGGER_CLASSNAME } from "../../settings/settingsLayout";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import {
  MAX_REVIEWERS,
  REVIEW_JOBS,
  type Reviewer,
  type ReviewJobId,
  type ReviewWorkflow,
} from "./reviewWorkflows.logic";
import { deleteReviewWorkflow, saveReviewWorkflow } from "./reviewWorkflowsStore";

const REVIEW_JOB_LABELS: Record<ReviewJobId, string> = {
  standards: msg("Standards"),
  bugs: msg("Bugs"),
  security: msg("Security"),
  simplify: msg("Simplify"),
};

export interface ReviewWorkflowEditorRequest {
  readonly workflow: ReviewWorkflow;
  readonly isNew: boolean;
  readonly isDefault: boolean;
}

interface EditorProps {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly request: ReviewWorkflowEditorRequest | null;
  readonly onClose: () => void;
}

export function ReviewWorkflowDialog({ request, ...props }: EditorProps) {
  // Keep the last request mounted while the dialog animates closed.
  const [shown, setShown] = useState<{ request: ReviewWorkflowEditorRequest; key: number } | null>(
    request === null ? null : { request, key: 0 },
  );
  if (request !== null && request !== shown?.request) {
    setShown({ request, key: (shown?.key ?? 0) + 1 });
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogPopup>
        {shown ? <ReviewWorkflowForm key={shown.key} request={shown.request} {...props} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function ReviewWorkflowForm({
  environmentId,
  projectId,
  request,
  onClose,
}: EditorProps & { readonly request: ReviewWorkflowEditorRequest }) {
  const gt = useGT();
  const formId = useId();
  const settings = useEnvironmentSettings(environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
  const entries = providerInstanceEntriesFor(providers, settings, projectId);
  const [name, setName] = useState(request.workflow.name);
  const [reviewers, setReviewers] = useState(request.workflow.reviewers);
  const [isDefault, setIsDefault] = useState(request.isDefault);
  const [error, setError] = useState<string | null>(null);

  const updateAt = (index: number, patch: Partial<Reviewer>) =>
    setReviewers((current) =>
      current.map((reviewer, at) => (at === index ? { ...reviewer, ...patch } : reviewer)),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") {
      setError(gt("Name is required."));
      return;
    }
    saveReviewWorkflow({ id: request.workflow.id, name: trimmed, reviewers }, isDefault);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {request.isNew ? <T>New review workflow</T> : <T>Edit review workflow</T>}
        </DialogTitle>
        <DialogDescription>
          <T>
            Reviewers run at the same time, each with its own job. Their findings come back merged
            in the thread.
          </T>
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <form id={formId} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-name`}>
              <T>Name</T>
            </Label>
            <Input
              id={`${formId}-name`}
              autoFocus
              placeholder={gt("Full review", { $context: "example review workflow name" })}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              <T>Reviewers</T>
            </Label>
            {reviewers.map((reviewer, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- the same reviewer can repeat
              <div key={index} className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1">
                  <ProviderModelPicker
                    environmentId={environmentId}
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
                    triggerClassName={`${SETTINGS_PICKER_TRIGGER_CLASSNAME} w-full shrink text-left sm:max-w-none`}
                    onInstanceModelChange={(instanceId, model) =>
                      updateAt(index, { instanceId, model })
                    }
                  />
                </div>
                <div className="w-36 shrink-0">
                  <Select
                    value={reviewer.job}
                    onValueChange={(value) => {
                      const job = REVIEW_JOBS.find((candidate) => candidate.id === value)?.id;
                      if (job) updateAt(index, { job });
                    }}
                  >
                    <SelectTrigger size="sm" aria-label={gt("Job")}>
                      <SelectValue>{m(REVIEW_JOB_LABELS[reviewer.job])}</SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {REVIEW_JOBS.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {m(REVIEW_JOB_LABELS[job.id])}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost-muted"
                  aria-label={gt("Remove reviewer")}
                  disabled={reviewers.length === 1}
                  onClick={() => setReviewers((current) => current.filter((_, at) => at !== index))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {reviewers.length < MAX_REVIEWERS ? (
              <Button
                type="button"
                size="sm"
                variant="ghost-muted"
                onClick={() =>
                  setReviewers((current) => {
                    const last = current.at(-1);
                    return last ? [...current, last] : current;
                  })
                }
              >
                <PlusIcon />
                <T>Add reviewer</T>
              </Button>
            ) : null}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm dark:border-transparent dark:bg-white/[0.035]">
            <span>
              <T>Default workflow</T>
              <span className="block text-xs text-muted-foreground">
                <T>Runs when you click Review in the thread card.</T>
              </span>
            </span>
            <Switch checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked)} />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </DialogPanel>
      <DialogFooter variant="bare">
        {request.isNew ? null : (
          <Button
            type="button"
            variant="destructive-outline"
            className="mr-auto"
            onClick={() => {
              deleteReviewWorkflow(request.workflow.id);
              onClose();
            }}
          >
            <T context="verb, delete the review workflow">Delete</T>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          <T>Cancel</T>
        </Button>
        <Button form={formId} type="submit">
          <T>Save</T>
        </Button>
      </DialogFooter>
    </>
  );
}
