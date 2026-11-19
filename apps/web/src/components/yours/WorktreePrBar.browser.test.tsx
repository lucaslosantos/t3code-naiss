import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { ensureLocalApi } from "~/localApi";
import { render } from "../../../test/render";
import { useRightPanelStore } from "~/rightPanelStore";
import { WorktreePrBar } from "./WorktreePrBar";

vi.mock("~/state/usePullRequestStack", () => ({
  usePullRequestStack: () => ({ data: null, isFresh: true }),
}));
vi.mock("../pullRequest/usePullRequestDetail", () => ({
  usePullRequestDetail: () => ({
    detail: {
      state: "open",
      isInMergeQueue: true,
      checks: [],
      capabilities: { stacks: true, actions: [], mergeMethods: [] },
      viewerPermissions: { actions: [] },
    },
    sharedSummary: { stack: { number: 1, position: 1, size: 2, base: "main" } },
    detailQuery: { isSuccess: true },
  }),
}));

it("opens the numbered PR in the right panel and offers the host link separately", async () => {
  const thread = {
    environmentId: EnvironmentId.make("local"),
    threadId: ThreadId.make("worktree"),
  };
  const projectId = ProjectId.make("repo");
  const url = "https://github.com/acme/demo/pull/3705";
  await using screen = await render(
    <WorktreePrBar
      thread={thread}
      projectId={projectId}
      pr={{
        state: "open",
        number: 3705,
        title: "Feature",
        headRef: "feature",
        baseRef: "main",
        url,
      }}
      onPrompt={() => {}}
    />,
  );
  using open = vi.spyOn(useRightPanelStore.getState(), "openPullRequest");
  using external = vi.spyOn(ensureLocalApi().shell, "openExternal").mockResolvedValue(undefined);
  await expect.element(screen.getByText("Queued")).toBeVisible();
  await screen.getByRole("button", { name: "#3705", exact: true }).click();
  expect(open).toHaveBeenCalledWith(thread, {
    projectId,
    host: "github.com",
    repository: "acme/demo",
    number: 3705,
    url,
  });
  await screen.getByRole("button", { name: "Pull request options" }).click();
  await page.getByRole("menuitem", { name: "Open on GitHub" }).click();
  expect(external).toHaveBeenCalledWith(url);
});
