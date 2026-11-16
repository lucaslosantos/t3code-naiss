import type { ScopedThreadRef } from "@t3tools/contracts";

import { useComposerDraftStore } from "../../composerDraftStore";
import { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";

/** The thread the main view shows, for server threads and drafts alike. */
export function useRouteThreadRef(): ScopedThreadRef | null {
  const routeTarget = useThreadRouteTarget();
  const draftSession = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null,
  );
  if (routeTarget?.kind === "server") return routeTarget.threadRef;
  if (routeTarget?.kind === "draft" && draftSession) {
    return { environmentId: draftSession.environmentId, threadId: draftSession.threadId };
  }
  return null;
}
