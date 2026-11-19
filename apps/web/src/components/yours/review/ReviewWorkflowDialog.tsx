// Fork-only: create or edit a project's review workflow, like the project script editor.
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { PlusIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { useEnvironmentSettings } from "~/hooks/useSettings";
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
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { MAX_REVIEWERS, type ReviewWorkflow } from "./reviewWorkflows.logic";

export interface ReviewWorkflowEditorRequest {
  readonly workflow: ReviewWorkflow;
  readonly isNew: boolean;
  readonly isDefault: boolean;
  /** The only workflow always runs, so its default switch stays on. */
  readonly isOnly: boolean;
}

interface EditorProps {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly request: ReviewWorkflowEditorRequest | null;
  readonly onSave: (workflow: ReviewWorkflow, makeDefault: boolean) => void;
  readonly onDelete: (id: string) => void;
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
  onSave,
  onDelete,
  onClose,
}: EditorProps & { readonly request: ReviewWorkflowEditorRequest }) {
  const gt = useGT();
  const formId = useId();
  const settings = useEnvironmentSettings(environmentId);
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
  const entries = providerInstanceEntriesFor(providers, settings, projectId);
  const [name, setName] = useState(request.workflow.name);
  const [prompt, setPrompt] = useState(request.workflow.prompt);
  const [reviewers, setReviewers] = useState(request.workflow.reviewers);
  const [isDefault, setIsDefault] = useState(request.isDefault || request.isOnly);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") {
      setError(gt("Name is required."));
      return;
    }
    if (prompt.trim() === "") {
      setError(gt("Prompt is required."));
      return;
    }
    onSave({ id: request.workflow.id, name: name.trim(), prompt, reviewers }, isDefault);
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
            Each model below gets this prompt and runs at the same time. Workflows belong to this
            project.
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
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-prompt`}>
              <T>Prompt</T>
            </Label>
            <Textarea
              id={`${formId}-prompt`}
              rows={7}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <T>
                Name your repo's own review skill or rules here, such as "Use the review skill and
                comment on the pull request".
              </T>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>
              <T>Models</T>
            </Label>
            {reviewers.map((reviewer, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- the same model can repeat
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
                      setReviewers((current) =>
                        current.map((entry, at) => (at === index ? { instanceId, model } : entry)),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost-muted"
                  aria-label={gt("Remove model")}
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
                <T>Add model</T>
              </Button>
            ) : null}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm dark:border-transparent dark:bg-white/[0.035]">
            <span>
              <T>Default workflow</T>
              <span className="block text-xs text-muted-foreground">
                <T>Runs when you click the review row in the thread card.</T>
              </span>
            </span>
            <Switch
              checked={isDefault}
              disabled={request.isOnly}
              onCheckedChange={(checked) => setIsDefault(checked)}
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </DialogPanel>
      <DialogFooter variant="bare">
        {request.isNew || request.isOnly ? null : (
          <Button
            type="button"
            variant="destructive-outline"
            className="mr-auto"
            onClick={() => {
              onDelete(request.workflow.id);
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
