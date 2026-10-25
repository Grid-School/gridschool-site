/**
 * The free check: six one-tap questions in, the person's top likely
 * bottlenecks, and their map out: a free map whose first step walks them
 * through the fix. People arrive warm
 * (from the VSL or an ad, mostly on phones), so there is no intro screen:
 * question 1 is the first thing they see. A resume is offered after the
 * questions, as an optional way to sharpen the result, never as a gate.
 * One card at a time beside the map, which redraws on every answer.
 *
 * Questions, order and scoring come from data/intake (questions.json +
 * intake.mjs), the same catalog the paid map's chunks use. The resume is read
 * once by POST /check/read while they answer (never stored); the answers save
 * only when they ask us to email the map (POST /check/save). Progress lives in
 * this browser so a refresh loses nothing; the resume text never does.
 */

import { PERSIST, link } from "../config.js?v=2b0f46b-202610250651";
import * as I from "../data/intake/intake.mjs?v=2b0f46b-202610250651";
import { mountCheckMap } from "./check-map.js?v=2b0f46b-202610250651";
import * as Account from "./account.js?v=2b0f46b-202610250651";
import { enterSeat } from "../app/js/persist-auth.js?v=2b0f46b-202610250651";
import { track, visitorId } from "./events.js?v=2b0f46b-202610250651";
import * as Share from "./share.mjs?v=2b0f46b-202610250651";
import { drawShareCard, cardBlob } from "./share-card.js?v=2b0f46b-202610250651";

const KEY = "gridschool.check.v1";
const SHARE_KEY = "gridschool.share.v1";
const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const READ_WAIT_MS = 9000;
const READ_TYPICAL_MS = 6000;
// What the read checks, in rubric order (data/intake/rubric.json): target, impact, proof, scope, skim, fit.
const READING = [
  "The first line: what role does it say?",
  "The top third: results, or duties?",
  "Proof: anything a reviewer can open?",
  "Scope: does it match the level you want?",
  "The skim: what sticks in 7 seconds?",
  "Fit: does your stack match the roles?",
];

const $ = (selector) => document.querySelector(selector);
const cardEl = $("#card");
const live = $("#live");

/**
 * Localhost may point the check at a local persist server: /check/?api=http://localhost:8768
 * Without ?api it uses the page's own origin, never production: a local test run
 * must not count as real traffic or save real checks.
 */
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  if (local) return (asked || location.origin).replace(/\/$/, "");
  return PERSIST.endpoint;
})();

/**
 * Walkthrough mode (?demo=1, kept for this tab): the offer shows even before Stripe is
 * connected and leads to demo/checkout/, which charges nothing; funnel counting is off.
 * ?demo=0 turns it off again.
 */
const DEMO_CHECKOUT = "../demo/checkout/";
const DEMO = (() => {
  const asked = new URLSearchParams(location.search).get("demo");
  try {
    if (asked === "1") sessionStorage.setItem("gridschool.demo", "1");
    if (asked === "0") sessionStorage.removeItem("gridschool.demo");
    return sessionStorage.getItem("gridschool.demo") === "1";
  } catch {
    return asked === "1";
  }
})();

/** What a person sees when something fails: our words, never the browser's ("Failed to fetch"). */
function say(problem) {
  const text = String(problem?.message || "");
  if (problem instanceof TypeError || /fetch|network|load failed/i.test(text) || !text) {
    return "We couldn't reach our server. Your map is still here; try again in a moment.";
  }
  return text;
}

let catalog;
let rubric = { dimensions: [] };
let booted = false;
let map;
let store = fresh();
let resumeText = "";
// Copy that lives in data/intake so it can be reviewed in one place (server/offer_test.py checks it).
let insights = { lines: {} };
let sources = { lines: {} };
let offer = null;

/**
 * Rory's naming test: does an instrument's name ("hiring scan") make the free thing feel
 * more valuable than "check"? Each visitor gets one name for good, counted with every step
 * (events prop "variant"). ?name=check or ?name=scan pins it for a look.
 */
const NAMES = { check: "Free check", scan: "Free hiring scan" };
const variant = (() => {
  const pinned = new URLSearchParams(location.search).get("name");
  if (pinned in NAMES) return pinned;
  const id = visitorId();
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  return sum % 2 ? "scan" : "check";
})();
const checkName = () => NAMES[variant];

/** "Our read": one line back after each answer, so the two minutes teach something. */
function insightLine() {
  if (!store.insight) return null;
  return h("p", "insight", null, {}, [h("span", "insight__label", "Our read"), h("span", "", store.insight)]);
}

function fresh() {
  return { view: "q", qid: null, state: I.emptyState(), read: null, readStatus: "idle", followups: [], saved: null, resumeOffered: false, from: "" };
}

/* ---------- storage: a convenience, never required ---------- */

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...store, readStatus: store.readStatus === "reading" ? "idle" : store.readStatus }));
  } catch {
    /* private window: the check still works, it just won't survive a refresh */
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.state?.answers) store = { ...fresh(), ...saved };
  } catch {
    /* nothing saved */
  }
}

/* ---------- the map ---------- */

/** Phones get the slim strip while a question is on screen, so the question keeps the screen. */
const stacked = matchMedia("(max-width: 960px)");
const asking = () => ["q", "follow", "wait"].includes(store.view);
const compact = () => stacked.matches && (asking() || store.view === "result");
/** The result on a wide screen: the map spans the page above the findings, so it's drawn wider. */
const wide = () => !stacked.matches && document.body.classList.contains("is-result");
const mapMode = () => (compact() ? "compact" : wide() ? "wide" : "normal");

function drawMap({ first = false } = {}) {
  const { nodes } = I.diagnosisMap(catalog, store.state, store.read);
  map.render(nodes, { first, compact: compact(), wide: wide() });
  const hits = nodes.filter((node) => node.state !== "locked").length;
  const found = `${hits} likely ${hits === 1 ? "bottleneck" : "bottlenecks"} so far`;
  $("#map-caption").textContent = !hits
    ? "Your map draws itself as you answer."
    : compact()
      ? `${found[0].toUpperCase()}${found.slice(1)}.`
      : `We've found ${found}. Locked areas open up with a few questions each.`;
}

/* ---------- views ---------- */

