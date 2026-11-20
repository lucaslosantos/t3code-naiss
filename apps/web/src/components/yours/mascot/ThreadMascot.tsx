import { Rive, RuntimeLoader } from "@rive-app/canvas";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";
import fallbackUrl from "@rive-app/canvas/rive_fallback.wasm?url";
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { T } from "gt-react";
import { createPortal } from "react-dom";
import * as Schema from "effect/Schema";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { isCommandPaletteOpen } from "../../../commandPaletteBus";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../../../keybindings";
import { primaryServerKeybindingsAtom } from "../../../state/server";
import { buildThreadRouteParams } from "../../../threadRoutes";
import { threadShortcutContext } from "../../Sidebar.logic";
import { Button } from "../../ui/button";
import { Kbd } from "../../ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";
import { nextForYou, wantsYou, type HerdMember, type MascotMood } from "./mascotHerd.logic";
import { onNextUnreadRequest, recordMascotVisit, useMascotHerd } from "./mascotHerd.state";

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
  unread: ["naiss", "perk"],
} as const;
const moodLabels = {
  idle: "Seen",
  working: "Working",
  waiting: "Needs you",
  failed: "Failed",
  unread: "Done, unread",
} as const;
/** Solid colours for the count on the companion, matching the sidebar's status dots. */
const moodBadges = {
  waiting: "bg-warning text-amber-950",
  failed: "bg-error text-white",
  unread: "bg-success text-white",
} as const;
const moodDots = { waiting: "bg-warning", failed: "bg-error", unread: "bg-success" } as const;
const positionSchema = Schema.Struct({ x: Schema.Number, y: Schema.Number });
const size = 76;
const mini = 56;
// Every companion shares the artboard, so a canvas this far down puts its feet on the main one's floor.
const miniTop = 18;
const maxMinis = 4;
/** How far each small mascot's centre sits from the main one's, tucked behind or opened into a row. */
const tucked = (index: number) => 16 + index * 9;
const spread = (index: number) => 51 + index * 44;
/** Threads you've already read stay grey, and open a little smaller at the end of the row. */
const seenScale = 0.8;
/** Where the count pins to the head's outer corner (centre x, top y), measured on the artwork, not the canvas. */
const badgeCorner = { x: 56, y: 3 };
const clamp = (fraction: number) => Math.max(0, Math.min(1, fraction));
/** A small mascot's centre sits this far below the main one's. */
const miniDrop = miniTop + mini / 2 - size / 2;
const flightMs = 460;
const flightEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * The swap in progress after a small mascot is clicked. It lives outside React because the
 * thread view may remount on navigation, and both ends of the swap read it on their first frame.
 */
let flight: { from: string; to: string; offset: number; at: number } | null = null;
const flying = (key: string, end: "from" | "to") =>
  flight !== null &&
  flight[end] === key &&
  Date.now() - flight.at < 1000 &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Drives one Rive companion on `canvas`; `still` draws a frame and rests instead of idling. */
function useCompanion(
  canvas: RefObject<HTMLCanvasElement | null>,
  mood: MascotMood,
  still: boolean,
) {
  const player = useRef<Rive | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function playReaction(reaction: string | null) {
    const rive = player.current;
    if (!rive) return;
    clearTimeout(timer.current);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rive.play("State Machine 1");
    if (reaction && !reduced) rive.viewModelInstance?.trigger(reaction)?.trigger();
    timer.current = setTimeout(() => rive.pause(), reaction && !reduced ? 1600 : 60);
  }

  const react = useEffectEvent((nextMood: MascotMood, first: boolean) => {
    const rive = player.current;
    if (!rive) return;
    const [skin, reaction] = moods[nextMood];
    const instance = rive.viewModelByName("mascot")?.instanceByName(skin);
    if (!instance) return;
    rive.bindViewModelInstance(instance);
    playReaction(first && still ? null : reaction);
  });
  const onLoad = useEffectEvent(() => react(mood, true));
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
  }, [canvas]);
  const seenMood = useRef(mood);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- thread activity drives the external animation
  useEffect(() => {
    if (seenMood.current === mood) return;
    seenMood.current = mood;
    react(mood, false);
  }, [mood]);

  return playReaction;
}

