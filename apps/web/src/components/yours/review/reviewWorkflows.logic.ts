// Fork-only: review workflows launched from the thread details card. Each project keeps its own
// list; a workflow is a prompt that every chosen model runs in parallel.
import { ProviderInstanceId, type EnvironmentId, type ProjectId } from "@t3tools/contracts";
import { Schema } from "effect";

const Reviewer = Schema.Struct({ instanceId: ProviderInstanceId, model: Schema.String });
export type Reviewer = typeof Reviewer.Type;

const ReviewWorkflow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  prompt: Schema.String,
  reviewers: Schema.Array(Reviewer),
});
export type ReviewWorkflow = typeof ReviewWorkflow.Type;

export const ReviewWorkflows = Schema.Struct({
  workflows: Schema.Array(ReviewWorkflow),
  defaultId: Schema.NullOr(Schema.String),
});
export type ReviewWorkflows = typeof ReviewWorkflows.Type;

export const EMPTY_REVIEW_WORKFLOWS: ReviewWorkflows = { workflows: [], defaultId: null };

export const MAX_REVIEWERS = 6;

export const STANDARD_WORKFLOW_ID = "standard";

export const STANDARD_REVIEW_PROMPT = [
  "Review the changes on this branch against its base branch. Do not edit files, commit, or push.",
  "Read this repository's agent instructions first and follow them. If it has a review skill or review guidelines, use them.",
  "Report each finding as: file:line, severity (high, medium, low), the problem, and a concrete fix. Verify each finding against the code before reporting it. If there is nothing worth fixing, say so.",
].join("\n");

export const reviewWorkflowsStorageKey = (environmentId: EnvironmentId, projectId: ProjectId) =>
  `t3code:yours:review-workflows:${environmentId}:${projectId}`;

/** A project with nothing saved still offers the built-in Standard workflow. */
export function withStandardWorkflow(
  state: ReviewWorkflows,
  standard: ReviewWorkflow,
): ReviewWorkflows {
  return state.workflows.length > 0 ? state : { workflows: [standard], defaultId: standard.id };
}

/** The workflow the row's run button starts: the chosen default, else the first one. */
export function defaultReviewWorkflow(state: ReviewWorkflows): ReviewWorkflow | null {
  return (
    state.workflows.find((workflow) => workflow.id === state.defaultId) ??
    state.workflows[0] ??
    null
  );
}

export function saveReviewWorkflowIn(
  state: ReviewWorkflows,
  workflow: ReviewWorkflow,
  makeDefault: boolean,
): ReviewWorkflows {
  const exists = state.workflows.some((current) => current.id === workflow.id);
  const workflows = exists
    ? state.workflows.map((current) => (current.id === workflow.id ? workflow : current))
    : [...state.workflows, workflow];
  if (makeDefault) return { workflows, defaultId: workflow.id };
  // Switching the default off hands it to another workflow, so the choice is visible.
  if (defaultReviewWorkflow(state)?.id === workflow.id) {
    const next = workflows.find((current) => current.id !== workflow.id);
    return { workflows, defaultId: next?.id ?? workflow.id };
  }
  return { workflows, defaultId: state.defaultId };
}

export function deleteReviewWorkflowIn(state: ReviewWorkflows, id: string): ReviewWorkflows {
  return {
    workflows: state.workflows.filter((workflow) => workflow.id !== id),
    defaultId: state.defaultId === id ? null : state.defaultId,
  };
}

/** The message the thread's agent receives; it starts each reviewer with `delegate_task`. */
export function buildReviewPrompt(workflow: ReviewWorkflow): string {
  const count = workflow.reviewers.length;
  const targets = workflow.reviewers.map(
    (reviewer, index) =>
      `${index + 1}. target { providerInstanceId: "${reviewer.instanceId}", model: "${reviewer.model}" }, title "${workflow.name} ${index + 1}"`,
  );
  return [
    `Run the "${workflow.name}" review with ${count} reviewer${count === 1 ? "" : "s"} in parallel.`,
    "",
    'Start every reviewer now, in this turn, with one `delegate_task` call each (role "review", isolation "shared", mode "async"):',
    ...targets,
    "",
    "Give each reviewer this task, adding this checkout's path, the base branch, and the pull request link if there is one:",
    "<task>",
    workflow.prompt.trim(),
    "</task>",
    "",
    "Do not do the task yourself while they run. When all reviewers have reported, merge their findings into one list: drop duplicates and false positives, rank by severity, and note which reviewers raised each. Do not change code until I ask.",
  ].join("\n");
}