function show(view, qid = null) {
  store.view = view;
  store.qid = qid;
  const wasMode = mapMode();
  document.body.classList.toggle("is-asking", asking());
  document.body.classList.toggle("is-result", view === "result");
  if (map && booted && wasMode !== mapMode()) drawMap();
  persist();
  cardEl.classList.remove("is-in");
  void cardEl.offsetWidth; // restart the arrival
  cardEl.replaceChildren(...VIEWS[view]());
  // Only animate a card someone can see: a hidden tab holds animations at their first frame.
  if (document.visibilityState === "visible") cardEl.classList.add("is-in");
  const focus = cardEl.querySelector("[data-focus]") || cardEl.querySelector("h1, h2");
  focus?.focus({ preventScroll: true });
  // A new card always starts with its top in view (the last one may have been taller),
  // just under the nav, or on a phone just under the map that rides above it.
  // The result opens at the top of the page, map first.
  // The reading screen too: it replaces the taller resume card, so it starts at the top as well.
  if (view === "result" || view === "wait") return scrollTo({ top: 0, behavior: "auto" });
  const floor = stacked.matches ? $(".check__map").getBoundingClientRect().bottom : 64;
  const top = cardEl.getBoundingClientRect().top;
  if (top < floor + 8 || top > innerHeight * 0.6) scrollBy({ top: top - floor - 16, behavior: prefersReduced() ? "auto" : "smooth" });
}

const VIEWS = {
  resume() {
    const input = h("input", "", null, { type: "file", accept: ".pdf,.txt,.md,application/pdf,text/plain", id: "resume-file", hidden: "" });
    const zone = h("label", "drop", null, { for: "resume-file", tabindex: 0 });
    zone.append(
      icon("M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"),
      h("b", "drop__title", matchMedia("(hover: none)").matches ? "Choose your resume" : "Drop your resume here, or click to choose it"),
      h("span", "drop__sub", "A PDF works best. We read it once and never store it.")
    );
    const error = h("p", "card__error", "", { role: "alert" });
    const paste = h("textarea", "paste", null, { rows: 7, placeholder: "Or paste your resume text here", "aria-label": "Resume text" });
    const pasteWrap = h("div", "paste-wrap", null, { hidden: "" });
    pasteWrap.append(paste, row(button("Use this text", () => take(paste.value), { solid: true })));

    const take = async (text) => {
      error.textContent = "";
      const clean = String(text || "").replace(/\s+\n/g, "\n").trim();
      if (clean.length < 200) {
        error.textContent = "We couldn't find enough text in that file. Try the PDF version, or paste the text instead.";
        return;
      }
      resumeText = clean;
      store.resumeOffered = true;
      count("check.resume");
      startRead();
      finish();
    };
    const fromFile = async (file) => {
      if (!file) return;
      zone.classList.add("is-busy");
      try {
        take(await fileText(file));
      } catch (problem) {
        error.textContent = problem.message || "That file didn't open. Paste the text instead.";
      } finally {
        zone.classList.remove("is-busy");
      }
    };
    input.addEventListener("change", () => fromFile(input.files[0]));
    zone.addEventListener("keydown", (event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), input.click()));
    for (const type of ["dragenter", "dragover"]) zone.addEventListener(type, (event) => (event.preventDefault(), zone.classList.add("is-over")));
    for (const type of ["dragleave", "drop"]) zone.addEventListener(type, () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", (event) => (event.preventDefault(), fromFile(event.dataTransfer.files[0])));

    const skip = () => {
      store.resumeOffered = true;
      finish(true);
    };
    return [
      insightLine(),
      h("p", "eyebrow", "Optional · makes your result sharper"),
      h("h2", "card__title", "Have your resume handy?", { tabindex: -1 }),
      h("p", "card__help", "We'll read it the way a hiring manager does in the first 7 seconds, and tell you plainly what they'd conclude and why. You can skip this."),
      row(button("Show my result", skip, { solid: true, arrow: true, focus: true })),
      zone,
      input,
      error,
      pasteWrap,
      row(
        link_("Paste the text instead", () => {
          pasteWrap.hidden = false;
          paste.focus();
        }),
        link_("Back", back)
      ),
    ];
  },

  q() {
    const question = I.questionOf(catalog, store.qid);
    const asked = I.chunkQuestions(catalog, "c0", store.state);
    const index = asked.findIndex((q) => q.id === question.id);
    const fromResume = store.state.sources[question.id] === "resume";
    const current = store.state.answers[question.id];
    const options = h("div", "options", null, { role: "group", "aria-label": question.prompt });
    question.options.forEach((option, n) => {
      const picked = current === option.value;
      const choice = h("button", `option${picked ? " is-picked" : ""}`, null, { type: "button", "aria-pressed": String(picked) });
      choice.append(h("kbd", "", String(n + 1)), h("span", "", option.label));
      if (n === 0 && !picked && !current) choice.dataset.focus = "";
      if (picked) choice.dataset.focus = "";
      choice.addEventListener("click", () => {
        for (const other of options.children) other.classList.remove("is-picked");
        choice.classList.add("is-picked");
        store.state = I.answer(store.state, question.id, option.value);
        store.insight = insights.lines?.[question.id]?.[option.value] || "";
        count("check.start");
        drawMap();
        setTimeout(next, prefersReduced() ? 0 : 200);
      });
      options.append(choice);
    });
    const opening = index === 0 && !Object.keys(store.state.answers).length;
    const adLine = opening ? Share.sourceLine(store.from, sources) : "";
    const filter = opening ? Share.filterLine(store.from, sources) : "";
    return [
      opening ? h("p", "eyebrow eyebrow--open", `${checkName()} · 2 minutes`) : null,
      adLine ? h("p", `card__lede${filter ? " card__lede--filtered" : ""}`, adLine) : null,
      filter ? h("p", "card__filter", filter) : null,
      opening ? null : insightLine(),
      progress(index + 1, asked.length),
      fromResume ? h("p", "tag tag--resume", "We filled this in from your resume. Is it right?") : null,
      h("h2", "card__title card__title--q", question.prompt, { tabindex: -1 }),
      question.help ? h("p", "card__help", question.help) : null,
      options,
      row(
        index > 0 ? link_("Back", back) : null,
        fromResume && current ? button("That's right", () => {
          store.state = I.answer(store.state, question.id, current);
          next();
        }, { solid: true, arrow: true }) : null,
        link_("Skip", () => {
          store.state = I.skip(store.state, question.id);
          drawMap();
          next();
        })
      ),
      readChip(),
    ].filter(Boolean);
  },

  // The read, made visible (Rory's review: hidden effort is wasted effort). These are the six
  // things the read really scores (rubric.json). It scores them in one pass, so the lines fill in
  // evenly over the usual read time and the last one waits for the real answer; nothing is delayed.
  wait() {
    const list = h("ul", "reading");
    const items = READING.map((line) => {
      const item = h("li", "", line);
      list.append(item);
      return item;
    });
    const paint = () => {
      if (!list.isConnected) return clearInterval(timer);
      const share = Math.min(1, (Date.now() - (store.readStartedAt || Date.now())) / READ_TYPICAL_MS);
      const done = Math.min(items.length - 1, Math.floor(share * items.length));
      items.forEach((item, n) => {
        item.classList.toggle("is-done", n < done);
        item.classList.toggle("is-now", n === done);
      });
    };
    const timer = setInterval(paint, 300);
    requestAnimationFrame(paint);
    return [
      h("p", "eyebrow", "Reading your resume"),
      h("h2", "card__title", "Reading it the way a hiring manager would.", { tabindex: -1 }),
      list,
      row(link_("Show my result now", () => finish(true))),
    ];
  },

  follow() {
    const fields = store.read.followups.map((item, n) => {
      const area = h("textarea", "paste paste--short", null, { rows: 3, "aria-label": item.prompt, ...(n === 0 ? { "data-focus": "" } : {}) });
      area.value = store.followups[n]?.answer || "";
      const wrap = h("label", "follow");
      wrap.append(h("span", "follow__q", item.prompt), area);
      return { wrap, area, prompt: item.prompt };
    });
    const save = () => {
      store.followups = fields.map(({ area, prompt }) => ({ prompt, answer: area.value.trim() })).filter((item) => item.answer);
      show("result");
      drawMap();
    };
    return [
      h("p", "eyebrow", "From your resume"),
      h("h2", "card__title", fields.length > 1 ? "Two questions your resume didn't answer" : "One question your resume didn't answer", { tabindex: -1 }),
      ...fields.map((field) => field.wrap),
      row(button("Show my result", save, { solid: true, arrow: true }), link_("Skip", () => show("result"))),
    ];
  },

  result() {
    // The result in steps, one card at a time beside the map, like the questions (Aden: "where do
    // I look?"): the one thing in your way, keep the map free (the map walks them through it), then
    // a choice of what would help most, ordered by their answers. store.rstep says which card is showing.
    const hits = I.bottlenecks(catalog, store.state, store.read).slice(0, 3);
    if (!hits.length) {
      return [
        h("p", "eyebrow", "Your scan"),
        h("h2", "card__title", "We need a little more to go on", { tabindex: -1 }),
        h("p", "card__lead", "You skipped most of the questions, so nothing stands out yet. Answer a couple more and your map will fill in."),
        row(button("Answer more", () => restart(), { solid: true })),
      ];
    }
    const step = RESULT_STEPS[store.rstep] ? store.rstep : "finding"; // an old "today" falls back here
    return RESULT_STEPS[step](hits);
  },
};

