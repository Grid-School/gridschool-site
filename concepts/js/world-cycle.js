/** One event: a change is accepted, the object enters the world, then rest. */
export const CYCLE_MS = 16000;

export function readCycle(ms, reduced) {
  if (reduced) {
    return { resolve: 1, live: 1, event: 0, patch: 1, phase: "live" };
  }

  const t = ms % CYCLE_MS;

  if (t < 1600) {
    return { resolve: 0, live: 0, event: 0, patch: 0, phase: "local" };
  }
  if (t < 3400) {
    return { resolve: 0, live: 0, event: 1, patch: 0, phase: "accepted" };
  }
  if (t < 5400) {
    const k = (t - 3400) / 2000;
    return { resolve: k, live: 0, event: 1, patch: k * 0.15, phase: "resolve" };
  }
  if (t < 6600) {
    const k = (t - 5400) / 1200;
    return { resolve: 1, live: k, event: 1 - k, patch: 0.15 + k * 0.85, phase: "go-live" };
  }
  if (t < 14000) {
    return { resolve: 1, live: 1, event: 0, patch: 1, phase: "live" };
  }

  const k = (t - 14000) / 2000;
  return { resolve: 1 - k, live: 1 - k, event: 0, patch: 1 - k, phase: "reset" };
}
