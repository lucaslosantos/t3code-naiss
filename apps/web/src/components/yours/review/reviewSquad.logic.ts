// Fork-only: parallel review squads launched from the thread details card.
import type { ProviderInstanceId } from "@t3tools/contracts";

export const REVIEW_FLOWS = [
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

export type ReviewFlowId = (typeof REVIEW_FLOWS)[number]["id"];

export interface Reviewer {
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
}

export interface ReviewSquad {
  readonly flow: ReviewFlowId;
  readonly reviewers: ReadonlyArray<Reviewer>;
}

export const MAX_REVIEWERS = 6;

export function parseReviewSquad(raw: unknown): ReviewSquad | null {
  if (!raw || typeof raw !== "object") return null;
  const { flow, reviewers } = raw as Record<string, unknown>;
  if (!Array.isArray(reviewers)) return null;
  const valid = reviewers
    .filter(
      (entry): entry is { instanceId: string; model: string } =>
        !!entry &&
        typeof entry === "object" &&
        typeof entry.instanceId === "string" &&
        entry.instanceId !== "" &&
        typeof entry.model === "string" &&
        entry.model !== "",
    )
    .slice(0, MAX_REVIEWERS)
    .map((entry) => ({
      instanceId: entry.instanceId as ProviderInstanceId,
      model: entry.model,
    }));
  return {
    flow: REVIEW_FLOWS.find((candidate) => candidate.id === flow)?.id ?? "standards",
    reviewers: valid,
  };
}

/** The message the thread's agent receives; it fans the brief out with `delegate_task`. */
export function buildReviewPrompt(squad: ReviewSquad): string {
  const flow = REVIEW_FLOWS.find((candidate) => candidate.id === squad.flow) ?? REVIEW_FLOWS[0];
  const count = squad.reviewers.length;
  const targets = squad.reviewers.map(
    (reviewer, index) =>
      `${index + 1}. providerInstanceId "${reviewer.instanceId}", model "${reviewer.model}", title "${flow.id} review ${index + 1}"`,
  );
  return [
    `Run a parallel ${flow.id} review of this branch with ${count} reviewer${count === 1 ? "" : "s"}.`,
    "",
    'Start every reviewer now, in this turn, with one `delegate_task` call each (role "review", isolation "shared", mode "async"):',
    ...targets,
    "",
    "Give each reviewer this brief, adding this checkout's path, the base branch, and the pull request link if there is one:",
    "<brief>",
    "Review the changes on this branch against its base branch. Do not edit files, commit, or push.",
    flow.focus,
    "Read the repository's agent instructions first and apply them. Report each finding as: file:line, severity (high, medium, low), the problem, and a concrete fix. Verify each finding against the code before reporting it. If there is nothing worth fixing, say so.",
    "</brief>",
    "",
    "Do not review it yourself while they run. When all reviewers have reported, merge their findings into one list: drop duplicates and false positives, rank by severity, and note which reviewers raised each. Do not change code until I ask.",
  ].join("\n");
}