/* ---------- the result, one step at a time ---------- */

function goStep(step) {
  store.rstep = step;
  persist();
  show("result");
}

const stepLabel = (n) => h("p", "eyebrow", `Your scan · ${n} of 2`);
const backTo = (step, label = "Back") => link_(label, () => goStep(step));

/** A finding; pointing at it lights its ring on the map. */
function findingCard(hit, n) {
  const item = h("article", `finding${n === 0 ? " finding--first finding--hero" : ""}`, null, { tabindex: 0 });
  item.append(
    ...[
      n ? h("div", "finding__head", null, {}, [h("span", "finding__n", String(n + 1)), h("span", "chip", "Also likely")]) : null,
      h("h3", "finding__title", hit.title),
      h("ul", "finding__why", null, {}, hit.evidence.map((line) => h("li", "", line))),
    ].filter(Boolean)
  );
  const light = () => map.hot(`b.${hit.id}`);
  item.addEventListener("mouseenter", light);
  item.addEventListener("focus", light);
  item.addEventListener("mouseleave", () => map.hot(null));
  item.addEventListener("blur", () => map.hot(null));
  return item;
}

/** A big choice, styled like a question's options. */
function choice(title, sub, onClick) {
  const node = h("button", "option option--choice", null, { type: "button" });
  node.append(h("span", "", null, {}, [h("b", "", title), sub ? h("small", "", sub) : null]));
  node.addEventListener("click", onClick);
  return node;
}


/**
 * "Open my map, free": the map is the free plan, and its first step walks them through fixing
 * this. On a walkthrough (?demo=1) it opens the made-up free map; otherwise keeping the map with
 * an email is what makes their free account, so it goes there first.
 */
const DEMO_FREE_MAP = "../app/?s=demo&map=free";

