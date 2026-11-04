/**
 * On a seat with the interview open (features.interview), the three foundation steps become one: the resume
 * step holds the interview, and Who you are and Where you're going leave the line. Their answers aren't lost:
 * the interview reads the same intake and the same resume graph. Pure, so the map can be tested without a page.
 */

export const MERGED_INTO_RESUME = ["b.profile", "p.path"];
export const RESUME_STEP = "b.resume";
/** The orientation step wears the walk's first name on the map: it is where the talk about your work begins. */
export const START_STEP = "s.start";
const START_TITLE = "Your work";

const TITLE = "Your resume";
const WHY = "Tell us about your work once, in a short conversation, and we build the resume from it. Nothing goes on the page until you've confirmed it.";
const EVIDENCE = "A downloaded resume where you confirmed every line.";

export function interviewCurriculum(curriculum) {
  if (!curriculum?.nodes) return curriculum;
  const gone = new Set(MERGED_INTO_RESUME);
  if (!curriculum.nodes.some((node) => gone.has(node.id))) return curriculum;
  const nodes = curriculum.nodes
    .filter((node) => !gone.has(node.id))
    .map((node) => {
      const requires = (node.requires ?? []).filter((id) => !gone.has(id));
      const next = requires.length === (node.requires ?? []).length ? node : { ...node, requires };
      if (next.id === START_STEP) return { ...next, title: START_TITLE };
      return next.id === RESUME_STEP ? { ...next, title: TITLE, why: WHY, evidence: EVIDENCE } : next;
    });
  return { ...curriculum, nodes };
}


/* ---------- The map grows from the record (2026-11-03) ----------
   After the first week the map carries what the student did and where it goes: the path ahead (a second
   company, a reply, a call, a mention, interviews, an offer) as steps on the search lane, and every company
   and person from the record as marks on the people lane, each lit by what happened. Nothing here is stored:
   it is drawn from the same record Key Connections reads, so the map and the list never disagree. */

