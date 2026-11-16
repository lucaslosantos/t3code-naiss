import { describe, expect, it } from "vite-plus/test";

import { findForkProject } from "./makeItMine.logic";

describe("findForkProject", () => {
  it("matches the fork folder by name, ignoring case and trailing slashes", () => {
    const projects = [
      { workspaceRoot: "/Users/me/Projects/t3code-yours-sections" },
      { workspaceRoot: "/Users/me/Projects/T3Code-Yours/" },
    ];
    expect(findForkProject(projects)).toBe(projects[1]);
  });

  it("returns null when the fork is not a project", () => {
    expect(findForkProject([{ workspaceRoot: "/Users/me/app" }])).toBeNull();
  });
});
