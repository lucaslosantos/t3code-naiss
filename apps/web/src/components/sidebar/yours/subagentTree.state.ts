import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "../../../state/threads";
import {
  buildSubagentIndex,
  buildSubagentTree,
  NO_SUBAGENTS,
  sameSubagentTree,
  type SubagentNode,
} from "./subagentTree.logic";

// Quiet shells hold still while a thread streams, so only status and title changes rebuild this.
const subagentIndexAtom = Atom.make((get) =>
  buildSubagentIndex(
    get(environmentThreadShells.quietThreadShellsAtom),
    get(environmentThreadShells.delegatedUnderParentAtom),
  ),
).pipe(Atom.withLabel("sidebar-subagent-index"));

const subagentTreeAtomFamily = Atom.family((parentKey: string) => {
  let previous: ReadonlyArray<SubagentNode> = NO_SUBAGENTS;
  return Atom.make((get) => {
    const next = buildSubagentTree(get(subagentIndexAtom), parentKey);
    if (sameSubagentTree(previous, next)) return previous;
    previous = next;
    return next;
  }).pipe(Atom.withLabel(`sidebar-subagent-tree:${parentKey}`));
});

const hasSubagentsAtomFamily = Atom.family((parentKey: string) =>
  Atom.make((get) => get(subagentTreeAtomFamily(parentKey)).length > 0).pipe(
    Atom.withLabel(`sidebar-has-subagents:${parentKey}`),
  ),
);
const NEVER_HAS_SUBAGENTS = Atom.make(false).pipe(Atom.withLabel("sidebar-has-subagents:off"));

/** Whether a row has children to frame; a boolean, so rows re-render only when that flips. */
export function useHasSubagents(parentKey: string, enabled: boolean): boolean {
  return useAtomValue(enabled ? hasSubagentsAtomFamily(parentKey) : NEVER_HAS_SUBAGENTS);
}

export function useSubagentTree(parentKey: string): ReadonlyArray<SubagentNode> {
  return useAtomValue(subagentTreeAtomFamily(parentKey));
}
