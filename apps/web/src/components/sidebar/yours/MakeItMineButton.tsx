// Fork-only: always-present sidebar button that hands app changes to an agent.
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { T, useGT, useMessages } from "gt-react";
import { PaletteIcon } from "lucide-react";
import { Fragment, memo } from "react";

import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useProjects } from "~/state/entities";

import {
  Menu,
  MenuItem,
  MenuItemDetail,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../../ui/menu";
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "../../ui/sidebar";
import { toastManager } from "../../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";
import {
  FORK_FOLDER_NAME,
  findForkProject,
  MAKE_IT_MINE_ACTIONS,
  type MakeItMineActionSpec,
} from "./makeItMine.logic";

export const MakeItMineButton = memo(function MakeItMineButton() {
  const projects = useProjects();
  const handleNewThread = useNewThreadHandler();
  const { isMobile, setOpenMobile } = useSidebar();
  const gt = useGT();
  const m = useMessages();

  const run = async (action: MakeItMineActionSpec) => {
    const project = findForkProject(projects);
    if (project === null) {
      toastManager.add({
        type: "warning",
        title: gt("Your T3 Code folder isn’t a project yet"),
        description: gt("Add the “{folder}” folder as a project, then try again.", {
          folder: FORK_FOLDER_NAME,
        }),
      });
      return;
    }
    if (isMobile) setOpenMobile(false);
    // Each change gets its own worktree off the fork branch, so changes never collide.
    await handleNewThread(scopeProjectRef(project.environmentId, project.id), {
      envMode: "worktree",
      branch: "yours",
      prompt: action.prompt,
    });
  };

  return (
    <SidebarMenuItem className="shrink-0">
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={<SidebarMenuButton aria-label={gt("Make it mine")} size="icon" />}
              />
            }
          >
            <PaletteIcon />
          </TooltipTrigger>
          <TooltipPopup side="top">
            <T>Make it mine</T>
          </TooltipPopup>
        </Tooltip>
        <MenuPopup side="top" align="start">
          {MAKE_IT_MINE_ACTIONS.map((action, index) => (
            <Fragment key={action.id}>
              {index === 1 ? <MenuSeparator /> : null}
              <MenuItem onClick={() => void run(action)}>
                {m(action.label)}
                <MenuItemDetail>{m(action.detail)}</MenuItemDetail>
              </MenuItem>
            </Fragment>
          ))}
        </MenuPopup>
      </Menu>
    </SidebarMenuItem>
  );
});
