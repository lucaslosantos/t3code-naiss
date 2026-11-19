# Customizations

Newest first. Each entry: date, what changed (plain words), merge commit.

- 2026-11-19: Worktrees show pull request status, stack layers, and chat actions in a status-colored row above the right panel tabs, with separate PR, stack, and state controls.

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
