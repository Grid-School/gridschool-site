/**
 * The Loom, as two campaign nodes (campaign-steps.js):
 *
 *   Script  one question on the screen at a time, each with a sentence to
 *           finish and a made-up example. A check marks each part as it's
 *           finished; the last screen joins the answers into the full script.
 *   Record  that script, a practice room on this page (camera, the script in
 *           large type near the lens, a timer; takes are never uploaded and
 *           vanish on close), Loom in a new tab, then the share link, which
 *           goes into the email.
 *
 * The student writes and records every Loom themselves. A face and a voice
 * pointing at real work is the costly signal; a generated one would spend it.
 */

import { el } from "../dom.js?v=8b71053-202610102102";
import { btn } from "../ui.js?v=8b71053-202610102102";
import { BEATS, composeBeats, tidyAnswers, scriptSeconds, blanksLeft, voiceFlags } from "../loom-script.js?v=8b71053-202610102102";
import { SLIDES, partDone, scriptDone } from "../campaign-steps.js?v=8b71053-202610102102";

/** Seconds a Loom should land in. */
export const PACE = { min: 45, low: 60, high: 90, max: 105 };

/** [Loom link], [portfolio link], [your number]: blanks for the email, not things to show. */
const PLACEHOLDER = /\blink\b|^your\b|\bnumber\b|^N$/i;

/** "[open the repo] I built this" → { spoken: "I built this", stage: ["open the repo"] } */
export function splitBeat(say) {
  const text = String(say ?? "");
  const stage = [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter((cue) => cue && !PLACEHOLDER.test(cue));
  const spoken = text.replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  return { spoken, stage };
}

/** A plain line on a take's length. No grades: long and short both have an easy fix. */
export function paceNote(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s < PACE.min) return `${clock(s)}. Short is fine; if it felt rushed, slow down on the proof.`;
  if (s < PACE.low) return `${clock(s)}. A touch short, which managers like. Send it.`;
  if (s <= PACE.high) return `${clock(s)}. Right in the window.`;
  if (s <= PACE.max) return `${clock(s)}. A little long. Cut one sentence from the second beat.`;
  return `${clock(s)}. Long. Say the problem in one sentence and let the screen do the proof.`;
}

