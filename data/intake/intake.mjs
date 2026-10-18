/**
 * The intake: which question comes next, what the answers suggest, and the map
 * they draw. Pure, so the free check (/check/) and the app's chunks share it;
 * tests in intake.test.mjs. The catalog is data/intake/questions.json.
 *
 * State is { answers: {id: value}, skipped: [id], sources: {id: "answer" | "resume"} }.
 * A value is a string (choice, text), a list (multi, links, upload refs),
 * a number, or {min, max} (range). A skipped question leaves its nodes "not
 * yet assessed"; it never blocks anything.
 *
 * Bottlenecks are transparent rules over the answers, not a prediction. At the
 * check every one is "suspected": all of it is self-reported until we see proof.
 */

export const KINDS = ["choice", "multi", "number", "range", "text", "links", "upload"];
export const FAMILIES = ["interview", "pipeline", "proof", "network", "presence"];

/** What a resume read may say about a resume (server/intake.py keeps the same list). */
export const SIGNALS = {
  "title-mismatch": "your job titles don't match the role you want",
  "vague-bullets": "your bullet points describe your duties, not what changed because of your work",
  "no-numbers": "there are no numbers that show the impact of your work",
  "no-links": "there's nothing a reviewer can click to see your work",
  "short-tenures": "there are several short jobs in a row",
  gap: "there's a gap with no current work to fill it",
  dense: "the text is dense enough that a seven-second skim misses the main point",
  "strong-proof": "it shows real work that someone could check",
};

/** "In your resume, there are no numbers that show the impact of your work." */
const fromResume = (signal) => `In your resume, ${SIGNALS[signal]}.`;

/** "You've sent over 200 applications" / "You haven't sent any applications yet" */
function sentLine(label, apps) {
  if (apps === "none") return "You haven't sent any applications yet";
  return `You've sent ${label("apps", apps).toLowerCase()} applications`;
}

/** Seconds a person spends on each kind, for the "about N minutes" line. */
const SECONDS = { choice: 12, multi: 18, number: 15, range: 20, text: 50, links: 25, upload: 40 };

export const emptyState = () => ({ answers: {}, skipped: [], sources: {} });

/* ---------- the catalog ---------- */

/** Every reason the catalog is wrong, so a bad edit fails a test instead of a person's intake. */
export function validateCatalog(catalog) {
  const errors = [];
  const chunks = new Map((catalog.chunks ?? []).map((chunk) => [chunk.id, chunk]));
  const ids = new Set();
  const { chunkMax = 7 } = catalog.rules ?? {};
  for (const chunk of chunks.values()) {
    if (!FAMILIES.includes(chunk.family)) errors.push(`${chunk.id}: family ${chunk.family} is not a lane`);
    if (!chunk.title || !chunk.unlocks) errors.push(`${chunk.id}: needs a title and what it unlocks`);
  }
  for (const q of catalog.questions ?? []) {
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    if (!/^[a-z][A-Za-z0-9]{1,30}$/.test(q.id)) errors.push(`${q.id}: id must be camelCase letters`);
    if (!chunks.has(q.chunk)) errors.push(`${q.id}: chunk ${q.chunk} does not exist`);
    if (!KINDS.includes(q.kind)) errors.push(`${q.id}: kind ${q.kind} is not one of ${KINDS.join(", ")}`);
    if (!q.prompt) errors.push(`${q.id}: no prompt`);
    if ((q.kind === "choice" || q.kind === "multi") && !(q.options?.length >= 2)) errors.push(`${q.id}: needs 2 or more options`);
    if (!(q.affects?.length) || q.affects.some((family) => !FAMILIES.includes(family))) {
      errors.push(`${q.id}: affects must name lanes (an answer that changes nothing is not asked)`);
    }
    for (const rule of q.askIf ?? []) {
      const on = (catalog.questions ?? []).find((other) => other.id === rule.q);
      if (!on) errors.push(`${q.id}: askIf points at unknown ${rule.q}`);
      else if (on.chunk !== q.chunk && order(catalog, on.chunk) > order(catalog, q.chunk)) {
        errors.push(`${q.id}: askIf reads ${rule.q}, which is asked later`);
      }
      const values = rule.in ?? rule.not ?? rule.any;
      if (!Array.isArray(values)) errors.push(`${q.id}: askIf needs in, not or any`);
      else if (on?.options && values.some((value) => !on.options.some((option) => option.value === value))) {
        errors.push(`${q.id}: askIf names an option ${rule.q} doesn't have`);
      }
    }
  }
  for (const chunk of chunks.values()) {
    const count = (catalog.questions ?? []).filter((q) => q.chunk === chunk.id).length;
    if (count > chunkMax) errors.push(`${chunk.id}: ${count} questions, over the ${chunkMax} a chunk may ask`);
  }
  return errors;
}

