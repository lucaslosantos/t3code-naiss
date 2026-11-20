import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { msg, useMessages } from "gt-react";
import { MailOpenIcon } from "lucide-react";

import { buildThreadRouteParams } from "../../../threadRoutes";
import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "../../CommandPalette.logic";
import { useRouteThreadRef } from "../useRouteThreadRef";
import { nextForYou } from "./mascotHerd.logic";
import { requestNextUnread, useMascotHerd } from "./mascotHerd.state";

const TITLE = msg("Go to next unread thread");

/** "Go to next unread thread", while one wants you. The companion flies there when it's on screen. */
export function useNextUnreadPaletteItems(): CommandPaletteActionItem[] {
  const routeThreadRef = useRouteThreadRef();
  const next = nextForYou(
    useMascotHerd(),
    routeThreadRef === null ? null : scopedThreadKey(routeThreadRef),
  );
  const navigate = useNavigate();
  const m = useMessages();
  if (next === null) return [];
  return [
    {
      kind: "action",
      value: "action:next-unread-thread",
      title: m(TITLE),
      description: next.title,
      searchTerms: ["next", "unread", "thread", "needs you", "inbox", "done"],
      icon: <MailOpenIcon className={ITEM_ICON_CLASS} />,
      shortcutCommand: "thread.nextUnread",
      run: async () => {
        if (requestNextUnread()) return;
        await navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(next.ref),
        });
      },
    },
  ];
}
