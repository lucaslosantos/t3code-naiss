// Fork-only: the "Make it mine" sidebar button. Kept in its own folder so upstream merges stay clean.

/** Folder name of this fork's checkout. The button opens threads in that project. */
export const FORK_FOLDER_NAME = "t3code-naiss";

export type MakeItMineAction = "change" | "update" | "undo" | "rollback";

export interface MakeItMineActionSpec {
  readonly id: MakeItMineAction;
  readonly label: string;
  readonly detail: string;
  /** Composer text. "change" leaves room for the user's own words. */
  readonly prompt: string;
}

export const MAKE_IT_MINE_ACTIONS: ReadonlyArray<MakeItMineActionSpec> = [
  {
    id: "change",
    label: "Change something…",
    detail: "Describe it, the agent builds it",
    prompt: "Make it mine: ",
  },
  {
    id: "update",
    label: "Update from T3 Code now",
    detail: "Pull official updates, keep your changes",
    prompt: "Update my T3 Code from the official version now. Follow YOURS.md, section Updating.",
  },
  {
    id: "undo",
    label: "Undo my last change",
    detail: "Revert the most recent customization",
    prompt: "Undo my most recent customization. Follow YOURS.md, section Undo.",
  },
  {
    id: "rollback",
    label: "Something broke, roll back",
    detail: "Reinstall the previous build",
    prompt: "My app is broken. Roll back to the previous build. Follow YOURS.md, section Rollback.",
  },
];

function folderName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(index + 1);
}

/** Finds the fork's own project, preferring the main checkout over its worktrees. */
export function findForkProject<T extends { readonly workspaceRoot: string }>(
  projects: ReadonlyArray<T>,
): T | null {
  return (
    projects.find(
      (project) => folderName(project.workspaceRoot).toLowerCase() === FORK_FOLDER_NAME,
    ) ??
    projects.find(
      (project) => folderName(project.workspaceRoot).toLowerCase() === "t3code-yours",
    ) ??
    null
  );
}
