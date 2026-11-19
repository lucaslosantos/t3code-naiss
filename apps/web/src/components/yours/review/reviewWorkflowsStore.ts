// Fork-only: a project's review workflows, kept on this device and in sync across its windows.
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import {
  deleteReviewWorkflowIn,
  EMPTY_REVIEW_WORKFLOWS,
  ReviewWorkflows,
  reviewWorkflowsStorageKey,
  saveReviewWorkflowIn,
  withStandardWorkflow,
  type ReviewWorkflow,
} from "./reviewWorkflows.logic";

export function useProjectReviewWorkflows(
  environmentId: EnvironmentId,
  projectId: ProjectId,
  standard: ReviewWorkflow,
) {
  const [stored, setStored] = useLocalStorage(
    reviewWorkflowsStorageKey(environmentId, projectId),
    EMPTY_REVIEW_WORKFLOWS,
    ReviewWorkflows,
  );
  return {
    state: withStandardWorkflow(stored, standard),
    save: (workflow: ReviewWorkflow, makeDefault: boolean) =>
      setStored((current) =>
        saveReviewWorkflowIn(withStandardWorkflow(current, standard), workflow, makeDefault),
      ),
    remove: (id: string) =>
      setStored((current) => deleteReviewWorkflowIn(withStandardWorkflow(current, standard), id)),
  };
}
