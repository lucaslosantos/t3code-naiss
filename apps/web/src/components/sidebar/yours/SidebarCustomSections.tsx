import { T, useGT, useMessages } from "gt-react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { ChevronDownIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

import { readLocalApi } from "~/localApi";
import { cn } from "~/lib/utils";
import { animateSidebarLayoutChanges, sidebarMarkerId } from "../../Sidebar.logic";
import { Button } from "../../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";
import { SIDEBAR_SORTABLE_DRAG_DISABLED } from "../SidebarThreadRow";
import { customSectionDropTarget } from "./customSections.drag";
import {
  type CustomSectionGroup,
  normalizeSectionColor,
  sectionReorderIndex,
  sidebarSectionDropId,
} from "./customSections.logic";
import {
  SECTION_COLOR_ORDER,
  SECTION_COLOR_STYLES,
  SectionGlyph,
  SectionIconPicker,
} from "./SectionIconPicker";
import { resolveSectionIcon } from "./sectionIcons.logic";
import {
  sectionDefinitions,
  type SectionThread,
  useSectionMembership,
  useSectionRenameStore,
} from "./useCustomSections";

export interface RenderedSectionGroup<T> extends CustomSectionGroup<T> {
  /** Every thread in the section; `threads` drops the hidden ones while it is collapsed. */
  readonly members: readonly T[];
}

/**
 * The user's sections, between Pinned and Active. One sortable marker holds them all, so the
 * list's drag projection reserves their height; threads drop onto a section through the
 * droppables inside it.
 */
export function SidebarCustomSections<T extends SectionThread>(props: {
  groups: ReadonlyArray<RenderedSectionGroup<T>>;
  renderThread: (thread: T) => ReactNode;
}) {
  const { setNodeRef, transform, transition } = useSortable({
    id: sidebarMarkerId("custom-sections"),
    disabled: SIDEBAR_SORTABLE_DRAG_DISABLED,
    animateLayoutChanges: animateSidebarLayoutChanges,
  });
  const dnd = useDndContext();
  const dragging = dnd.active !== null;
  const dropTargetId = dragging ? customSectionDropTarget(dnd.collisions) : null;
  const activeId = dnd.active === null ? null : String(dnd.active.id);
  // The block's drag transform makes it a stacking context; lift it so a row dragged out of
  // a section stays above the rows below.
  const draggingFromInside =
    activeId !== null &&
    props.groups.some((group) =>
      group.threads.some(
        (thread) => scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) === activeId,
      ),
    );
  const { listRef, reordering, startReorder, reorderStyleFor, consumeReorderClick } =
    useSectionReorder(props.groups.length);
  return (
    <li
      ref={setNodeRef}
      data-thread-selection-safe
      data-testid="sidebar-custom-sections"
      className={cn("list-none", draggingFromInside && "relative z-30")}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        visibility: transform?.scaleY === 0 ? "hidden" : undefined,
      }}
    >
      <ul ref={listRef} className="flex flex-col gap-1.5 pt-1">
        {props.groups.map((group, index) => (
          <CustomSection
            key={group.section.id}
            group={group}
            isFirst={index === 0}
            isLast={index === props.groups.length - 1}
            dragging={dragging}
            isDropTarget={dropTargetId === group.section.id}
            reorderStyle={reorderStyleFor(index)}
            reordering={reordering}
            onHeaderPointerDown={(event) => startReorder(event, group.section.id, index)}
            consumeHeaderClick={consumeReorderClick}
            renderThread={props.renderThread}
          />
        ))}
      </ul>
    </li>
  );
}

const SECTION_DRAG_DISTANCE = 4;

/**
 * Drag a section's header to move the whole section. Plain pointer tracking rather than
 * dnd-kit: the sections sit inside the thread list's drag context, and a nested context
 * would capture the thread rows inside them.
 */