const RESULT_STEPS = {
  finding(hits) {
    const open = () => {
      if (DEMO) return void (location.href = DEMO_FREE_MAP);
      goStep("keep");
    };
    return [
      stepLabel(1),
      h("h2", "card__title", "The most likely thing in your way", { tabindex: -1 }),
      h("div", "findings findings--one", null, {}, [findingCard(hits[0], 0)]),
      h("p", "card__help card__help--map", "Your map walks you through fixing this, step by step."),
      row(button("Open my map, free", open, { solid: true, arrow: true, focus: true })),
      h("p", "card__fine card__fine--honest", "Our best guess from what you told us. Your map tests it and drops it if it doesn't hold up."),
    ];
  },

  keep() {
    return [
      stepLabel(2),
      h("div", "keep-main", null, {}, [saveForm()]),
      row(link_(store.saved ? "Continue" : "Not now, continue", () => goStep("next")), backTo("finding")),
    ];
  },

  // No paid choice here: nobody is asked to pay before they've opened their own map (Aden).
  // The full plan is offered from inside the free board ("Have us do this", ?step=offer).
  next(hits) {
    const free = [
      hits.length > 1 ? choice(`See the other likely ${hits.length === 2 ? "blocker" : "blockers"}`, "What else is probably slowing you down.", () => goStep("others")) : null,
      store.read?.verdict ? choice("How a hiring manager reads your resume", "Six things they check in the first seconds, scored.", () => goStep("resume")) : null,
      choice("See what the rest of your map covers", "The parts that open with a few more questions.", () => goStep("rest")),
      choice("Share your scan with a friend", "A picture of your scan and a link to take theirs.", () => goStep("share")),
    ];
    return [
      h("p", "eyebrow", "Your scan"),
      h("h2", "card__title", "What would help most now?", { tabindex: -1 }),
      store.saved?.id ? openMapRow() : null,
      h("div", "options options--choices", null, {}, free.filter(Boolean)),
      row(backTo("keep"), link_("Start over", () => restart(true))),
    ].filter(Boolean);
  },

  offer(hits) {
    // The real offer goes on to checkout/, which picks how to pay (once or the trial) and holds the Stripe links.
    const checkout = DEMO ? DEMO_CHECKOUT : "../checkout/?plan=complete&from=offer";
    // Reached from their board ("Have us do this"): back goes to the map they came from.
    const fromBoard = /\/app\//.test(document.referrer);
    return [offerBlock(hits, checkout), row(fromBoard ? link_("Back to my map", () => history.back()) : backTo("next"))];
  },

  others(hits) {
    return [
      h("p", "eyebrow", "Your scan"),
      h("h2", "card__title", "Also likely in your way", { tabindex: -1 }),
      h("div", "findings findings--one", null, {}, hits.slice(1).map((hit, n) => findingCard(hit, n + 1))),
      row(backTo("next")),
    ];
  },

  resume() {
    return [verdictPanel(store.read.verdict), row(backTo("next"))];
  },

  rest() {
    const { nodes } = I.diagnosisMap(catalog, store.state, store.read);
    const list = h("ul", "locked");
    for (const node of nodes.filter((n) => n.state === "locked")) {
      list.append(h("li", "", null, {}, [lockIcon(), h("span", "", node.title), h("span", "locked__min", `${node.questions} questions · ~${node.minutes} min`)]));
    }
    return [
      h("p", "eyebrow", "Your map"),
      h("h2", "card__title", "What the rest of your map covers", { tabindex: -1 }),
      h("p", "card__help", "Each part opens with a few more questions, and fills in as results come back."),
      list,
      row(backTo("next")),
    ];
  },

  share() {
    return [h("p", "eyebrow", "Your scan"), h("h2", "card__title", "Share your scan", { tabindex: -1 }), sharePanel(), row(backTo("next"))];
  },
};

/* ---------- moving through the chunk ---------- */

function next() {
  const question = I.nextQuestion(catalog, "c0", store.state) ?? null;
  // Prefilled answers still get shown once, as "Is this right?"
  const asked = I.chunkQuestions(catalog, "c0", store.state);
  const unconfirmed = asked.find((q) => store.state.sources[q.id] === "resume");
  const target = unconfirmed && (!question || asked.indexOf(unconfirmed) < asked.indexOf(question)) ? unconfirmed : question;
  if (target) return show("q", target.id);
  if (!store.resumeOffered && store.readStatus === "idle") return show("resume");
  finish();
}

function back() {
  const asked = I.chunkQuestions(catalog, "c0", store.state);
  if (store.view === "resume") return show("q", asked.at(-1).id);
  const index = asked.findIndex((q) => q.id === store.qid);
  if (index > 0) show("q", asked[index - 1].id);
}

let waiting = null;
function finish(now = false) {
  if (store.readStatus === "reading" && !now) {
    show("wait");
    clearTimeout(waiting);
    waiting = setTimeout(() => finish(true), READ_WAIT_MS);
    return;
  }
  clearTimeout(waiting);
  drawMap();
  if (store.read?.followups?.length && !store.followups.length) return show("follow");
  store.rstep = "finding";
  show("result");
  count("check.done");
  live.textContent = "Your result is ready.";
}

function restart(clear = false) {
  if (clear) {
    store = fresh();
    resumeText = "";
    history.replaceState(null, "", location.pathname);
    drawMap();
    return next();
  }
  store.state = { ...store.state, skipped: [] };
  next();
}

/* ---------- the resume read ---------- */

