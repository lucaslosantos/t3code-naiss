import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildMascotHerd, nextForYou } from "./mascotHerd.logic";

type Fixture = Parameters<typeof buildMascotHerd>[0][number];

const now = "2026-02-01T00:00:00.000Z";

function thread(
  id: string,
  overrides: {
    status?: "running" | "failed" | "idle";
    approval?: boolean;
    subagent?: boolean;
    archived?: boolean;
    settled?: boolean;
    sentAt?: string;
    finishedAt?: string;
    visitedAt?: string;
    planReady?: boolean;
    snoozedUntil?: string;
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
    latestRun:
      overrides.finishedAt === undefined
        ? null
        : ({
            runId: `run-${id}`,
            status: "completed",
            completedAt: overrides.finishedAt,
          } as NonNullable<Fixture["latestRun"]>),
    lastVisitedAt: overrides.visitedAt ?? null,
    interactionMode: overrides.planReady ? "plan" : "default",
    hasActionableProposedPlan: overrides.planReady === true,
    hasPendingApprovals: overrides.approval === true,
    hasPendingUserInput: false,
    latestUserMessageAt: overrides.sentAt ?? null,
    snoozedUntil: overrides.snoozedUntil ?? null,
    snoozedAt: null,
  } as Fixture;
}

describe("buildMascotHerd", () => {
  it("keeps every unsettled top-level thread, most urgent first", () => {
    const herd = buildMascotHerd(
      [
        thread("old-work", { status: "running", sentAt: "2026-01-01T00:00:00.000Z" }),
        thread("new-work", { status: "running", sentAt: "2026-01-02T00:00:00.000Z" }),
        thread("broke", { status: "failed" }),
        thread("asks", { status: "running", approval: true }),
        thread("parked", { status: "idle", sentAt: "2026-01-03T00:00:00.000Z" }),
        thread("done", { sentAt: "2026-01-01T00:00:00.000Z" }),
        thread("settled", { settled: true }),
        thread("child", { status: "running", subagent: true }),
        thread("gone", { status: "running", archived: true }),
      ],
      [],
      now,
    );
    expect(herd.map((member) => [member.title, member.mood])).toEqual([
      ["asks", "waiting"],
      ["broke", "failed"],
      ["new-work", "working"],
      ["old-work", "working"],
      ["parked", "idle"],
      ["done", "idle"],
    ]);
  });

  it("puts finished threads you haven't read ahead of work, longest waiting first", () => {
    const visited = "2026-01-01T00:00:00.000Z";
    const herd = buildMascotHerd(
      [
        thread("read", {
          finishedAt: "2026-01-01T00:00:00.000Z",
          visitedAt: "2026-01-02T00:00:00.000Z",
        }),
        thread("work", { status: "running" }),
        thread("done-later", { finishedAt: "2026-01-05T00:00:00.000Z", visitedAt: visited }),
        thread("done-first", { finishedAt: "2026-01-03T00:00:00.000Z", visitedAt: visited }),
        thread("plan", {
          finishedAt: "2026-01-04T00:00:00.000Z",
          visitedAt: "2026-01-09T00:00:00.000Z",
          planReady: true,
        }),
        thread("snoozed", {
          finishedAt: "2026-01-04T00:00:00.000Z",
          visitedAt: visited,
          snoozedUntil: "2026-03-01T00:00:00.000Z",
        }),
      ],
      [],
      now,
    );
    expect(herd.map((member) => [member.title, member.mood])).toEqual([
      ["plan", "waiting"],
      ["done-first", "unread"],
      ["done-later", "unread"],
      ["work", "working"],
      ["read", "idle"],
    ]);
    expect(nextForYou(herd, herd[0]!.key)?.title).toBe("done-first");
    expect(nextForYou(herd.slice(3), null)).toBeNull();
  });

  it("keeps threads you've read at the back, most recent visit first", () => {
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
      now,
    );
    expect(herd.map((member) => [member.title, member.mood])).toEqual([
      ["asks", "waiting"],
      ["work", "working"],
      ["left", "idle"],
      ["left-earlier", "idle"],
      ["never-opened", "idle"],
    ]);
  });
});