function MiniMascot({
  member,
  offset,
  style,
  onOpen,
}: {
  member: HerdMember;
  offset: number;
  style: React.CSSProperties;
  onOpen: (offset: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useCompanion(canvas, member.mood, true);
  const landOffset = useRef(offset);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the thread you left shrinks out of the main spot before its first paint
  useLayoutEffect(() => {
    if (!flying(member.key, "from")) return;
    button.current?.animate(
      [
        {
          transform: `translate(${-landOffset.current}px, ${-miniDrop}px) scale(${size / mini})`,
          opacity: 0.6,
        },
        { transform: "none", opacity: 1 },
      ],
      { duration: flightMs, easing: flightEasing },
    );
  }, [member.key]);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            ref={button}
            type="button"
            aria-label={`${member.title}: ${moodLabels[member.mood]}`}
            onClick={() => onOpen(offset)}
            className="pointer-events-auto absolute size-14 origin-bottom cursor-pointer [-webkit-app-region:no-drag] rounded-full outline-none transition-[translate,scale,opacity] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
            style={style}
          />
        }
      >
        <canvas
          ref={canvas}
          width={112}
          height={112}
          aria-hidden="true"
          className={member.mood === "idle" ? "size-14 brightness-75 grayscale" : "size-14"}
        />
      </TooltipTrigger>
      <TooltipPopup side="top">
        <span className="font-medium">{member.title}</span>
        <span className="text-muted-foreground"> · {moodLabels[member.mood]}</span>
      </TooltipPopup>
    </Tooltip>
  );
}

