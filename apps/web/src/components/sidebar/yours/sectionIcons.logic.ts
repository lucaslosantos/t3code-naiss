import type { SidebarSectionIcon } from "@t3tools/contracts";

/**
 * The icons a section can wear, in picker order, with words the search matches.
 * `sectionIcons.tsx` maps each name to its lucide component.
 */
const SECTION_ICON_CATALOG = [
  // Work states
  { name: "circle-dot", keywords: "active in progress doing wip current" },
  { name: "circle-check", keywords: "done complete finished shipped check" },
  { name: "eye", keywords: "review watch look see" },
  { name: "git-pull-request", keywords: "pr pull request review" },
  { name: "git-merge", keywords: "merge ready landed" },
  { name: "git-branch", keywords: "branch feature fork" },
  { name: "clock", keywords: "later time waiting soon" },
  { name: "hourglass", keywords: "pending blocked waiting wait" },
  { name: "pause", keywords: "paused on hold stopped" },
  { name: "flag", keywords: "milestone priority important mark" },
  { name: "target", keywords: "goal focus aim objective" },
  { name: "rocket", keywords: "launch ship release deploy" },
  { name: "flame", keywords: "hot urgent fire priority" },
  { name: "zap", keywords: "fast quick lightning energy" },
  { name: "triangle-alert", keywords: "warning risk alert danger" },
  { name: "ban", keywords: "blocked cancel stop never" },
  { name: "inbox", keywords: "inbox triage new incoming" },
  { name: "archive", keywords: "archive old storage past" },
  { name: "bookmark", keywords: "saved later bookmark" },
  { name: "pin", keywords: "pinned keep stick" },
  { name: "star", keywords: "favorite starred best" },
  { name: "heart", keywords: "love personal like" },
  // Building
  { name: "bug", keywords: "bug fix issue defect" },
  { name: "wrench", keywords: "fix maintenance tools repair chore" },
  { name: "hammer", keywords: "build make craft" },
  { name: "construction", keywords: "wip under construction work" },
  { name: "code", keywords: "code dev engineering programming" },
  { name: "terminal", keywords: "terminal cli scripts shell command" },
  { name: "database", keywords: "data database db storage" },
  { name: "server", keywords: "server backend infra api" },
  { name: "cloud", keywords: "cloud deploy hosting" },
  { name: "gauge", keywords: "performance speed metrics" },
  { name: "bot", keywords: "agents automation robot ai" },
  { name: "puzzle", keywords: "integration plugin extension" },
  { name: "blocks", keywords: "components blocks modules" },
  { name: "layers", keywords: "stack layers platform" },
  { name: "box", keywords: "box package container" },
  { name: "package", keywords: "package release dependencies deps" },
  { name: "smartphone", keywords: "mobile phone ios android app" },
  { name: "monitor", keywords: "desktop screen web" },
  { name: "globe", keywords: "web world international site" },
  { name: "lock", keywords: "security private lock" },
  { name: "shield", keywords: "security safety protect" },
  { name: "key", keywords: "auth secrets access key" },
  // Making and thinking
  { name: "palette", keywords: "design color ui style" },
  { name: "pen-tool", keywords: "design vector draw" },
  { name: "pencil", keywords: "writing draft edit" },
  { name: "image", keywords: "assets images pictures" },
  { name: "file-text", keywords: "notes spec document writing" },
  { name: "book-open", keywords: "docs documentation learn reading" },
  { name: "lightbulb", keywords: "ideas idea research" },
  { name: "brain", keywords: "thinking research ai mind" },
  { name: "flask-conical", keywords: "experiment beaker lab test" },
  { name: "microscope", keywords: "investigate research science" },
  { name: "telescope", keywords: "explore future vision" },
  { name: "compass", keywords: "explore direction strategy" },
  { name: "map", keywords: "roadmap plan journey" },
  { name: "search", keywords: "search find research" },
  // Business and people
  { name: "trending-up", keywords: "growth metrics up increase" },
  { name: "chart-bar", keywords: "analytics stats data charts" },
  { name: "dollar-sign", keywords: "money revenue sales pricing dollar" },
  { name: "briefcase", keywords: "work business client job" },
  { name: "megaphone", keywords: "marketing announce launch" },
  { name: "message-circle", keywords: "chat support feedback talk" },
  { name: "mail", keywords: "email mail inbox" },
  { name: "users", keywords: "team people group" },
  { name: "user", keywords: "me personal person" },
  // Organizing and mood
  { name: "calendar", keywords: "schedule planning date week" },
  { name: "list-todo", keywords: "todo tasks checklist" },
  { name: "kanban", keywords: "board project kanban" },
  { name: "folder", keywords: "folder files misc" },
  { name: "tag", keywords: "label tag category" },
  { name: "repeat", keywords: "recurring routine repeat" },
  { name: "trophy", keywords: "wins achievement award" },
  { name: "coffee", keywords: "side break chill small" },
  { name: "sun", keywords: "today morning day" },
  { name: "moon", keywords: "night later someday" },
  { name: "leaf", keywords: "cleanup refactor nature eco" },
  { name: "sprout", keywords: "new beginning start grow" },
  { name: "house", keywords: "home personal house" },
] as const satisfies ReadonlyArray<{ readonly name: string; readonly keywords: string }>;

