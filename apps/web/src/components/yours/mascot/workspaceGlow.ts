import type { HerdMember, MascotMood } from "./mascotHerd.logic";

const inks: Record<MascotMood, string> = {
  idle: "var(--muted-foreground)",
  working: "var(--info)",
  waiting: "var(--warning)",
  failed: "var(--error)",
  unread: "var(--success)",
};
const tint = (ink: string, percent: number) =>
  `color-mix(in srgb, ${ink} ${percent}%, transparent)`;

let lit: { key: string; glow: Animation } | null = null;

/**
 * Lights the sidebar row of the thread whose small mascot is under the pointer, or dims it with
 * `null`. The sidebar is upstream code, so the row is found by its key and animated from here.
 */
export function lightWorkspaceRow(member: HerdMember | null) {
  if (lit?.key === member?.key) return;
  if (lit) {
    const { glow } = lit;
    glow.onfinish = () => glow.cancel();
    glow.reverse();
    lit = null;
  }
  if (!member) return;
  const row = document.querySelector(`[data-sidebar-row="${CSS.escape(member.key)}"]`);
  if (!row) return;
  const ink = inks[member.mood];
  // The row clips to its list item, so the glow sits inside its rounded edge.
  const glow = row.animate(
    {
      backgroundColor: tint(ink, 9),
      boxShadow: `inset 0 0 0 1px ${tint(ink, 32)}, inset 0 0 16px -4px ${tint(ink, 45)}`,
    },
    {
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220,
      easing: "ease-out",
      fill: "both",
    },
  );
  lit = { key: member.key, glow };
}
