import { describe, expect, it } from "vite-plus/test";

import { appBundleOf, foreignLockOwner, singletonLockPid } from "./YoursProfileOwner.ts";

const official = "/Applications/T3 Code (Beta).app/Contents/MacOS/T3 Code (Beta)";
const yours = "/Applications/T3 Code (Yours).app/Contents/MacOS/T3 Code (Yours)";

describe("YoursProfileOwner", () => {
  it("reads the pid from Chromium's SingletonLock target", () => {
    expect(singletonLockPid("MacBook-Pro-8.local-79091")).toBe(79091);
    expect(singletonLockPid("host-")).toBeUndefined();
  });

  it("finds the enclosing app bundle", () => {
    expect(appBundleOf(official)).toBe("/Applications/T3 Code (Beta).app");
    expect(appBundleOf("/usr/bin/node")).toBeUndefined();
  });

  it("names another bundle holding the lock, and stays quiet for this same app", () => {
    expect(foreignLockOwner({ ownerExecutable: official, ownExecutable: yours })).toEqual({
      owner: "T3 Code (Beta)",
      self: "T3 Code (Yours)",
    });
    expect(foreignLockOwner({ ownerExecutable: yours, ownExecutable: yours })).toBeUndefined();
    expect(foreignLockOwner({ ownerExecutable: undefined, ownExecutable: yours })).toBeUndefined();
  });
});