export type SectionIconName = (typeof SECTION_ICON_CATALOG)[number]["name"];

const ICON_NAMES: ReadonlySet<string> = new Set(SECTION_ICON_CATALOG.map((icon) => icon.name));

function isSectionIconName(name: string): name is SectionIconName {
  return ICON_NAMES.has(name);
}

/** Catalog icons matching every word of `query` by name or keyword, in catalog order. */
export function searchSectionIcons(query: string): SectionIconName[] {
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return SECTION_ICON_CATALOG.filter((icon) => {
    const haystack = `${icon.name.replaceAll("-", " ")} ${icon.keywords}`;
    return words.every((word) => haystack.includes(word));
  }).map((icon) => icon.name);
}

const SINGLE_EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍|\p{Extended_Pictographic}|[\u{E0020}-\u{E007F}])*)$/u;

/** The one emoji in `input` (surrounding space ignored), or null for text or several emoji. */
export function parseSingleEmoji(input: string): string | null {
  const value = input.trim();
  if (value.length === 0 || value.length > 32) return null;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
  if (graphemes.length !== 1) return null;
  return SINGLE_EMOJI.test(value) ? value : null;
}

export type ResolvedSectionIcon =
  | { readonly kind: "lucide"; readonly name: SectionIconName }
  | { readonly kind: "emoji"; readonly value: string }
  | { readonly kind: "dot" };

/** What the header draws: the stored icon when this client can draw it, else the dot. */
export function resolveSectionIcon(icon: SidebarSectionIcon | undefined): ResolvedSectionIcon {
  if (icon?.kind === "lucide" && isSectionIconName(icon.name)) {
    return { kind: "lucide", name: icon.name };
  }
  if (icon?.kind === "emoji") {
    const value = parseSingleEmoji(icon.value);
    if (value !== null) return { kind: "emoji", value };
  }
  return { kind: "dot" };
}

/** Words in a section name that suggest an icon, checked in order. */
const SUGGESTIONS: ReadonlyArray<readonly [ReadonlyArray<string>, SectionIconName]> = [
  [["merge", "merging", "merged"], "git-merge"],
  [["pr", "prs", "pull"], "git-pull-request"],
  [["review", "reviewing", "qa"], "eye"],
  [["done", "complete", "completed", "finished", "shipped"], "circle-check"],
  [["bug", "bugs", "bugfix", "crash"], "bug"],
  [["fix", "fixes", "maintenance", "chore", "chores"], "wrench"],
  [["growth", "metrics"], "trending-up"],
  [["analytics", "stats"], "chart-bar"],
  [["design", "ui", "ux"], "palette"],
  [["launch", "ship", "release", "deploy"], "rocket"],
  [["urgent", "hot", "asap", "fire"], "flame"],
  [["blocked", "waiting", "pending"], "hourglass"],
  [["later", "someday", "backlog"], "moon"],
  [["wip", "doing", "progress", "active"], "circle-dot"],
  [["idea", "ideas", "research"], "lightbulb"],
  [["experiment", "experiments", "spike", "prototype"], "flask-conical"],
  [["docs", "documentation"], "book-open"],
  [["writing", "draft", "drafts", "copy"], "pencil"],
  [["marketing", "launches"], "megaphone"],
  [["sales", "revenue", "pricing", "billing", "money"], "dollar-sign"],
  [["team", "people", "hiring"], "users"],
  [["support", "feedback"], "message-circle"],
  [["security", "auth"], "shield"],
  [["mobile", "ios", "android"], "smartphone"],
  [["data", "database", "db"], "database"],
  [["infra", "backend", "server", "api"], "server"],
  [["agent", "agents", "automation", "bots"], "bot"],
  [["inbox", "triage"], "inbox"],
  [["archive", "archived", "old"], "archive"],
  [["goal", "goals", "focus"], "target"],
  [["personal", "home"], "house"],
];

/** A calm default icon for a section name, or null to keep the dot. */
export function suggestSectionIcon(name: string): SectionIconName | null {
  const words = new Set(
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
  for (const [keys, icon] of SUGGESTIONS) {
    if (keys.some((key) => words.has(key))) return icon;
  }
  return null;
}
