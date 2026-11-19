import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";

import * as ServerConfig from "../../config.ts";
import * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";
import * as VcsProcess from "../../vcs/VcsProcess.ts";
import { continueFromDefault, nextContinuationBranchName } from "./continueFromDefault.ts";

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const driverLayer = GitVcsDriver.layer.pipe(
  Layer.provideMerge(VcsProcess.layer),
  Layer.provideMerge(
    ServerConfig.layerTest(process.cwd(), { prefix: "t3-continue-" }).pipe(Layer.provide(platform)),
  ),
  Layer.provideMerge(platform),
);

it("names the continuation after the merged branch", () => {
  const cases: ReadonlyArray<[string, string[], string]> = [
    ["t3/feature", [], "t3/feature-2"],
    ["t3/feature-2", ["t3/feature-3"], "t3/feature-4"],
    ["t3/feature", ["T3/Feature-2"], "t3/feature-3"],
    ["2", [], "2-2"],
  ];
  for (const [current, existing, expected] of cases) {
    assert.equal(nextContinuationBranchName(current, existing), expected);
  }
});

it.layer(platform)("continueFromDefault", (it) => {
  it.effect("moves a merged worktree onto a new branch from the latest remote default branch", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const driver = yield* GitVcsDriver.GitVcsDriver;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3-continue-" });
      const remote = `${root}/remote.git`;
      const seed = `${root}/seed`;
      const work = `${root}/work`;
      const git = (cwd: string, ...args: string[]) =>
        driver
          .execute({
            operation: "test.continue",
            cwd,
            args: ["-c", "user.email=t@t", "-c", "user.name=t", ...args],
          })
          .pipe(Effect.map((result) => result.stdout.trim()));

      yield* fileSystem.makeDirectory(seed);
      yield* git(root, "init", "--bare", "-b", "main", remote);
      yield* git(seed, "init", "-b", "main");
      yield* git(seed, "commit", "--allow-empty", "-m", "a");
      yield* git(seed, "remote", "add", "origin", remote);
      yield* git(seed, "push", "origin", "main");
      yield* git(root, "clone", remote, work);
      yield* git(work, "switch", "-c", "t3/feature");
      yield* fileSystem.writeFileString(`${work}/feature.txt`, "work\n");
      yield* git(work, "add", "feature.txt");
      yield* git(work, "commit", "-m", "feature");
      yield* git(seed, "commit", "--allow-empty", "-m", "b");
      yield* git(seed, "push", "origin", "main");
      const latestMain = yield* git(seed, "rev-parse", "HEAD");

      yield* fileSystem.writeFileString(`${work}/feature.txt`, "dirty\n");
      const dirty = yield* Effect.exit(continueFromDefault(driver, { cwd: work }));
      assert.isTrue(Exit.isFailure(dirty));
      assert.equal(yield* git(work, "branch", "--show-current"), "t3/feature");
      yield* git(work, "checkout", "--", "feature.txt");

      const result = yield* continueFromDefault(driver, { cwd: work });
      assert.deepEqual(result, { refName: "t3/feature-2", baseRefName: "main" });
      assert.equal(yield* git(work, "branch", "--show-current"), "t3/feature-2");
      assert.equal(yield* git(work, "rev-parse", "HEAD"), latestMain);
      assert.equal(yield* git(work, "config", "branch.t3/feature-2.t3-merge-base"), "main");
      assert.equal(
        yield* git(work, "config", "--default", "", "branch.t3/feature-2.merge"),
        "",
        "a push must publish the new branch, not update main",
      );
    }).pipe(Effect.scoped, Effect.provide(driverLayer)),
  );
});
