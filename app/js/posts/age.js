/**
 * LinkedIn prints age as a short relative label ("34m", "2h", "1d").
 * A post is fresh only while that label is still inside the last day.
 * Unknown labels are not treated as fresh.
 */

const DAY_MINUTES = 24 * 60;

const UNITS = [
  [/^(m|min|mins|minute|minutes)$/, 1],
  [/^(h|hr|hrs|hour|hours)$/, 60],
  [/^(d|day|days)$/, DAY_MINUTES],
  [/^(w|wk|wks|week|weeks)$/, 7 * DAY_MINUTES],
  [/^(mo|month|months)$/, 30 * DAY_MINUTES],
  [/^(yr|yrs|year|years)$/, 365 * DAY_MINUTES],
];

export function ageMinutes(label) {
  if (!label) return null;
  const text = String(label).toLowerCase().replace(/[•·]/g, " ");
  if (/\b(just now|moments? ago)\b/.test(text)) return 0;
  if (/\byesterday\b/.test(text)) return DAY_MINUTES;
  const match = text.match(
    /\b(\d+)\s*(minutes?|mins?|min|hours?|hrs?|days?|weeks?|wks?|months?|years?|mo|yr|yrs|m|h|d|w)\b/
  );
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const scale = UNITS.find(([pattern]) => pattern.test(unit));
  if (!scale) return null;
  return amount * scale[1];
}

export function isFresh(label) {
  const minutes = ageMinutes(label);
  return minutes != null && minutes < DAY_MINUTES;
}

export function formatAge(minutes) {
  if (minutes == null) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
