import { type SidebarCustomSection, type SidebarSectionColor } from "@t3tools/contracts";
import { msg, T, useGT, useMessages } from "gt-react";
import { SearchIcon } from "lucide-react";
import { type RefObject, useState } from "react";

import { cn } from "~/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../ui/input-group";
import { Popover, PopoverPopup, PopoverTrigger } from "../../ui/popover";
import { Toggle, ToggleGroup } from "../../ui/toggle-group";
import { normalizeSectionColor } from "./customSections.logic";
import { searchSectionEmoji } from "./sectionEmoji.logic";
import { SECTION_ICON_COMPONENTS } from "./sectionIcons";
import {
  parseSingleEmoji,
  type ResolvedSectionIcon,
  resolveSectionIcon,
  searchSectionIcons,
} from "./sectionIcons.logic";
import { sectionDefinitions } from "./useCustomSections";

/** Per-color classes. Fills are opaque, so a lifted section still covers the rows it passes over. */
export const SECTION_COLOR_STYLES = {
  gray: {
    fill: "bg-[color-mix(in_oklab,var(--color-zinc-500)_12%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-zinc-500)_22%,var(--color-sidebar))]",
    label: msg("Gray", { $context: "section color" }),
    dot: "bg-sidebar-muted-foreground/60",
    chip: "bg-sidebar-foreground/10 text-sidebar-foreground/75",
    drop: "ring-1 ring-inset ring-sidebar-foreground/25",
    dropHint: "border-sidebar-foreground/30 text-sidebar-foreground/80",
  },
  red: {
    fill: "bg-[color-mix(in_oklab,var(--color-red-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-red-500)_32%,var(--color-sidebar))]",
    label: msg("Red", { $context: "section color" }),
    dot: "bg-red-500",
    chip: "bg-red-500/20 text-red-600 dark:text-red-400",
    drop: "ring-1 ring-inset ring-red-500/50",
    dropHint: "border-red-500/50 text-red-600 dark:text-red-400",
  },
  rose: {
    fill: "bg-[color-mix(in_oklab,var(--color-rose-400)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-rose-400)_32%,var(--color-sidebar))]",
    label: msg("Rose", { $context: "section color" }),
    dot: "bg-rose-400",
    chip: "bg-rose-400/20 text-rose-600 dark:text-rose-400",
    drop: "ring-1 ring-inset ring-rose-400/50",
    dropHint: "border-rose-400/50 text-rose-600 dark:text-rose-400",
  },
  pink: {
    fill: "bg-[color-mix(in_oklab,var(--color-pink-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-pink-500)_32%,var(--color-sidebar))]",
    label: msg("Pink", { $context: "section color" }),
    dot: "bg-pink-500",
    chip: "bg-pink-500/20 text-pink-600 dark:text-pink-400",
    drop: "ring-1 ring-inset ring-pink-500/50",
    dropHint: "border-pink-500/50 text-pink-600 dark:text-pink-400",
  },
  fuchsia: {
    fill: "bg-[color-mix(in_oklab,var(--color-fuchsia-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-fuchsia-500)_32%,var(--color-sidebar))]",
    label: msg("Fuchsia", { $context: "section color" }),
    dot: "bg-fuchsia-500",
    chip: "bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
    drop: "ring-1 ring-inset ring-fuchsia-500/50",
    dropHint: "border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400",
  },
  purple: {
    fill: "bg-[color-mix(in_oklab,var(--color-violet-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-violet-500)_32%,var(--color-sidebar))]",
    label: msg("Purple", { $context: "section color" }),
    dot: "bg-violet-500",
    chip: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    drop: "ring-1 ring-inset ring-violet-500/50",
    dropHint: "border-violet-500/50 text-violet-600 dark:text-violet-400",
  },
  indigo: {
    fill: "bg-[color-mix(in_oklab,var(--color-indigo-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-indigo-500)_32%,var(--color-sidebar))]",
    label: msg("Indigo", { $context: "section color" }),
    dot: "bg-indigo-500",
    chip: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    drop: "ring-1 ring-inset ring-indigo-500/50",
    dropHint: "border-indigo-500/50 text-indigo-600 dark:text-indigo-400",
  },
  blue: {
    fill: "bg-[color-mix(in_oklab,var(--color-blue-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-blue-500)_32%,var(--color-sidebar))]",
    label: msg("Blue", { $context: "section color" }),
    dot: "bg-blue-500",
    chip: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    drop: "ring-1 ring-inset ring-blue-500/50",
    dropHint: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  },
  sky: {
    fill: "bg-[color-mix(in_oklab,var(--color-sky-400)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-sky-400)_32%,var(--color-sidebar))]",
    label: msg("Sky", { $context: "section color" }),
    dot: "bg-sky-400",
    chip: "bg-sky-400/20 text-sky-600 dark:text-sky-400",
    drop: "ring-1 ring-inset ring-sky-400/50",
    dropHint: "border-sky-400/50 text-sky-600 dark:text-sky-400",
  },
  cyan: {
    fill: "bg-[color-mix(in_oklab,var(--color-cyan-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-cyan-500)_32%,var(--color-sidebar))]",
    label: msg("Cyan", { $context: "section color" }),
    dot: "bg-cyan-500",
    chip: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    drop: "ring-1 ring-inset ring-cyan-500/50",
    dropHint: "border-cyan-500/50 text-cyan-600 dark:text-cyan-400",
  },
  teal: {
    fill: "bg-[color-mix(in_oklab,var(--color-teal-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-teal-500)_32%,var(--color-sidebar))]",
    label: msg("Teal", { $context: "section color" }),
    dot: "bg-teal-500",
    chip: "bg-teal-500/20 text-teal-600 dark:text-teal-400",
    drop: "ring-1 ring-inset ring-teal-500/50",
    dropHint: "border-teal-500/50 text-teal-600 dark:text-teal-400",
  },
  green: {
    fill: "bg-[color-mix(in_oklab,var(--color-emerald-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-emerald-500)_32%,var(--color-sidebar))]",
    label: msg("Green", { $context: "section color" }),
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    drop: "ring-1 ring-inset ring-emerald-500/50",
    dropHint: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  },
  lime: {
    fill: "bg-[color-mix(in_oklab,var(--color-lime-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-lime-500)_32%,var(--color-sidebar))]",
    label: msg("Lime", { $context: "section color" }),
    dot: "bg-lime-500",
    chip: "bg-lime-500/20 text-lime-700 dark:text-lime-400",
    drop: "ring-1 ring-inset ring-lime-500/50",
    dropHint: "border-lime-500/50 text-lime-700 dark:text-lime-400",
  },
  yellow: {
    fill: "bg-[color-mix(in_oklab,var(--color-amber-400)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-amber-400)_32%,var(--color-sidebar))]",
    label: msg("Yellow", { $context: "section color" }),
    dot: "bg-amber-400",
    chip: "bg-amber-400/20 text-amber-600 dark:text-amber-400",
    drop: "ring-1 ring-inset ring-amber-400/50",
    dropHint: "border-amber-400/50 text-amber-600 dark:text-amber-400",
  },
  orange: {
    fill: "bg-[color-mix(in_oklab,var(--color-orange-500)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-orange-500)_32%,var(--color-sidebar))]",
    label: msg("Orange", { $context: "section color" }),
    dot: "bg-orange-500",
    chip: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    drop: "ring-1 ring-inset ring-orange-500/50",
    dropHint: "border-orange-500/50 text-orange-600 dark:text-orange-400",
  },
  brown: {
    fill: "bg-[color-mix(in_oklab,var(--color-amber-800)_18%,var(--color-sidebar))]",
    dropFill: "bg-[color-mix(in_oklab,var(--color-amber-800)_32%,var(--color-sidebar))]",
    label: msg("Brown", { $context: "section color" }),
    dot: "bg-amber-800",
    chip: "bg-amber-800/20 text-amber-800 dark:text-amber-600",
    drop: "ring-1 ring-inset ring-amber-800/50",
    dropHint: "border-amber-800/50 text-amber-800 dark:text-amber-600",
  },
} as const satisfies Record<
  SidebarSectionColor,
  {
    fill: string;
    dropFill: string;
    label: string;
    dot: string;
    chip: string;
    drop: string;
    dropHint: string;
  }