// The one step the student takes next is numbered; what happens to them after it (a reply, a call, their name
// reaching the manager, interviews, an offer) is drawn as marks that light as they happen, never as tasks.
const AHEAD = [
  { id: "r.reply", title: "A reply", why: "Someone writes back. We read it and write your next line.", lit: (s) => people(s).some((c) => c.touches?.reply) },
  { id: "r.call", title: "A call", why: "Twenty minutes with someone on the team, no agenda.", lit: (s) => people(s).some((c) => c.touches?.call) },
  { id: "r.mention", title: "Your name reaches the manager", why: "An engineer says your name to the person who hires.", lit: (s) => people(s).some((c) => c.touches?.vouch) },
  { id: "r.interview", title: "Interviews", why: "The conversations that come from being mentioned.", lit: (s) => apps(s).some((a) => ["screen", "interview"].includes(a.stage)) },
  { id: "r.offer", title: "An offer", why: "Where the map ends.", lit: (s) => apps(s).some((a) => a.stage === "offer") },
];
const NUDGE_DAYS = [3, 7];
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayShort = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${WEEKDAYS[d.getDay()]}, ${dateWord(iso)}`; };

// Companies in the order they were added, so the field reads left to right in time.
const targets = (student) => (student?.search?.targets ?? []).filter((t) => t.state === "active").sort((a, b) => String(a.openedAt || "").localeCompare(String(b.openedAt || "")));
const activeCount = (student) => targets(student).length;
const people = (student) => targets(student).flatMap((t) => t.people ?? []);
const apps = (student) => student?.search?.apps ?? [];
const firstName = (name) => String(name || "").split(/\s+/)[0];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateWord = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };

/** The words under a person's mark: the latest touch by date, and when the follow-up is due while waiting. */
export function personHint(c) {
  const t = c.touches || {};
  const words = { vouch: "will mention you", call: "you talked", thing: "you sent what you promised", asked: "asked for a mention", back: "you wrote back", reply: "they answered", offer: "call offered", nudge7: "follow-up sent", nudge3: "follow-up sent", note: "sent", request: "request sent" };
  const latest = Object.entries(t).filter(([k, v]) => v && words[k]).sort((a, b) => (a[1] < b[1] ? 1 : -1))[0];
  if (!latest) return c.note ? "note ready" : c.why ? "picked for you" : "";
  const [k, v] = latest;
  const line = `${words[k]} ${k === "note" || k === "request" ? "" : "· "}${dateWord(v)}`.replace(/\s+/g, " ").trim();
  if ((k === "note" || k === "nudge3") && !t.reply) {
    const due = NUDGE_DAYS.map((d) => addDays(t.note, d)).find((d) => !t[`nudge${d === addDays(t.note, 3) ? 3 : 7}`]);
    return due ? `${line} · follow-up ${dayShort(due)}` : line;
  }
  return line;
}

/** How a person's mark is drawn: warm (they did something toward you), waiting (your note is out), or ahead. */
export function personState(c) {
  const t = c.touches || {};
  if (t.reply || t.call || t.vouch) return "warm";
  if (t.note || t.request) return "waiting";
  return "ahead";
}

/** How far a person has come toward you, as the line of light draws it: sent a quarter, answered a half,
 * talked three quarters, will mention you the whole. */
export function personProgress(c) {
  const t = c.touches || {};
  if (t.vouch) return 1;
  if (t.call) return 0.75;
  if (t.reply) return 0.5;
  if (t.note || t.request) return 0.25;
  return 0;
}

/** The nodes the record adds to the map, and the evidence that lights them. */
export function recordNodes(student, { firstWeekDone = false } = {}) {
  if (!student) return { nodes: [], evidence: {} };
  const nodes = [];
  const evidence = {};
  const light = (id) => { evidence[id] = { url: `gridschool:record/${id}`, internal: true }; };
  // The path ahead, on the search lane, after the first notes.
  // The first week's own steps light from the same record as the marks: a company picked, a note sent.
  if (activeCount(student)) light("s.targets");
  if (people(student).some((c) => c.touches?.note || c.touches?.request)) light("s.send");
  let prev = "s.send";
  AHEAD.forEach((step, i) => {
    nodes.push({ id: step.id, n: 20 + i, type: "step", kind: "core", phase: "week", family: "pipeline", title: step.title, why: step.why, evidence: step.title, requires: [prev], completion: "evidence", record: true, marker: !step.step, ahead: !step.step });
    if (step.lit(student)) light(step.id);
    prev = step.id;
  });
  // The field: companies as hubs hanging off the path in the order they were added, each with its people
  // beneath it. A hub lights once a note is out of it; a person is a ghost until written to, waiting while your
  // note is out, warm once they did something toward you; their line of light is how far they came. An empty
  // hub stands for the next company while there is room for one. Nothing here is on the road.
  let order = 40;
  let col = 0;
  for (const t of targets(student)) {
    const tid = `t.${t.id}`;
    const ppl = t.people ?? [];
    const names = new Set(ppl.map((c) => c.name.toLowerCase()));
    const picks = (t.picks?.people ?? []).filter((p) => p.pick && !names.has(p.name.toLowerCase()));
    const count = ppl.length + picks.length;
    nodes.push({ id: tid, n: order++, type: "step", kind: "core", phase: "week", family: "pipeline", title: t.company, why: t.why || "", evidence: "A note out to someone there.", requires: [], completion: "evidence", marker: true, company: true, field: true, col: col++, record: true, hint: count ? `${count} ${count === 1 ? "person" : "people"}` : "find who to write to", targetId: t.id });
    if (ppl.some((c) => c.touches?.note || c.touches?.request)) light(tid);
    const byProgress = [...ppl].sort((a, b) => personProgress(b) - personProgress(a));
    let row = 0;
    for (const c of byProgress) {
      const cid = `c.${c.id}`;
      nodes.push({ id: cid, n: order++, type: "step", kind: "core", phase: "week", family: "pipeline", title: c.name, why: c.why || "", evidence: "They did something toward you.", requires: [], completion: "evidence", marker: true, person: true, field: true, hub: tid, row: row++, personState: personState(c), progress: personProgress(c), record: true, hint: personHint(c), contactId: c.id, targetId: t.id });
      if (personState(c) === "warm") light(cid);
    }
    for (const p of picks) {
      nodes.push({ id: `p.${t.id}.${p.name}`, n: order++, type: "step", kind: "core", phase: "week", family: "pipeline", title: p.name, why: p.why || "", evidence: "", requires: [], completion: "evidence", marker: true, person: true, field: true, hub: tid, row: row++, personState: "ahead", progress: 0, record: true, hint: "picked for you", targetId: t.id, pickName: p.name });
    }
  }
  if (activeCount(student) < 5) {
    nodes.push({ id: "t.next", n: order++, type: "step", kind: "core", phase: "week", family: "pipeline", title: activeCount(student) ? "A second company" : "Your first company", why: "Breadth before depth: another company while the first note is read.", evidence: "", requires: [], completion: "evidence", marker: true, company: true, field: true, ghost: true, col: col++, record: true, hint: "add one" });
  }
  return { nodes, evidence };
}

/** The curriculum plus the record, for the map; the student plus the record's evidence, for the statuses. */
export function withRecord(curriculum, student) {
  const { nodes, evidence } = recordNodes(student);
  if (!nodes.length) return { curriculum, student };
  const phases = (curriculum.phases ?? []).map((p) => (p.id === "week" ? { ...p, pace: "Up to five companies, two people each · follow-ups at three and seven days" } : p));
  return {
    curriculum: { ...curriculum, nodes: [...curriculum.nodes, ...nodes], phases },
    student: { ...student, evidence: { ...(student.evidence ?? {}), ...evidence } },
  };
}
