import { describe, expect, it } from "vite-plus/test";

import {
  parseSingleEmoji,
  resolveSectionIcon,
  searchSectionIcons,
  suggestSectionIcon,
} from "./sectionIcons.logic";

describe("suggestSectionIcon", () => {
  it("maps whole words in a name to a calm icon, else keeps the dot", () => {
    expect(
      [
        "Ready to merge",
        "Needs review",
        "Growth",
        "Bugs",
        "Done",
        "PRs",
        "Projects",
        "Misc",
        "",
      ].map(suggestSectionIcon),
    ).toEqual([
      "git-merge",
      "eye",
      "trending-up",
      "bug",
      "circle-check",
      "git-pull-request",
      null,
      null,
      null,
    ]);
  });
});

describe("parseSingleEmoji", () => {
  it("accepts exactly one emoji, including joined and flag sequences", () => {
    expect(["🚀", " 🎉 ", "👩🏽‍💻", "🇫🇷", "❤️", "1️⃣"].map(parseSingleEmoji)).toEqual([
      "🚀",
      "🎉",
      "👩🏽‍💻",
      "🇫🇷",
      "❤️",
      "1️⃣",
    ]);
    expect(["", "a", "ab", "🚀🚀", "🚀a", "1", "#"].map(parseSingleEmoji)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("resolveSectionIcon", () => {
  it("draws known icons and falls back to the dot for anything else", () => {
    expect(resolveSectionIcon(undefined)).toEqual({ kind: "dot" });
    expect(resolveSectionIcon({ kind: "lucide", name: "bug" })).toEqual({
      kind: "lucide",
      name: "bug",
    });
    expect(resolveSectionIcon({ kind: "lucide", name: "from-a-newer-client" })).toEqual({
      kind: "dot",
    });
    expect(resolveSectionIcon({ kind: "emoji", value: "🔥" })).toEqual({
      kind: "emoji",
      value: "🔥",
    });
    expect(resolveSectionIcon({ kind: "emoji", value: "hello" })).toEqual({ kind: "dot" });
  });
});

describe("searchSectionIcons", () => {
  it("matches names and keywords, requiring every word", () => {
    expect(searchSectionIcons("merge")).toEqual(["git-merge"]);
    expect(searchSectionIcons("design")).toEqual(expect.arrayContaining(["palette", "pen-tool"]));
    expect(searchSectionIcons("pull request")).toEqual(["git-pull-request"]);
    expect(searchSectionIcons("zzz")).toEqual([]);
    expect(searchSectionIcons("  ").length).toBeGreaterThan(60);
  });
});
