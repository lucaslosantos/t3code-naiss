import {
  type ContextMenuItem,
  SIDEBAR_SECTION_COLORS,
  type SidebarCustomSection,
  type SidebarSectionColor,
  type SidebarSectionIcon,
} from "@t3tools/contracts";

import { suggestSectionIcon } from "./sectionIcons.logic";

/** Membership lives on the thread as a tag, so it follows the thread to every client. */
const SIDEBAR_SECTION_TAG_PREFIX = "section:";

export function sidebarSectionTag(sectionId: string): string {
  return `${SIDEBAR_SECTION_TAG_PREFIX}${sectionId}`;
}

/**
 * The section a thread belongs to: its first section tag naming a section this client knows.
 * Tags for deleted or unknown sections are ignored, so the thread falls back to its bucket.
 */
export function resolveThreadSectionId(
  tags: ReadonlyArray<string> | undefined,
  knownSectionIds: ReadonlySet<string>,
): string | null {
  if (tags === undefined || knownSectionIds.size === 0) return null;
  for (const tag of tags) {
    if (!tag.startsWith(SIDEBAR_SECTION_TAG_PREFIX)) continue;
    const id = tag.slice(SIDEBAR_SECTION_TAG_PREFIX.length);
    if (knownSectionIds.has(id)) return id;
  }
  return null;
}

/** Section tags to clear before tagging a thread into `sectionId` (null clears them all). */
export function staleSectionTags(
  tags: ReadonlyArray<string> | undefined,
  sectionId: string | null,
): string[] {
  const keep = sectionId === null ? null : sidebarSectionTag(sectionId);
  return (tags ?? []).filter((tag) => tag.startsWith(SIDEBAR_SECTION_TAG_PREFIX) && tag !== keep);
}

export interface CustomSectionGroup<T> {
  readonly section: SidebarCustomSection;
  readonly threads: readonly T[];
}

/**
 * Pulls threads that belong to a custom section out of the Active and Working buckets.
 * Pinned, Snoozed and Settled keep theirs: those states are explicit and win over a section.
 */
export function splitThreadsIntoCustomSections<T>(input: {
  readonly sections: ReadonlyArray<SidebarCustomSection>;
  readonly activeThreads: readonly T[];
  readonly workingThreads: readonly T[];
  readonly tagsOf: (thread: T) => ReadonlyArray<string> | undefined;
  readonly sort: (threads: readonly T[]) => readonly T[];
}): {
  readonly activeThreads: readonly T[];
  readonly workingThreads: readonly T[];
  readonly groups: ReadonlyArray<CustomSectionGroup<T>>;
} {
  const { sections, activeThreads, workingThreads, tagsOf } = input;
  if (sections.length === 0) return { activeThreads, workingThreads, groups: [] };
  const known = new Set(sections.map((section) => section.id));
  const members = new Map<string, T[]>();
  const keep = (threads: readonly T[]) => {
    let kept: T[] | null = null;
    for (const [index, thread] of threads.entries()) {
      const sectionId = resolveThreadSectionId(tagsOf(thread), known);
      if (sectionId === null) {
        kept?.push(thread);
        continue;
      }
      kept ??= threads.slice(0, index);
      const list = members.get(sectionId);
      if (list) list.push(thread);
      else members.set(sectionId, [thread]);
    }
    // Unchanged lists keep their identity, so downstream memoization holds.
    return kept ?? threads;
  };
  const nextActive = keep(activeThreads);
  const nextWorking = keep(workingThreads);
  return {
    activeThreads: nextActive,
    workingThreads: nextWorking,
    groups: sections.map((section) => ({
      section,
      threads: input.sort(members.get(section.id) ?? []),
    })),
  };
}

export function normalizeSectionColor(color: string): SidebarSectionColor {
  return (SIDEBAR_SECTION_COLORS as ReadonlyArray<string>).includes(color)
    ? (color as SidebarSectionColor)
    : "gray";
}

function nextSectionColor(
  sections: ReadonlyArray<Pick<SidebarCustomSection, "color">>,
): SidebarSectionColor {
  const used = new Set(sections.map((section) => section.color));
  return SIDEBAR_SECTION_COLORS.find((color) => color !== "gray" && !used.has(color)) ?? "gray";
}

const DEFAULT_SECTION_NAME = "New section";

export function createSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  input: { readonly id: string; readonly name?: string },
): SidebarCustomSection[] {
  return [
    ...sections,
    {
      id: input.id,
      name: input.name?.trim() || DEFAULT_SECTION_NAME,
      color: nextSectionColor(sections),
      collapsed: false,
    },
  ];
}

export function updateSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  patch: Partial<Pick<SidebarCustomSection, "color" | "collapsed">>,
): SidebarCustomSection[] {
  return sections.map((section) => (section.id === id ? { ...section, ...patch } : section));
}

/**
 * Renames a section. Naming a fresh section also gives it an icon the name suggests;
 * sections the user already named keep whatever they have, so nothing changes under them.
 */
