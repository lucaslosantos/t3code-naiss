import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "../../../rpc/atomRegistry";
import { environmentThreadShells } from "../../../state/threads";
import { buildMascotHerd, nextForYou, sameHerd, type HerdMember } from "./mascotHerd.logic";

/** The companion's artwork is not in the repo; without it neither the companion nor its pill shows. */
export const companionUrl = Object.values(
  import.meta.glob<string>("./companion.riv", {
    eager: true,
    query: "?url",
    import: "default",
  }),
)[0];

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

/** Room the timeline keeps under its last row for the "Next unread" pill, so the pill covers nothing. */
export function useNextUnreadPillInset(threadKey: string, mounted: boolean): number {
  const pill = nextForYou(useMascotHerd(), threadKey) !== null;
  return pill && mounted && companionUrl ? 34 : 0;
}

const nextUnreadRequests = new EventTarget();

/** Asks the mounted companion to fly to the next thread that wants you; false when none is listening. */
export function requestNextUnread(): boolean {
  return !nextUnreadRequests.dispatchEvent(new Event("next", { cancelable: true }));
}

export function onNextUnreadRequest(handle: () => void) {
  const listener = (event: Event) => {
    event.preventDefault();
    handle();
  };
  nextUnreadRequests.addEventListener("next", listener);
  return () => nextUnreadRequests.removeEventListener("next", listener);
}