/** How the count of rehearsed takes reads back to them. */
export function takesLine(n) {
  const takes = Math.max(0, Math.floor(Number(n) || 0));
  if (!takes) return "Take one is a warm-up. Nobody sees it.";
  if (takes === 1) return "One take rehearsed. Most people send their second or third.";
  if (takes < 4) return `${takes} takes rehearsed. You're ready once you look at the lens more than the words.`;
  return `${takes} takes rehearsed. That's plenty; the next one goes on Loom.`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What they've typed per target, kept across redraws of the drawer. */
const drafts = new Map();
/** Which question each target's script is on, and parts already celebrated. */
const places = new Map();

/** What they saved, and the starter sentence in every blank they haven't touched yet. */
export function startingAnswers(saved) {
  const answers = {};
  for (const beat of BEATS) for (const b of beat.blanks) answers[b.id] = saved?.[b.id] ?? b.starter ?? "";
  return answers;
}

function answersFor(target, readOnly) {
  if (readOnly) return startingAnswers(target.loomScript);
  if (!drafts.has(target.id)) drafts.set(target.id, startingAnswers(target.loomScript));
  return drafts.get(target.id);
}

/** The script the prompter and Copy use: their saved words, else the research draft. */
export function scriptBeats(target, campaign) {
  const own = composeBeats(drafts.get(target.id) ?? target.loomScript);
  return own.length ? own : campaign?.loom ?? [];
}

/** The whole script, read top to bottom, the way the practice room shows it. */
function scriptList(beats) {
  return el(
    "ol.lkit__lines",
    {},
    beats.map((b) => {
      const { spoken, stage } = splitBeat(b.say);
      return el("li", {}, el("span.camp__t", {}, b.t), el("div", {}, stage.length ? el("span.lkit__stage", {}, `On screen: ${stage.join("; ")}`) : null, el("p", {}, spoken)));
    })
  );
}

const check = () => el("span.lkit__check", { "aria-hidden": "true" }, "✓");

/**
 * The Script node. One question per screen; Back and Next move between them.
 * Finishing a part saves the script and marks the part with a check. The
 * last screen shows the full script and sends them on to Record.
 */
export function scriptWizard({ target, campaign, readOnly, onSaveScript, onFinish }) {
  const answers = answersFor(target, readOnly);
  if (!places.has(target.id)) places.set(target.id, { i: scriptDone(target.loomScript) ? SLIDES.length : 0, cheered: new Set(BEATS.map((_, p) => p).filter((p) => partDone(target.loomScript, p))), cheer: null, focusUntil: 0 });
  const place = places.get(target.id);
  const save = () => onSaveScript(tidyAnswers(answers));
  const root = el("div.wiz");

  function go(i) {
    const leaving = SLIDES[place.i];
    place.i = Math.max(0, Math.min(SLIDES.length, i));
    // Leaving the last question of a part: if the part is finished, save and celebrate it once.
    let cheer = null;
    if (leaving && i > SLIDES.indexOf(leaving) && SLIDES[place.i]?.part !== leaving.part && partDone(answers, leaving.part) && !place.cheered.has(leaving.part)) {
      place.cheered.add(leaving.part);
      cheer = leaving.part;
    }
    // A save redraws the whole drawer, so the cheer and the cursor are kept on the place, briefly.
    place.cheer = cheer === null ? null : { part: cheer, until: Date.now() + 3500 };
    place.focusUntil = Date.now() + 1500;
    if (leaving && i > SLIDES.indexOf(leaving) && SLIDES[place.i]?.part !== leaving.part && !readOnly) save();
    paint();
  }

  function parts(cheer) {
    return el(
      "ol.wiz__parts",
      {},
      BEATS.map((beat, p) => {
        const done = partDone(answers, p);
        const here = SLIDES[place.i]?.part === p;
        return el(
          "li",
          { class: [done ? "is-done" : "", here ? "is-here" : "", cheer === p ? "is-cheer" : ""].join(" ").trim() || null },
          el("span.wiz__dot", {}, done ? "✓" : "ABCDE"[p]),
          el("span.wiz__pname", {}, beat.name)
        );
      })
    );
  }

  function slide(cheer) {
    const q = SLIDES[place.i];
    const n = place.i + 1;
    const box = el("textarea.wiz__answer", {
      rows: q.stage ? 3 : 5,
      placeholder: q.stage ? "What's on your screen" : null,
      disabled: readOnly || null,
      oninput: () => {
        answers[q.id] = box.value;
        paintFlags();
      },
      onkeydown: (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          go(place.i + 1);
        }
      },
    });
    box.value = answers[q.id] ?? "";
    const flags = el("div.wiz__flags", { "aria-live": "polite" });
    function paintFlags() {
      const left = (box.value.match(/_{2,}/g) ?? []).length;
      flags.replaceChildren(
        left ? el("span.wiz__left", {}, `${left} blank${left === 1 ? "" : "s"} left in this answer.`) : null,
        ...voiceFlags({ [q.id]: box.value }).map((f) => el("span.lkit__flag", {}, `"${f.phrase}" sounds like a template. ${f.fix}`))
      );
    }
    paintFlags();
    const lastOfPart = SLIDES[place.i + 1]?.part !== q.part;
    const node = el(
      "div.wiz__slide",
      { "data-q": q.id },
      cheer !== null ? el("p.wiz__cheer", {}, check(), `Part ${"ABCDE"[cheer]} done: ${BEATS[cheer].name}. Saved.`) : null,
      el("p.wiz__count", {}, `Question ${n} of ${SLIDES.length} · Part ${"ABCDE"[q.part]}: ${q.partName}`),
      el("h3.wiz__q", {}, q.q),
      q.hint ? el("p.wiz__hint", {}, q.hint) : null,
      box,
      flags,
      el("p.wiz__ex", {}, el("span", {}, "Example: "), q.example),
      el(
        "div.wiz__nav",
        {},
        place.i > 0 ? btn({ label: "← Back", variant: "quiet", onclick: () => go(place.i - 1) }) : el("span"),
        btn({ label: lastOfPart ? `Finish part ${"ABCDE"[q.part]} →` : "Next →", variant: "solid", onclick: () => go(place.i + 1) })
      ),
      el("p.wiz__keys", {}, lastOfPart ? "Finishing a part saves your answers so far." : "Your answers stay here while you move between questions.")
    );
    if (Date.now() < (place.focusUntil ?? 0)) queueMicrotask(() => box.isConnected && !readOnly && box.focus());
    return node;
  }

  function review() {
    const beats = composeBeats(answers);
    const seconds = scriptSeconds(answers);
    const left = blanksLeft(answers);
    const flags = voiceFlags(answers);
    const done = scriptDone(answers);
    const firstUnfinished = SLIDES.findIndex((q) => !tidyAnswers(answers)[q.id] || /_{2,}/.test(answers[q.id]));
    return el(
      "div.wiz__slide.wiz__review",
      {},
      done ? el("div.wiz__done", {}, el("span.wiz__bigcheck", { "aria-hidden": "true" }, "✓"), el("b", {}, "Your script is ready")) : null,
      el("p.wiz__count", {}, done ? "All five parts done" : "Almost there"),
      el("h3.wiz__q", {}, "Your full script"),
      el(
        "p.wiz__hint",
        {},
        [
          seconds ? `About ${clock(seconds)} out loud${seconds > PACE.max ? ", so trim a sentence or two" : ""}.` : "",
          left ? `${left} blank${left === 1 ? "" : "s"} still to fill.` : "",
          "These are your answers joined in order. The Record step shows this script, and the practice room scrolls it beside your camera.",
        ]
          .filter(Boolean)
          .join(" ")
      ),
      ...flags.map((f) => el("p.lkit__flag", {}, `"${f.phrase}" sounds like a template. ${f.fix}`)),
      el("div.lkit__script", {}, scriptList(beats)),
      el(
        "div.wiz__nav",
        {},
        btn({ label: "← Back to the questions", variant: "quiet", onclick: () => go(firstUnfinished >= 0 ? firstUnfinished : SLIDES.length - 1) }),
        readOnly
          ? null
          : btn({
              label: done ? "Save and go to Record →" : "Save it as it is",
              variant: "solid",
              onclick: () => {
                save();
                if (done) onFinish();
              },
            })
      )
    );
  }

  function paint() {
    const cheer = place.cheer && Date.now() < place.cheer.until ? place.cheer.part : null;
    root.replaceChildren(parts(cheer), place.i >= SLIDES.length ? review() : slide(cheer));
  }
  paint();
  return root;
}

