import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

export const SIDEBAR_SECTION_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
] as const;
export type SidebarSectionColor = (typeof SIDEBAR_SECTION_COLORS)[number];

/** A section the user made in the sidebar. Array order is display order. */
export const SidebarCustomSection = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
  name: Schema.String,
  // A plain string, so a color added by a newer client does not drop the section here.
  color: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed("gray"))),
  collapsed: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
});
export type SidebarCustomSection = typeof SidebarCustomSection.Type;

const decodeSidebarCustomSection = Schema.decodeUnknownOption(SidebarCustomSection);

/** Bad entries drop alone, so a hand edit or a newer client cannot reset every section. */
export const SidebarCustomSections = Schema.Array(Schema.Unknown).pipe(
  Schema.decodeTo(
    Schema.Array(Schema.toType(SidebarCustomSection)),
    SchemaTransformation.transform<ReadonlyArray<SidebarCustomSection>, ReadonlyArray<unknown>>({
      decode: (values) =>
        values.flatMap((value) => Option.toArray(decodeSidebarCustomSection(value))),
      encode: (values) => values,
    }),
  ),
);
