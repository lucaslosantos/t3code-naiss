import type { SidebarCustomSection } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  createSidebarSection,
  moveSidebarSection,
  parseSectionMenuId,
  resolveThreadSectionId,
  splitThreadsIntoCustomSections,
  staleSectionTags,
  renameSidebarSection,
  setSidebarSectionIcon,
  withSectionMenuItems,
} from "./customSections.logic";

const section = (id: string, overrides: Partial<SidebarCustomSection> = {}) => ({
  id,
  name: id,
  color: "gray",
  collapsed: false,
  ...overrides,
});

type Row = { readonly id: string; readonly tags?: ReadonlyArray<string> };

const split = (
  sections: ReadonlyArray<SidebarCustomSection>,
  activeThreads: readonly Row[],
  workingThreads: readonly Row[] = [],
) =>
  splitThreadsIntoCustomSections({
    sections,
    activeThreads,
    workingThreads,
    tagsOf: (thread) => thread.tags,
    sort: (threads) => threads.toSorted((left, right) => left.id.localeCompare(right.id)),
  });

describe("splitThreadsIntoCustomSections", () => {
  it("moves tagged active and working threads into their sections, in section order", () => {
    const result = split(
      [section("review"), section("growth")],
      [{ id: "c", tags: ["section:growth"] }, { id: "a" }, { id: "b", tags: ["section:review"] }],
      [{ id: "w", tags: ["section:growth"] }, { id: "x" }],
    );
    expect(result.activeThreads.map((thread) => thread.id)).toEqual(["a"]);
    expect(result.workingThreads.map((thread) => thread.id)).toEqual(["x"]);
    expect(
      result.groups.map((group) => [group.section.id, group.threads.map((thread) => thread.id)]),
    ).toEqual([
      ["review", ["b"]],
      ["growth", ["c", "w"]],
    ]);
  });

  it("leaves threads tagged for a deleted section in their bucket and keeps list identity", () => {
    const active = [{ id: "a", tags: ["section:gone", "private"] }];
    const working: Row[] = [];
    const result = split([section("review")], active, working);
    expect(result.activeThreads).toBe(active);
    expect(result.workingThreads).toBe(working);
    expect(result.groups).toEqual([{ section: section("review"), threads: [] }]);
  });

  it("does nothing without sections", () => {
    const active = [{ id: "a", tags: ["section:review"] }];
    expect(split([], active)).toEqual({ activeThreads: active, workingThreads: [], groups: [] });
  });
});

describe("section tags", () => {
  it("resolves the first tag naming a known section", () => {
    const known = new Set(["b", "c"]);
    expect(resolveThreadSectionId(["section:a", "section:c", "section:b"], known)).toBe("c");
    expect(resolveThreadSectionId(["sections:b", "b"], known)).toBeNull();
    expect(resolveThreadSectionId(undefined, known)).toBeNull();
  });

  it("lists every other section tag to clear on a move", () => {
    const tags = ["section:a", "private", "section:b"];
    expect(staleSectionTags(tags, "b")).toEqual(["section:a"]);
    expect(staleSectionTags(tags, null)).toEqual(["section:a", "section:b"]);
  });
});

describe("section definitions", () => {
  it("names a blank section and picks an unused color", () => {
    const sections = createSidebarSection([section("a", { color: "blue" })], {
      id: "b",
      name: "  ",
    });
    expect(sections[1]).toEqual({ id: "b", name: "New section", color: "green", collapsed: false });
  });

  it("keeps the old name when a rename is blank", () => {
    expect(renameSidebarSection([section("a")], "a", "  ")[0]!.name).toBe("a");
    expect(renameSidebarSection([section("a")], "a", " Ship ")[0]!.name).toBe("Ship");
  });

  it("suggests an icon only when naming a fresh section", () => {
    const fresh = section("a", { name: "New section" });
    expect(renameSidebarSection([fresh], "a", "Ready to merge")[0]!.icon).toEqual({
      kind: "lucide",
      name: "git-merge",
    });
    expect(renameSidebarSection([fresh], "a", "Misc")[0]).not.toHaveProperty("icon");
    expect(renameSidebarSection([section("a")], "a", "Bugs")[0]).not.toHaveProperty("icon");
    const emoji = { kind: "emoji" as const, value: "🎉" };
    expect(
      renameSidebarSection([section("a", { name: "New section", icon: emoji })], "a", "Bugs")[0]!
        .icon,
    ).toEqual(emoji);
  });

  it("sets and clears a section icon", () => {
    const withIcon = setSidebarSectionIcon([section("a")], "a", { kind: "lucide", name: "bug" });
    expect(withIcon[0]!.icon).toEqual({ kind: "lucide", name: "bug" });
    expect(setSidebarSectionIcon(withIcon, "a", null)[0]).not.toHaveProperty("icon");
  });

  it("moves a section within bounds", () => {
    const sections = [section("a"), section("b"), section("c")];
    expect(moveSidebarSection(sections, "c", -1).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(moveSidebarSection(sections, "a", -1).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("withSectionMenuItems", () => {
  it("inserts move and remove before the anchor and round-trips their ids", () => {
    const items = withSectionMenuItems(
      [
        { id: "pin", label: "Pin" },
        { id: "rename", label: "Rename" },
      ],
      { sections: [section("a"), section("b")], currentSectionId: "b", beforeId: "rename" },
    );
    expect(items.map((item) => item.id)).toEqual([
      "pin",
      "section:menu",
      "section:remove",
      "rename",
    ]);
    const children = items[1]!.children ?? [];
    expect(children.map((child) => [child.id, child.checked ?? false])).toEqual([
      ["section:move:a", false],
      ["section:move:b", true],
      ["section:new", false],
    ]);
    expect(parseSectionMenuId("section:move:a")).toEqual({ kind: "move", sectionId: "a" });
    expect(parseSectionMenuId("rename")).toBeNull();
  });
});
