import { expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { ClientSettingsPatch, ClientSettingsSchema } from "./settings.ts";

const decodeClientSettings = Schema.decodeUnknownSync(ClientSettingsSchema);
const decodeClientSettingsPatch = Schema.decodeUnknownSync(ClientSettingsPatch);

it("drops a malformed sidebar section alone and fills defaults", () => {
  expect(
    decodeClientSettings({
      sidebarCustomSections: [
        { id: "a", name: "Growth" },
        { id: "", name: "Bad id" },
        { name: "No id" },
        "junk",
        { id: "b", name: "Review", color: "teal", collapsed: true },
        { id: "c", name: "Ship", icon: { kind: "lucide", name: "rocket" } },
        { id: "d", name: "Fun", icon: { kind: "emoji", value: "🎉" } },
        { id: "e", name: "Bad icon", icon: { kind: "svg", path: "M0" } },
        { id: "f", name: "Empty icon", icon: { kind: "emoji", value: "" } },
        { id: "", name: "Bad id and icon", icon: "junk" },
      ],
    }).sidebarCustomSections,
  ).toEqual([
    { id: "a", name: "Growth", color: "gray", collapsed: false },
    { id: "b", name: "Review", color: "teal", collapsed: true },
    {
      id: "c",
      name: "Ship",
      color: "gray",
      collapsed: false,
      icon: { kind: "lucide", name: "rocket" },
    },
    { id: "d", name: "Fun", color: "gray", collapsed: false, icon: { kind: "emoji", value: "🎉" } },
    { id: "e", name: "Bad icon", color: "gray", collapsed: false },
    { id: "f", name: "Empty icon", color: "gray", collapsed: false },
  ]);
  expect(decodeClientSettings({}).sidebarCustomSections).toEqual([]);
  expect(decodeClientSettings({}).sidebarShowSubagents).toBe(true);
});

it("leaves sidebar sections out of patches that do not set them", () => {
  expect(decodeClientSettingsPatch({ sidebarShowSubagents: false })).toEqual({
    sidebarShowSubagents: false,
  });
});
