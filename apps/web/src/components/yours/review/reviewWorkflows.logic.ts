// Fork-only: saved review workflows launched from the thread details card. Each reviewer runs in
// parallel with its own model and job.
import type { ProviderInstanceId } from "@t3tools/contracts";

export const REVIEW_JOBS = [
  {
    id: "standards",
    focus:
      "Hold the changes to this codebase's own standards: its agent instructions (AGENTS.md, CLAUDE.md and anything they link), conventions, patterns, naming, tests and docs rules.",
  },
  {
    id: "bugs",
    focus:
      "Hunt for correctness bugs: regressions, missed edge cases, race conditions, broken states and error paths.",
  },
  {
    id: "security",
    focus:
      "Look for security problems: injection, auth and permission gaps, leaked secrets, unsafe input handling and trust boundaries.",
  },
  {
    id: "simplify",
    focus:
      "Look for simplifications: dead code, duplication, needless abstraction, and simpler ways to get the same behavior.",
  },
] as const;

export type ReviewJobId = (typeof REVIEW_JOBS)[number]["id"];

export interface Reviewer {
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
  readonly job: ReviewJobId;
}

export interface ReviewWorkflow {
  readonly id: string;
  readonly name: string;
  readonly reviewers: ReadonlyArray<Reviewer>;
}

export interface ReviewWorkflows {
  readonly workflows: ReadonlyArray<ReviewWorkflow>;
  readonly defaultId: string | null;
}

export const MAX_REVIEWERS = 6;

export const EMPTY_REVIEW_WORKFLOWS: ReviewWorkflows = { workflows: [], defaultId: null };

const jobOf = (value: unknown): ReviewJobId =>
  REVIEW_JOBS.find((job) => job.id === value)?.id ?? "standards";

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

function parseReviewer(raw: unknown): Reviewer | null {
  if (!raw || typeof raw !== "object") return null;
  const { instanceId, model, job } = raw as Record<string, unknown>;
  if (!nonEmpty(instanceId) || !nonEmpty(model)) return null;
  return { instanceId: instanceId as ProviderInstanceId, model, job: jobOf(job) };
}

function parseWorkflow(raw: unknown): ReviewWorkflow | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, name, reviewers } = raw as Record<string, unknown>;
  if (!nonEmpty(id) || !nonEmpty(name) || !Array.isArray(reviewers)) return null;
  const valid = reviewers
    .map(parseReviewer)
    .filter((reviewer) => reviewer !== null)
    .slice(0, MAX_REVIEWERS);
  return valid.length > 0 ? { id, name, reviewers: valid } : null;
}

export function parseReviewWorkflows(raw: unknown): ReviewWorkflows {
  if (!raw || typeof raw !== "object") return EMPTY_REVIEW_WORKFLOWS;
  const { workflows, defaultId } = raw as Record<string, unknown>;
  if (!Array.isArray(workflows)) return EMPTY_REVIEW_WORKFLOWS;
  const valid = workflows.map(parseWorkflow).filter((workflow) => workflow !== null);
  return {
    workflows: valid,
    defaultId: valid.some((workflow) => workflow.id === defaultId) ? (defaultId as string) : null,
  };
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
  return {
    workflows: exists
      ? state.workflows.map((current) => (current.id === workflow.id ? workflow : current))
      : [...state.workflows, workflow],
    defaultId: makeDefault ? workflow.id : state.defaultId === workflow.id ? null : state.defaultId,
  };
}

export function deleteReviewWorkflowIn(state: ReviewWorkflows, id: string): ReviewWorkflows {
  return {
    workflows: state.workflows.filter((workflow) => workflow.id !== id),
    defaultId: state.defaultId === id ? null : state.defaultId,
  };
}

/** The message the thread's agent receives; it fans the reviewers out with `delegate_task`. */
export function buildReviewPrompt(workflow: ReviewWorkflow): string {
  const count = workflow.reviewers.length;
  const targets = workflow.reviewers.map((reviewer, index) => {
    const job = REVIEW_JOBS.find((candidate) => candidate.id === reviewer.job) ?? REVIEW_JOBS[0];
    // oxlint-disable-next-line t3code/no-untranslated-copy -- agent-facing prompt, not UI copy
    return `${index + 1}. providerInstanceId "${reviewer.instanceId}", model "${reviewer.model}", title "${job.id} review ${index + 1}". Focus: ${job.focus}`;
  });
  return [
    `Run the "${workflow.name}" review of this branch with ${count} reviewer${count === 1 ? "" : "s"} in parallel.`,
    "",
    'Start every reviewer now, in this turn, with one `delegate_task` call each (role "review", isolation "shared", mode "async"). Each one gets the shared brief below plus its own focus:',
    ...targets,
    "",
    "Shared brief (add this checkout's path, the base branch, and the pull request link if there is one):",
    "<brief>",
    "Review the changes on this branch against its base branch. Do not edit files, commit, or push.",
    "Read the repository's agent instructions first and apply them. Report each finding as: file:line, severity (high, medium, low), the problem, and a concrete fix. Verify each finding against the code before reporting it. If there is nothing worth fixing, say so.",
    "</brief>",
    "",
    "Do not review it yourself while they run. When all reviewers have reported, merge their findings into one list: drop duplicates and false positives, rank by severity, and note which reviewers raised each. Do not change code until I ask.",
  ].join("\n");
}