>;

/** Picker and menu order: around the color wheel. */
export const SECTION_COLOR_ORDER = Object.keys(
  SECTION_COLOR_STYLES,
) as ReadonlyArray<SidebarSectionColor>;

/** The 20px mark at the start of a section header: a tinted icon chip, an emoji, or the dot. */
export function SectionGlyph(props: { icon: ResolvedSectionIcon; color: SidebarSectionColor }) {
  const styles = SECTION_COLOR_STYLES[props.color];
  if (props.icon.kind === "dot") {
    return (
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
        <span className={cn("size-2 rounded-full", styles.dot)} />
      </span>
    );
  }
  if (props.icon.kind === "emoji") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md text-xs leading-none",
          styles.chip,
        )}
      >
        {props.icon.value}
      </span>
    );
  }
  const Icon = SECTION_ICON_COMPONENTS[props.icon.name];
  return (
    <span
      aria-hidden
      className={cn("flex size-5 shrink-0 items-center justify-center rounded-md", styles.chip)}
    >
      <Icon className="size-3" strokeWidth={2.25} />
    </span>
  );
}

/**
 * The header's glyph as a button that opens one popover for color and icon. `open` is
 * controlled so the section menu's "Icon…" can open it too.
 */
export function SectionIconPicker(props: {
  section: SidebarCustomSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { section, open, onOpenChange, triggerRef } = props;
  const color = normalizeSectionColor(section.color);
  const icon = resolveSectionIcon(section.icon);
  const gt = useGT();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            aria-label={gt("{name} icon and color", { name: section.name })}
            className="flex cursor-pointer rounded-md outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 motion-reduce:transition-none"
          />
        }
      >
        <SectionGlyph icon={icon} color={color} />
      </PopoverTrigger>
      <PopoverPopup
        side="bottom"
        align="start"
        padding="none"
        anchor={triggerRef}
        aria-label={gt("Section icon")}
      >
        <SectionIconPanel section={section} color={color} icon={icon} />
      </PopoverPopup>
    </Popover>
  );
}

