// Fork-only: the last review squad, per device, so the next review starts from it.
import { useSyncExternalStore } from "react";

import { parseReviewSquad, type ReviewSquad } from "./reviewSquad.logic";

const STORAGE_KEY = "t3code:yours:review-squad";

let squad: ReviewSquad | null | undefined;
const listeners = new Set<() => void>();

function readSquad(): ReviewSquad | null {
  if (squad !== undefined) return squad;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    squad = raw ? parseReviewSquad(JSON.parse(raw)) : null;
  } catch {
    squad = null;
  }
  return squad;
}

export function saveReviewSquad(next: ReviewSquad): void {
  squad = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the squad still applies for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSavedReviewSquad(): ReviewSquad | null {
  return useSyncExternalStore(subscribe, readSquad, () => null);
}
