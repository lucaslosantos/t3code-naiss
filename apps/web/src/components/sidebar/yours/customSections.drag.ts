import type { Collision, CollisionDetection } from "@dnd-kit/core";

import { sidebarMarkerId } from "../../Sidebar.logic";
import { parseSidebarSectionDropId } from "./customSections.logic";

const CUSTOM_SECTIONS_MARKER_ID = sidebarMarkerId("custom-sections");

/**
 * A pointer inside a custom section collides with the dragged row itself, carrying the section
 * in its data: dnd-kit only moves the drag source while `over` is a sortable item. Elsewhere the
 * list's own detection runs over the list's items only.
 */
export function withCustomSectionCollisions(
  base: CollisionDetection,
  listIds: ReadonlySet<string>,
): CollisionDetection {
  return (args) => {
    const pointer = args.pointerCoordinates;
    if (pointer) {
      for (const container of args.droppableContainers) {
        const sectionId = parseSidebarSectionDropId(String(container.id));
        if (sectionId === null) continue;
        const rect = args.droppableRects.get(container.id);
        if (
          rect &&
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom
        ) {
          return [{ id: args.active.id, data: { sectionId } }];
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

/** The custom section a drag is over, from the collisions `withCustomSectionCollisions` made. */
export function customSectionDropTarget(
  collisions: ReadonlyArray<Collision> | null | undefined,
): string | null {
  const sectionId: unknown = collisions?.[0]?.data?.sectionId;
  return typeof sectionId === "string" ? sectionId : null;
}
