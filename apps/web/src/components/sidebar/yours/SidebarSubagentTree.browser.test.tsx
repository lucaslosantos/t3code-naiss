import { createMemoryHistory } from "@tanstack/react-router";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
// The thread route loads ChatView lazily; its first transform would eat the test's timeout.
import "~/components/ChatView";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
} from "../../../../test/fakeEnvironment";
import { render } from "../../../../test/render";

// The socket is the only fake layer; see test/appScenarios.renders.tsx.
vi.mock(
  "../../../../../../packages/client-runtime/src/connection/driver.ts",
  async (importOriginal) => {
    const [actual, { fakeDriver }, Layer] = await Promise.all([
      importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
      import("../../../../test/fakeEnvironment"),
      import("effect/Layer"),
    ]);
    return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
  },
);

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

it("nests subagents inside the parent's card and opens a child without opening the parent", async () => {
  await page.viewport(1200, 800);
  const parent = threadWithHistory("parent", 1);
  const other = threadWithHistory("other", 1);
  const child = { ...threadWithHistory("child", 1), subagentOf: parent.id };
  using _environment = installFakeEnvironment([parent, child, other]);
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    sidebarShowSubagents: true,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const router = getRouter(
    createMemoryHistory({ initialEntries: [`/${ENVIRONMENT_ID}/${other.id}`] }),
  );
  await router.load();
  await using _app = await render(<AppRoot router={router} />, { router: false });

  const disclosure = page.getByRole("button", { name: "1 subagent", exact: true });
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "false");
  // The tree lives in the parent's list item, under its card surface, not in a row of its own.
  const card = disclosure.element().closest("[data-thread-item]");
  expect(card?.textContent).toContain(parent.title);

  await userEvent.click(disclosure);
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "true");
  const childButton = page.getByRole("list", { name: "Subagents" }).getByRole("button", {
    name: new RegExp(`^${child.title}`),
  });
  await userEvent.click(childButton);
  await vi.waitFor(() => expect(router.state.location.pathname).toContain(String(child.id)));
  await expect.element(childButton).toHaveAttribute("aria-current", "page");
});
