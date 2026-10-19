/**
 * The free check: six one-tap questions in, the person's top likely
 * bottlenecks, one thing to do today, and their map out. People arrive warm
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

import { PERSIST, link } from "../config.js?v=88ea7f7-202610190752";
import * as I from "../data/intake/intake.mjs?v=88ea7f7-202610190752";
import { mountCheckMap } from "./check-map.js?v=88ea7f7-202610190752";
import * as Account from "./account.js?v=88ea7f7-202610190752";
import { track, visitorId } from "./events.js?v=88ea7f7-202610190752";

const KEY = "gridschool.check.v1";
const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const READ_WAIT_MS = 9000;

const $ = (selector) => document.querySelector(selector);
const cardEl = $("#card");
const live = $("#live");

/** Localhost may point the check at a local persist server: /check/?api=http://localhost:8768 */
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  return local && asked ? asked.replace(/\/$/, "") : PERSIST.endpoint;
})();

let catalog;
let booted = false;
let map;
let store = fresh();
let resumeText = "";

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
  if (view === "result") return scrollTo({ top: 0, behavior: "auto" });
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
      h("p", "eyebrow", "Optional · makes your result sharper"),
      h("h2", "card__title", "Have your resume handy?", { tabindex: -1 }),
      h("p", "card__help", "We'll read it for what your answers can't show, like vague bullet points or a title that doesn't match. You can skip this."),
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
        count("check.start");
        drawMap();
        setTimeout(next, prefersReduced() ? 0 : 200);
      });
      options.append(choice);
    });
    const opening = index === 0 && !Object.keys(store.state.answers).length;
    return [
      opening ? h("p", "eyebrow eyebrow--open", "Free check · 2 minutes") : null,
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

  wait() {
    return [
      h("p", "eyebrow", "Almost there"),
      h("h2", "card__title", "We're almost done reading your resume.", { tabindex: -1 }),
      h("div", "dots", null, { "aria-hidden": "true" }),
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
    const hits = I.bottlenecks(catalog, store.state, store.read).slice(0, 3);
    const { nodes } = I.diagnosisMap(catalog, store.state, store.read);
    const locked = nodes.filter((node) => node.state === "locked");
    const parts = [
      h("div", "result__head", null, {}, [
        h("p", "eyebrow", "Your check"),
        h("h2", "card__title", hits.length ? "What most likely stands between you and interviews" : "We need a little more to go on", { tabindex: -1 }),
      ]),
    ];
    if (!hits.length) {
      parts.push(h("p", "card__lead", "You skipped most of the questions, so nothing stands out yet. Answer a couple more and your map will fill in."));
      parts.push(row(button("Answer more", () => restart(), { solid: true })));
    }

    // The findings, side by side. Each carries the number drawn in its ring on the map,
    // and pointing at one lights that ring, so the cards and the map read as one thing.
    const findings = h("div", "findings");
    hits.forEach((hit, n) => {
      const item = h("article", `finding${n === 0 ? " finding--first" : ""}`, null, { tabindex: 0 });
      item.append(
        h("div", "finding__head", null, {}, [h("span", "finding__n", String(n + 1)), h("span", "chip", n === 0 ? "Likely · start here" : "Likely")]),
        h("h3", "finding__title", hit.title),
        h("ul", "finding__why", null, {}, hit.evidence.map((line) => h("li", "", line)))
      );
      const light = () => map.hot(`b.${hit.id}`);
      item.addEventListener("mouseenter", light);
      item.addEventListener("focus", light);
      item.addEventListener("mouseleave", () => map.hot(null));
      item.addEventListener("blur", () => map.hot(null));
      findings.append(item);
    });
    if (hits[0]) {
      const copy = button("Copy", async () => {
        try {
          await navigator.clipboard.writeText(hits[0].action);
          copy.textContent = "Copied";
        } catch {
          copy.textContent = "Select it to copy";
        }
      }, { small: true });
      findings.append(
        h("div", "today", null, {}, [
          h("div", "", null, {}, [h("span", "today__label", "Do this today"), h("p", "today__text", hits[0].action)]),
          copy,
        ])
      );
    }
    if (hits.length) {
      parts.push(
        findings,
        h("p", "card__fine card__fine--honest", "These are our best guesses based on what you told us. Your full map tests each one and drops any that don't hold up.")
      );
    }

    // What's next, beside keeping it: the locked areas on one side, the save on the other.
    // Keeping it comes first (the one thing we ask them to do here); the locked areas beside it say what's next.
    const foot = h("div", "result__foot");
    const keep = h("section", "");
    const checkout = link("completeCheckout");
    if (checkout) keep.append(row(h("a", "btn btn--solid", "Unlock your full map →", { href: checkout })));
    keep.append(saveForm());
    foot.append(keep);
    if (locked.length) {
      const list = h("ul", "locked");
      for (const node of locked) list.append(h("li", "", null, {}, [lockIcon(), h("span", "", node.title), h("span", "locked__min", `${node.questions} questions · ~${node.minutes} min`)]));
      foot.append(h("section", "", null, {}, [h("h3", "card__sub", `${locked.length} more parts of your map open up with a few questions each`), list]));
    }
    parts.push(foot, row(link_("Start over", () => restart(true))));
    return parts;
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
  render_readChip();
  try {
    const res = await fetch(`${API}/check/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume: resumeText, role: store.state.answers.role }),
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
  const signed = Account.session();
  const draw = (...nodes) => wrap.replaceChildren(...nodes);

  const savedView = () => {
    const done = h("div", "saved");
    const inAccount = Account.session()?.email && Account.session().email === store.saved?.email;
    const sent = store.saved.emailed;
    done.classList.toggle("saved--unsent", !inAccount && sent === false);
    done.append(
      h("b", "", inAccount ? "Saved to your account." : sent ? "Sent. Check your inbox." : "Your map is saved."),
      h("p", "", inAccount
        ? `Come back any time at gridschool.org/check and sign in with ${store.saved.email}.`
        : sent ? "You can always get back to your map at this link:" : "We couldn't send the email just now, so keep this link. It always opens your map:"),
      ...(inAccount ? [] : [h("a", "saved__link", store.saved.link, { href: store.saved.link })])
    );
    draw(done);
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
      row(
        link_("Send a new code", async () => {
          error.textContent = "";
          try {
            const { sent } = await Account.sendCode(API, email);
            error.textContent = sent ? "A new code is on its way." : "We couldn't send a code just now.";
          } catch (problem) {
            error.textContent = problem.message;
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
        error.textContent = problem.message;
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
      h("h3", "card__sub card__sub--keep", "Keep your map"),
      h("p", "card__help", "Save it to an account so you can come back to it. No password: we email you a code."),
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
        error.textContent = problem.message;
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
        error.textContent = problem.message;
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
        wrap.append(h("p", "card__error", problem.message, { role: "alert" }));
      }
    }, { solid: true });
    draw(h("h3", "card__sub card__sub--keep", "Keep your map"), row(keep));
  } else draw(...emailView());
  return wrap;
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
function count(name) {
  track(API, name, { source: store.from, check: store.saved?.id || "" });
}

/** Anything answered in this browser that a returning sign-in shouldn't replace. */
function localStorageHasProgress() {
  try {
    return Object.keys(JSON.parse(localStorage.getItem(KEY) || "null")?.state?.answers ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Where they came from (?from=vsl, or an ad's utm tags), saved with the lead so each source can be measured. */
function arrivedFrom() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("from") || [params.get("utm_source"), params.get("utm_campaign")].filter(Boolean).join(":");
  return raw.replace(/[^\w:.-]/g, "").slice(0, 60);
}

async function boot() {
  catalog = await (await fetch("../data/intake/questions.json")).json();
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
