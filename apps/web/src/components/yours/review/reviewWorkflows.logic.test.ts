import type { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildReviewPrompt,
  defaultReviewWorkflow,
  deleteReviewWorkflowIn,
  EMPTY_REVIEW_WORKFLOWS,
  MAX_REVIEWERS,
  parseReviewWorkflows,
  saveReviewWorkflowIn,
  type ReviewWorkflow,
} from "./reviewWorkflows.logic";

const claude = {
  instanceId: "claude" as ProviderInstanceId,
  model: "claude-opus-5-5",
  job: "bugs" as const,
};
const codex = {
  instanceId: "codex" as ProviderInstanceId,
  model: "gpt-5.5",
  job: "security" as const,
};
const full: ReviewWorkflow = { id: "full", name: "Full review", reviewers: [claude, codex, codex] };
const quick: ReviewWorkflow = { id: "quick", name: "Quick", reviewers: [claude] };

describe("parseReviewWorkflows", () => {
  it("keeps valid workflows, caps reviewers, falls back to the standards job, and drops a stale default", () => {
    const parsed = parseReviewWorkflows({
      defaultId: "gone",
      workflows: [
        {
          id: "full",
          name: "Full review",
          reviewers: [
            { ...claude, job: "retired-job" },
            { instanceId: "", model: "x" },
            null,
            ...Array.from({ length: 9 }, () => codex),
          ],
        },
        { id: "empty", name: "No reviewers", reviewers: [] },
        { id: "", name: "No id", reviewers: [claude] },
      ],
    });
    expect(parsed.workflows.map((workflow) => workflow.id)).toEqual(["full"]);
    expect(parsed.workflows[0]?.reviewers).toHaveLength(MAX_REVIEWERS);
    expect(parsed.workflows[0]?.reviewers[0]?.job).toBe("standards");
    expect(parsed.defaultId).toBeNull();
  });

  it("returns no workflows for stored values that are not workflows", () => {
    expect(parseReviewWorkflows("nope")).toEqual(EMPTY_REVIEW_WORKFLOWS);
    expect(parseReviewWorkflows({ flow: "bugs", reviewers: [claude] })).toEqual(
      EMPTY_REVIEW_WORKFLOWS,
    );
  });
});

describe("saving and deleting workflows", () => {
  it("runs the chosen default, else the first workflow, and moves the default with edits and deletes", () => {
    let state = saveReviewWorkflowIn(EMPTY_REVIEW_WORKFLOWS, full, false);
    state = saveReviewWorkflowIn(state, quick, true);
    expect(defaultReviewWorkflow(state)?.id).toBe("quick");

    state = saveReviewWorkflowIn(state, { ...quick, name: "Quick check" }, false);
    expect(state.workflows.map((workflow) => workflow.name)).toEqual([
      "Full review",
      "Quick check",
    ]);
    expect(defaultReviewWorkflow(state)?.id).toBe("full");

    state = saveReviewWorkflowIn(state, quick, true);
    state = deleteReviewWorkflowIn(state, "quick");
    expect(state.defaultId).toBeNull();
    expect(defaultReviewWorkflow(state)?.id).toBe("full");
    expect(defaultReviewWorkflow(deleteReviewWorkflowIn(state, "full"))).toBeNull();
  });
});

describe("buildReviewPrompt", () => {
  it("names one delegate target per reviewer, repeats included, each with its own job's focus", () => {
    const prompt = buildReviewPrompt(full);
    expect(prompt).toContain('"Full review" review of this branch with 3 reviewers');
    expect(prompt).toMatch(
      /1\. providerInstanceId "claude", model "claude-opus-5-5".*correctness bugs/,
    );
    expect(prompt).toMatch(/3\. providerInstanceId "codex", model "gpt-5\.5".*security problems/);
    expect(prompt).toContain('role "review"');
  });
});
