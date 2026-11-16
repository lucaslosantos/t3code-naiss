import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { SIDEBAR_SECTION_COLORS } from "@t3tools/contracts";
import { ChevronDownIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { readLocalApi } from "~/localApi";
import { cn } from "~/lib/utils";
import { animateSidebarLayoutChanges, sidebarMarkerId } from "../../Sidebar.logic";
import { Button } from "../../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";
import { SIDEBAR_SORTABLE_DRAG_DISABLED } from "../SidebarThreadRow";
import {
  type CustomSectionGroup,
  normalizeSectionColor,
  sidebarSectionDropId,
} from "./customSections.logic";
import {
  sectionDefinitions,
  type SectionThread,
  useSectionMembership,
  useSectionRenameStore,
} from "./useCustomSections";

const SECTION_COLOR_DOT = {
  gray: "bg-sidebar-muted-foreground/60",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-violet-500",
  pink: "bg-pink-500",
} as const satisfies Record<(typeof SIDEBAR_SECTION_COLORS)[number], string>;

const COLOR_LABEL = {
  gray: "Gray",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  orange: "Orange",
  red: "Red",
  purple: "Purple",
  pink: "Pink",
} as const satisfies Record<(typeof SIDEBAR_SECTION_COLORS)[number], string>;

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
  const dragging = useDndContext().active !== null;
  return (
    <li
      ref={setNodeRef}
      data-thread-selection-safe
      data-testid="sidebar-custom-sections"
      className="list-none"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        visibility: transform?.scaleY === 0 ? "hidden" : undefined,
      }}
    >
      <ul className="flex flex-col gap-px pt-1">
        {props.groups.map((group, index) => (
          <CustomSection
            key={group.section.id}
            group={group}
            isFirst={index === 0}
            isLast={index === props.groups.length - 1}
            dragging={dragging}
            renderThread={props.renderThread}
          />
        ))}
      </ul>
    </li>
  );
}

function CustomSection<T extends SectionThread>(props: {
  group: RenderedSectionGroup<T>;
  isFirst: boolean;
  isLast: boolean;
  dragging: boolean;
  renderThread: (thread: T) => ReactNode;
}) {
  const { section, threads, members } = props.group;
  const count = members.length;
  const { removeFromSection } = useSectionMembership();
  const { setNodeRef, isOver } = useDroppable({ id: sidebarSectionDropId(section.id) });
  const renaming = useSectionRenameStore((state) => state.renamingId === section.id);
  const setRenamingId = useSectionRenameStore((state) => state.setRenamingId);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const rowId = `section:${section.id}`;
  const color = normalizeSectionColor(section.color);

  const openMenu = (position: { x: number; y: number }) => {
    const api = readLocalApi();
    if (!api) return;
    void (async () => {
      const clicked = await settlePromise(() =>
        api.contextMenu.show(
          [
            { id: "rename", label: "Rename section", icon: "pencil" },
            {
              id: "color",
              label: "Color",
              children: SIDEBAR_SECTION_COLORS.map((option) => ({
                id: `color:${option}`,
                label: COLOR_LABEL[option],
                checked: option === color,
              })),
            },
            { id: "move-up", label: "Move up", disabled: props.isFirst, separatorBefore: true },
            { id: "move-down", label: "Move down", disabled: props.isLast },
            { id: "new", label: "New section", icon: "folder-plus", separatorBefore: true },
            {
              id: "delete",
              label: "Delete section",
              ...(count > 0 ? { detail: "Threads go back to Active" } : {}),
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

  const highlighted = props.dragging && isOver;
  return (
    <li
      ref={setNodeRef}
      data-testid="sidebar-custom-section"
      className={cn(
        "group/custom-section relative list-none rounded-md",
        highlighted && "bg-primary/5 ring-1 ring-inset ring-primary/40",
      )}
    >
      {renaming ? (
        <SectionNameInput
          name={section.name}
          dotClassName={SECTION_COLOR_DOT[color]}
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
            onClick={() => sectionDefinitions.setCollapsed(section.id, !section.collapsed)}
            onDoubleClick={() => setRenamingId(section.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu({ x: event.clientX, y: event.clientY });
            }}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
              highlighted
                ? "text-primary"
                : props.dragging
                  ? "text-sidebar-foreground/80"
                  : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", SECTION_COLOR_DOT[color])}
            />
            <span className="min-w-0 truncate">{section.name}</span>
            <span aria-hidden className="h-px min-w-2 flex-1 invisible" />
            <span className="shrink-0 font-normal tabular-nums group-hover/custom-section:invisible group-has-[[data-sidebar-action-for]:focus]/custom-section:invisible pointer-coarse:invisible">
              {count}
            </span>
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-3 shrink-0 transition-transform motion-reduce:transition-none",
                section.collapsed && "-rotate-90",
              )}
            />
          </button>
          {/* Sits over the count, which hides on hover or focus, and left of the chevron. */}
          <span className="absolute top-0 right-6 flex h-8 items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover/custom-section:opacity-100 pointer-coarse:opacity-100">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    data-sidebar-action-for={rowId}
                    size="icon-xs"
                    variant="ghost-muted"
                    aria-label="New section"
                    onClick={() => setRenamingId(sectionDefinitions.create())}
                  />
                }
              >
                <PlusIcon aria-hidden />
              </TooltipTrigger>
              <TooltipPopup>New section</TooltipPopup>
            </Tooltip>
            <Button
              ref={menuButtonRef}
              data-sidebar-action-for={rowId}
              size="icon-xs"
              variant="ghost-muted"
              aria-label={`${section.name} options`}
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
        <ul className="flex flex-col gap-px">
          {threads.map((thread) => props.renderThread(thread))}
        </ul>
      ) : !section.collapsed ? (
        <div
          className={cn(
            "mx-0.5 mb-1 flex h-9 items-center justify-center rounded-md border border-dashed text-xs",
            highlighted
              ? "border-primary/40 text-primary"
              : "border-sidebar-foreground/15 text-sidebar-muted-foreground",
          )}
        >
          Drag threads here
        </div>
      ) : null}
    </li>
  );
}

function SectionNameInput(props: {
  name: string;
  dotClassName: string;
  onDone: (name: string | null) => void;
}) {
  // Enter and Escape blur the input as it unmounts; that blur must not commit again.
  const doneRef = useRef(false);
  const finish = (name: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    props.onDone(name === null ? null : name.trim() || null);
  };
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
    <div className="flex h-8 items-center gap-2 px-2">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", props.dotClassName)} />
      <input
        autoFocus
        defaultValue={props.name}
        dir="auto"
        aria-label="Section name"
        maxLength={60}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={handleKeyDown}
        onBlur={(event) => finish(event.currentTarget.value)}
        className="-mx-1 min-w-0 flex-1 rounded-sm bg-card px-1 text-xs font-medium text-card-foreground outline-none ring-1 ring-inset ring-input focus:ring-foreground"
      />
    </div>
  );
}
