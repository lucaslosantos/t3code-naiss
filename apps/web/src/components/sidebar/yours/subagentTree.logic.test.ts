import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildSubagentIndex,
  buildSubagentTree,
  countSubagents,
  NO_SUBAGENTS,
  resolveSubagentExpanded,
  sameSubagentTree,
  subagentTreeContains,
} from "./subagentTree.logic";

const LOCAL = EnvironmentId.make("local");
const REMOTE = EnvironmentId.make("remote");

type Fixture = Parameters<typeof buildSubagentIndex>[0][number];

function thread(
  id: string,
  overrides: {
    parent?: string;
    relationship?: "fork" | "subagent";
    sideChat?: boolean;
    environmentId?: EnvironmentId;
    delegatedFrom?: { environmentId: EnvironmentId; threadId: string };
    status?: "running" | "failed" | "completed";
    approval?: boolean;
    archived?: boolean;
  } = {},
): Fixture {
  const environmentId = overrides.environmentId ?? LOCAL;
  return {
    environmentId,
    id: ThreadId.make(id),
    title: `Thread ${id}`,
    lineage: {
      parentThreadId: overrides.parent ? ThreadId.make(overrides.parent) : null,
      relationshipToParent: overrides.parent ? (overrides.relationship ?? "subagent") : null,
      rootThreadId: ThreadId.make(overrides.parent ?? id),
      ...(overrides.sideChat ? { sideChat: true } : {}),
    },
    delegatedFrom: overrides.delegatedFrom
      ? {
          environmentId: overrides.delegatedFrom.environmentId,
          threadId: ThreadId.make(overrides.delegatedFrom.threadId),
        }
      : null,
    archivedAt: overrides.archived ? "2026-01-01T00:00:00.000Z" : null,
    runtime:
      overrides.status === undefined
        ? null
        : ({ status: overrides.status } as NonNullable<Fixture["runtime"]>),
    latestRun:
      overrides.status === undefined ? null : ({ status: "completed" } as Fixture["latestRun"]),
    hasPendingApprovals: overrides.approval === true,
    hasPendingUserInput: false,
  } as Fixture;
}

const key = (id: string, environmentId: EnvironmentId = LOCAL) => `${environmentId}:${id}`;

function treeOf(threads: Fixture[], parent: string, delegated: ReadonlySet<string> = new Set()) {
  return buildSubagentTree(buildSubagentIndex(threads, delegated), key(parent));
}

describe("buildSubagentTree", () => {
  it("nests subagents and grandchildren with live status, leaving out side chats and forks", () => {
    const tree = treeOf(
      [
        thread("root"),
        thread("a", { parent: "root", status: "running" }),
        thread("b", { parent: "root", status: "failed" }),
        thread("a1", { parent: "a", approval: true }),
        thread("side", { parent: "root", sideChat: true }),
        thread("fork", { parent: "root", relationship: "fork" }),
        thread("old", { parent: "root", archived: true }),
      ],
      "root",
    );
    expect(tree.map((node) => [node.title, node.status, node.working])).toEqual([
      ["Thread a", "working", true],
      ["Thread b", "failed", false],
    ]);
    expect(tree[0]!.children.map((node) => [node.title, node.status])).toEqual([
      ["Thread a1", "attention"],
    ]);
    expect(countSubagents(tree)).toBe(3);
    expect(subagentTreeContains(tree, key("a1"))).toBe(true);
  });

  it("marks an ancestor working when only a grandchild works", () => {
    const tree = treeOf(
      [
        thread("a", { parent: "root", status: "completed" }),
        thread("a1", { parent: "a", status: "running" }),
      ],
      "root",
    );
    expect(tree[0]).toMatchObject({ status: "done", working: true });
  });

  it("nests a delegated task only while its parent is listed", () => {
    const task = thread("task", {
      environmentId: REMOTE,
      delegatedFrom: { environmentId: LOCAL, threadId: "root" },
    });
    expect(treeOf([task], "root", new Set([key("task", REMOTE)])).map((n) => n.key)).toEqual([
      key("task", REMOTE),
    ]);
    expect(treeOf([task], "root")).toBe(NO_SUBAGENTS);
  });

  it("stops at a lineage cycle", () => {
    const tree = treeOf([thread("a", { parent: "b" }), thread("b", { parent: "a" })], "a");
    expect(tree.map((node) => node.key)).toEqual([key("b")]);
    expect(tree[0]!.children).toBe(NO_SUBAGENTS);
  });

  it("compares trees by what they render", () => {
    const threads = [thread("a", { parent: "root", status: "running" })];
    expect(sameSubagentTree(treeOf(threads, "root"), treeOf(threads, "root"))).toBe(true);
    const finished = [thread("a", { parent: "root", status: "completed" })];
    expect(sameSubagentTree(treeOf(threads, "root"), treeOf(finished, "root"))).toBe(false);
  });
});

describe("resolveSubagentExpanded", () => {
  const working = treeOf([thread("a", { parent: "root", status: "running" })], "root");
  const idle = treeOf([thread("a", { parent: "root", status: "completed" })], "root");

  it("opens while a child works or holds the open thread, until the user chooses", () => {
    expect(resolveSubagentExpanded(null, idle, false)).toBe(false);
    expect(resolveSubagentExpanded(null, working, false)).toBe(true);
    expect(resolveSubagentExpanded(null, idle, true)).toBe(true);
    expect(resolveSubagentExpanded(false, working, true)).toBe(false);
    expect(resolveSubagentExpanded(true, idle, false)).toBe(true);
  });
});
