/**
 * The job search, as data. Two records feed it:
 *
 *   student.search  (student-owned) the resume they keep current, and the log of
 *                   every application and warm message they sent, with how far
 *                   each one got.
 *   student.career  (instructor-owned) what Aden worked out with them: the story
 *                   in three parts (who, what, next), headline, About, the title
 *                   cluster, weekly targets, and the resume as Aden received it.
 *
 * Everything here is pure, so the board, the desk, the 1:1 report and the tests
 * read the same rules. Weeks are Monday-based (time.js), the same weeks the
 * calendar draws.
 */

import { isoDate, weekStart, addDays, parseDate } from "./time.js?v=15fea56-202610100117";

/** How far one application got. Each stage implies every stage before it. */
export const STAGES = [
  { id: "sent", label: "Sent", verb: "sent" },
  { id: "replied", label: "Replied", verb: "got a reply" },
  { id: "screen", label: "Screen", verb: "had a recruiter screen" },
  { id: "interview", label: "Interview", verb: "interviewed" },
  { id: "offer", label: "Offer", verb: "got an offer" },
];
export const STAGE_IDS = STAGES.map((stage) => stage.id);

export const KINDS = {
  apply: "Application",
  warm: "Warm message",
};

/** Defaults until Aden sets targets on the desk (application-engine and warm-path modules). */
export const DEFAULT_TARGETS = { apply: 15, warm: 10 };

/** An application with no reply after this many days is a follow-up. */
export const FOLLOW_UP_DAYS = 7;

const MAX_TEXT = 40_000;
const MAX_SHORT = 300;

const clip = (value, limit = MAX_SHORT) => String(value ?? "").trim().slice(0, limit);

export function stageIndex(stage) {
  const index = STAGE_IDS.indexOf(stage);
  return index < 0 ? 0 : index;
}