async function startRead() {
  store.readStatus = "reading";
  store.readStartedAt = Date.now();
  render_readChip();
  try {
    const res = await fetch(`${API}/check/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume: resumeText, role: store.state.answers.role, level: store.state.answers.level }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "read failed");
    store.read = body.read;
    store.state = I.applyPrefill(catalog, store.state, body.read.prefill);
    store.readStatus = "done";
  } catch {
    store.readStatus = "failed";
  }
  persist();
  drawMap();
  if (store.view === "wait") return finish(true);
  if (store.view === "q") {
    // A prefill that lands on the question on screen shows as "Is this right?"
    if (store.state.sources[store.qid] === "resume") return show("q", store.qid);
  }
  render_readChip();
}

function readChip() {
  const filled = Object.values(store.state.sources).filter((source) => source === "resume").length;
  const text = {
    reading: "Reading your resume…",
    done: filled ? `We read your resume and filled in ${filled} ${filled === 1 ? "answer" : "answers"} from it.` : "We've read your resume.",
    failed: "We couldn't read your resume, but your answers still work.",
  }[store.readStatus];
  return text ? h("p", `read-chip read-chip--${store.readStatus}`, text, { "aria-live": "polite" }) : null;
}

function render_readChip() {
  const old = cardEl.querySelector(".read-chip");
  const chip = readChip();
  if (old && chip) old.replaceWith(chip);
  else if (chip && store.view === "q") cardEl.append(chip);
}

async function fileText(file) {
  const name = file.name.toLowerCase();
  if (file.size > 8 * 1024 * 1024) throw new Error("That file is over 8 MB. Try exporting your resume as a PDF.");
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return file.text();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import(PDF_JS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, 6); n += 1) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join(""));
    }
    return pages.join("\n");
  }
  if (name.endsWith(".docx")) throw new Error("Word files don't open here yet. Save it as a PDF, or paste the text instead.");
  throw new Error("That type of file doesn't open here. Use a PDF, or paste the text instead.");
}

/* ---------- saving ---------- */

/**
 * The resume verdict: what a hiring manager concludes in 7 seconds, scored on
 * a fixed rubric (data/intake/rubric.json), each score with the line behind it.
 * Honest without being cruel; the peer comparison appears only from 30 resumes.
 */
function verdictPanel(verdict) {
  const panel = h("section", "verdict");
  const list = h("ul", "verdict__scores");
  for (const dim of rubric.dimensions) {
    const item = verdict.scores?.[dim.id];
    if (!item) continue;
    const bar = h("span", "verdict__bar", null, { "aria-hidden": "true" });
    for (let n = 1; n <= 5; n += 1) bar.append(h("i", n <= item.score ? "on" : ""));
    list.append(
      h("li", `verdict__row verdict__row--${item.score <= 2 ? "low" : item.score >= 4 ? "high" : "mid"}`, null, {}, [
        h("span", "verdict__label", dim.label),
        bar,
        h("span", "verdict__score", `${item.score}/5`, { "aria-label": `${dim.label}: ${item.score} out of 5` }),
        h("p", "verdict__why", item.why),
      ])
    );
  }
  const peersLine = h("p", "verdict__peers", "Comparing with other resumes for this role…");
  panel.append(
    h("h3", "card__sub", "Your resume, read the way a hiring manager reads it"),
    h("p", "verdict__line", verdict.line),
    list,
    h("div", "verdict__pair", null, {}, [
      verdict.strongest ? h("p", "", null, {}, [h("b", "", "Strongest: "), verdict.strongest]) : null,
      verdict.fixFirst ? h("p", "", null, {}, [h("b", "", "Fix first: "), verdict.fixFirst]) : null,
    ]),
    peersLine,
    h("p", "card__fine", "Scored by AI against a fixed rubric. Every score names the line behind it, so you can check it yourself.")
  );
  const role = store.state.answers.role;
  const roleWord = I.questionOf(catalog, "role")?.options.find((o) => o.value === role)?.label.toLowerCase() || "engineering";
  if (role && role !== "unsure" && Number.isFinite(verdict.total)) {
    fetch(`${API}/check/peers?role=${encodeURIComponent(role)}&total=${verdict.total}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((peers) => {
        if (!peers) return peersLine.remove();
        peersLine.textContent = peers.percentile === null
          ? `Comparison with other ${roleWord} resumes starts at ${peers.minimum} of them; we've read ${peers.n} so far.`
          : `Scored higher than ${peers.percentile}% of the ${peers.n} ${roleWord} resumes people have shared with us.`;
      })
      .catch(() => peersLine.remove());
  } else peersLine.remove();
  return panel;
}

/** Saves the answers as a check; the account email is attached so the map lives in their account. */
async function saveCheck(email, { notify = false, trap = "" } = {}) {
  const res = await fetch(`${API}/check/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      notify,
      visitor: visitorId(),
      company: trap,
      from: store.from,
      state: { answers: store.state.answers, skipped: store.state.skipped },
      read: store.read,
      followups: store.followups,
      top: I.bottlenecks(catalog, store.state, store.read).slice(0, 3).map((hit) => ({ id: hit.id, title: hit.title })),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "We couldn't save that. Try again in a minute.");
  store.saved = { id: body.id, link: body.link, emailed: body.emailed, email };
  persist();
  const params = new URLSearchParams(location.search);
  params.set("id", body.id);
  history.replaceState(null, "", `?${params}`);
  return body;
}

/**
 * Keeping the map. Signed in: one tap. Otherwise: email (a code arrives, or a
 * link in the same email) or Google where it works. If the code email can't go
 * out, the saved link on screen is how they keep it, and we say so.
 */
function saveForm() {
  const wrap = h("section", "keep");
  const keepTitle = "Keep your map. It's free.";
  const signed = Account.session();
  const draw = (...nodes) => wrap.replaceChildren(...nodes);

  const savedView = () => {
    const done = h("div", "saved");
    const inAccount = Account.session()?.email && Account.session().email === store.saved?.email;
    const sent = store.saved.emailed;
    done.classList.toggle("saved--unsent", !inAccount && sent === false);
    done.append(
      h("p", "", inAccount
        ? `Saved to your account. Come back any time at gridschool.org/check and sign in with ${store.saved.email}.`
        : sent ? "We also emailed you a link. This one always brings you back to your map:" : "To come back later, keep this link. It always brings you back to your map:"),
      ...(inAccount ? [] : [h("a", "saved__link", store.saved.link, { href: store.saved.link })])
    );
    // Saved: their map is a free board of their own, and this opens it, with or without a sign-in
    // (the check's own id opens the seat made from it: server free_seat.check_seat_session).
    draw(...[openMapRow(), done, communityBlock()].filter(Boolean));
    prepareShare();
  };

  const codeView = (email) => {
    const form = h("form", "save", null, { novalidate: "" });
    const code = h("input", "code-input", null, { name: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, placeholder: "6-digit code", "aria-label": "6-digit code", "data-focus": "" });
    const error = h("p", "card__error", "", { role: "alert" });
    const confirm = button("Confirm", null, { solid: true, type: "submit" });
    form.append(
      h("h3", "card__sub card__sub--keep", "Check your email"),
      h("p", "card__help", `We sent a 6-digit code to ${email}. Enter it to keep your map in your account. The email also has a link if you'd rather tap.`),
      h("div", "save__row", null, {}, [code, confirm]),
      error,
      ...(store.saved?.id ? [row(link_("Open my map now", () => savedView()))] : []),
      row(
        link_("Send a new code", async () => {
          error.textContent = "";
          try {
            const { sent } = await Account.sendCode(API, email);
            error.textContent = sent ? "A new code is on its way." : "We couldn't send a code just now.";
          } catch (problem) {
            error.textContent = say(problem);
          }
        }),
        link_("Use a different email", () => draw(...emailView()))
      )
    );
    code.addEventListener("input", () => {
      code.value = code.value.replace(/\D/g, "").slice(0, 6);
      if (code.value.length === 6) form.requestSubmit();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      if (!/^\d{6}$/.test(code.value)) return (error.textContent = "Enter the 6-digit code from the email.");
      confirm.disabled = true;
      try {
        await Account.verifyCode(API, email, code.value, store.from);
        showAccount();
        savedView();
        live.textContent = "Signed in. Your map is saved to your account.";
      } catch (problem) {
        error.textContent = say(problem);
        confirm.disabled = false;
      }
    });
    draw(form);
    code.focus({ preventScroll: true });
  };

  const emailView = () => {
    const form = h("form", "save", null, { novalidate: "" });
    const email = h("input", "", null, { name: "email", type: "email", autocomplete: "email", placeholder: "Email", "aria-label": "Email", required: "" });
    const trap = h("input", "trap", null, { name: "company", tabindex: -1, autocomplete: "off", "aria-hidden": "true" });
    const error = h("p", "card__error", "", { role: "alert" });
    const submit = button("Keep my map", null, { solid: true, type: "submit" });
    const googleSlot = h("div", "google-slot");
    form.append(
      h("h3", "card__sub card__sub--keep", keepTitle),
      h("p", "card__help", "Save your findings and your map so you can come back to them. No card, no password: we email you a code."),
      h("div", "save__row", null, {}, [email, submit]),
      trap,
      error,
      googleSlot,
      h("p", "card__fine", "We only use your answers to build your map, and we never sell or share them.")
    );
    Account.mountGoogle(googleSlot, async (credential) => {
      error.textContent = "";
      try {
        const account = await Account.google(API, credential, store.from);
        await saveCheck(account.email);
        showAccount();
        savedView();
      } catch (problem) {
        error.textContent = say(problem);
      }
    }).then((shown) => shown && googleSlot.prepend(h("span", "or", "or")));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const value = email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(value)) return (error.textContent = "That email doesn't look right.");
      submit.disabled = true;
      submit.textContent = "Saving…";
      try {
        await saveCheck(value, { trap: trap.value });
        const { sent } = await Account.sendCode(API, value);
        if (sent) return codeView(value);
        store.saved.emailed = false; // the code couldn't go out: the link on screen is how they keep it
        persist();
        savedView();
      } catch (problem) {
        error.textContent = say(problem);
        submit.disabled = false;
        submit.textContent = "Keep my map";
      }
    });
    return [form];
  };

  if (store.saved) savedView();
  else if (signed) {
    const keep = button(`Save to your account (${signed.email})`, async () => {
      keep.disabled = true;
      try {
        await saveCheck(signed.email);
        savedView();
      } catch (problem) {
        keep.disabled = false;
        wrap.append(h("p", "card__error", say(problem), { role: "alert" }));
      }
    }, { solid: true });
    draw(h("h3", "card__sub card__sub--keep", keepTitle), row(keep));
  } else draw(...emailView());
  return wrap;
}

