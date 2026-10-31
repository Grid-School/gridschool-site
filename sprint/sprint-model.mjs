/**
 * The free sprint's page logic that has no page in it (sprint.js, apply/apply.js), so it is tested on its own
 * (sprint-model.test.mjs). Server: server/sprint.py, sprint_api.py.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-11-04" as "November 4" (or "Wednesday, November 4"). Dates are read as calendar days, never shifted by time zone. */
export function dayText(iso, { weekday = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const text = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return weekday ? `${DAYS[d.getUTCDay()]}, ${text}` : text;
}

/** The seat counter on sprint/: {left, words, waves, full}. */
export function seatsLine(status) {
  if (!status || status.seatsLeft == null) return { left: String(status?.cap ?? 13), words: `seats in all`, waves: "", full: false };
  const left = Number(status.seatsLeft);
  const waves = (status.waves || []).filter((w) => w.starts).map((w) => `${w.label} starts ${dayText(w.starts)}`).join(" · ");
  if (left <= 0) return { left: "0", words: "seats left: join the waitlist", waves, full: true };
  return { left: String(left), words: `of ${status.cap} ${status.cap === 1 ? "seat" : "seats"} left`, waves, full: false };
}

/** The source carried from sprint/ through the check into the step: ?from=, else "sprint". */
export function sourceFrom(search) {
  const raw = new URLSearchParams(search || "").get("from") || "";
  const clean = raw.replace(/[^\w:.-]/g, "").slice(0, 60);
  return clean || "sprint";
}

/** Where "Apply" goes: the free check in sprint mode, carrying the source. */
export function checkHref(from, base = "../check/") {
  return `${base}?sprint=1&from=${encodeURIComponent(from || "sprint")}`;
}

/** Who is applying, as the server reads it: a signed-in account first, then a board token, then the saved check's id. */
export function identity({ account = null, board = "", check = "" } = {}) {
  const headers = { "content-type": "application/json" };
  if (account?.token) headers.authorization = `Bearer ${account.token}`;
  else if (board) headers.authorization = `Bearer ${board}`;
  return { headers, check: /^ck_[A-Za-z0-9_-]{16,40}$/.test(check || "") ? check : "" };
}

/** The saved check's id from the check's own storage (check/check.js KEY), or "". */
export function savedCheck(raw) {
  try {
    const id = JSON.parse(raw || "null")?.saved?.id || "";
    return /^ck_[A-Za-z0-9_-]{16,40}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

/** The step's answers from what the form holds; only the questions that were asked are sent. */
export function stepAnswers(asked, values) {
  const step = {};
  for (const id of asked) {
    if (id === "built") {
      if (values.nothing) step.nothing = true;
      else {
        if (String(values.shipped || "").trim()) step.shipped = String(values.shipped).trim();
        const link = String(values.link || "").trim();
        if (link) step.links = [link];
      }
    } else if (id === "linkedin") {
      const link = String(values.linkedin || "").trim();
      if (link) step.linkedin = link;
    } else if (id === "hours8") {
      if (values.hours8 === "yes" || values.hours8 === "no") step.hours8 = values.hours8;
    } else if (values[id]) step[id] = values[id];
  }
  return step;
}

/** What the step still needs before it can be sent, in plain words, or "". LinkedIn is optional. */
export function stepProblem(asked, values) {
  const need = {
    auth: "Tell us whether you need sponsorship.",
    hours: "Pick how many hours a week you can give.",
    hours8: "Tell us whether 8 hours a week is possible.",
    school: "Pick where you are with school.",
  };
  for (const id of asked) {
    if (need[id] && !values[id]) return need[id];
    if (id === "built" && !values.nothing && !String(values.shipped || "").trim() && !String(values.link || "").trim()) {
      return "Name one thing you've built, add a link, or tick that you haven't yet.";
    }
  }
  if (!String(values.title || "").trim()) return "Confirm the title you're going after.";
  if (!values.clinic) return "Pick a clinic time, or async.";
  return "";
}

/** A full name is two words or more. */
export const fullName = (value) => String(value || "").trim().split(/\s+/).filter((part) => /\p{L}/u.test(part)).length >= 2;

/** The result screen's headline and badge for a decision. */
export function resultHead(out) {
  if (out.decision === "member") return { badge: "You're in", tone: "", title: `You're in. Your sprint starts ${dayText(out.starts, { weekday: true })}.` };
  if (out.decision === "waitlist") return { badge: "Waitlist", tone: "wait", title: out.position ? `You're number ${out.position} on the waitlist.` : "You're on the waitlist." };
  if (out.decision === "declined") return { badge: "Not this time", tone: "no", title: "The sprint isn't the right fit right now." };
  if (out.decision === "released" || out.status === "released") return { badge: "Seat released", tone: "no", title: "Your seat went to the next person." };
  return { badge: "", tone: "", title: "" };
}