export function newId(now = new Date()) {
  return `a${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** One application, cleaned. Unknown fields drop; a bad stage becomes "sent". */
export function normalizeApp(raw = {}, now = new Date()) {
  const kind = raw.kind === "warm" ? "warm" : "apply";
  const stage = STAGE_IDS.includes(raw.stage) ? raw.stage : "sent";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? "")) ? raw.date : isoDate(now);
  return {
    id: clip(raw.id, 40) || newId(now),
    kind,
    company: clip(raw.company, 120),
    role: clip(raw.role, 160),
    link: clip(raw.link, 600),
    contact: clip(raw.contact, 160),
    date,
    stage,
    closed: raw.closed === true,
    note: clip(raw.note, 1000),
    roleKey: clip(raw.roleKey, 200) || undefined,
    followed: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.followed ?? "")) ? raw.followed : undefined,
    nudges: Number.isInteger(raw.nudges) ? raw.nudges : undefined,
    at: raw.at ?? now.toISOString(),
    moved: raw.moved ?? raw.at ?? now.toISOString(),
  };
}

export function searchOf(student) {
  const search = student?.search ?? {};
  return {
    resume: search.resume ?? null,
    profileAt: search.profileAt ?? null,
    linkedin: search.linkedin ?? "",
    apps: Array.isArray(search.apps) ? search.apps : [],
  };
}

export function careerOf(student) {
  const career = student?.career ?? {};
  return {
    linkedin: career.linkedin ?? "",
    resume: career.resume ?? null,
    story: { who: "", what: "", next: "", ...(career.story ?? {}) },
    headline: career.headline ?? "",
    about: career.about ?? "",
    titles: Array.isArray(career.titles) ? career.titles : [],
    companies: career.companies ?? "",
    fixes: Array.isArray(career.fixes) ? career.fixes : [],
    turnoffs: Array.isArray(career.turnoffs) ? career.turnoffs : [],
    confirm: Array.isArray(career.confirm) ? career.confirm : [],
    targets: { ...DEFAULT_TARGETS, ...(career.targets ?? {}) },
    notes: career.notes ?? "",
    years: Number.isInteger(career.years) ? career.years : null,
    working: Array.isArray(career.working) ? career.working : [],
    updatedAt: career.updatedAt ?? null,
  };
}

/** The resume to read: whichever of the student's and Aden's copies is newer. */
export function currentResume(student) {
  const mine = searchOf(student).resume;
  const aden = careerOf(student).resume;
  const has = (resume) => resume && (resume.text || resume.link);
  if (has(mine) && has(aden)) return String(mine.at ?? "") >= String(aden.at ?? "") ? { ...mine, from: "student" } : { ...aden, from: "aden" };
  if (has(mine)) return { ...mine, from: "student" };
  if (has(aden)) return { ...aden, from: "aden" };
  return null;
}

export function cleanResume({ text = "", link = "" } = {}, now = new Date()) {
  return { text: String(text ?? "").trim().slice(0, MAX_TEXT), link: clip(link, 600), at: now.toISOString() };
}

/* ---------- writes (pure: they return the next list) ---------- */

export function addApp(apps, raw, now = new Date()) {
  return [normalizeApp({ ...raw, id: undefined, at: now.toISOString(), moved: now.toISOString() }, now), ...(apps ?? [])];
}

export function moveApp(apps, id, stage, now = new Date()) {
  return (apps ?? []).map((app) =>
    app.id === id ? { ...app, stage: STAGE_IDS.includes(stage) ? stage : app.stage, closed: false, moved: now.toISOString() } : app
  );
}

export function closeApp(apps, id, closed = true, now = new Date()) {
  return (apps ?? []).map((app) => (app.id === id ? { ...app, closed, moved: now.toISOString() } : app));
}

export function editApp(apps, id, patch, now = new Date()) {
  return (apps ?? []).map((app) => (app.id === id ? normalizeApp({ ...app, ...patch, id: app.id, at: app.at, moved: now.toISOString() }, now) : app));
}

export function removeApp(apps, id) {
  return (apps ?? []).filter((app) => app.id !== id);
}

/* ---------- reads ---------- */

/** Monday of the week a YYYY-MM-DD date falls in, as YYYY-MM-DD. */
function weekKey(date) {
  return isoDate(weekStart(parseDate(date)));
}

/** How many of each kind were sent in the week containing `now`. */
export function thisWeek(apps, now = new Date()) {
  const key = isoDate(weekStart(now));
  const inWeek = (apps ?? []).filter((app) => weekKey(app.date) === key);
  return {
    start: key,
    apply: inWeek.filter((app) => app.kind !== "warm").length,
    warm: inWeek.filter((app) => app.kind === "warm").length,
  };
}

/** Sent per week (both kinds) for the last `weeks` weeks, oldest first. */
export function weeklySeries(apps, now = new Date(), weeks = 8) {
  const monday = weekStart(now);
  const keys = Array.from({ length: weeks }, (_, i) => isoDate(addDays(monday, -7 * (weeks - 1 - i))));
  const counts = new Map(keys.map((key) => [key, { week: key, apply: 0, warm: 0 }]));
  for (const app of apps ?? []) {
    const bucket = counts.get(weekKey(app.date));
    if (bucket) bucket[app.kind === "warm" ? "warm" : "apply"] += 1;
  }
  return keys.map((key) => counts.get(key));
}

/** How many reached each stage, all time. A screen counts as a reply too. */
export function funnel(apps) {
  const list = apps ?? [];
  return STAGES.map((stage, index) => ({
    ...stage,
    count: list.filter((app) => stageIndex(app.stage) >= index).length,
  }));
}

/** Open applications nobody answered within FOLLOW_UP_DAYS: the follow-up list. */
export function followUps(apps, now = new Date()) {
  const cutoff = isoDate(addDays(now, -FOLLOW_UP_DAYS));
  const last = (app) => (app.followed && app.followed > app.date ? app.followed : app.date);
  return (apps ?? [])
    .filter((app) => !app.closed && app.stage === "sent" && last(app) <= cutoff && (app.nudges ?? 0) < 2)
    .sort((a, b) => last(a).localeCompare(last(b)));
}

/** They sent the follow-up: the clock restarts, and after two nudges it leaves the list. */
export function markFollowed(apps, id, now = new Date()) {
  return (apps ?? []).map((app) => (app.id === id ? { ...app, followed: isoDate(now), nudges: (app.nudges ?? 0) + 1, moved: now.toISOString() } : app));
}

/** Live conversations: replied or further, not closed, not an offer yet. */
export function active(apps) {
  return (apps ?? [])
    .filter((app) => !app.closed && stageIndex(app.stage) >= 1 && app.stage !== "offer")
    .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || String(b.moved).localeCompare(String(a.moved)));
}

const pct = (part, whole) => (whole ? Math.round((100 * part) / whole) : 0);

/**
 * Where the search is stuck, as one sentence and a tone. Checked in funnel
 * order, so the first leak wins: there is no point practicing interviews while
 * nothing gets a reply. Thresholds are small on purpose: a founding cohort has
 * small numbers, and the point is the next move, not a statistic.
 */
export function diagnose({ student, now = new Date() }) {
  const apps = searchOf(student).apps;
  const career = careerOf(student);
  const week = thisWeek(apps, now);
  const [sent, replied, screen, interview, offer] = funnel(apps).map((stage) => stage.count);
  const linkedin = career.linkedin || searchOf(student).linkedin;

  if (offer) return { id: "offer", tone: "ok", text: "An offer is on the table. Compare it, negotiate once, report it on the map." };
  if (!career.headline && !career.story.who && !linkedin)
    return { id: "findable", tone: "warn", text: "No story yet. Set who it's for, what they do and what to do next, then put it on the profile." };
  if (!sent) return { id: "start", tone: "warn", text: `Nothing logged yet. The engine is ${career.targets.apply} applications and ${career.targets.warm} warm messages a week.` };
  if (sent >= 15 && pct(replied, sent) < 5)
    return { id: "replies", tone: "bad", text: `${sent} sent, ${replied} replied. Cold applications aren't landing: send more warm messages, and tighten the title fit and the resume's first lines.` };
  if (replied >= 3 && screen === 0)
    return { id: "screens", tone: "warn", text: `${replied} replies, no screens yet. The first message back is where it stops: answer within a day and ask for the call.` };
  if (screen >= 3 && interview === 0)
    return { id: "interviews", tone: "warn", text: `${screen} screens, no interviews. Rehearse the two-minute story and the "why this role" answer out loud.` };
  if (interview >= 3 && offer === 0)
    return { id: "offers", tone: "warn", text: `${interview} interviews, no offer. Book a recorded mock and fix the one thing it shows.` };
  if (week.apply < career.targets.apply)
    return { id: "volume", tone: "warn", text: `${week.apply} of ${career.targets.apply} applications this week. Volume is the lever right now.` };
  return { id: "moving", tone: "ok", text: "On pace this week. Keep the daily number and follow up on time." };
}

/** Aden's 1:1 sheet in plain text: paste it into the call notes or the log. */
export function weeklyReport({ student, now = new Date() }) {
  const name = student?.name ?? "Student";
  const { apps } = searchOf(student);
  const career = careerOf(student);
  const week = thisWeek(apps, now);
  const stages = funnel(apps);
  const due = followUps(apps, now);
  const live = active(apps);
  const lines = [
    `${name} · job search · week of ${week.start}`,
    "",
    `This week: ${week.apply} / ${career.targets.apply} applications · ${week.warm} / ${career.targets.warm} warm messages`,
    `All time: ${stages.map((stage) => `${stage.count} ${stage.label.toLowerCase()}`).join(" → ")}`,
    `Where it stalls: ${diagnose({ student, now }).text}`,
  ];
  if (live.length) {
    lines.push("", "Live conversations:");
    for (const app of live.slice(0, 8)) lines.push(`  - ${app.company}${app.role ? `, ${app.role}` : ""}: ${STAGES[stageIndex(app.stage)].label.toLowerCase()}`);
  }
  if (due.length) {
    lines.push("", `Follow up (no reply in ${FOLLOW_UP_DAYS}+ days):`);
    for (const app of due.slice(0, 8)) lines.push(`  - ${app.company}${app.role ? `, ${app.role}` : ""} (sent ${app.date})`);
  }
  const series = weeklySeries(apps, now, 4);
  lines.push("", `Last 4 weeks sent: ${series.map((w) => w.apply + w.warm).join(" · ")}`);
  return lines.join("\n");
}

/* ---------- matching fresh roles (the radar feed) to the title cluster ---------- */

const STOP = new Set(["engineer", "engineering", "developer", "senior", "sr", "jr", "junior", "staff", "lead", "principal", "ii", "iii", "i", "the", "and", "of", "a", "(ai)", "ai"]);

/** The words that make a title distinctive: "Forward Deployed Engineer" → ["forward", "deployed"]. */
export function titleTerms(titles) {
  const terms = new Set();
  for (const title of titles ?? []) {
    const words = String(title).toLowerCase().replace(/[()/,·|-]/g, " ").split(/\s+/).filter(Boolean);
    const distinct = words.filter((word) => !STOP.has(word));
    if (distinct.length) terms.add(distinct.join(" "));
    if (words.includes("ai")) terms.add("ai");
  }
  return [...terms];
}

/**
 * Score a radar role against the title cluster. Every distinctive phrase in the
 * title is worth 2; "AI" anywhere in the title is worth 1; a plain software
 * engineer title is worth 1 so the lane B fallback ("any SWE role at a smaller
 * company") still surfaces. Zero means not shown.
 */
export function roleScore(role, titles) {
  const title = String(role?.title ?? "").toLowerCase();
  if (!title) return 0;
  if (/\b(intern|internship|principal|staff|director|vp|head of|manager)\b/.test(title)) return 0;
  let score = 0;
  for (const term of titleTerms(titles)) {
    if (term === "ai") {
      if (/\bai\b|\bllm\b|\bml\b|machine learning|agent/.test(title)) score += 1;
      continue;
    }
    if (term.split(" ").every((word) => title.includes(word))) score += 2;
  }
  if (/software engineer|full[- ]?stack|backend|back-end/.test(title)) score += 1;
  return score;
}

export function matchRoles(roles, titles, { limit = 25, appliedKeys = new Set() } = {}) {
  return (roles ?? [])
    .map((role) => ({ role, score: roleScore(role, titles) }))
    .filter(({ role, score }) => score > 0 && !appliedKeys.has(role.key))
    .sort((a, b) => b.score - a.score || String(b.role.published_at ?? b.role.first_seen_at ?? "").localeCompare(String(a.role.published_at ?? a.role.first_seen_at ?? "")))
    .slice(0, limit)
    .map(({ role, score }) => ({ ...role, score }));
}

/* ---------- people: the warm network ----------
   Referrals are the biggest lever there is (a few percent of applicants, a
   large share of hires), and someone with several past employers already
   knows people at companies that hire. A person is someone they could
   message: a former colleague, someone they met, or a stranger in the seat. */

export const RELATIONS = {
  colleague: "Former colleague",
  met: "Met before",
  cold: "Cold",
};

export const PERSON_STATES = [
  { id: "todo", label: "To ask" },
  { id: "asked", label: "Asked" },
  { id: "replied", label: "Replied" },
  { id: "referred", label: "Referred / intro" },
];

export function peopleOf(student) {
  const people = student?.search?.people;
  return Array.isArray(people) ? people : [];
}

export function normalizePerson(raw = {}, now = new Date()) {
  return {
    id: clip(raw.id, 40) || newId(now).replace(/^a/, "p"),
    name: clip(raw.name, 120),
    company: clip(raw.company, 120),
    role: clip(raw.role, 160),
    link: clip(raw.link, 600),
    relation: RELATIONS[raw.relation] ? raw.relation : "cold",
    state: PERSON_STATES.some((s) => s.id === raw.state) ? raw.state : "todo",
    note: clip(raw.note, 600),
    at: raw.at ?? now.toISOString(),
    moved: raw.moved ?? raw.at ?? now.toISOString(),
  };
}

export function addPerson(people, raw, now = new Date()) {
  return [normalizePerson({ ...raw, id: undefined, at: now.toISOString() }, now), ...(people ?? [])];
}

export function movePerson(people, id, state, now = new Date()) {
  return (people ?? []).map((p) => (p.id === id ? { ...p, state, moved: now.toISOString() } : p));
}

export function removePerson(people, id) {
  return (people ?? []).filter((p) => p.id !== id);
}

/** Warm first: colleagues, then people they've met, then strangers; oldest added first. */
export function toAsk(people) {
  const rank = { colleague: 0, met: 1, cold: 2 };
  return (people ?? [])
    .filter((p) => p.state === "todo")
    .sort((a, b) => rank[a.relation] - rank[b.relation] || String(a.at).localeCompare(String(b.at)));
}

/* ---------- finding people without scraping anyone ----------
   Search links the student opens themselves. Nothing here touches LinkedIn on
   their behalf (its terms ban automation and accounts get restricted); the
   machine writes the query, the person clicks. */

export function peopleLinks(company, titles = ["engineering manager", "head of engineering"]) {
  const name = String(company ?? "").trim();
  if (!name) return [];
  const quoted = titles.map((t) => `"${t}"`).join(" OR ");
  const enc = encodeURIComponent;
  return [
    { label: "LinkedIn people at " + name, href: `https://www.linkedin.com/search/results/people/?keywords=${enc(`${name} ${titles[0]}`)}` },
    { label: "Google: their managers", href: `https://www.google.com/search?q=${enc(`site:linkedin.com/in "${name}" (${quoted})`)}` },
    { label: "Former colleagues there", href: `https://www.linkedin.com/search/results/people/?keywords=${enc(name)}&network=%5B%22F%22%2C%22S%22%5D` },
    { label: "Their engineering on GitHub", href: `https://github.com/search?type=users&q=${enc(name)}` },
  ];
}

