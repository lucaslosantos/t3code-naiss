import type { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildReviewPrompt,
  defaultReviewWorkflow,
  deleteReviewWorkflowIn,
  EMPTY_REVIEW_WORKFLOWS,
  saveReviewWorkflowIn,
  withStandardWorkflow,
  type ReviewWorkflow,
} from "./reviewWorkflows.logic";

const claude = { instanceId: "claude" as ProviderInstanceId, model: "claude-opus-5-5" };
const codex = { instanceId: "codex" as ProviderInstanceId, model: "gpt-5.5" };
const standard: ReviewWorkflow = {
  id: "standard",
  name: "Standard",
  prompt: "Review it.",
  reviewers: [claude],
};
const full: ReviewWorkflow = {
  id: "full",
  name: "Full",
  prompt: "Use the review skill and comment on the pull request.",
  reviewers: [claude, codex, codex],
};

describe("review workflows", () => {
  it("offers Standard until something is saved, and keeps it when the first workflow is added", () => {
    expect(defaultReviewWorkflow(withStandardWorkflow(EMPTY_REVIEW_WORKFLOWS, standard))).toBe(
      standard,
    );
    const state = saveReviewWorkflowIn(
      withStandardWorkflow(EMPTY_REVIEW_WORKFLOWS, standard),
      full,
      false,
    );
    expect(state.workflows.map((workflow) => workflow.id)).toEqual(["standard", "full"]);
    expect(defaultReviewWorkflow(state)?.id).toBe("standard");
  });

  it("hands the default to another workflow when it is switched off, and back to Standard when all are deleted", () => {
    let state = saveReviewWorkflowIn(
      withStandardWorkflow(EMPTY_REVIEW_WORKFLOWS, standard),
      full,
      false,
    );
    state = saveReviewWorkflowIn(state, standard, false);
    expect(defaultReviewWorkflow(state)?.id).toBe("full");

    const only = { workflows: [full], defaultId: null };
    expect(defaultReviewWorkflow(saveReviewWorkflowIn(only, full, false))?.id).toBe("full");

    state = deleteReviewWorkflowIn(deleteReviewWorkflowIn(state, "full"), "standard");
    expect(defaultReviewWorkflow(withStandardWorkflow(state, standard))?.id).toBe("standard");
  });
});

describe("buildReviewPrompt", () => {
  it("starts one delegate per model, repeats included, each with the workflow's own prompt", () => {
    const prompt = buildReviewPrompt(full);
    expect(prompt).toContain('"Full" review with 3 reviewers');
    expect(prompt).toContain(
      '1. target { providerInstanceId: "claude", model: "claude-opus-5-5" }',
    );
    expect(prompt).toContain('3. target { providerInstanceId: "codex", model: "gpt-5.5" }');
    expect(prompt).toContain(
      "<task>\nUse the review skill and comment on the pull request.\n</task>",
    );
  });
});
