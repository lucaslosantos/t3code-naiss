# Customizations

Newest first. Each entry: date, what changed (plain words), merge commit.

- 2026-11-22: Teammates can install this version with one Terminal command; their app updates from yours every morning and asks before restarting. (merge 87ff3cef98)

- 2026-11-21: After a restart the mascot stack is complete right away: every thread that isn't settled has its mascot, with its current state, without having to open each one first. (merge 526d1056fa)

- 2026-11-21: Hovering a small mascot in the stack lights up its thread's row in the sidebar with a soft glow in the thread's colour, fading from row to row as you move across the mascots. (merges 734719bebe, 983cb8b1cf)

- 2026-11-21: The Next unread pill sits closer to the message box, level with "Scroll to end", shows its shortcut as plain text, and the chat leaves room so it never covers the last lines. (merge 0e948a0428)

- 2026-11-21: Dropping the companion quickly, while it's still doing its pick-up dance, keeps it where you let go instead of snapping back, including when the desktop app misses the release. (merges 2dca876c23, 68e7e12eee)

- 2026-11-20: The companion (and its stack and the Next unread pill) can be grabbed and moved over the desktop title bar too, instead of getting stuck there. (merge 26204b4dda)

- 2026-11-20: Finished threads you haven't read now show as green companions at the front of the mascot stack, next to the ones that need you; threads you've read stay tucked in solid grey at the back. A count on the companion's head, in the colour of the most urgent thread, says how many want you, and tapping the companion, the "Next unread" pill above the composer (lined up with its edge), the command palette or ⌘⇧U takes you to the next one, longest waiting first. (merges 9c81956f66, 3f5a29809e, d312fd52c0, 4c6f017e79, 72d7a1a555, 0a990e83b0)

- 2026-11-20: Review workflows get an optional "After the review" box: what the agent should do once it has merged the reviewers' findings (leave it empty to stop at the list). Before starting reviewers, the agent now finds the right base branch and stops if there is nothing to review; when merging, it double-checks findings only one reviewer raised, says which reviewers failed, and lists what it dropped and why. (merge 98a06e7069)

- 2026-11-19: A merged pull request bar now has a Continue button next to Merged: it keeps the same worktree and chat but starts a fresh branch from the latest main, so you can keep going without a new workspace. (merge f90ad426ab)

- 2026-11-19: Review workflows are now per project and are just a prompt plus the models that run it in parallel. Every project starts with a Standard workflow you can edit; add more (e.g. one that uses the repo's own review skill). (merge 505e01c2b5)

- 2026-11-19: The PR number button in the pull request bar no longer has a white fill; it takes the bar's color like the stack badge next to it, dropdown arrow included. (merge 8d435e4484, 799f343420)

- 2026-11-19: The Review row now works like run scripts: save several review workflows, each reviewer with its own model and job (Bugs, Security, Standards, Simplify); click to run the default one, or pick another from the menu. (merge 68290529e9)

- 2026-11-19: A Review row in the thread details card starts several reviewer agents at once: pick a flow (Standards, Bugs, Security, Simplify) and any mix of providers and models, and the thread's agent merges what they find. (merge 5d9e2e793a)

- 2026-11-19: Threads inside a section no longer sit indented under a guide line; their icons line up under the section's icon and their titles under the section's name. (merge ac3f02855e)

- 2026-11-19: Settling a thread takes its small mascot out of the stack. (merge 922d1c25ce)

- 2026-11-19: Swapping threads from the mascot stack flies the chosen companion into the main spot, where it lands and perks up, while the one you left shrinks back behind it. (merge 567419292f)

- 2026-11-19: Moving to a thread from the mascot stack swaps places: the thread you left stays in the stack instead of disappearing. (merge 7a9123b4d5)

- 2026-11-19: A small mascot for each busy thread sits tucked behind the companion, opens into a row on hover or when a thread needs you, and takes you to that thread when clicked. (merge 9c6b72005a)

- 2026-11-19: Worktrees show pull request status, stack layers, and chat actions in a status-colored row above the right panel tabs, with PR and stack controls on the left and status on the right.

- 2026-11-19: Dropping a thread into a section follows the visible section as the sidebar shifts during a drag.

- 2026-11-19: The Naiss Slush theme pairs a green Send button with readable selected threads and outlined toolbar toggles in dark mode. Apply it with `t3 theme set themes/naiss-slush.json`.

- 2026-11-19: Compact thread cards put the project icon beside the title and activity at the right, with an appearance setting and per-thread override. (merge dbf3b0d159)

- 2026-11-19: The team fork is named T3 Code (naiss) and installs over its earlier names. (merge 92afccc271)

- 2026-11-19: Tap the companion for a boop, or drag it to see it flap and perk up on release.

- 2026-11-18: The companion can be dragged from a conversation onto the sidebar and back.

- 2026-11-18: T3 Code (luko) wears the Naiss logo and has a draggable companion that reacts to the current thread. (merge aa8ab49341)

- 2026-11-18: Dragging in the sidebar is smooth now: threads follow the cursor and land in a section instantly, and you can drag a section by its header to reorder sections. Empty sections show a quiet "No threads" line instead of a big dashed box. (merge 05cf3bc466)

- 2026-11-17: Threads inside a section now sit slightly indented under a thin line in the section's color, so it's clear which section they belong to. (merge a38a41ebe1)

- 2026-11-16: Section emoji tab now shows a searchable grid of about 125 emoji (type "rocket", "done", "heart"…); pasting any other emoji still works.

- 2026-11-16: Section icons: click a section's dot to give it an icon (about 80 to search) or any emoji, and pick its color in the same place. Headers got a tinted icon chip, a bolder name, a quiet count pill, and a colored edge when you drag a thread over them. New sections suggest an icon from their name.
- 2026-11-16: Right-panel terminal is now a dock under the panel's tabs, like Conductor: its own tabs, fold chevron, resizable divider, and a Run button for project scripts.
- 2026-11-16: Terminal position: right panel (default), bottom, or a split at the bottom of the sidebar. Move it from the terminal's own menu, Settings, or the command palette.
- 2026-11-16: Nested subagents: child agents show as a tree inside their parent thread's card ("› 2 subagents"), each with the same status as a thread card (Working 2m, Waiting 5m, Input, Failed, Done) or its last time; a closed tree sums up its children's states.
- 2026-11-16: Custom sidebar sections (like Conductor): create, rename, recolor, collapse; drag threads in or use "Move to section".
- 2026-11-16: Packaged as its own app, "T3 Code (Yours)", sharing your data; official auto-updates off.
- 2026-11-16: "Make it mine" button in the sidebar footer: one click opens an agent thread to change the app, update it, undo, or roll back.