/** A short follow-up they can send as is, or edit. Plain, specific, one ask. */
export function followUpText(app, student) {
  const first = String(student?.name ?? "").split(/\s+/)[0];
  const role = app.role ? `the ${app.role} role` : "the open role";
  return `Hi, following up on my application for ${role} at ${app.company} (sent ${app.date}). I've been building ${careerOf(student).story.what ? careerOf(student).story.what.charAt(0).toLowerCase() + careerOf(student).story.what.slice(1).replace(/\.$/, "") : "in this space"}, and I'd value 15 minutes with whoever is hiring for it. Is there someone you'd point me to?${first ? `\n\n${first}` : ""}`;
}

/** A referral ask for someone they already know. */
export function referralText(person, student) {
  const first = String(student?.name ?? "").split(/\s+/)[0];
  const them = String(person?.name ?? "").split(/\s+/)[0] || "there";
  const where = person?.company ? ` at ${person.company}` : "";
  return `Hi ${them}, it's been a while. I'm looking for my next role, mostly ${careerOf(student).titles.slice(0, 2).join(" or ") || "software engineering"} work, and I noticed you're${where}. Would you be open to a 15-minute call about the team, or to referring me if something fits? Happy to send a short summary first.${first ? `\n\n${first}` : ""}`;
}

