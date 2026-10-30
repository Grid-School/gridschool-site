/**
 * The morning roles email (server/daily_run.py), on the app's side. Pure: no DOM, no network.
 *
 * Each role in the email links to #/do/today/role/<role key>?from=daily-run: Jobs → Today opens with that
 * role prepared (views/hire.js), the event log counts the visit once (measure.js), and the tag leaves the
 * address so a reload or a copied link doesn't count again. The student's profile turns the email on or off.
 */

export const SOURCE = "daily-run";

/** Whether this visit came from the email. */
export function fromDailyRun(search) {
  return new URLSearchParams(search || "").get("from") === SOURCE;
}

/** The query string without the email's tag (and without a bare "?" when nothing is left). */
export function withoutFrom(search) {
  const params = new URLSearchParams(search || "");
  params.delete("from");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** The role key in #/do/<tool>/role/<key>, or "" for any other route. */
export function roleKeyFromRoute(kind, raw) {
  if (kind !== "role" || !raw) return "";
  try {
    return decodeURIComponent(raw).slice(0, 300);
  } catch {
    return "";
  }
}

/** What the profile says about the email, and the one button that changes it. */
export function emailSetting(on) {
  return on
    ? { status: "On. New roles prepared for you arrive by email on mornings when there are some, at most once a day.", action: "Stop these emails" }
    : { status: "Off. Your prepared roles are still here on Jobs every morning.", action: "Turn them back on" };
}
