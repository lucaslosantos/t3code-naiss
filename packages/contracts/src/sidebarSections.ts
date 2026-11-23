import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

// New sections take the first unused color, so neighbors in this list should differ clearly.
export const SIDEBAR_SECTION_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
  "teal",
  "indigo",
  "sky",
  "rose",
  "lime",
  "cyan",
  "fuchsia",
  "brown",
] as const;
export type SidebarSectionColor = (typeof SIDEBAR_SECTION_COLORS)[number];

/**
 * A section's icon. Lucide names stay plain strings, so a name only a newer client knows
 * survives here; the client shows its dot for names it cannot draw.
 */
export const SidebarSectionIcon = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("lucide"),
    name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  }),
  Schema.Struct({
    kind: Schema.Literal("emoji"),
    value: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
  }),
]);
export type SidebarSectionIcon = typeof SidebarSectionIcon.Type;

/** A section the user made in the sidebar. Array order is display order. */
export const SidebarCustomSection = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
  name: Schema.String,
  // A plain string, so a color added by a newer client does not drop the section here.
  color: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed("gray"))),
  collapsed: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  icon: Schema.optionalKey(SidebarSectionIcon),
});
export type SidebarCustomSection = typeof SidebarCustomSection.Type;

const decodeSidebarCustomSection = Schema.decodeUnknownOption(SidebarCustomSection);

/** A section whose only fault is its icon keeps everything else and falls back to the dot. */
function decodeSectionLeniently(value: unknown): Option.Option<SidebarCustomSection> {
  const decoded = decodeSidebarCustomSection(value);
  if (Option.isSome(decoded) || typeof value !== "object" || value === null || !("icon" in value)) {
    return decoded;
  }
  const { icon: _icon, ...rest } = value;
  return decodeSidebarCustomSection(rest);
}

/** Bad entries drop alone, so a hand edit or a newer client cannot reset every section. */
export const SidebarCustomSections = Schema.Array(Schema.Unknown).pipe(
  Schema.decodeTo(
    Schema.Array(Schema.toType(SidebarCustomSection)),
    SchemaTransformation.transform<ReadonlyArray<SidebarCustomSection>, ReadonlyArray<unknown>>({
      decode: (values) => values.flatMap((value) => Option.toArray(decodeSectionLeniently(value))),
      encode: (values) => values,
    }),
  ),
);