/* ---------- the day's run ----------
   What to do today, in the order that produces interviews: warm asks first,
   follow-ups that are due, fresh tailored applications (early and specific
   beats many and generic), then the proof work on their map. Daily numbers
   come from what's left of the week's targets over the weekdays left. */

export function weekdaysLeft(now = new Date()) {
  const day = now.getDay(); // 0 Sun .. 6 Sat
  if (day === 0 || day === 6) return 1; // a weekend day still gets a small run
  return 6 - day; // Mon=5 ... Fri=1
}

export function dailyTargets({ student, now = new Date() }) {
  const { apps } = searchOf(student);
  const { targets } = careerOf(student);
  const week = thisWeek(apps, now);
  const days = weekdaysLeft(now);
  const today = isoDate(now);
  const doneToday = (kind) => apps.filter((a) => a.date === today && (kind === "warm" ? a.kind === "warm" : a.kind !== "warm")).length;
  const left = (target, done) => Math.max(0, target - done);
  // Catching up is capped: a missed Monday shouldn't make Friday a 15-application day.
  const per = (target, done) => Math.min(Math.ceil(left(target, done) / days), Math.ceil(target / 5) + 2);
  return {
    apply: { target: per(targets.apply, week.apply - doneToday("apply")), done: doneToday("apply"), weekLeft: left(targets.apply, week.apply) },
    warm: { target: per(targets.warm, week.warm - doneToday("warm")), done: doneToday("warm"), weekLeft: left(targets.warm, week.warm) },
  };
}