const order = (catalog, chunkId) => catalog.chunks.findIndex((chunk) => chunk.id === chunkId);

export const chunkOf = (catalog, id) => catalog.chunks.find((chunk) => chunk.id === id);
export const questionOf = (catalog, id) => catalog.questions.find((q) => q.id === id);

/* ---------- asking ---------- */

export function isAnswered(state, id) {
  const value = state.answers[id];
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export const isSettled = (state, id) => isAnswered(state, id) || state.skipped.includes(id);

/**
 * A question is asked only when its askIf holds. While the question it reads
 * is unanswered, a `not` rule asks (we'd rather ask than guess) and an `in` or
 * `any` rule waits (it only applies to some people).
 */
export function shouldAsk(question, answers) {
  return (question.askIf ?? []).every((rule) => {
    const value = answers[rule.q];
    if (value === undefined || value === null) return !rule.in && !rule.any;
    const values = Array.isArray(value) ? value : [value];
    if (rule.in) return values.some((v) => rule.in.includes(v));
    if (rule.any) return values.some((v) => rule.any.includes(v));
    if (rule.not) return !values.some((v) => rule.not.includes(v));
    return true;
  });
}

/** The questions a chunk asks this person, in catalog order. */
export function chunkQuestions(catalog, chunkId, state) {
  return catalog.questions.filter((q) => q.chunk === chunkId && shouldAsk(q, state.answers));
}

/** The next question in a chunk that still needs the person, or null when the chunk is done. */
export function nextQuestion(catalog, chunkId, state) {
  return chunkQuestions(catalog, chunkId, state).find((q) => !isSettled(state, q.id)) ?? null;
}

export const chunkDone = (catalog, chunkId, state) => nextQuestion(catalog, chunkId, state) === null;

export function chunkMinutes(questions) {
  const seconds = questions.reduce((sum, q) => sum + (SECONDS[q.kind] ?? 20), 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Where a chunk stands, for its progress ring: answered of asked. */
export function chunkProgress(catalog, chunkId, state) {
  const asked = chunkQuestions(catalog, chunkId, state);
  return { done: asked.filter((q) => isSettled(state, q.id)).length, total: asked.length };
}

/**
 * Fill what the resume already says, without overwriting anything the person
 * answered. Returns a new state; prefilled ids are marked "resume" so the page
 * asks "Is this right?" instead of the question.
 */
export function applyPrefill(catalog, state, prefill = {}) {
  const next = { answers: { ...state.answers }, skipped: [...state.skipped], sources: { ...state.sources } };
  for (const q of catalog.questions) {
    if (!q.prefill || isAnswered(state, q.id) || state.skipped.includes(q.id)) continue;
    const value = prefill[q.prefill];
    if (value === undefined || value === null || value === "") continue;
    if (q.options && !q.options.some((option) => option.value === value)) continue;
    next.answers[q.id] = value;
    next.sources[q.id] = "resume";
  }
  return next;
}

export function answer(state, id, value) {
  return {
    answers: { ...state.answers, [id]: value },
    skipped: state.skipped.filter((other) => other !== id),
    sources: { ...state.sources, [id]: "answer" },
  };
}

export function skip(state, id) {
  const answers = { ...state.answers };
  delete answers[id];
  return { answers, skipped: [...new Set([...state.skipped, id])], sources: { ...state.sources, [id]: "skipped" } };
}

/* ---------- what the answers suggest ---------- */

const MANY = ["21to75", "76to200", "gt200"];
const FEW = ["none", "1to20"];
const LONG = ["6to12", "gt12"];
/** "A", "A and B", "A, B and C" */
const listWords = (items) => (items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const labelOf = (catalog, id, value) => questionOf(catalog, id)?.options?.find((option) => option.value === value)?.label ?? value;

/**
 * Each rule reads the answers (and the resume read, when there is one) and
 * either passes or returns a score with the lines that justify it. The lines
 * quote the person's own answers, so nothing reads as a verdict from nowhere.
 */
const RULES = [
  {
    id: "reach",
    family: "pipeline",
    title: "Your applications aren't reaching a real person",
    unlock: "c2",
    test: ({ a, label }) =>
      a.stop === "replies" && MANY.includes(a.apps) && {
        score: a.apps === "21to75" ? 0.8 : 0.95,
        evidence: [`${sentLine(label, a.apps)} and rarely hear back.`],
      },
    action: "Pick 5 roles posted in the last 3 days. For each one, find the hiring manager and send them a short note instead of only applying through the portal.",
  },
  {
    id: "story",
    family: "presence",
    title: "Your resume doesn't read like the role you want",
    unlock: "c4",
    test: ({ a, read }) => {
      const flags = ["title-mismatch", "vague-bullets", "no-numbers", "dense"].filter((s) => read.signals.includes(s));
      const silent = a.stop === "replies" && !FEW.includes(a.apps);
      if (!silent && !flags.length && a.role !== "unsure") return false;
      return {
        score: Math.min(0.95, (silent ? 0.6 : 0.3) + 0.12 * flags.length + (a.role === "unsure" ? 0.1 : 0)),
        evidence: [
          ...(silent ? ["Most replies depend on a quick skim of your resume, and right now those replies aren't coming."] : []),
          ...flags.map(fromResume),
        ],
      };
    },
    action: "Rewrite the first three lines of your resume so the very first one names the role you want and the strongest thing you've shipped.",
  },
  {
    id: "volume",
    family: "pipeline",
    title: "You're not sending enough applications",
    unlock: "c2",
    test: ({ a, label }) =>
      FEW.includes(a.apps) && a.months && a.months !== "lt1" && {
        score: a.apps === "none" ? 0.85 : 0.7,
        evidence: [`You've been looking for ${label("months", a.months).toLowerCase()}. ${sentLine(label, a.apps)}${a.apps === "none" ? "" : " in that time"}.`],
      },
    action: "Send 3 applications today to roles posted this week under the exact title you want.",
  },
  {
    id: "target",
    family: "pipeline",
    title: "You haven't settled on a target role yet",
    unlock: "c1",
    test: ({ a, read }) =>
      (a.role === "unsure" || a.stop === "offers") && {
        score: a.role === "unsure" ? 0.85 : 0.75,
        evidence: [
          a.role === "unsure"
            ? "You're not sure which role to aim for, so each application tells a different story."
            : "You're getting offers, just not for the job you want. Usually that means the role, the level or the pay is off.",
          ...(read.titles.length ? [`Your resume best supports roles like ${listWords(read.titles.slice(0, 3))}.`] : []),
        ],
      },
    action: "Pick the job title you've held most in the last two years, and search for only that title this week.",
  },
  {
    id: "gap",
    family: "presence",
    title: "Your time out of work is starting to show",
    unlock: "c4",
    test: ({ a, read, label }) =>
      (LONG.includes(a.months) || read.signals.includes("gap")) && {
        score: a.months === "gt12" ? 0.75 : 0.6,
        evidence: [
          a.months ? `You've been looking for ${label("months", a.months).toLowerCase()}.` : fromResume("gap"),
          "Callbacks tend to drop the longer a search goes on, and showing what you're building now helps.",
        ],
      },
    action: "Add one current line at the top of your resume: what you're building or learning now, with a link to it.",
  },
  {
    id: "proof",
    family: "proof",
    title: "There isn't enough proof of your work that someone can check",
    unlock: "c3",
    test: ({ a, read }) => {
      const early = a.stage === "grad" || a.stage === "self";
      const stalls = a.stop === "screen" || a.stop === "technical";
      const flags = ["no-links", "no-numbers"].filter((s) => read.signals.includes(s));
      if (read.signals.includes("strong-proof") || (!early && !stalls && !flags.length)) return false;
      return {
        score: Math.min(0.9, (early ? 0.6 : stalls ? 0.45 : 0.3) + 0.12 * flags.length),
        evidence: [
          ...(early ? ["Teams hiring early-career engineers look for work they can open and check for themselves."] : []),
          ...(stalls && !early ? ["You're getting calls, so the next thing employers look at is what you can show them."] : []),
          ...flags.map(fromResume),
        ],
      };
    },
    action: "Put one link a reviewer can open at the top of your resume: a repo, a live demo, or a short write-up of something you built.",
  },
  {
    id: "screen",
    family: "interview",
    title: "The first recruiter call isn't moving you forward",
    unlock: "c5",
    test: ({ a }) =>
      a.stop === "screen" && {
        score: 0.8,
        evidence: ["You're getting replies, but things end after the recruiter call. That's usually about how you tell your story or the level you're aiming for, not your code."],
      },
    action: "Write your 30-second answer to \"tell me about yourself\" for the role you want, then say it out loud twice.",
  },
  {
    id: "technical",
    family: "interview",
    title: "Your search stops at the technical round",
    unlock: "c5",
    test: ({ a }) =>
      a.stop === "technical" && { score: 0.85, evidence: ["You make it to the technical round, and that's where it ends."] },
    action: "Take the last technical question that stopped you and solve it again with AI closed, explaining out loud as you go.",
  },
  {
    id: "final",
    family: "interview",
    title: "You're stalling in final rounds",
    unlock: "c5",
    test: ({ a }) =>
      a.stop === "final" && {
        score: 0.85,
        evidence: ["You're good enough to reach the final round, so something in that last conversation is costing you the offer."],
      },
    action: "Write down your last final round: each interviewer, what they asked, and where it went quiet.",
  },
  {
    id: "level",
    family: "pipeline",
    title: "You may be aiming a level above what your resume shows",
    unlock: "c1",
    test: ({ a, read }) =>
      read.years !== null && ((a.level === "senior" && read.years < 4) || (a.level === "staff" && read.years < 7)) && {
        score: 0.55,
        evidence: [`You're aiming for ${a.level} roles, and your resume shows about ${read.years} years of experience.`],
      },
    action: "This week, apply to two roles one level below your target alongside your usual ones, and compare the replies you get.",
  },
];

function normalRead(read) {
  return {
    signals: Array.isArray(read?.signals) ? read.signals.filter((s) => s in SIGNALS) : [],
    titles: Array.isArray(read?.titles) ? read.titles.filter(Boolean) : [],
    years: Number.isFinite(read?.years) ? read.years : null,
    headline: typeof read?.headline === "string" ? read.headline : "",
  };
}

/** Every rule that fires, strongest first. Each carries the lines that justify it. */
export function bottlenecks(catalog, state, read = null) {
  const a = state.answers;
  const r = normalRead(read);
  const label = (id, value) => labelOf(catalog, id, value);
  return RULES.map((rule) => {
    const hit = rule.test({ a, read: r, label });
    if (!hit) return null;
    return {
      id: rule.id,
      family: rule.family,
      title: rule.title,
      unlock: rule.unlock,
      score: Math.round(hit.score * 100) / 100,
      confidence: "suspected",
      evidence: hit.evidence,
      action: rule.id === "story" && r.headline ? `Change your LinkedIn headline to: "${r.headline}"` : rule.action,
    };
  })
    .filter(Boolean)
    .sort((x, y) => y.score - x.score);
}

/* ---------- what comes next ---------- */

/**
 * The next chunk: c0, then c1 (nothing can be targeted without goals), then
 * whichever open chunk tests the strongest bottleneck, then catalog order.
 */
export function nextChunk(catalog, state, done = [], read = null) {
  const open = catalog.chunks.filter((chunk) => !done.includes(chunk.id));
  if (!open.length) return null;
  for (const id of ["c0", "c1"]) if (open.some((chunk) => chunk.id === id)) return id;
  const ranked = bottlenecks(catalog, state, read);
  for (const hit of ranked) if (open.some((chunk) => chunk.id === hit.unlock)) return hit.unlock;
  return open[0].id;
}

/* ---------- the map the answers draw ---------- */

/**
 * The diagnosis map: You, the top bottlenecks (open, the first marked "do this
 * next"), then one locked node per chunk still to answer, each saying what it
 * unlocks and how long it takes, then the offer at the end. Nodes sit on their
 * family's lane; the page lays them out on the road (js/rez/road.js).
 */
export function diagnosisMap(catalog, state, read = null, { done = ["c0"], top = 3 } = {}) {
  const hits = bottlenecks(catalog, state, read).slice(0, top);
  const nodes = hits.map((hit, index) => ({
    id: `b.${hit.id}`,
    family: hit.family,
    title: hit.title,
    state: index === 0 ? "next" : "open",
    bottleneck: hit,
  }));
  let chunkId;
  const queue = [];
  const seen = [...done];
  while ((chunkId = nextChunk(catalog, state, seen, read))) {
    queue.push(chunkId);
    seen.push(chunkId);
  }
  for (const id of queue) {
    const chunk = chunkOf(catalog, id);
    const asked = chunkQuestions(catalog, id, state);
    nodes.push({
      id: `lock.${id}`,
      family: chunk.family,
      title: chunk.unlocks,
      state: "locked",
      chunk: id,
      minutes: chunkMinutes(asked),
      questions: asked.length,
    });
  }
  return { nodes, bottlenecks: hits };
}