function useSectionReorder(count: number) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<{
    id: string;
    from: number;
    rects: Array<{ top: number; height: number }>;
    deltaY: number;
  } | null>(null);

  const start = (event: ReactPointerEvent<HTMLElement>, id: string, from: number) => {
    if (event.button !== 0 || count < 2 || event.pointerType === "touch") return;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    let started: { rects: Array<{ top: number; height: number }> } | null = null;
    let deltaY = 0;
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      deltaY = moveEvent.clientY - startY;
      if (started === null) {
        if (Math.abs(deltaY) < SECTION_DRAG_DISTANCE || listRef.current === null) return;
        started = {
          rects: Array.from(listRef.current.children, (child) => {
            const rect = child.getBoundingClientRect();
            return { top: rect.top, height: rect.height };
          }),
        };
        handle.setPointerCapture(pointerId);
      }
      moveEvent.preventDefault();
      setDrag({ id, from, rects: started.rects, deltaY });
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      if (started === null) return;
      // The release lands on the header as a click; it must not also fold the section.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      if (commit) {
        const to = sectionReorderIndex(started.rects, from, deltaY);
        if (to !== from) sectionDefinitions.moveTo(id, to);
      }
      setDrag(null);
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === pointerId) finish(true);
    };
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) finish(false);
    };
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || started === null) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      finish(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  };

  const target = drag === null ? null : sectionReorderIndex(drag.rects, drag.from, drag.deltaY);
  const styleFor = (index: number): CSSProperties | undefined => {
    if (drag === null || target === null) return undefined;
    if (index === drag.from) return { transform: `translateY(${drag.deltaY}px)` };
    const dragged = drag.rects[drag.from]!;
    const next = drag.rects[1];
    const gap = next && drag.rects[0] ? next.top - drag.rects[0].top - drag.rects[0].height : 0;
    const shift =
      drag.from < target && index > drag.from && index <= target
        ? -(dragged.height + gap)
        : target < drag.from && index >= target && index < drag.from
          ? dragged.height + gap
          : 0;
    return { transform: `translateY(${shift}px)`, transition: "transform 150ms ease-out" };
  };

  return {
    listRef,
    reordering: drag === null ? null : drag.id,
    startReorder: start,
    reorderStyleFor: styleFor,
    consumeReorderClick: () => suppressClickRef.current,
  };
}