/* ---------- prepared roles (role_pack.py), kept on their own record ---------- */

export const MAX_PACKS = 30;

export function packsOf(student) {
  const packs = student?.search?.packs;
  return packs && typeof packs === "object" ? packs : {};
}

export function keepPack(packs, key, entry, now = new Date()) {
  const next = { ...(packs ?? {}), [key]: { ...entry, at: now.toISOString() } };
  const keys = Object.keys(next).sort((a, b) => String(next[b].at).localeCompare(String(next[a].at)));
  return Object.fromEntries(keys.slice(0, MAX_PACKS).map((k) => [k, next[k]]));
}

/** How old a posting is, in plain words, from its publish date. */
export function ageLabel(iso, now = new Date()) {
  if (!iso) return "";
  const days = Math.floor((now - new Date(iso)) / 86400000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

/* ---------- their network: the LinkedIn connections export ----------
   LinkedIn lets every member download their own connections (Settings → Data
   privacy → Get a copy of your data → Connections). Importing your own export
   touches nothing on LinkedIn. Kept compact on its own student key
   (`network`), written only on import, as rows [name, company, position, url]. */

export const MAX_NETWORK = 8000;

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Rows from LinkedIn's Connections.csv (it starts with a few "Notes" lines before the header). */
export function parseConnections(text) {
  const rows = csvRows(String(text ?? ""));
  const at = rows.findIndex((row) => row.some((c) => /first name/i.test(c)) && row.some((c) => /company/i.test(c)));
  if (at < 0) return [];
  const head = rows[at].map((c) => c.trim().toLowerCase());
  const col = (name) => head.findIndex((c) => c === name || c.startsWith(name));
  const [first, last, url, company, position] = ["first name", "last name", "url", "company", "position"].map(col);
  return rows
    .slice(at + 1)
    .map((row) => [
      `${(row[first] ?? "").trim()} ${(row[last] ?? "").trim()}`.trim().slice(0, 120),
      (row[company] ?? "").trim().slice(0, 120),
      (row[position] ?? "").trim().slice(0, 160),
      (row[url] ?? "").trim().slice(0, 300),
    ])
    .filter(([name, company]) => name && company)
    .slice(0, MAX_NETWORK);
}

export function networkOf(student) {
  const rows = student?.network?.rows;
  return Array.isArray(rows) ? rows : [];
}

const COMPANY_NOISE = /\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc|technologies|technology|labs|hq|the)\b\.?/g;

/** "Acme AI, Inc." and "acme ai" are the same company. */
export function companyKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(COMPANY_NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** For each role, the connections who work at that company now. */
export function insideConnections(roles, rows) {
  const byCompany = new Map();
  for (const row of rows ?? []) {
    const key = companyKey(row[1]);
    if (!key) continue;
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push({ name: row[0], company: row[1], role: row[2], link: row[3] });
  }
  const out = [];
  for (const role of roles ?? []) {
    const people = byCompany.get(companyKey(role.company));
    if (people?.length) out.push({ role, people });
  }
  return out;
}

/** A posting title short enough for a sentence: the first role, commas inside parentheses kept. */
export function shortTitle(title) {
  const text = String(title ?? "").trim();
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth = Math.max(0, depth - 1);
    else if (text[i] === "," && depth === 0) return text.slice(0, i).trim();
  }
  return text;
}

/** The ask for someone who works where a role is open. */
export function insiderText(person, role, student) {
  const first = String(student?.name ?? "").split(/\s+/)[0];
  const them = String(person?.name ?? "").split(/\s+/)[0] || "there";
  return `Hi ${them}, I saw ${role.company} is hiring for ${shortTitle(role.title)} and I'm applying. ${careerOf(student).story.what ? `My work is ${careerOf(student).story.what.charAt(0).toLowerCase()}${careerOf(student).story.what.slice(1).replace(/\.$/, "")}. ` : ""}Would you be open to telling me a bit about the team, or referring me if it seems like a fit? Happy to send a two-line summary.${first ? `\n\n${first}` : ""}`;
}
