import { Rive, RuntimeLoader } from "@rive-app/canvas";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";
import fallbackUrl from "@rive-app/canvas/rive_fallback.wasm?url";
import { createPortal } from "react-dom";
import * as Schema from "effect/Schema";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useLocalStorage } from "../../../hooks/useLocalStorage";
const companionUrl = Object.values(
  import.meta.glob<string>("./companion.riv", {
    eager: true,
    query: "?url",
    import: "default",
  }),
)[0];

RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.setWasmFallbackUrl(fallbackUrl);

const moods = {
  idle: ["naiss", "wink"],
  working: ["water", "flap"],
  waiting: ["spark", "perk"],
  failed: ["fire", "droop"],
} as const;
const positionSchema = Schema.Struct({ x: Schema.Number, y: Schema.Number });
const size = 76;
const clamp = (fraction: number) => Math.max(0, Math.min(1, fraction));

export default function ThreadMascot({ mood }: { mood: keyof typeof moods }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Rive | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, savePosition] = useLocalStorage(
    "t3code:luko:mascot-position",
    { x: 0.98, y: 0.14 },
    positionSchema,
  );
  const [moving, setMoving] = useState<typeof position | null>(null);
  const drag = useRef<{
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const { x, y } = moving ?? position;

  function playReaction(reaction: string) {
    const rive = player.current;
    if (!rive) return;
    clearTimeout(timer.current);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rive.play("State Machine 1");
    if (!reduced) rive.viewModelInstance?.trigger(reaction)?.trigger();
    timer.current = setTimeout(() => rive.pause(), reduced ? 60 : 1600);
  }

  const react = useEffectEvent((nextMood: keyof typeof moods) => {
    const rive = player.current;
    if (!rive) return;
    const [skin, reaction] = moods[nextMood];
    const instance = rive.viewModelByName("mascot")?.instanceByName(skin);
    if (!instance) return;
    rive.bindViewModelInstance(instance);
    playReaction(reaction);
  });
  const onLoad = useEffectEvent(() => react(mood));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the canvas owns a native Rive instance for its mounted lifetime
  useEffect(() => {
    if (!canvas.current || !companionUrl) return;
    let disposed = false;
    const rive = new Rive({
      src: companionUrl,
      canvas: canvas.current,
      artboard: "stage2",
      stateMachines: "State Machine 1",
      autoplay: false,
      shouldDisableRiveListeners: true,
      onLoad: () => {
        if (disposed) return;
        player.current = rive;
        onLoad();
      },
    });
    return () => {
      disposed = true;
      clearTimeout(timer.current);
      player.current = null;
      rive.cleanup();
    };
  }, []);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- thread activity drives the external animation
  useEffect(() => {
    react(mood);
  }, [mood]);

  if (!companionUrl) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-30">
      <canvas
        ref={canvas}
        width={152}
        height={152}
        aria-hidden="true"
        className="pointer-events-auto absolute size-[76px] touch-none cursor-grab select-none active:cursor-grabbing"
        style={{
          left: `calc(${100 * clamp(x)}% - ${size * clamp(x)}px)`,
          top: `calc(${100 * clamp(y)}% - ${size * clamp(y)}px)`,
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          const box = event.currentTarget.getBoundingClientRect();
          drag.current = {
            dx: event.clientX - box.left,
            dy: event.clientY - box.top,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const box = event.currentTarget.offsetParent?.getBoundingClientRect();
          if (!box) return;
          if (!drag.current.moved) {
            if (
              Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY) <
              5
            )
              return;
            drag.current.moved = true;
            playReaction("flap");
          }
          setMoving({
            x: clamp((event.clientX - box.left - drag.current.dx) / Math.max(1, box.width - size)),
            y: clamp((event.clientY - box.top - drag.current.dy) / Math.max(1, box.height - size)),
          });
        }}
        onPointerUp={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          playReaction(drag.current.moved ? "perk" : "boop");
          if (moving) savePosition(moving);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setMoving(null);
        }}
      />
    </div>,
    document.body,
  );
}