/**
 * "Open my map": their free board (POST /account/free-seat, server: free_seat.py), by their
 * sign-in when they have one, otherwise by this saved check's own id.
 * The first time, it makes the free seat from this check; after that it opens the same one. A paid
 * seat opens as itself. Localhost carries ?api= to the board, so it never talks to production.
 */
function openMapRow() {
  const error = h("p", "card__error", "", { role: "alert" });
  const open = button("Open my map", async () => {
    error.textContent = "";
    open.disabled = true;
    try {
      const token = Account.session()?.token;
      const res = await fetch(`${API}/account/free-seat`, {
        method: "POST",
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
        body: JSON.stringify({ check: store.saved?.id || "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Your map didn't open. Try again in a moment.");
      const slug = await enterSeat(body);
      location.href = boardUrl(slug);
    } catch (problem) {
      open.disabled = false;
      error.textContent = say(problem);
    }
  }, { solid: true, arrow: true, focus: true });
  return h("div", "saved__open", null, {}, [h("h3", "card__sub card__sub--keep", "Your map is ready."), h("p", "card__help", "It starts with the step that walks you through fixing this. Free, and yours to keep."), row(open), error]);
}

/** The board for a seat. On this Mac the board gets the same local API the check uses. */
function boardUrl(slug) {
  const url = new URL("../app/", location.href);
  url.searchParams.set("s", slug);
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) url.searchParams.set("api", API);
  return url.toString();
}

/**
 * Off to checkout. The link carries this check's id (client_reference_id), so the
 * payment finds this exact map, and the email (prefilled_email) so they don't type
 * it twice. An unsaved check is saved first: signed in, with their account email;
 * otherwise we ask for an email right here and go straight on (no code step), since
 * the welcome page signs them in after they pay.
 */
async function goToCheckout(checkout, email = "") {
  if (DEMO) {
    // Walkthrough: nothing is saved or counted; the demo checkout carries the top finding on.
    const demo = new URL(checkout, location.href);
    const top = I.bottlenecks(catalog, store.state, store.read)[0];
    if (top) demo.searchParams.set("top", top.id);
    location.href = demo.toString();
    return;
  }
  if (!store.saved?.id) await saveCheck(email);
  // On to checkout/ with this check's id, so the payment builds (or upgrades) this exact map.
  const url = new URL(checkout, location.href);
  url.searchParams.set("ck", store.saved.id);
  // A free seat pays with its account email, so the payment finds that seat. It travels in this tab's
  // session storage, not the address, so it never sits in a URL (checkout/checkout.js reads it once).
  const payEmail = store.saved.email || Account.session()?.email || "";
  try {
    if (payEmail) sessionStorage.setItem("gridschool.checkout.email", payEmail);
  } catch {
    /* checkout still works; the buyer types their email at Stripe */
  }
  location.href = url.toString();
}

/**
 * The offer, in the order that makes the argument (Rory's review): the work we do for
 * this person's top finding, who does it, the price, the refund, then the button. Every
 * line here is something the paid map really delivers (offer.json, checked against
 * complete_map.PLANS by server/offer_test.py).
 */
function offerBlock(hits, checkout) {
  const price = offer.price;
  const photo = link("adenPhoto");
  const section = h("section", "offer", null, { "aria-labelledby": "offer-title" });
  const error = h("p", "card__error", "", { role: "alert" });
  const ask = h("form", "save offer__ask", null, { novalidate: "", hidden: "" });
  const askEmail = h("input", "", null, { type: "email", autocomplete: "email", placeholder: "Email", "aria-label": "Email", required: "" });
  let target = checkout;
  ask.append(
    h("p", "card__help", "Where should we send your map? It'll be waiting for you after you pay."),
    h("div", "save__row", null, {}, [askEmail, button("Continue to payment", null, { solid: true, type: "submit" })])
  );
  const start = async (url) => {
    error.textContent = "";
    target = url;
    const signed = Account.session();
    if (store.saved?.id || signed || DEMO) {
      try {
        return await goToCheckout(url, signed?.email || "");
      } catch (problem) {
        error.textContent = say(problem);
        return;
      }
    }
    ask.hidden = false;
    askEmail.focus();
  };
  ask.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = askEmail.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return (error.textContent = "That email doesn't look right.");
    try {
      await goToCheckout(target, value);
    } catch (problem) {
      error.textContent = say(problem);
    }
  });

  const who = h("div", "offer__who");
  who.append(
    photo ? h("img", "offer__face", null, { src: photo, alt: "Aden Jessee", width: 44, height: 44 }) : h("span", "offer__face offer__face--initials", "AJ", { "aria-hidden": "true" }),
    h("p", "", null, {}, [h("b", "", "Aden Jessee reviews your map within 24 hours."), h("span", "", " He's a working applied-AI engineer, and he approves everything before you send it.")])
  );
  const prepared = offer.prepared[hits[0].id];
  section.append(
    h("p", "eyebrow", "Optional · done for you"),
    h("h3", "offer__title", "Want us to do the first week's work?", { id: "offer-title" }),
    who,
    h("ul", "offer__list", null, {}, [
      prepared ? h("li", "", prepared) : null,
      h("li", "", "Every send and every reply is tracked on your map, so you can see what's working."),
      h("li", "", "Your map keeps adjusting as you answer more and as results come in."),
      h("li", "", "The whole course opens: every module and every film, not just the two profile steps."),
    ].filter(Boolean)),
    h("p", "offer__price", null, {}, [
      h("b", "", `$${price.full}`),
      h("span", "", ` once, for ${price.months} months, or $${price.monthly} a month after a ${price.trialDays}-day free trial`),
      h("span", "offer__refund", `${price.refundDays}-day refund on the one-time price, no questions asked`),
    ]),
    row(button("Choose how to pay", () => start(checkout), { arrow: true })),
    ask,
    error,
    h("p", "card__fine", offer.payNote),
    h("p", "card__fine", "Prices are in US dollars and include any sales tax or VAT. Checkout shows them in your own currency."),
    h("p", "card__fine", null, {}, [
      "Want me on calls with you, building your projects together? ",
      h("a", "", "See the Residency", { href: `../residency/${DEMO ? "?demo=1" : ""}` }),
      ".",
    ]),
    row(shareButton(hits))
  );
  return section;
}

