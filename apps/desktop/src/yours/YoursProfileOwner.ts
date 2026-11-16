// @effect-diagnostics nodeBuiltinImport:off - Runs before Electron is ready, beside the synchronous single-instance lock.
/**
 * Fork-only: every T3 Code build shares the `t3code-v2` Electron profile and `~/.t3`, so Chromium's
 * single-instance lock lets one run at a time. Upstream quits the loser silently; name the winner.
 * @module YoursProfileOwner
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Electron from "electron";
import * as Effect from "effect/Effect";

/** The `.app` bundle that contains an executable path, if any. */
export const appBundleOf = (executablePath: string): string | undefined => {
  const match = /^(.*?\.app)(?:\/|$)/u.exec(executablePath);
  return match?.[1];
};

/** Chromium's `SingletonLock` symlink target is `<hostname>-<pid>`. */
export const singletonLockPid = (target: string): number | undefined => {
  const pid = Number(target.slice(target.lastIndexOf("-") + 1));
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
};

const lockOwnerExecutable = (userDataPath: string): string | undefined => {
  try {
    const pid = singletonLockPid(NodeFS.readlinkSync(NodePath.join(userDataPath, "SingletonLock")));
    if (pid === undefined) return undefined;
    const output = NodeChildProcess.execFileSync("/bin/ps", ["-o", "comm=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
};

const appNameOf = (bundle: string) => NodePath.basename(bundle, ".app");

/** The other app bundle holding this profile's lock, or undefined when it is this same app. */
export const foreignLockOwner = (input: {
  readonly ownerExecutable: string | undefined;
  readonly ownExecutable: string;
}): { readonly owner: string; readonly self: string } | undefined => {
  const ownerBundle = input.ownerExecutable ? appBundleOf(input.ownerExecutable) : undefined;
  const ownBundle = appBundleOf(input.ownExecutable);
  if (ownerBundle === undefined || ownBundle === undefined || ownerBundle === ownBundle) {
    return undefined;
  }
  return { owner: appNameOf(ownerBundle), self: appNameOf(ownBundle) };
};

/** Shows "Quit <other app> first" when a different T3 Code bundle holds the profile lock. */
export const reportForeignLockOwner = (input: {
  readonly platform: NodeJS.Platform;
  readonly userDataPath: string;
}) =>
  Effect.sync(() => {
    if (input.platform !== "darwin") return;
    const foreign = foreignLockOwner({
      ownerExecutable: lockOwnerExecutable(input.userDataPath),
      ownExecutable: process.execPath,
    });
    if (foreign === undefined) return;
    try {
      Electron.dialog.showErrorBox(
        `Quit ${foreign.owner} first`,
        `${foreign.owner} is running and uses the same T3 Code data (~/.t3). Only one T3 Code app can use it at a time, so ${foreign.self} will close now.\n\nQuit ${foreign.owner}, then open ${foreign.self} again.`,
      );
    } catch {
      // The upstream quit still follows; the dialog is only an explanation.
    }
  });
