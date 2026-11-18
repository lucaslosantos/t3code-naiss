import type { Collision, CollisionDetection } from "@dnd-kit/core";

import { sidebarMarkerId } from "../../Sidebar.logic";
import { parseSidebarSectionDropId } from "./customSections.logic";

/**
 * A pointer inside a custom section collides with its sortable parent, carrying the section
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
        // The sortable parent moves when the pinned preview opens; cached child rects miss that transform.
        const rect = container.node.current?.getBoundingClientRect();
        if (
          rect &&
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top - 1 &&
          pointer.y <= rect.bottom + 1
        ) {
          return [{ id: sidebarMarkerId("custom-sections"), data: { sectionId } }];
        }
      }
    }
    return base({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        const id = String(container.id);
        return listIds.has(id);
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
