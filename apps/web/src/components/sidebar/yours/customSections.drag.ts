import type { CollisionDetection } from "@dnd-kit/core";

import { sidebarMarkerId } from "../../Sidebar.logic";
import { parseSidebarSectionDropId } from "./customSections.logic";

const CUSTOM_SECTIONS_MARKER_ID = sidebarMarkerId("custom-sections");

/**
 * A pointer inside a custom section targets that section. Everywhere else the list's own
 * detection runs over the list's items only, so rows nested in sections never become
 * reorder targets and the sections block is never a slot to drop into.
 */
export function withCustomSectionCollisions(
  base: CollisionDetection,
  listIds: ReadonlySet<string>,
): CollisionDetection {
  return (args) => {
    const pointer = args.pointerCoordinates;
    if (pointer) {
      for (const container of args.droppableContainers) {
        if (parseSidebarSectionDropId(String(container.id)) === null) continue;
        const rect = args.droppableRects.get(container.id);
        if (
          rect &&
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom
        ) {
          return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
        }
      }
    }
    return base({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        const id = String(container.id);
        return listIds.has(id) && id !== CUSTOM_SECTIONS_MARKER_ID;
      }),
    });
  };
}
