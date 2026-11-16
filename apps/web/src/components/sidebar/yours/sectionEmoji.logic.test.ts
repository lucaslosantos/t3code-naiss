import { describe, expect, it } from "vite-plus/test";

import { SECTION_EMOJI_CATALOG, searchSectionEmoji } from "./sectionEmoji.logic";
import { parseSingleEmoji } from "./sectionIcons.logic";

describe("section emoji catalog", () => {
  it("only holds single emoji that a section can store", () => {
    for (const entry of SECTION_EMOJI_CATALOG) {
      expect(parseSingleEmoji(entry.emoji), entry.keywords).toBe(entry.emoji);
    }
  });

  it("has no duplicates", () => {
    const emoji = SECTION_EMOJI_CATALOG.map((entry) => entry.emoji);
    expect(new Set(emoji).size).toBe(emoji.length);
  });

  it("searches by every word", () => {
    expect(searchSectionEmoji("")).toHaveLength(SECTION_EMOJI_CATALOG.length);
    expect(searchSectionEmoji("rocket")).toEqual(["🚀"]);
    expect(searchSectionEmoji("heart green")).toEqual(["💚"]);
    expect(searchSectionEmoji("zzzz-nothing")).toEqual([]);
  });
});