/** The Record node: the script they wrote, practice, Loom, and the link back. */
export function recordNode({ target, campaign, readOnly, loomField, onSaveLink, onTake, onEditScript }) {
  const beats = scriptBeats(target, campaign);
  const own = Object.keys(tidyAnswers(target.loomScript)).length > 0;
  const answers = answersFor(target, readOnly);
  const showing = answers.show?.trim();
  const firstOne = !target.loomUrl && !target.loomTakes;
  const step = (n, title, what, ...body) => el("section.lkit__step", {}, el("h3.lkit__stephead", {}, el("span.lkit__n", {}, String(n)), title), what ? el("p.lkit__what", {}, what) : null, ...body);

  return el(
    "div.lkit",
    {},
    el(
      "p.lkit__lead",
      {},
      "About 70 seconds of you, talking to one person about their company and showing one thing you built. It doesn't need to be polished, and a small stumble is normal."
    ),
    step(
      1,
      "Read your script once",
      own ? null : "You haven't written your own script yet, so this is the rough draft from the research. The Script step turns it into your words.",
      el("div.lkit__script", {}, scriptList(beats)),
      readOnly ? null : el("div.lkit__act", {}, btn({ label: "Edit in the Script step", variant: "quiet", onclick: onEditScript }))
    ),
    step(
      2,
      "Practise it",
      "Opens a practice room on this page: your camera, your script in large type near the top of the screen, and a timer. Practice takes stay on this page and are deleted when you close the room. Nothing is uploaded and nobody sees them.",
      target.loomTakes ? el("p.pack__hint", {}, takesLine(target.loomTakes)) : null,
      readOnly ? null : el("div.lkit__act", {}, btn({ label: "Open the practice room", variant: "ghost", onclick: () => openRehearsal({ company: target.company, beats, onTake }) }))
    ),
    step(
      3,
      "Record the real one on Loom",
      "Loom opens in a new tab. Sign in to your own Loom account (the free plan is enough), choose screen and camera, and record. When you stop, Loom gives you a share link. Copy it.",
      el(
        "p.lkit__then",
        {},
        el("b", {}, "Have open before you start: "),
        target.link ? el("a", { href: target.link, target: "_blank", rel: "noopener" }, "their posting") : "their posting or site",
        showing ? `, and ${showing}.` : ", and the thing you'll show on screen."
      ),
      firstOne ? el("p.lkit__tip", {}, "If this is your first Loom, send it to the target you care about least. You'll get better with each one, so the first few go where the stakes are lowest.") : null,
      el("div.lkit__act", {}, btn({ label: "Open Loom ↗", variant: "ghost", href: "https://www.loom.com/", target: "_blank" }))
    ),
    step(
      4,
      "Paste your Loom link",
      "Paste the share link Loom gave you. Saving it finishes this step and puts the link into your email, which is the next step.",
      el("div.row.camp__loom", {}, loomField.node, readOnly ? null : btn({ label: "Save the link", variant: "solid", onclick: onSaveLink }))
    )
  );
}

