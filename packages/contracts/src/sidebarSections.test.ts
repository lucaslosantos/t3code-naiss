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
      ],
    }).sidebarCustomSections,
  ).toEqual([
    { id: "a", name: "Growth", color: "gray", collapsed: false },
    { id: "b", name: "Review", color: "teal", collapsed: true },
  ]);
  expect(decodeClientSettings({}).sidebarCustomSections).toEqual([]);
  expect(decodeClientSettings({}).sidebarShowSubagents).toBe(true);
});

it("leaves sidebar sections out of patches that do not set them", () => {
  expect(decodeClientSettingsPatch({ sidebarShowSubagents: false })).toEqual({
    sidebarShowSubagents: false,
  });
});
