import { type RefObject, useRef, useState } from "react";

/**
 * Fork-only: the "Pinned" and "Active" drag labels stay closed at pickup, so the list holds
 * still, and open once the pointer rises above the list's first row, where pinning happens.
 * Reads the raw pointer: dnd-kit's drag deltas are clamped by the sidebar's modifiers.
 */
export function useDragLabelReveal(listRef: RefObject<HTMLElement | null>) {
  const [revealed, setRevealed] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };
  return {
    revealed,
    start: () => {
      stop();
      setRevealed(false);
      const onMove = (event: PointerEvent) => {
        const first = listRef.current?.firstElementChild;
        if (!first || event.clientY >= first.getBoundingClientRect().top) return;
        setRevealed(true);
        stop();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stop, { once: true });
      window.addEventListener("pointercancel", stop, { once: true });
      stopRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
    },
  };
}