export function renameSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  name: string,
): SidebarCustomSection[] {
  return sections.map((section) => {
    if (section.id !== id) return section;
    const nextName = name.trim() || section.name;
    const suggested =
      section.icon === undefined && section.name === DEFAULT_SECTION_NAME
        ? suggestSectionIcon(nextName)
        : null;
    return {
      ...section,
      name: nextName,
      ...(suggested === null ? {} : { icon: { kind: "lucide" as const, name: suggested } }),
    };
  });
}

/** Sets a section's icon; null puts the color dot back. */
export function setSidebarSectionIcon(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  icon: SidebarSectionIcon | null,
): SidebarCustomSection[] {
  return sections.map((section) => {
    if (section.id !== id) return section;
    const { icon: _previous, ...rest } = section;
    return icon === null ? rest : { ...rest, icon };
  });
}

export function moveSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  offset: -1 | 1,
): SidebarCustomSection[] {
  const index = sections.findIndex((section) => section.id === id);
  return index === -1 ? [...sections] : moveSidebarSectionTo(sections, id, index + offset);
}

/** Moves a section to `toIndex` in the list without it; out-of-range indices clamp. */
export function moveSidebarSectionTo(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  toIndex: number,
): SidebarCustomSection[] {
  const moving = sections.find((section) => section.id === id);
  if (moving === undefined) return [...sections];
  const rest = sections.filter((section) => section !== moving);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

/**
 * Where a dragged section lands. Going down, it passes a section once its bottom edge crosses
 * that section's middle; going up, once its top edge does. Rects are where everything started.
 */
export function sectionReorderIndex(
  rects: ReadonlyArray<{ readonly top: number; readonly height: number }>,
  fromIndex: number,
  deltaY: number,
): number {
  const dragged = rects[fromIndex];
  if (dragged === undefined) return fromIndex;
  const top = dragged.top + deltaY;
  const bottom = top + dragged.height;
  let index = fromIndex;
  for (const [i, rect] of rects.entries()) {
    const middle = rect.top + rect.height / 2;
    if (i > fromIndex && bottom > middle) index += 1;
    else if (i < fromIndex && top < middle) index -= 1;
  }
  return index;
}

/** A thread's tags as they will be once it moves into `sectionId` (null: out of every section). */
export function tagsWithSection(
  tags: ReadonlyArray<string> | undefined,
  sectionId: string | null,
): string[] {
  const rest = (tags ?? []).filter((tag) => !tag.startsWith(SIDEBAR_SECTION_TAG_PREFIX));
  return sectionId === null ? rest : [sidebarSectionTag(sectionId), ...rest];
}

export function deleteSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
): SidebarCustomSection[] {
  return sections.filter((section) => section.id !== id);
}

const SECTION_DROP_PREFIX = "sidebar-custom-section:";

export function sidebarSectionDropId(sectionId: string): string {
  return `${SECTION_DROP_PREFIX}${sectionId}`;
}

export function parseSidebarSectionDropId(id: string): string | null {
  return id.startsWith(SECTION_DROP_PREFIX) ? id.slice(SECTION_DROP_PREFIX.length) : null;
}

export type SectionMenuId =
  | `section:move:${string}`
  | "section:menu"
  | "section:new"
  | "section:remove";

export function parseSectionMenuId(
  id: string,
): { kind: "move"; sectionId: string } | { kind: "new" } | { kind: "remove" } | null {
  if (id === "section:new") return { kind: "new" };
  if (id === "section:remove") return { kind: "remove" };
  if (id.startsWith("section:move:")) {
    return { kind: "move", sectionId: id.slice("section:move:".length) };
  }
  return null;
}

/** "Move to section" items for a thread menu, inserted before `beforeId` (end when missing). */
export function withSectionMenuItems<T extends string, Extra extends string = never>(
  items: ReadonlyArray<ContextMenuItem<T>>,
  input: {
    readonly sections: ReadonlyArray<Pick<SidebarCustomSection, "id" | "name">>;
    readonly currentSectionId: string | null;
    readonly beforeId: T;
  },
  ...extraItems: ContextMenuItem<Extra>[]
): ContextMenuItem<T | SectionMenuId | Extra>[] {
  const added: ContextMenuItem<SectionMenuId>[] = [
    {
      id: "section:menu",
      label: "Move to section",
      icon: "folder-plus",
      children: [
        ...input.sections.map((section) => ({
          id: `section:move:${section.id}` as const,
          label: section.name,
          checked: section.id === input.currentSectionId,
        })),
        { id: "section:new", label: "New section…", separatorBefore: input.sections.length > 0 },
      ],
    },
    ...(input.currentSectionId === null
      ? []
      : [{ id: "section:remove" as const, label: "Remove from section" }]),
  ];
  const index = items.findIndex((item) => item.id === input.beforeId);
  const at = index === -1 ? items.length : index;
  return [...items.slice(0, at), ...added, ...items.slice(at), ...extraItems];
}