/**
 * A plain summary to show someone (a partner, a friend), because the hardest part of
 * paying is often explaining it. Copied, never sent anywhere.
 */
function shareButton(hits) {
  const price = offer.price;
  const text = [
    "My GridSchool check (gridschool.org/check) says what's most likely in the way of interviews:",
    ...hits.map((hit, n) => `${n + 1}. ${hit.title}`),
    "",
    `For $${price.full} (${price.months} months, ${price.refundDays}-day refund), or $${price.monthly} a month after a ${price.trialDays}-day free trial, they do the first week's work: ${offer.prepared[hits[0].id] || ""}`.trim(),
    "A person reviews everything before I send it, and every send and reply is tracked.",
  ].join("\n");
  const copy = link_("Copy a summary to show someone", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copied. Paste it anywhere.";
    } catch {
      copy.textContent = "Couldn't copy here. Select your findings above instead.";
    }
  });
  return copy;
}

/* ---------- sharing the scan ---------- */

/**
 * The ref in a shared link: from the saved check (a hash, never its id), or a random one kept
 * in this browser until they save. Someone who arrives by it starts with from=share:<ref>,
 * which saves with their check, so a share is counted all the way to a saved map.
 */
let memoryRef = "";
async function shareRef() {
  if (store.saved?.id) {
    const ref = await Share.refFromCheck(store.saved.id).catch(() => "");
    if (ref) return ref;
  }
  try {
    let ref = localStorage.getItem(SHARE_KEY);
    if (!/^[0-9a-z]{10}$/.test(ref || "")) {
      ref = Share.randomRef();
      localStorage.setItem(SHARE_KEY, ref);
    }
    return ref;
  } catch {
    memoryRef ||= Share.randomRef();
    return memoryRef;
  }
}

// The card and link are made ahead of the tap: a phone's share sheet only opens straight from a tap.
let shareReady = null;
let shareFor = null;
function prepareShare() {
  const hits = I.bottlenecks(catalog, store.state, store.read);
  if (!hits.length) return null;
  const key = `${store.saved?.id || ""}|${hits[0].id}`;
  if (shareReady && shareFor === key) return shareReady;
  shareFor = key;
  const { nodes } = I.diagnosisMap(catalog, store.state, store.read);
  shareReady = (async () => {
    const url = Share.shareUrl(await shareRef());
    const canvas = await drawShareCard({ title: hits[0].title, nodes, label: variant === "scan" ? "My hiring scan" : "My free check" });
    const blob = await cardBlob(canvas);
    const file = blob && typeof File === "function" ? new File([blob], "gridschool-scan.png", { type: "image/png" }) : null;
    return { url, canvas, blob, file };
  })().catch(() => {
    shareReady = null;
    return null;
  });
  return shareReady;
}

/**
 * "Share your scan": a picture of their #1 likely blocker and their map's shape, and a link that
 * starts someone else's. Phones get the share sheet with the picture; everywhere else, or if the
 * sheet can't take a file, the picture shows here with Copy link and Download image.
 */
function sharePanel() {
  const panel = h("section", "share", null, { "aria-label": "Share your scan" });
  const preview = h("div", "share__preview", null, { hidden: "" });
  const status = h("p", "share__status", "", { "aria-live": "polite" });
  const open = button("Share your scan", null, { small: true });
  const counted = (via) => count("check.share", { view: via });

  const showPreview = async () => {
    const ready = await prepareShare();
    if (!ready) return;
    const img = h("img", "share__img", null, { src: ready.canvas.toDataURL("image/png"), alt: "Your scan as a picture: your #1 likely blocker, your map, and gridschool.org/check", width: 1200, height: 630 });
    const copy = button("Copy link", async () => {
      // Saving after the card showed changes the ref to the saved check's, so ask again.
      const { url } = (await prepareShare()) || ready;
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = "Link copied.";
        counted("copy");
      } catch {
        status.textContent = url;
      }
    }, { small: true });
    const download = h("a", "btn btn--line btn--small", "Download image", { href: ready.blob ? URL.createObjectURL(ready.blob) : img.src, download: "gridschool-scan.png" });
    download.addEventListener("click", () => counted("download"));
    preview.replaceChildren(img, h("div", "card__row share__actions", null, {}, [copy, download]));
    preview.hidden = false;
  };

  open.addEventListener("click", async () => {
    status.textContent = "";
    const ready = await prepareShare();
    if (!ready) return;
    const data = { title: "My hiring scan", text: "This is what my scan says is most likely in my way. Take yours: two minutes, free.", url: ready.url };
    const canFile = ready.file && navigator.canShare?.({ ...data, files: [ready.file] });
    if (canFile && matchMedia("(hover: none)").matches) {
      try {
        await navigator.share({ ...data, files: [ready.file] });
        counted("native");
        return;
      } catch (problem) {
        if (problem?.name === "AbortError") return; // they closed the sheet
      }
    }
    await showPreview();
  });
  panel.append(
    h("div", "share__head", null, {}, [
      h("p", "share__text", "Send a friend in the same search a picture of your scan and a link to take theirs. It shows your #1 likely blocker and your map, never your name, email or resume."),
      open,
    ]),
    status,
    preview
  );
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 400)))(() => prepareShare());
  return panel;
}

