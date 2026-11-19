// Fork-only: saved review workflows, per device and shared across projects.
import { useSyncExternalStore } from "react";

import {
  deleteReviewWorkflowIn,
  EMPTY_REVIEW_WORKFLOWS,
  parseReviewWorkflows,
  saveReviewWorkflowIn,
  type ReviewWorkflow,
  type ReviewWorkflows,
} from "./reviewWorkflows.logic";

const STORAGE_KEY = "t3code:yours:review-workflows";

let state: ReviewWorkflows | undefined;
const listeners = new Set<() => void>();

function readWorkflows(): ReviewWorkflows {
  if (state !== undefined) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? parseReviewWorkflows(JSON.parse(raw)) : EMPTY_REVIEW_WORKFLOWS;
  } catch {
    state = EMPTY_REVIEW_WORKFLOWS;
  }
  return state;
}

function write(next: ReviewWorkflows): void {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the change still applies for this session.
  }
  for (const listener of listeners) listener();
}

export function saveReviewWorkflow(workflow: ReviewWorkflow, makeDefault: boolean): void {
  write(saveReviewWorkflowIn(readWorkflows(), workflow, makeDefault));
}

export function deleteReviewWorkflow(id: string): void {
  write(deleteReviewWorkflowIn(readWorkflows(), id));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReviewWorkflows(): ReviewWorkflows {
  return useSyncExternalStore(subscribe, readWorkflows, () => EMPTY_REVIEW_WORKFLOWS);
}
