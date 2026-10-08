/**
 * When a student last opened their own board (the server's last_seen_at,
 * set only by their own token). `undefined` means unknown (no server), `null`
 * means not since tracking began (2026-10-08). Pure, so the desk header, the Room signal and the
 * test read the same rules.
 */

const DAY = 86400000;

/** Whole days between two instants by local calendar date (today = 0). */
function daysAgo(iso, now) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / DAY));
}

export function seenLabel(lastSeen, now = new Date()) {
  if (lastSeen === undefined) return null;
  if (lastSeen === null) return "Not seen on the board yet";
  const days = daysAgo(lastSeen, now);
  if (days === null) return null;
  if (days === 0) return "Last seen today";
  if (days === 1) return "Last seen yesterday";
  return `Last seen ${days} days ago`;
}

/** The Room signal for silence, or null when they have been around lately. */
export function quietSignal(lastSeen, now = new Date(), { quietDays = 4 } = {}) {
  if (lastSeen === undefined) return null;
  if (lastSeen === null) return { tone: "bad", text: "Not seen on the board yet" };
  const days = daysAgo(lastSeen, now);
  if (days !== null && days >= quietDays) return { tone: "warn", text: `Quiet ${days} days` };
  return null;
}