function CustomSection<T extends SectionThread>(props: {
  group: RenderedSectionGroup<T>;
  isFirst: boolean;
  isLast: boolean;
  dragging: boolean;
  isDropTarget: boolean;
  reorderStyle: CSSProperties | undefined;
  reordering: string | null;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  consumeHeaderClick: () => boolean;
  renderThread: (thread: T) => ReactNode;
}) {
  const { section, threads, members } = props.group;
  const count = members.length;
  const { removeFromSection } = useSectionMembership();
  const { setNodeRef } = useDroppable({ id: sidebarSectionDropId(section.id) });
  const renaming = useSectionRenameStore((state) => state.renamingId === section.id);
  const setRenamingId = useSectionRenameStore((state) => state.setRenamingId);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const rowId = `section:${section.id}`;
  const color = normalizeSectionColor(section.color);
  const styles = SECTION_COLOR_STYLES[color];
  const gt = useGT();
  const m = useMessages();

  const openMenu = (position: { x: number; y: number }) => {
    const api = readLocalApi();
    if (!api) return;
    void (async () => {
      const clicked = await settlePromise(() =>
        api.contextMenu.show(
          [
            { id: "rename", label: gt("Rename section"), icon: "pencil" },
            { id: "icon", label: gt("Icon…", { $context: "menu item: change section icon" }) },
            {
              id: "color",
              label: gt("Color", { $context: "section color" }),
              children: SECTION_COLOR_ORDER.map((option) => ({
                id: `color:${option}`,
                label: m(SECTION_COLOR_STYLES[option].label),
                checked: option === color,
              })),
            },
            { id: "move-up", label: gt("Move up"), disabled: props.isFirst, separatorBefore: true },
            { id: "move-down", label: gt("Move down"), disabled: props.isLast },
            { id: "new", label: gt("New section"), icon: "folder-plus", separatorBefore: true },
            {
              id: "delete",
              label: gt("Delete section"),
              ...(count > 0 ? { detail: gt("Threads go back to Active") } : {}),
              icon: "trash",
              destructive: true,
              separatorBefore: true,
            },
          ],
          position,
        ),
      );
      if (clicked._tag === "Failure" || clicked.value === null) return;
      const value = clicked.value;
      if (value.startsWith("color:")) {
        sectionDefinitions.setColor(section.id, value.slice("color:".length));
        return;
      }
      switch (value) {
        case "rename":
          setRenamingId(section.id);
          return;
        case "icon":
          setPickerOpen(true);
          return;
        case "move-up":
          sectionDefinitions.move(section.id, -1);
          return;
        case "move-down":
          sectionDefinitions.move(section.id, 1);
          return;
        case "new":
          setRenamingId(sectionDefinitions.create());
          return;
        case "delete":
          sectionDefinitions.delete(section.id);
          // Unknown section tags are ignored anyway; clearing them keeps the thread's tags tidy.
          for (const thread of members) void removeFromSection(thread);
          return;
      }
    })();
  };

  const highlighted = props.isDropTarget;
  const lifted = props.reordering === section.id;
  return (
    <li
      ref={setNodeRef}
      data-testid="sidebar-custom-section"
      style={props.reorderStyle}
      className={cn(
        "group/custom-section relative list-none rounded-lg transition-colors duration-150 motion-reduce:transition-none",
        highlighted ? [styles.dropFill, styles.drop] : styles.fill,
        threads.length > 0 && "pb-1",
        lifted && "z-20 shadow-lg ring-1 ring-sidebar-foreground/8",
      )}
    >
      {renaming ? (
        <SectionNameInput
          name={section.name}
          glyph={<SectionGlyph icon={resolveSectionIcon(section.icon)} color={color} />}
          onDone={(name) => {
            setRenamingId(null);
            if (name !== null && name !== section.name) sectionDefinitions.rename(section.id, name);
          }}
        />
      ) : (
        <>
          <button
            type="button"
            data-sidebar-row={rowId}
            aria-expanded={!section.collapsed}
            onPointerDown={props.onHeaderPointerDown}
            onClick={() => {
              if (props.consumeHeaderClick()) return;
              sectionDefinitions.setCollapsed(section.id, !section.collapsed);
            }}
            onDoubleClick={() => setRenamingId(section.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu({ x: event.clientX, y: event.clientY });
            }}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md ps-8 pe-2 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
              lifted && "cursor-grabbing",
              highlighted || props.dragging || lifted
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
            )}
          >
            <span className="min-w-0 truncate">{section.name}</span>
            <span aria-hidden className="h-px min-w-2 flex-1 invisible" />
            <span className="shrink-0 rounded-full bg-sidebar-foreground/6 px-1.5 text-3xs leading-4 font-medium tabular-nums text-sidebar-muted-foreground group-hover/custom-section:invisible group-has-[[data-sidebar-action-for]:focus]/custom-section:invisible pointer-coarse:invisible">
              {count}
            </span>
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-3 shrink-0 text-sidebar-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
                section.collapsed && "-rotate-90",
              )}
            />
          </button>
          {/* Its own button beside the header's, since buttons cannot nest. Centered over the thread icons. */}
          <span className="absolute top-1.5 left-2 flex">
            <SectionIconPicker
              section={section}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              triggerRef={iconButtonRef}
            />
          </span>
          {/* Sits over the count, which hides on hover or focus, and left of the chevron. */}
          <span
            className={cn(
              "absolute top-0 right-6 flex h-8 items-center gap-0.5 opacity-0 focus-within:opacity-100 pointer-coarse:opacity-100",
              props.reordering === null &&
                !props.dragging &&
                "group-hover/custom-section:opacity-100",
            )}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    data-sidebar-action-for={rowId}
                    size="icon-xs"
                    variant="ghost-muted"
                    aria-label={gt("New section")}
                    onClick={() => setRenamingId(sectionDefinitions.create())}
                  />
                }
              >
                <PlusIcon aria-hidden />
              </TooltipTrigger>
              <TooltipPopup>
                <T>New section</T>
              </TooltipPopup>
            </Tooltip>
            <Button
              ref={menuButtonRef}
              data-sidebar-action-for={rowId}
              size="icon-xs"
              variant="ghost-muted"
              aria-label={gt("{name} options", { name: section.name })}
              onClick={() => {
                const rect = menuButtonRef.current?.getBoundingClientRect();
                if (rect) openMenu({ x: rect.left, y: rect.bottom + 4 });
              }}
            >
              <EllipsisIcon aria-hidden />
            </Button>
          </span>
        </>
      )}
      {threads.length > 0 ? (
        <ul className="flex flex-col gap-px px-1">
          {threads.map((thread) => props.renderThread(thread))}
        </ul>
      ) : !section.collapsed ? (
        // Same height idle and mid-drag, so nothing shifts under the pointer.
        <div
          className={cn(
            "mx-1 mb-1 flex h-7 items-center rounded-md border border-dashed ps-2.5 text-xs transition-colors duration-150 motion-reduce:transition-none",
            highlighted
              ? styles.dropHint
              : props.dragging
                ? "border-sidebar-foreground/15 text-sidebar-muted-foreground"
                : "border-transparent text-sidebar-muted-foreground/60",
          )}
        >
          {props.dragging ? <T>Drop here</T> : <T>No threads</T>}
        </div>
      ) : null}
    </li>
  );
}

function SectionNameInput(props: {
  name: string;
  glyph: ReactNode;
  onDone: (name: string | null) => void;
}) {
  // Enter and Escape blur the input as it unmounts; that blur must not commit again.
  const doneRef = useRef(false);
  const finish = (name: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    props.onDone(name === null ? null : name.trim() || null);
  };
  const gt = useGT();
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      finish(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(null);
    }
  };
  return (
    <div className="flex h-8 items-center gap-0.5 ps-2 pe-2">
      {props.glyph}
      <input
        autoFocus
        defaultValue={props.name}
        dir="auto"
        aria-label={gt("Section name")}
        maxLength={60}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={handleKeyDown}
        onBlur={(event) => finish(event.currentTarget.value)}
        className="h-6 min-w-0 flex-1 rounded-md bg-sidebar/70 px-1.5 text-xs font-semibold text-sidebar-foreground shadow-xs outline-none ring-1 ring-inset ring-sidebar-foreground/10 selection:bg-sidebar-foreground/15"
      />
    </div>
  );
}
