import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "../../../rpc/atomRegistry";
import { environmentThreadShells } from "../../../state/threads";
import { buildMascotHerd, sameHerd, type HerdMember } from "./mascotHerd.logic";

const maxVisits = 8;
const visitsAtom = Atom.make<ReadonlyArray<string>>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("mascot-visits"),
);

/** Remembers the open thread so it stays in the stack after you move to another one. */
export function recordMascotVisit(threadKey: string) {
  const visits = appAtomRegistry.get(visitsAtom);
  if (visits[0] === threadKey) return;
  appAtomRegistry.set(
    visitsAtom,
    [threadKey, ...visits.filter((key) => key !== threadKey)].slice(0, maxVisits),
  );
}

let previous: ReadonlyArray<HerdMember> = [];
// Quiet shells hold still while a thread streams, so only status and title changes rebuild this.
const herdAtom = Atom.make((get) => {
  const next = buildMascotHerd(get(environmentThreadShells.quietThreadShellsAtom), get(visitsAtom));
  if (sameHerd(previous, next)) return previous;
  previous = next;
  return next;
}).pipe(Atom.withLabel("mascot-herd"));

export function useMascotHerd(): ReadonlyArray<HerdMember> {
  return useAtomValue(herdAtom);
}
