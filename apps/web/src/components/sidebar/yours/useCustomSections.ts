import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { SidebarCustomSection, SidebarSectionIcon } from "@t3tools/contracts";
import { create } from "zustand";

import { getClientSettings, updateClientSettings } from "~/hooks/useSettings";
import type { useThreadActions } from "~/hooks/useThreadActions";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { stackedThreadToast, toastManager } from "../../ui/toast";
import {
  createSidebarSection,
  deleteSidebarSection,
  moveSidebarSection,
  moveSidebarSectionTo,
  renameSidebarSection,
  setSidebarSectionIcon,
  sidebarSectionTag,
  staleSectionTags,
  tagsWithSection,
  updateSidebarSection,
} from "./customSections.logic";

/** The section whose name is being edited inline; a new section starts here. */
export const useSectionRenameStore = create<{
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}>((set) => ({
  renamingId: null,
  setRenamingId: (renamingId) => set({ renamingId }),
}));

function newSectionId(): string {
  // getRandomValues works on plain-http LAN origins, where randomUUID does not exist.
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function writeSections(
  update: (sections: ReadonlyArray<SidebarCustomSection>) => SidebarCustomSection[],
) {
  return updateClientSettings({
    sidebarCustomSections: update(getClientSettings().sidebarCustomSections),
  });
}

export const sectionDefinitions = {
  create: (name?: string): string => {
    const id = newSectionId();
    void writeSections((sections) =>
      createSidebarSection(sections, name === undefined ? { id } : { id, name }),
    );
    return id;
  },
  rename: (id: string, name: string) =>
    void writeSections((sections) => renameSidebarSection(sections, id, name)),
  setColor: (id: string, color: string) =>
    void writeSections((sections) => updateSidebarSection(sections, id, { color })),
  setIcon: (id: string, icon: SidebarSectionIcon | null) =>
    void writeSections((sections) => setSidebarSectionIcon(sections, id, icon)),
  setCollapsed: (id: string, collapsed: boolean) =>
    void writeSections((sections) => updateSidebarSection(sections, id, { collapsed })),
  move: (id: string, offset: -1 | 1) =>
    void writeSections((sections) => moveSidebarSection(sections, id, offset)),
  moveTo: (id: string, toIndex: number) =>
    void writeSections((sections) => moveSidebarSectionTo(sections, id, toIndex)),
  delete: (id: string) => void writeSections((sections) => deleteSidebarSection(sections, id)),
};

function failureToast(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

export type SectionThread = Pick<
  EnvironmentThreadShell,
  "environmentId" | "id" | "pinnedAt" | "settledOverride" | "source"
>;

/**
 * Section moves this client just made, keyed by thread, so a dropped thread lands in its new
 * section at once instead of after its server echoes the tag. Null means "out of every section".
 */
const useOptimisticSectionMoves = create<{ moves: ReadonlyMap<string, string | null> }>(() => ({
  moves: new Map(),
}));

// Covers the tag's round trip; after it the thread's real tags are the only truth again.
const OPTIMISTIC_MOVE_HOLD_MS = 2000;

function setOptimisticMove(key: string, sectionId: string | null | undefined) {
  useOptimisticSectionMoves.setState(({ moves }) => {
    const next = new Map(moves);
    if (sectionId === undefined) next.delete(key);
    else next.set(key, sectionId);
    return { moves: next };
  });
}

/** Reads a thread's tags with this client's pending section move applied. */
export function useOptimisticSectionTags() {
  const moves = useOptimisticSectionMoves((state) => state.moves);
  return (thread: Pick<SectionThread, "environmentId" | "id" | "source">) => {
    if (moves.size === 0) return thread.source.tags;
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const move = moves.get(key);
    return move === undefined ? thread.source.tags : tagsWithSection(thread.source.tags, move);
  };
}

/**
 * Moves threads between sections by tagging them on their server. With `actions`, moving a
 * pinned or settled thread in also brings it back, since it would otherwise stay in its bucket.
 */
export function useSectionMembership(
  actions?: Pick<ReturnType<typeof useThreadActions>, "unpinThread" | "unsettleThread">,
) {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag, { reportFailure: false });

  const writeTag = async (thread: SectionThread, tag: string, tagged: boolean) => {
    const result = await setTag({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, tag, tagged },
    });
    if (result._tag === "Success") return true;
    if (!isAtomCommandInterrupted(result)) {
      failureToast("Failed to move thread", squashAtomCommandFailure(result));
    }
    return false;
  };

  const clearSections = async (thread: SectionThread, keepSectionId: string | null) => {
    for (const tag of staleSectionTags(thread.source.tags, keepSectionId)) {
      if (!(await writeTag(thread, tag, false))) return false;
    }
    return true;
  };

  const optimistically = async (
    thread: SectionThread,
    sectionId: string | null,
    write: () => Promise<boolean>,
  ) => {
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    setOptimisticMove(key, sectionId);
    const ok = await write();
    if (!ok) {
      setOptimisticMove(key, undefined);
      return false;
    }
    setTimeout(() => {
      if (useOptimisticSectionMoves.getState().moves.get(key) === sectionId) {
        setOptimisticMove(key, undefined);
      }
    }, OPTIMISTIC_MOVE_HOLD_MS);
    return true;
  };

  const moveToSection = async (thread: SectionThread, sectionId: string) => {
    const tag = sidebarSectionTag(sectionId);
    const moved = await optimistically(thread, sectionId, async () => {
      if (!(await clearSections(thread, sectionId))) return false;
      return (thread.source.tags ?? []).includes(tag) || writeTag(thread, tag, true);
    });
    if (!moved) return;
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    if (actions && thread.pinnedAt != null) await actions.unpinThread(ref);
    if (actions && thread.settledOverride === "settled") await actions.unsettleThread(ref);
  };

  const removeFromSection = async (thread: SectionThread) => {
    await optimistically(thread, null, () => clearSections(thread, null));
  };

  return { moveToSection, removeFromSection };
}
