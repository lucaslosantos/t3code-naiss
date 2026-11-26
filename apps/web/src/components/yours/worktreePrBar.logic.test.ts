import { describe, expect, it } from "vite-plus/test";

import { resolveWorktreeBarPr } from "./worktreePrBar.logic";

const pr = (number: number, headRef: string, state: "open" | "merged" | "closed") => ({
  number,
  title: `PR ${number}`,
  url: `https://github.com/acme/demo/pull/${number}`,
  baseRef: "main",
  headRef,
  state,
});

describe("resolveWorktreeBarPr", () => {
  it.each([
    ["the branch's own PR wins", pr(2, "feat", "open"), pr(1, "old", "open"), "feat", 2],
    ["open linked PR pushed under another name", null, pr(1, "other", "open"), "feat", 1],
    ["merged linked PR from this branch", null, pr(1, "feat", "merged"), "feat", 1],
    ["merged linked PR from earlier work", null, pr(1, "old", "merged"), "feat", null],
    ["closed linked PR from earlier work", null, pr(1, "old", "closed"), "feat", null],
    ["nothing linked", null, null, "feat", null],
  ])("%s", (_name, branchPr, linkedPr, branch, expected) => {
    expect(resolveWorktreeBarPr(branchPr, linkedPr, branch)?.number ?? null).toBe(expected);
  });
});
