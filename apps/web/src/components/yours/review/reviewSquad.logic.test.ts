import type { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildReviewPrompt, MAX_REVIEWERS, parseReviewSquad } from "./reviewSquad.logic";

const claude = { instanceId: "claude" as ProviderInstanceId, model: "claude-opus-5-5" };
const codex = { instanceId: "codex" as ProviderInstanceId, model: "gpt-5.5" };

describe("parseReviewSquad", () => {
  it("keeps valid reviewers, caps the count, and falls back to the standards flow", () => {
    const parsed = parseReviewSquad({
      flow: "retired-flow",
      reviewers: [claude, { instanceId: "", model: "x" }, null, ...Array(9).fill(codex)],
    });
    expect(parsed?.flow).toBe("standards");
    expect(parsed?.reviewers).toHaveLength(MAX_REVIEWERS);
    expect(parsed?.reviewers[0]).toEqual(claude);
  });

  it("rejects stored values that are not a squad", () => {
    expect(parseReviewSquad("nope")).toBeNull();
    expect(parseReviewSquad({ flow: "bugs" })).toBeNull();
  });
});

describe("buildReviewPrompt", () => {
  it("names one delegate target per reviewer, repeats included, with the flow's focus", () => {
    const prompt = buildReviewPrompt({ flow: "security", reviewers: [claude, codex, codex] });
    expect(prompt).toContain("with 3 reviewers");
    expect(prompt).toContain('1. providerInstanceId "claude", model "claude-opus-5-5"');
    expect(prompt).toContain('3. providerInstanceId "codex", model "gpt-5.5"');
    expect(prompt).toContain("security problems");
    expect(prompt).toContain('role "review"');
  });
});