/**
 * The community, only for people who just kept their map with an email: that step is the
 * proof they mean it. Hidden while the invite link is still a placeholder.
 */
function communityBlock() {
  const invite = link("community"); // public door; the invite itself stays on the server (config.js)
  if (!invite || !store.saved || !(store.saved.email || Account.session())) return null;
  const join = h("a", "btn btn--line btn--small", "Join the community", { href: invite, target: "_blank", rel: "noopener" });
  join.addEventListener("click", () => count("community.join_click"));
  return h("div", "community", null, {}, [
    h("p", "", "Join the community: fresh roles every morning, weekly send day, and people at the same stage as you."),
    join,
  ]);
}

/** The nav says who is signed in, with a way out. */
function showAccount() {
  const slot = $("#nav-account");
  if (!slot) return;
  const signed = Account.session();
  if (!signed) return slot.replaceChildren();
  const out = h("button", "textlink textlink--nav", "Sign out", { type: "button" });
  out.addEventListener("click", async () => {
    await Account.signOut(API);
    showAccount();
  });
  slot.replaceChildren(h("span", "nav-account__who", signed.email), out);
}

async function reopen(id) {
  try {
    const res = await fetch(`${API}/check/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error();
    const { check } = await res.json();
    store = { ...fresh(), state: { ...I.emptyState(), ...check.state }, read: check.read, followups: check.followups, readStatus: "done", saved: { id: check.id, link: location.href } };
    return true;
  } catch {
    return false;
  }
}

/* ---------- small builders ---------- */

function h(tag, className, text, attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) if (child) node.append(child);
  return node;
}

function row(...children) {
  return h("div", "card__row", null, {}, children);
}

function button(label, onClick, { solid = false, focus = false, arrow = false, small = false, type = "button" } = {}) {
  const node = h("button", `btn${solid ? " btn--solid" : " btn--line"}${small ? " btn--small" : ""}`, null, { type });
  node.append(label);
  if (arrow) node.append(h("span", "arr", "→", { "aria-hidden": "true" }));
  if (focus) node.dataset.focus = "";
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

function link_(label, onClick) {
  const node = h("button", "textlink", label, { type: "button" });
  node.addEventListener("click", onClick);
  return node;
}

function progress(n, total) {
  const wrap = h("div", "progress", null, { "aria-label": `Question ${n} of ${total}` });
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(ns, "circle");
  const fill = document.createElementNS(ns, "circle");
  for (const c of [track, fill]) {
    c.setAttribute("cx", "18");
    c.setAttribute("cy", "18");
    c.setAttribute("r", "15");
  }
  track.setAttribute("class", "progress__track");
  fill.setAttribute("class", "progress__fill");
  const length = 2 * Math.PI * 15;
  fill.style.strokeDasharray = `${length}`;
  fill.style.strokeDashoffset = `${length * (1 - (n - 1) / total)}`;
  requestAnimationFrame(() => (fill.style.strokeDashoffset = `${length * (1 - n / total)}`));
  svg.append(track, fill);
  wrap.append(svg, h("span", "", `${n} of ${total}`));
  return wrap;
}

function icon(d) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "drop__icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

const lockIcon = () => icon("M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z");
const prefersReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- keys: 1 to 6 pick an option ---------- */

addEventListener("keydown", (event) => {
  if (store.view !== "q" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? "")) return;
  const n = Number(event.key);
  const options = cardEl.querySelectorAll(".option");
  if (n >= 1 && n <= options.length) options[n - 1].click();
});

/* ---------- start ---------- */

/** One funnel step, tagged with where they came from (server: events.py). */
function count(name, props = {}) {
  if (DEMO) return; // walkthroughs never count as real traffic
  track(API, name, { source: store.from, check: store.saved?.id || "", props: { variant, ...props } });
}

/** Anything answered in this browser that a returning sign-in shouldn't replace. */
function localStorageHasProgress() {
  try {
    return Object.keys(JSON.parse(localStorage.getItem(KEY) || "null")?.state?.answers ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Where they came from (?from=vsl, a shared link's share:<ref>, or an ad's utm tags), saved with the lead so each source can be measured. */
const arrivedFrom = () => Share.arrivedFrom(location.search);

async function boot() {
  catalog = await (await fetch("../data/intake/questions.json")).json();
  rubric = await fetch("../data/intake/rubric.json").then((res) => res.json()).catch(() => rubric);
  [insights, sources, offer] = await Promise.all([
    fetch("../data/intake/insights.json").then((res) => res.json()).catch(() => insights),
    fetch("../data/intake/sources.json").then((res) => res.json()).catch(() => sources),
    fetch("../data/intake/offer.json").then((res) => res.json()).catch(() => null),
  ]);
  const navName = document.querySelector(".nav-right .eyebrow");
  if (navName) navName.textContent = checkName();
  map = mountCheckMap({ svg: $("#map-svg"), box: $("#map"), card: $("#map-card") });
  const params = new URLSearchParams(location.search);
  // The link in the sign-in email: sign in, then open their newest map.
  const signinLink = params.get("signin");
  if (signinLink) {
    params.delete("signin");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    await Account.verifyLink(API, signinLink, store.from).catch(() => null);
  }
  showAccount();
  let id = params.get("id");
  if (!id && Account.session()) {
    const mine = await Account.me(API);
    const fresh = !Object.keys(store.state.answers).length && !localStorageHasProgress();
    if (mine?.checks?.length && (signinLink || fresh)) id = mine.checks[0].id;
    showAccount();
  }
  if (id && (await reopen(id))) {
    // From a free board's "Have us do this" (?step=offer): straight to the offer on their own check.
    const asked = params.get("step");
    if (asked === "offer") store.rstep = offer ? "offer" : "next"; // without Stripe yet, the offer says how to start
    show("result");
    booted = true;
    return drawMap({ first: true });
  }
  restore();
  store.from = store.from || arrivedFrom();
  if (store.view in VIEWS && store.view !== "wait" && (store.view !== "q" || store.qid)) show(store.view, store.qid);
  else next();
  booted = true;
  count("check.view");
  drawMap({ first: true }); // after the view, so the map is drawn once, in the right shape, with its arrival
}

boot();
