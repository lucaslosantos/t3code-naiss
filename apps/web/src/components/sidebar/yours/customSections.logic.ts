import {
  type ContextMenuItem,
  SIDEBAR_SECTION_COLORS,
  type SidebarCustomSection,
  type SidebarSectionColor,
} from "@t3tools/contracts";

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

export function createSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  input: { readonly id: string; readonly name?: string },
): SidebarCustomSection[] {
  return [
    ...sections,
    {
      id: input.id,
      name: input.name?.trim() || "New section",
      color: nextSectionColor(sections),
      collapsed: false,
    },
  ];
}

export function updateSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  patch: Partial<Omit<SidebarCustomSection, "id">>,
): SidebarCustomSection[] {
  return sections.map((section) =>
    section.id === id
      ? {
          ...section,
          ...patch,
          ...(patch.name === undefined ? {} : { name: patch.name.trim() || section.name }),
        }
      : section,
  );
}

export function moveSidebarSection(
  sections: ReadonlyArray<SidebarCustomSection>,
  id: string,
  offset: -1 | 1,
): SidebarCustomSection[] {
  const index = sections.findIndex((section) => section.id === id);
  const target = index + offset;
  if (index === -1 || target < 0 || target >= sections.length) return [...sections];
  const next = [...sections];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
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
export function withSectionMenuItems<T extends string>(
  items: ReadonlyArray<ContextMenuItem<T>>,
  input: {
    readonly sections: ReadonlyArray<Pick<SidebarCustomSection, "id" | "name">>;
    readonly currentSectionId: string | null;
    readonly beforeId: T;
  },
): ContextMenuItem<T | SectionMenuId>[] {
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
  return [...items.slice(0, at), ...added, ...items.slice(at)];
}
