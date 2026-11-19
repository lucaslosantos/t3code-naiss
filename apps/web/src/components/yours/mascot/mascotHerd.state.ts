import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "../../../state/threads";
import { buildMascotHerd, sameHerd, type HerdMember } from "./mascotHerd.logic";

let previous: ReadonlyArray<HerdMember> = [];
// Quiet shells hold still while a thread streams, so only status and title changes rebuild this.
const herdAtom = Atom.make((get) => {
  const next = buildMascotHerd(get(environmentThreadShells.quietThreadShellsAtom));
  if (sameHerd(previous, next)) return previous;
  previous = next;
  return next;
}).pipe(Atom.withLabel("mascot-herd"));

export function useMascotHerd(): ReadonlyArray<HerdMember> {
  return useAtomValue(herdAtom);
}
