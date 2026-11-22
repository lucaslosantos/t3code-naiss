# T3 Code (naiss): playbook for agents

This is a personal fork of T3 Code. Read this before anything else; it overrides AGENTS.md where they disagree.

## Who you're working for

The owner is a designer and product person, not an engineer. They talk about what they see and feel ("move this", "make it calmer", "like Linear does it"). So:

- Speak plainly. No jargon, no file paths in your summary unless asked. Say what changed on screen.
- Don't ask technical questions. Make the sensible engineering call yourself. Ask only about taste or intent, and offer 2–3 concrete options when you do.
- Match the existing look: same tokens, spacing, type and motion. Quiet, polished, Linear/Apple-like. No new dependencies unless unavoidable.
- When you can, show the result: a screenshot of the change from a dev run (see AGENTS.md "Dev servers" and "Test data"; never touch `~/.t3/userdata`).

## How the fork is organized

- `main` mirrors `pingdotgg/t3code` (upstream). Never commit fork work to `main`.
- `yours` is the owner's app. Every customization ends up here.
- Each change happens in its own thread worktree, branched from `yours`.
- **Keep upstream merges painless.** Put fork code in new files, preferably in `yours/` folders (for example `apps/web/src/components/sidebar/yours/`), and hook it into upstream files with the smallest possible edit. Prefix fork-only settings and comments with "Fork-only:".
- Log every customization in `CUSTOMIZATIONS.md` (newest first): date, one plain sentence, and the merge commit SHA.

## Making a change ("Make it mine: …")

1. Understand the request in UI terms. If it's ambiguous on taste, ask once with options; otherwise just build it.
2. Build it in this worktree. Run the focused tests and typecheck for what you touched, and `vp run check:changed`.
3. Commit, then merge into `yours` from the main checkout (`~/projects/t3code-naiss`): `git -C ~/projects/t3code-naiss merge --no-ff <your-branch>`. Push `yours` to `origin`.
4. Add the entry to `CUSTOMIZATIONS.md` (in the same merge).
5. Build the app: `~/projects/t3code-naiss/scripts/yours/build.sh`. If it fails, fix it before going on.
6. Tell the owner in one or two plain sentences what changed. Then apply: `~/projects/t3code-naiss/scripts/yours/apply.sh --detach`. The app restarts a few seconds after your turn ends, and threads resume.

## Teammates (machines that follow the owner's build)

Teammates install with `scripts/yours/teammate-setup.sh` (the one-line command is at its top). Their checkout has `git config yours.follow` set to `true`. On such a machine:

- **Updating** means `~/projects/t3code-naiss/scripts/yours/follow.sh --now`. It brings in the owner's latest `yours`, builds and installs it. Never merge `upstream` there: the owner does that and teammates get it the next morning (the LaunchAgent `com.t3tools.t3code.yours.follow` runs `follow.sh` daily and asks before restarting).
- **Making a change** works as below, but commit to the local `yours` only and never push: teammates cannot write to `origin`. `follow.sh` merges the owner's updates on top; if they conflict it stops and says so, and you resolve it here like an upstream conflict.
- Undo and Rollback work as below, without pushing.
- The logo and companion mascot are private, so they are not in the repo. The owner runs `scripts/yours/share-artwork.sh` and sends the zip; teammates run `scripts/yours/add-artwork.sh`, which installs it to `~/.t3/luko-artwork` and rebuilds.

## Updating (pulling official T3 Code changes)

On a teammate machine, follow "Teammates" above instead.

1. `git -C ~/projects/t3code-naiss fetch upstream`, then fast-forward `main` to `upstream/main` and push it.
2. In a worktree from `yours`, merge `upstream/main`. Resolve conflicts so that **both** upstream's change and the owner's customization survive; `CUSTOMIZATIONS.md` explains what each customization is for.
3. Run `vp run check:changed` plus the tests in every `yours/` folder. Fix what broke.
4. Merge into `yours`, push, build, apply (steps 3–6 above). Summarize in plain words: "Updated to official version X. Your N customizations kept." plus anything notable that's new.
5. If a conflict really needs a product decision (upstream redesigned something the owner customized), don't guess. Leave `yours` untouched and ask the owner one plain question with options.

## Undo

Revert the most recent customization's merge commit from `CUSTOMIZATIONS.md` (`git revert -m 1 <sha>` on `yours`), mark it as undone in the log, push, build, apply.

## Rollback (the app is broken)

Run `~/projects/t3code-naiss/scripts/yours/rollback.sh --detach`. It puts back the previous build. Then investigate why, fix it on `yours`, and rebuild.

## Tooling notes

- Use the repo's own `vp`: `export PATH="$PWD/node_modules/.bin:$PATH"` (a newer global `vp` refuses this repo).
- Previewing from the main checkout (not a worktree): never plain `vp run dev`. Seed a copy first with `node apps/server/scripts/migrate-dev-db.ts --base-dir "$PWD/.t3"`, then `node scripts/dev-runner.ts dev --home-dir "$PWD/.t3"`. Thread worktrees get their own seeded `.t3` automatically.
- The fork follows upstream `main`, which can be ahead of the official release. Its database migrations then land on the shared `~/.t3` data when the owner opens the app; `apply.sh` backs up first.

## Safety

- Never write to `~/.t3/userdata`. `apply.sh` backs up the database to `~/.t3/backups/` before each install.
- Never kill processes by pattern (AGENTS.md rule 1). `apply.sh` quits the app gracefully.
