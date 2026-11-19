import {
  SIDEBAR_SECTION_COLORS,
  type SidebarCustomSection,
  type SidebarSectionColor,
} from "@t3tools/contracts";
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

/** Per-color classes. Tints sit near 12% so a chip reads as a hue, not a badge. */
export const SECTION_COLOR_STYLES = {
  gray: {
    label: msg("Gray", { $context: "section color" }),
    dot: "bg-sidebar-muted-foreground/60",
    chip: "bg-sidebar-foreground/8 text-sidebar-foreground/70",
    drop: "bg-sidebar-foreground/4 before:bg-sidebar-foreground/35",
    dropHint: "border-sidebar-foreground/30 text-sidebar-foreground/80",
  },
  blue: {
    label: msg("Blue", { $context: "section color" }),
    dot: "bg-blue-500",
    chip: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    drop: "bg-blue-500/6 before:bg-blue-500",
    dropHint: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  },
  green: {
    label: msg("Green", { $context: "section color" }),
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    drop: "bg-emerald-500/6 before:bg-emerald-500",
    dropHint: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  yellow: {
    label: msg("Yellow", { $context: "section color" }),
    dot: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    drop: "bg-amber-400/8 before:bg-amber-400",
    dropHint: "border-amber-400/50 text-amber-600 dark:text-amber-400",
  },
  orange: {
    label: msg("Orange", { $context: "section color" }),
    dot: "bg-orange-500",
    chip: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
    drop: "bg-orange-500/6 before:bg-orange-500",
    dropHint: "border-orange-500/40 text-orange-600 dark:text-orange-400",
  },
  red: {
    label: msg("Red", { $context: "section color" }),
    dot: "bg-red-500",
    chip: "bg-red-500/12 text-red-600 dark:text-red-400",
    drop: "bg-red-500/6 before:bg-red-500",
    dropHint: "border-red-500/40 text-red-600 dark:text-red-400",
  },
  purple: {
    label: msg("Purple", { $context: "section color" }),
    dot: "bg-violet-500",
    chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    drop: "bg-violet-500/6 before:bg-violet-500",
    dropHint: "border-violet-500/40 text-violet-600 dark:text-violet-400",
  },
  pink: {
    label: msg("Pink", { $context: "section color" }),
    dot: "bg-pink-500",
    chip: "bg-pink-500/12 text-pink-600 dark:text-pink-400",
    drop: "bg-pink-500/6 before:bg-pink-500",
    dropHint: "border-pink-500/40 text-pink-600 dark:text-pink-400",
  },
} as const satisfies Record<
  SidebarSectionColor,
  { label: string; dot: string; chip: string; drop: string; dropHint: string }
>;

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
        className="flex items-center justify-between px-1"
      >
        {SIDEBAR_SECTION_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === color}
            aria-label={m(SECTION_COLOR_STYLES[option].label)}
            onClick={() => sectionDefinitions.setColor(section.id, option)}
            className={cn(
              "flex size-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
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