/* ---------- the rehearsal room ---------- */

let active = null;

/**
 * Close the open rehearsal, if there is one. The drawer's modal catches Escape
 * first (window, capture phase), so it asks here before closing itself.
 */
export function closeRehearsal() {
  if (!active) return false;
  active.close();
  return true;
}

function pickMime() {
  const R = globalThis.MediaRecorder;
  if (!R?.isTypeSupported) return "";
  return ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find((t) => R.isTypeSupported(t)) || "";
}

/**
 * Full-screen, private rehearsal. Camera and mic stay on this page; a take is
 * a blob URL that is revoked when the next one starts or the room closes.
 * Without a camera it still runs the prompter and the timer, out loud.
 */
export function openRehearsal({ company, beats, onTake = () => {} }) {
  closeRehearsal();
  const parts = (beats ?? []).map((b) => ({ t: b.t, ...splitBeat(b.say) }));
  let stream = null;
  let recorder = null;
  let chunks = [];
  let takeUrl = null;
  let beat = 0;
  let started = 0;
  let tick = null;
  let countdown = null;
  let state = "idle"; // idle | counting | rolling | review

  const live = el("video.rh__cam", { muted: true, playsInline: true, autoplay: true });
  const playback = el("video.rh__play", { controls: true, playsInline: true, hidden: true });
  const camNote = el("p.rh__camnote", { hidden: true }, "No camera here. Rehearse out loud: the prompter and the timer still run.");
  const stage = el("p.rh__stage");
  const spoken = el("p.rh__spoken");
  const dots = el("div.rh__dots", {}, parts.map(() => el("span")));
  const timer = el("span.rh__timer", {}, "0:00");
  const band = el("span.rh__band", {}, `aim ${clock(PACE.low)}–${clock(PACE.high)}`);
  const big = el("div.rh__count", { hidden: true });
  const note = el("p.rh__note", {}, "Take one is a warm-up. Nobody sees it, including Aden.");
  const controls = el("div.rh__controls");

  const layer = el(
    "div.rh",
    { role: "dialog", "aria-modal": "true", "aria-label": `Practise the Loom for ${company}`, tabindex: "-1" },
    el(
      "header.rh__head",
      {},
      el("div", {}, el("b.eyebrow", {}, "Practice room"), el("h1", {}, company)),
      el("p.rh__private", {}, "Takes stay in this tab. Nothing is uploaded or saved."),
      el("button.rh__x", { type: "button", "aria-label": "Close the practice room", onclick: close }, "×")
    ),
    el("div.rh__prompter", { "aria-live": "polite" }, stage, spoken, dots),
    el("div.rh__screen", {}, live, playback, camNote, big),
    el("footer.rh__foot", {}, el("div.rh__clock", {}, timer, band), note, controls)
  );

  function showBeat(i) {
    beat = Math.max(0, Math.min(parts.length - 1, i));
    const part = parts[beat] ?? { spoken: "", stage: [] };
    stage.textContent = part.stage.length ? `On screen: ${part.stage.join("; ")}` : "";
    spoken.textContent = part.spoken;
    [...dots.children].forEach((d, n) => d.classList.toggle("is-on", n === beat));
  }

  function setControls() {
    const list = {
      idle: [btn({ label: "Start a take", variant: "solid", onclick: start })],
      counting: [btn({ label: "Cancel", variant: "quiet", onclick: reset })],
      rolling: [
        btn({ label: beat < parts.length - 1 ? "Next beat →" : "Last beat", variant: "ghost", disabled: beat >= parts.length - 1, onclick: () => showBeat(beat + 1) }),
        btn({ label: "Stop", variant: "solid", onclick: stop }),
      ],
      review: [
        btn({ label: "Again", variant: "ghost", onclick: reset }),
        btn({ label: "Good enough: record it on Loom ↗", variant: "solid", href: "https://www.loom.com/", target: "_blank" }),
      ],
    }[state];
    controls.replaceChildren(...list);
  }

  async function camera() {
    if (stream || !navigator.mediaDevices?.getUserMedia) return Boolean(stream);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      live.srcObject = stream;
      return true;
    } catch {
      camNote.hidden = false;
      live.hidden = true;
      return false;
    }
  }

  function start() {
    state = "counting";
    setControls();
    let n = 3;
    big.hidden = false;
    big.textContent = String(n);
    countdown = setInterval(() => {
      n -= 1;
      if (n > 0) big.textContent = String(n);
      else {
        clearInterval(countdown);
        countdown = null;
        big.hidden = true;
        roll();
      }
    }, 800);
  }

  function roll() {
    state = "rolling";
    showBeat(0);
    chunks = [];
    if (stream && globalThis.MediaRecorder) {
      try {
        const mimeType = pickMime();
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
        recorder.onstop = review;
        recorder.start(500);
      } catch {
        recorder = null;
      }
    }
    started = performance.now();
    tick = setInterval(() => {
      const s = (performance.now() - started) / 1000;
      timer.textContent = clock(s);
      timer.classList.toggle("is-long", s > PACE.max);
    }, 250);
    note.textContent = "Talk to one person. Point at the screen when you reach the proof. Space moves to the next beat.";
    setControls();
  }

  function stop() {
    clearInterval(tick);
    tick = null;
    const seconds = (performance.now() - started) / 1000;
    note.textContent = paceNote(seconds);
    onTake({ seconds: Math.round(seconds) });
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else review();
  }

  function review() {
    state = "review";
    recorder = null;
    if (chunks.length) {
      if (takeUrl) URL.revokeObjectURL(takeUrl);
      takeUrl = URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || "video/webm" }));
      playback.src = takeUrl;
      playback.hidden = false;
      live.hidden = true;
      note.textContent += " Watch it once, as them: would you reply?";
    }
    setControls();
  }

  function reset() {
    if (countdown) clearInterval(countdown);
    countdown = null;
    big.hidden = true;
    playback.pause();
    playback.hidden = true;
    playback.removeAttribute("src");
    if (takeUrl) URL.revokeObjectURL(takeUrl);
    takeUrl = null;
    live.hidden = !stream;
    timer.textContent = "0:00";
    timer.classList.remove("is-long");
    note.textContent = "Different words are fine. Keep the same order.";
    state = "idle";
    showBeat(0);
    setControls();
  }

  function onKey(e) {
    if (e.key === "Escape") close();
    else if (state === "rolling" && (e.key === " " || e.key === "ArrowRight") && !/^(BUTTON|A|INPUT|TEXTAREA|VIDEO)$/.test(e.target?.tagName ?? "")) {
      e.preventDefault();
      showBeat(beat + 1);
      setControls();
    }
  }

  function close() {
    clearInterval(tick);
    if (countdown) clearInterval(countdown);
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stream?.getTracks().forEach((t) => t.stop());
    if (takeUrl) URL.revokeObjectURL(takeUrl);
    document.removeEventListener("keydown", onKey);
    layer.remove();
    if (active === handle) active = null;
  }

  showBeat(0);
  setControls();
  document.body.append(layer);
  document.addEventListener("keydown", onKey);
  layer.focus();
  camera();
  const handle = { close };
  active = handle;
  return handle;
}