function SectionIconPanel(props: {
  section: SidebarCustomSection;
  color: SidebarSectionColor;
  icon: ResolvedSectionIcon;
}) {
  const { section, color, icon } = props;
  const [tab, setTab] = useState<"icons" | "emoji">(icon.kind === "emoji" ? "emoji" : "icons");
  const styles = SECTION_COLOR_STYLES[color];
  const gt = useGT();
  const m = useMessages();
  return (
    <div className="flex w-64 flex-col gap-2.5 p-2.5">
      <div
        role="radiogroup"
        aria-label={gt("Color", { $context: "section color" })}
        className="-mx-2.5 flex items-center gap-0.5 overflow-x-auto px-3 pb-1 [scrollbar-width:thin]"
      >
        {SECTION_COLOR_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === color}
            aria-label={m(SECTION_COLOR_STYLES[option].label)}
            onClick={() => sectionDefinitions.setColor(section.id, option)}
            className={cn(
              "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
              option === color && "bg-accent",
            )}
          >
            <span
              className={cn(
                "size-3 rounded-full transition-transform motion-reduce:transition-none",
                SECTION_COLOR_STYLES[option].dot,
                option === color && "scale-125",
              )}
            />
          </button>
        ))}
      </div>
      <ToggleGroup
        aria-label={gt("Icon type")}
        className="w-full *:flex-1"
        value={[tab]}
        onValueChange={(next) => {
          const value = next[0];
          if (value === "icons" || value === "emoji") setTab(value);
        }}
      >
        <Toggle value="icons">
          <T>Icons</T>
        </Toggle>
        <Toggle value="emoji">
          <T>Emoji</T>
        </Toggle>
      </ToggleGroup>
      {tab === "icons" ? (
        <IconGrid section={section} icon={icon} chipClassName={styles.chip} />
      ) : (
        <EmojiGrid section={section} icon={icon} chipClassName={styles.chip} />
      )}
    </div>
  );
}

const CELL =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70";

function IconGrid(props: {
  section: SidebarCustomSection;
  icon: ResolvedSectionIcon;
  chipClassName: string;
}) {
  const { section, icon } = props;
  const [query, setQuery] = useState("");
  const names = searchSectionIcons(query);
  const dotClassName = SECTION_COLOR_STYLES[normalizeSectionColor(section.color)].dot;
  const gt = useGT();
  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3" />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          size="sm"
          type="search"
          value={query}
          placeholder={gt("Search icons")}
          aria-label={gt("Search icons")}
          spellCheck={false}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </InputGroup>
      <div className="-mx-1 grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto px-1">
        {query.trim() === "" ? (
          <button
            type="button"
            aria-label={gt("No icon, just the dot")}
            aria-pressed={icon.kind === "dot"}
            onClick={() => sectionDefinitions.setIcon(section.id, null)}
            className={cn(CELL, icon.kind === "dot" && props.chipClassName)}
          >
            <span className={cn("size-2 rounded-full", dotClassName)} />
          </button>
        ) : null}
        {names.map((name) => {
          const Icon = SECTION_ICON_COMPONENTS[name];
          const selected = icon.kind === "lucide" && icon.name === name;
          return (
            <button
              key={name}
              type="button"
              aria-label={name.replaceAll("-", " ")}
              aria-pressed={selected}
              onClick={() => sectionDefinitions.setIcon(section.id, { kind: "lucide", name })}
              className={cn(CELL, selected && props.chipClassName)}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          );
        })}
        {names.length === 0 ? (
          <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
            <T>No icons</T>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmojiGrid(props: {
  section: SidebarCustomSection;
  icon: ResolvedSectionIcon;
  chipClassName: string;
}) {
  const { section, icon } = props;
  const [query, setQuery] = useState("");
  // A pasted emoji (any emoji, not just the catalog's) is picked straight away.
  const pasted = parseSingleEmoji(query);
  const matches = searchSectionEmoji(query);
  const shown = pasted !== null && !matches.includes(pasted) ? [pasted, ...matches] : matches;
  const gt = useGT();
  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3" />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          size="sm"
          type="search"
          value={query}
          placeholder={gt("Search or paste an emoji")}
          aria-label={gt("Search emoji")}
          spellCheck={false}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setQuery(value);
            const emoji = parseSingleEmoji(value);
            if (emoji !== null)
              sectionDefinitions.setIcon(section.id, { kind: "emoji", value: emoji });
          }}
        />
      </InputGroup>
      <div className="-mx-1 grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto px-1">
        {shown.map((emoji) => {
          const selected = icon.kind === "emoji" && icon.value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              aria-pressed={selected}
              onClick={() =>
                sectionDefinitions.setIcon(section.id, { kind: "emoji", value: emoji })
              }
              className={cn(CELL, "text-base leading-none", selected && props.chipClassName)}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
        {shown.length === 0 ? (
          <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
            <T>No match. Paste any emoji to use it.</T>
          </p>
        ) : null}
      </div>
    </div>
  );
}