export default function ThreadMascot({
  mood,
  threadKey,
  pillBottom,
}: {
  mood: MascotMood;
  threadKey: string;
  /** Where the "Next unread" pill sits above the composer, in pixels from the bottom. */
  pillBottom: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const playReaction = useCompanion(canvas, mood, false);
  const navigate = useNavigate();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the visit trail is a module store shared across thread views
  useEffect(() => recordMascotVisit(threadKey), [threadKey]);
  const flyIn = useEffectEvent((key: string) => {
    if (!flight || !flying(key, "to") || !canvas.current) return;
    const { offset } = flight;
    playReaction("flap");
    const landing = canvas.current.animate(
      [
        { transform: `translate(${offset}px, ${miniDrop}px) scale(${mini / size})` },
        { transform: "translate(0, -6px) scale(1.04)", offset: 0.7 },
        { transform: "translate(0, 0) scale(1.06, 0.94)", offset: 0.86 },
        { transform: "none" },
      ],
      { duration: flightMs + 120, easing: flightEasing },
    );
    landing.onfinish = () => playReaction("perk");
    return landing;
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the chosen thread's companion flies in from its small mascot before the first paint
  useLayoutEffect(() => {
    const landing = flyIn(threadKey);
    return () => landing?.cancel();
  }, [threadKey]);
  const herd = useMascotHerd().filter((member) => member.key !== threadKey);
  const nextUp = nextForYou(herd, threadKey);
  const forYou = herd.filter((member) => wantsYou(member.mood));
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const nextShortcut = shortcutLabelForCommand(keybindings, "thread.nextUnread");
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
  const dirX = clamp(x) > 0.5 ? -1 : 1;
  const shown = herd.slice(0, maxMinis);
  const overflow = herd.length - shown.length;
  const [hovered, setHovered] = useState(false);
  const [calling, setCalling] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = moving === null && (hovered || calling) && shown.length > 0;
  const urgent = forYou.map((member) => member.key).join(" ");
  const seenUrgent = useRef(urgent);
  const callTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noticeUrgent = useEffectEvent((next: string) => {
    const before = new Set(seenUrgent.current.split(" "));
    seenUrgent.current = next;
    if (!next.split(" ").some((key) => key && !before.has(key))) return;
    setCalling(true);
    clearTimeout(callTimer.current);
    callTimer.current = setTimeout(() => setCalling(false), 2500);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a thread starting to need the user opens the stack briefly
  useEffect(() => {
    noticeUrgent(urgent);
  }, [urgent]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- pending open and close timers end with the mascot
  useEffect(
    () => () => {
      clearTimeout(callTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );
  const offsetOf = (index: number) => dirX * (open ? spread(index) : tucked(index));
  const openMember = (member: HerdMember, offset: number) => {
    flight = { from: threadKey, to: member.key, offset, at: Date.now() };
    // Folding the stack lets the thread you left settle behind the companion.
    clearTimeout(closeTimer.current);
    setHovered(false);
    setCalling(false);
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(member.ref),
    });
  };
  const goNext = () => {
    if (!nextUp) return false;
    const index = shown.indexOf(nextUp);
    openMember(nextUp, index === -1 ? dirX * tucked(0) : offsetOf(index));
    return true;
  };
  const goNextLater = useEffectEvent(goNext);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the next-unread shortcut and palette action reach the mounted companion
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen()) return;
      const command = resolveShortcutCommand(event, keybindings, {
        platform: navigator.platform,
        context: threadShortcutContext(null),
      });
      if (command !== "thread.nextUnread") return;
      event.preventDefault();
      goNextLater();
    };
    window.addEventListener("keydown", onKeyDown);
    const stopRequests = onNextUnreadRequest(() => goNextLater());
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      stopRequests();
    };
  }, [keybindings]);
  const hover = (next: boolean) => {
    clearTimeout(closeTimer.current);
    if (next) setHovered(true);
    else closeTimer.current = setTimeout(() => setHovered(false), 250);
  };

  if (!companionUrl) return null;
  const pill =
    nextUp === null ? null : (
      <div
        // The composer's own lane and width, so the pill's edge lines up with the message box.
        className="chat-composer-lane pointer-events-none absolute inset-x-0 z-30 py-1.5"
        style={{ bottom: pillBottom }}
      >
        <div className="mx-auto flex w-full max-w-(--chat-content-max-width) justify-end">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => goNext()}
                  className="pointer-events-auto [-webkit-app-region:no-drag]"
                  size="xs"
                  variant="glass"
                />
              }
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${moodDots[nextUp.mood as keyof typeof moodDots]}`}
              />
              <T>Next unread</T>
              {forYou.length > 1 ? (
                <span className="text-muted-foreground tabular-nums">{forYou.length}</span>
              ) : null}
              {nextShortcut ? <Kbd className="max-sm:hidden">{nextShortcut}</Kbd> : null}
            </TooltipTrigger>
            <TooltipPopup side="top">
              <span className="font-medium">{nextUp.title}</span>
              <span className="text-muted-foreground"> · {moodLabels[nextUp.mood]}</span>
            </TooltipPopup>
          </Tooltip>
        </div>
      </div>
    );
  return (
    <>
      {pill}
      {createPortal(
        // The desktop title bar drags the window and swallows clicks unless what sits on it opts out.
        <div ref={stage} className="pointer-events-none fixed inset-0 z-30">
          <div
            className="absolute size-[76px]"
            onPointerEnter={() => hover(true)}
            onPointerLeave={() => hover(false)}
            style={{
              left: `calc(${100 * clamp(x)}% - ${size * clamp(x)}px)`,
              top: `calc(${100 * clamp(y)}% - ${size * clamp(y)}px)`,
            }}
          >
            {open && hovered ? (
              // Bridges the gaps between opened mascots so the stack stays open while crossing them.
              <div
                className="pointer-events-auto absolute [-webkit-app-region:no-drag]"
                style={{
                  top: miniTop,
                  height: mini,
                  left: dirX > 0 ? size / 2 : size / 2 - spread(shown.length),
                  width: spread(shown.length),
                }}
              />
            ) : null}
            {shown.map((member, index) => (
              <MiniMascot
                key={member.key}
                member={member}
                style={{
                  left: size / 2 - mini / 2,
                  top: miniTop,
                  translate: `${offsetOf(index)}px 0`,
                  scale: member.mood === "idle" && open ? seenScale : 1,
                  transitionDelay: open ? `${index * 25}ms` : "0ms",
                  zIndex: maxMinis - index,
                }}
                offset={offsetOf(index)}
                onOpen={(offset) => openMember(member, offset)}
              />
            ))}
            {forYou.length > 0 && !open ? (
              <span
                aria-hidden="true"
                className={`absolute z-20 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full px-1 text-3xs leading-none font-semibold tabular-nums ring-2 ring-background ${moodBadges[forYou[0]!.mood as keyof typeof moodBadges]}`}
                style={{
                  left: dirX > 0 ? size - badgeCorner.x : badgeCorner.x,
                  top: badgeCorner.y,
                }}
              >
                {forYou.length}
              </span>
            ) : null}
            {overflow > 0 ? (
              <span
                className="absolute flex h-5 min-w-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-popover px-1.5 text-2xs font-medium text-muted-foreground shadow-xs transition-opacity duration-300 motion-reduce:transition-none"
                style={{
                  left: size / 2 + dirX * (spread(shown.length) - 12),
                  top: miniTop + mini - 26,
                  opacity: open ? 1 : 0,
                }}
              >
                +{overflow}
              </span>
            ) : null}
            <canvas
              ref={canvas}
              width={152}
              height={152}
              aria-hidden="true"
              className="pointer-events-auto relative z-10 size-[76px] touch-none cursor-grab [-webkit-app-region:no-drag] select-none active:cursor-grabbing"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                event.preventDefault();
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
                if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                const box = stage.current?.getBoundingClientRect();
                if (!box) return;
                if (!drag.current.moved) {
                  if (
                    Math.hypot(
                      event.clientX - drag.current.startX,
                      event.clientY - drag.current.startY,
                    ) < 5
                  )
                    return;
                  drag.current.moved = true;
                  playReaction("flap");
                }
                setMoving({
                  x: clamp(
                    (event.clientX - box.left - drag.current.dx) / Math.max(1, box.width - size),
                  ),
                  y: clamp(
                    (event.clientY - box.top - drag.current.dy) / Math.max(1, box.height - size),
                  ),
                });
              }}
              onPointerUp={(event) => {
                if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                if (!drag.current.moved && goNext()) return;
                playReaction(drag.current.moved ? "perk" : "boop");
                if (moving) savePosition(moving);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
                setMoving(null);
              }}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
