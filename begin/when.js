/**
 * When Aden's review of a new map lands, said plainly: the next 10:00 in
 * Denver that is at least 18 hours away. Aden reviews within 24 hours, so this
 * is always a promise he can keep. Pure; begin/when.test.mjs runs it.
 */

const ZONE = "America/Denver";
const HOUR = 10;
const LEAD_MS = 18 * 3600 * 1000;

function partsIn(zone, date) {
  const out = {};
  for (const { type, value } of new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date)) out[type] = value;
  return { y: +out.year, m: +out.month, d: +out.day, h: +out.hour % 24, min: +out.minute };
}

/** The instant that reads as y-m-d hour:00 on a Denver wall clock (DST-safe). */
function denverAt(y, m, d, hour) {
  const wanted = Date.UTC(y, m - 1, d, hour);
  let guess = wanted;
  for (let i = 0; i < 3; i += 1) {
    const p = partsIn(ZONE, new Date(guess));
    guess += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  }
  return new Date(guess);
}

export function nextReview(now = new Date()) {
  const today = partsIn(ZONE, now);
  for (let i = 0; i < 4; i += 1) {
    const at = denverAt(today.y, today.m, today.d + i, HOUR);
    if (at - now >= LEAD_MS) return at;
  }
  return denverAt(today.y, today.m, today.d + 4, HOUR);
}

const clock = (date, zone) => new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(date).replace(":00", "").replace(/\s?([AP])M/, (_, x) => `${x.toLowerCase()}m`);
const weekday = (date, zone) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(date);

/** "Tuesday 10am Mountain time", plus the reader's own clock when it differs: "(noon your time)". */
export function reviewLabel(now = new Date(), localZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const at = nextReview(now);
  const main = `${weekday(at, ZONE)} 10am Mountain time`;
  if (!localZone || clock(at, localZone) === clock(at, ZONE)) return main;
  const day = weekday(at, localZone);
  const local = clock(at, localZone).replace(/^12pm$/, "noon");
  return `${main} (${day === weekday(at, ZONE) ? "" : `${day} `}${local} your time)`;
}
