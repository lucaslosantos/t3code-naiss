import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildMascotHerd } from "./mascotHerd.logic";

type Fixture = Parameters<typeof buildMascotHerd>[0][number];

function thread(
  id: string,
  overrides: {
    status?: "running" | "failed" | "idle";
    approval?: boolean;
    subagent?: boolean;
    archived?: boolean;
    settled?: boolean;
    sentAt?: string;
  } = {},
): Fixture {
  return {
    environmentId: EnvironmentId.make("local"),
    id: ThreadId.make(id),
    title: id,
    lineage: {
      parentThreadId: overrides.subagent ? ThreadId.make("parent") : null,
      relationshipToParent: overrides.subagent ? "subagent" : null,
      rootThreadId: ThreadId.make(id),
    },
    delegatedFrom: null,
    archivedAt: overrides.archived ? "2026-01-01T00:00:00.000Z" : null,
    settledOverride: overrides.settled ? "settled" : null,
    runtime:
      overrides.status === undefined
        ? null
        : ({ status: overrides.status } as NonNullable<Fixture["runtime"]>),
    latestRun: null,
    hasPendingApprovals: overrides.approval === true,
    hasPendingUserInput: false,
    latestUserMessageAt: overrides.sentAt ?? null,
  } as Fixture;
}

describe("buildMascotHerd", () => {
  it("keeps busy top-level threads, most urgent first", () => {
    const herd = buildMascotHerd([
      thread("old-work", { status: "running", sentAt: "2026-01-01T00:00:00.000Z" }),
      thread("new-work", { status: "running", sentAt: "2026-01-02T00:00:00.000Z" }),
      thread("broke", { status: "failed" }),
      thread("asks", { status: "running", approval: true }),
      thread("parked", { status: "idle" }),
      thread("done"),
      thread("child", { status: "running", subagent: true }),
      thread("gone", { status: "running", archived: true }),
    ]);
    expect(herd.map((member) => [member.title, member.mood])).toEqual([
      ["asks", "waiting"],
      ["broke", "failed"],
      ["new-work", "working"],
      ["old-work", "working"],
    ]);
  });

  it("keeps a visited idle thread behind urgent ones, most recent visit first", () => {
    const key = (id: string) => buildMascotHerd([thread(id, { status: "running" })])[0]!.key;
    const herd = buildMascotHerd(
      [
        thread("left-earlier", { status: "idle" }),
        thread("left", { status: "idle" }),
        thread("never-opened", { status: "idle" }),
        thread("left-settled", { status: "idle", settled: true }),
        thread("work", { status: "running" }),
        thread("asks", { status: "running", approval: true }),
      ],
      [key("current"), key("left-settled"), key("left"), key("work"), key("left-earlier")],
    );
    expect(herd.map((member) => [member.title, member.mood])).toEqual([
      ["asks", "waiting"],
      ["left", "idle"],
      ["work", "working"],
      ["left-earlier", "idle"],
    ]);
  });
});
