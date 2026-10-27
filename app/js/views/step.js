/**
 * Full step page. Everything for one node lives here: lesson, required
 * reading (opens in a modal over the page), tasks, the link. A thin column on
 * the right (step-progress.js) shows the parts filling bottom-up; Save
 * unlocks once the reading is done, Next once the link is saved.
 *
 * Route: #/map/<nodeId> or #/map/<nodeId>/m/<module/path/segments> (the
 * reading as a shareable page).
 */

import { el, mount } from "../dom.js?v=a8ec4dc-202610271940";
import { btn, placeholder, toast, field } from "../ui.js?v=a8ec4dc-202610271940";
import { STATUS, blockedBy, isSpine, nextUp, stepNumber, stepCount, specOf } from "../graph/model.js?v=a8ec4dc-202610271940";
import { taskRow, reviewScores } from "./parts.js?v=a8ec4dc-202610271940";
import { statusLabel, trackLabel, ccvvLabel } from "../copy.js?v=a8ec4dc-202610271940";
import { videoCard, resolveMedia, filmSummary } from "./video.js?v=a8ec4dc-202610271940";
import { handoffDisclosure } from "./handoff.js?v=a8ec4dc-202610271940";
import { withSavedState, isCountTask } from "../task-state.js?v=a8ec4dc-202610271940";
import { renderMarkdown, splitTitle } from "../markdown.js?v=a8ec4dc-202610271940";
import { hydrateMermaid, mermaidSource } from "../mermaid.js?v=a8ec4dc-202610271940";
import { provesBlock } from "./proves.js?v=a8ec4dc-202610271940";
import { modeLine } from "./mode.js?v=a8ec4dc-202610271940";
import { artifactLine } from "./artifact.js?v=a8ec4dc-202610271940";
import { refsBlock } from "./refs.js?v=a8ec4dc-202610271940";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js?v=a8ec4dc-202610271940";
import { electiveBlock } from "./elective.js?v=a8ec4dc-202610271940";
import { fromAdenCard } from "./from-aden.js?v=a8ec4dc-202610271940";
import { helpBlock } from "./step-help.js?v=a8ec4dc-202610271940";
import { signoffNotice, submitLabel, linkHint } from "./signoff.js?v=a8ec4dc-202610271940";
import { stepSpine, canAdvance, readyToSave, readFlag } from "./step-progress.js?v=a8ec4dc-202610271940";
import { createReadingModal } from "./reading-modal.js?v=a8ec4dc-202610271940";
import { bindDraft, clearDraft } from "../drafts.js?v=a8ec4dc-202610271940";
import { registerLeaveGuard, clearLeaveGuard, isLeaveDirty } from "../leave-guard.js?v=a8ec4dc-202610271940";
import { isPreviewMedia } from "../preview-mode.js?v=a8ec4dc-202610271940";
import { siteOverridesDoc, dropSiteOverridesCache } from "../../../js/site-overrides.js?v=a8ec4dc-202610271940";
import { isCompleteMap, isFreeMap, stageTime, upgradeHref, PAID_ASK, PAID_TASKS, PAID_VIDEO, DFY_LINE, FILM_COMING, COURSE_LINE, COURSE_ASK, COURSE_TASKS } from "../prep.js?v=a8ec4dc-202610271940";
import { sampleBlock } from "./sample.js?v=a8ec4dc-202610271940";
import { answerBlock } from "./answer.js?v=a8ec4dc-202610271940";
import { renderResume } from "./resume.js?v=a8ec4dc-202610271940";
import { renderProfile } from "./profile.js?v=a8ec4dc-202610271940";
import { renderSend } from "./send.js?v=a8ec4dc-202610271940";
import { renderPath } from "./path.js?v=a8ec4dc-202610271940";
import { renderLinkedinStep, renderTargetsStep } from "./step-checklist.js?v=a8ec4dc-202610271940";

const TOOLS = { profile: renderProfile, send: renderSend, path: renderPath, linkedin: renderLinkedinStep, targets: renderTargetsStep };

/* A "builder" node is its tool: the step page shows the tool itself in place of a task list that points
   somewhere else. One instance per node, kept across repaints so an answer being typed survives. */
const builders = new Map();
function builderBlock(ctx, node) {
  const key = `${ctx.state.slug}:${node.id}`;
  let tool = builders.get(key);
  if (!tool) {
    tool = (TOOLS[node.tool] || renderResume)(ctx, { embedded: true, node });
    builders.set(key, tool);
  } else {
    tool.update(ctx, { node });
  }
  return el("section.step__tool", {}, tool.node);
}
import { videoAccess, isFilmed } from "../../../data/video-access.mjs?v=a8ec4dc-202610271940";

const FALLBACK_VIDEO = {
  title: "Lesson",
  mins: 1,
  path: "test-bbb",
};

/**
 * One lesson block: heading, paragraphs, then an optional figure. A figure is
 * either an image (`fig.src`) or a diagram written as mermaid source
 * (`mermaid`, with an optional `caption`); the diagram is drawn after mount.
 */
function lessonSection(section, { letter = false } = {}) {
  const fig = section.fig;
  return el(
    "section.lesson__sec",
    { class: letter ? "lesson__sec--letter" : "" },
    section.h && el("h2", {}, section.h),
    (section.p ?? []).map((paragraph) => el("p", {}, paragraph)),
    fig?.src
      ? el(
          "figure.lesson__fig",
          {},
          el("img", {
            src: fig.src,
            alt: fig.alt || "",
            loading: "lazy",
            decoding: "async",
          }),
          fig.caption ? el("figcaption", {}, fig.caption) : null
        )
      : null,
    section.mermaid
      ? el(
          "figure.lesson__fig.lesson__fig--diagram",
          {},
          mermaidSource(section.mermaid),
          section.caption ? el("figcaption", {}, section.caption) : null
        )
      : null
  );
}

/** True when #/map/<id> should be the step page rather than the graph. */
/**
 * The line over a step's task list. Habit (count) tasks reset each day or
 * week and never block the step, so "in order, check each box" would be
 * wrong for them; say what they are instead.
 */
export function tasksLead(node, welcome = false) {
  if (welcome) return "Do these in order. Check the box after you have finished the work. Reading the task does not complete it.";
  const tasks = node?.tasks ?? [];
  const habits = tasks.filter(isCountTask);
  if (!habits.length) return "Complete these tasks in order. Check each box after you finish the work.";
  const periods = new Set(habits.map((task) => (task.per === "week" ? "week" : "day")));
  const reset = periods.size === 1 ? `each ${[...periods][0]}` : "each day or week";
  const habitLine = `Habits reset ${reset}; they never block this step.`;
  if (habits.length === tasks.length) return `Keep these habits going. ${habitLine}`;
  return `Complete the other tasks in order and check each box after you finish the work. ${habitLine}`;
}

/**
 * GridSchool Complete: the work we're doing for them, as a tracker (prep.js).
 * A stage is lit only once it was set; nothing is guessed from the clock.
 */
export function prepBlock(node, { upgrade = null } = {}) {
  // A free map, a course step past the free ones: what it is, and one way to get it.
  if (node?.paidOnly && node.course) {
    return el(
      "section.step__prep.step__prep--paid",
      { "aria-label": COURSE_LINE },
      el(
        "div.dfy__locked",
        {},
        el("div.dfy__blur", { "aria-hidden": "true" }, courseRows(node).map((line, n) => el(`p.dfy__row${n % 3 === 0 ? ".dfy__row--head" : ""}`, {}, line))),
        el(
          "div.dfy__over",
          {},
          el("b", {}, COURSE_LINE),
          el("span", {}, "The module, its film and its tasks open with GridSchool Complete. Your two profile steps are free now."),
          upgrade ? btn({ label: COURSE_ASK, variant: "cta", href: upgrade }) : null
        )
      )
    );
  }
  // A free map: who does it, what we'd do, the stages it would move through, and one way to start.
  if (node?.paidOnly) {
    return el(
      "section.step__prep.step__prep--paid",
      { "aria-label": DFY_LINE },
      el(
        "div.dfy__head",
        {},
        el("span.dfy__avatar", { "aria-hidden": "true" }, "C"),
        el("div", {}, el("b.eyebrow", {}, DFY_LINE), el("p.dfy__who", {}, "Made for you from your answers and your resume."))
      ),
      node.prepared ? el("p.step__prep-what", {}, node.prepared) : null,
      lockedPreview(node, upgrade),
      node.stages?.length
        ? el(
            "div.dfy__preview",
            {},
            el("b.dfy__label", {}, "What we'd do for you"),
            el(
              "ol.prep.prep--preview",
              {},
              node.stages.map((stage) => el("li.prep__stage", {}, el("i.prep__dot", { "aria-hidden": "true" }), el("span.prep__label", {}, stage.label)))
            )
          )
        : null
    );
  }
  const prep = node?.prep;
  if (!prep) return null;
  const note = prep.ready
    ? "It's ready. Your part is below."
    : prep.started
      ? `Now: ${prep.current.label}. Each stage lights up as the work moves forward.`
      : "This starts in a few minutes. Each stage lights up as the work moves forward.";
  return el(
    "section.step__prep",
    { "aria-label": "Prepared for you" },
    el("b.eyebrow", {}, "Prepared for you"),
    node.prepared ? el("p.step__prep-what", {}, node.prepared) : null,
    el(
      "ol.prep",
      {},
      prep.stages.map((stage) =>
        el(
          "li.prep__stage",
          { class: `is-${stage.state}`, "aria-current": stage.state === "current" ? "step" : null },
          el("i.prep__dot", { "aria-hidden": "true" }),
          el("span.prep__label", {}, stage.label),
          el("span.prep__at", {}, stage.state === "current" ? "In progress" : stage.at ? stageTime(stage.at) : "")
        )
      )
    ),
    el("p.step__prep-note", {}, note)
  );
}

/**
 * The today step's walkthrough (complete_map.py `how`): numbered lines someone can follow
 * without help, and an example where one helps. Sits above the task's checkbox and field.
 */
export function howBlock(node) {
  const how = Array.isArray(node?.how) ? node.how.filter((line) => typeof line === "string" && line) : [];
  if (!how.length) return null;
  return el(
    "section.step__how",
    { "aria-label": "How to do it" },
    el("b.eyebrow", {}, "How to do it"),
    el("ol.step__how-list", {}, how.map((line) => el("li", {}, line))),
    node.example ? el("p.step__how-example", {}, el("b", {}, "Example"), el("span", {}, node.example)) : null
  );
}

/**
 * A film that doesn't play here, drawn as a poster: a frame with a play mark and the
 * coach mark, then the title, the length, one line on what it covers and why it won't play.
 * On a free map: a film not uploaded yet says "Film coming" (from its brief), and a paid one
 * says it's included when we do it with you. It never fakes playback, and a paid film's
 * address never reaches a free seat (server/video_access.py).
 */
/**
 * What the full plan makes for this step, shown blurred on a free map (Aden: let them see their
 * own dashboard, with the paid parts blurred). The shapes under the blur are generic, never their
 * data or invented results, and the words on top say exactly what it is.
 */
const PREVIEW_ROWS = {
  reach: ["Senior Backend Engineer · posted 2 days ago", "Hiring manager · Engineering Manager, Payments", "Note: Hi, I saw the payments role and wanted to reach you directly", "Platform Engineer · posted yesterday", "Hiring manager · Director of Platform", "Note: Hi, your team's work on the data pipeline caught my eye"],
  story: ["Backend Engineer | Payment and data APIs in Python and Go", "Led the billing service rewrite: [your result, in your numbers]", "Owned the reconciliation pipeline end to end", "Shipped the new invoicing API used by three teams"],
  proof: ["Audit: the app's sign-up and payments flow", "Finding 1 · critical · the token is never checked", "Fix: verify the token on every request, with a test", "Report outline: what you checked, what you fixed, what's left"],
};
/** What a locked course step blurs: its own task titles, then the parts every module has, four lines or more. */
function courseRows(node) {
  const tasks = (node?.tasks ?? []).map((task) => task.title).filter(Boolean).slice(0, 4);
  const parts = [node?.video?.title ? `Film: ${node.video.title}` : "The film for this step", "A worked example, start to finish", "What done looks like, and how to check it", "Your tasks, one at a time"];
  return [...tasks, ...parts].slice(0, Math.max(4, tasks.length + 2));
}

function lockedPreview(node, upgrade) {
  const rows = PREVIEW_ROWS[node?.basis?.rule] ?? ["What we prepare for this step", "Researched for your target roles", "Written in your voice", "Checked by your coach before it reaches you"];
  return el(
    "div.dfy__locked",
    {},
    el("div.dfy__blur", { "aria-hidden": "true" }, rows.map((line, n) => el(`p.dfy__row${n % 3 === 0 ? ".dfy__row--head" : ""}`, {}, line))),
    el(
      "div.dfy__over",
      {},
      el("b", {}, "Included in the full plan"),
      el("span", {}, "We make yours from your answers once you start. This blur is the shape of it."),
      upgrade ? btn({ label: PAID_ASK, variant: "cta", href: upgrade }) : null
    )
  );
}

export function filmCard(video, { note, paid = false, lead = null } = {}) {
  const line = String(video?.summary ?? "").trim().match(/^[^.!?]+[.!?]?/)?.[0] ?? "";
  return el(
    "figure.film",
    { class: paid ? "film--paid film--blur" : "film--coming" },
    el(
      "div.film__frame",
      { "aria-hidden": "true" },
      el("span.film__play"),
      el("span.film__by", {}, "C"),
      video?.mins ? el("span.film__mins", {}, `${video.mins} min`) : null
    ),
    el(
      "figcaption.film__body",
      {},
      lead ? el("b.film__lead", {}, lead) : null,
      el("p.film__title", {}, video?.title || "Lesson film"),
      line ? el("p.film__line", {}, line) : null,
      el("span.film__note", {}, note)
    )
  );
}

/** A finished Complete step ends lit, on what it changed (the plan's `done`). */
export function changedBlock(node) {
  if (node?.status !== STATUS.LIT || !node.evidence) return null;
  return el("section.step__changed", { role: "status" }, el("b.eyebrow", {}, "Done"), el("p.step__changed-line", {}, node.evidence));
}

export function isStepArgs(args, graph) {
  const list = Array.isArray(args) ? args : [];
  const [arg] = list;
  if (!arg || arg === "list") return false;
  return Boolean(graph?.byId?.has(arg));
}

export function moduleIdFromArgs(args) {
  if (!args || args[1] !== "m" || args.length < 3) return null;
  return args.slice(2).join("/");
}

export function renderStep(ctx, nodeId, moduleId = null) {
  const root = el("div.view.view--step");
  let current = ctx;
  let currentNodeId = nodeId;
  let currentModuleId = moduleId;
  const reading = createReadingModal({
    onDone: (module) => current.store.setStepFlag(currentNodeId, readFlag(module.id), true),
  });

  function paint() {
    const { graph, student } = current.state;
    const node = graph.byId.get(currentNodeId);
    if (!node) {
      mount(
        root,
        el("header.view__head", {}, el("h1", {}, "This step is unavailable")),
        btn({ label: "Back to the map", variant: "solid", onclick: () => current.navigate("map") })
      );
      return;
    }
    if (currentModuleId) {
      mount(root, moduleView(node, currentModuleId));
      loadModule(currentModuleId);
      return;
    }
    mount(root, stepView(node, graph, student), reading.layer);
    hydrateMermaid(root);
  }

  /** Where you are, in one line: "Map / Step 3 of 6 · Current". The only way back and the only count. */
  function crumb(node, graph) {
    return el(
      "nav.step__crumb",
      { "aria-label": "Where you are" },
      btn({ label: "Map", variant: "quiet", onclick: () => current.navigate("map") }),
      el("span.step__crumb-sep", { "aria-hidden": "true" }, "/"),
      el("span.step__crumb-here", {}, stepEyebrow(node, graph))
    );
  }

  function stepEyebrow(node, graph) {
    if (node.id === "or.start") return "Week 1 · Orientation";
    // One count, the same as the rail and the list (graph/model.js stepCount): this step's place on the line.
    // A coach call or a habit is a marker on the line, so it says what it is instead of a number.
    const { total } = stepCount(graph);
    const where = node.marker
      ? specOf(node).tag ?? "On your map"
      : isSpine(node) && stepNumber(node) && total
        ? `Step ${Number(stepNumber(node)) || stepNumber(node)} of ${total}`
        : trackLabel(node.track);
    /* Weeks are typical pace inside the intensive sequence, not a calendar
       promise: the residency runs a year and nothing on the map expires. */
    const weeks =
      Array.isArray(node.weeks) && node.weeks.length
        ? ` · week ${node.weeks[0] === node.weeks[1] ? node.weeks[0] : `${node.weeks[0]} to ${node.weeks[1]}`}`
        : "";
    return `${where} · ${statusLabel(node.status)}${weeks}`;
  }

  function stepView(node, graph, student) {
    const isAdmin = current.role === "admin";
    const blockers = blockedBy(graph, node.id);
    const canTurnIn = node.status === STATUS.OPEN || node.status === STATUS.LIT;
    const welcome = node.id === "or.start";
    // A filmed chapter gets its player. An unfilmed one shows nothing about a
    // film to a student. Media preview (instructor strip, device-local) shows
    // the stand-in clip and the film's brief so the page can be judged before
    // filming.
    // A free map: every film shows. A free one plays once it's uploaded and is a "Film coming"
    // poster until then; a paid one is a poster that never plays (the server sends it without an
    // address). The guided first step opens on its film: "Watch first".
    const freePlan = isFreeMap(graph);
    const demoBoard = current.state.slug === "demo";
    const upgrade = freePlan ? upgradeHref(graph, node, { demo: demoBoard }) : null;
    const access = freePlan && node.video ? videoAccess(node.video, node) : null;
    const watchFirst = access === "free" && /^t\./.test(node.id) && node.video?.mins ? `Watch first, about ${node.video.mins} min` : null;
    const slot =
      access === "paid"
        ? filmCard(node.video, { note: node.course ? "Included in the full course" : PAID_VIDEO, paid: true })
        : access === "free" && !isFilmed(node.video)
          ? filmCard(node.video, { note: FILM_COMING, lead: watchFirst })
          : null;
    const filmed = access !== "paid" && Boolean(node.video && resolveMedia(node.video));
    const preview = isAdmin && isPreviewMedia();
    const previewClip = !filmed && Boolean(node.video) && preview;
    const video = filmed ? node.video : previewClip ? { ...FALLBACK_VIDEO, title: node.video.title || FALLBACK_VIDEO.title, mins: node.video.mins || FALLBACK_VIDEO.mins } : null;
    const card = video
      ? videoCard({
          title: video.title,
          mins: video.mins,
          youtube: video.youtube,
          path: video.path,
          thumb: video.thumb,
          startOpen: true,
          onWatch: welcome
            ? () => {
                current.store.setStepFlag(node.id, "watched", true);
              }
            : null,
        })
      : null;

    if (shouldInterceptLock(node)) {
      return el(
        "div.step.step--locked",
        {},
        el(
          "header.step__head",
          {},
          crumb(node, graph),
          el("h1.step__title", {}, node.title),
          node.why ? el("p.step__lead", {}, node.why) : null,
          artifactLine(node)
        ),
        lockNotice({
          graph,
          node,
          onGo: (id) => current.navigate("map", id),
        }),
        // What you'll do here, so a locked step is a preview and not a wall.
        !node.lesson?.length && node.tasks?.length && node.kind !== "future"
          ? el(
              "section.step__preview",
              {},
              el("b.eyebrow", {}, "What you'll do here"),
              el("ol.step__preview-list", {}, node.tasks.map((task) => el("li", {}, task.title)))
            )
          : null,
        node.kind !== "future" && node.lesson?.length
          ? el(
              "section.step__lesson",
              {},
              el("b.eyebrow", {}, "Preview"),
              node.lesson.map((section) => lessonSection(section))
            )
          : null,
        node.kind === "future" ? null : refsBlock(node, { filmed }),
        stepBar({ node, graph, student, locked: true })
      );
    }

    // A builder node's tool shows its own progress; the task spine beside it would say the same thing twice.
    const spine = node.type === "builder" ? null : stepSpine({ node, student, store: current.store, onChange: () => paint() });
    const tasksBlock = node.tasks?.length
      ? el(
          "section.step__tasks",
          {},
          el("h2.step__tasks-title", {}, "Your tasks"),
          el(
            "p.step__tasks-lead",
            {},
            node.course && node.paidOnly
              ? "These open with the full course."
              : node.paidOnly
              ? "On the paid plan we do the work above, then these are yours."
              : node.preparing ? "These are yours once the work above is ready. Until then there's nothing to do here." : tasksLead(node, welcome)
          ),
          el(
            "div.tasks",
            {},
            node.tasks.map((task, i) =>
              taskRow(
                {
                  ...withSavedState(task, student),
                  nodeId: node.id,
                  nodeN: node.n,
                  nodeLabel: stepNumber(node),
                  nodeTitle: node.title,
                  index: i + 1,
                  hideKind: !isCountTask(task),
                  locked: node.course && node.paidOnly ? COURSE_TASKS : node.paidOnly ? PAID_TASKS : node.preparing ? "Opens when the work above is ready for you" : null,
                },
                { store: current.store, navigate: current.navigate }
              )
            )
          )
        )
      : null;

    return el(
      "div.step",
      { class: welcome ? "step--welcome" : "" },
      spine,
      el(
        "header.step__head",
        {},
        crumb(node, graph),
        el("h1.step__title", {}, node.title),
        node.why ? el("p.step__lead", {}, node.why) : null,
        welcome ? null : modeLine(node),
        welcome ? null : artifactLine(node)
      ),
      prepBlock(node, { upgrade }),
      sampleBlock(node, { upgrade }),
      fromAdenCard(node),
      electiveBlock({ node, store: current.store }),
      card || slot || (preview && !filmed && node.video?.summary)
        ? el(
            "section.step__video",
            {},
            card && watchFirst ? el("b.eyebrow.film__first", {}, watchFirst) : null,
            card ? card.node : null,
            card ? null : slot,
            preview && !welcome ? filmSummary({ summary: node.video?.summary, filmed }) : null
          )
        : null,
      welcome ? tasksBlock : null,
      node.lesson?.length
        ? el(
            "section.step__lesson",
            {},
            el("b.eyebrow", {}, welcome ? "Welcome" : "Lesson"),
            node.lesson.map((section, index) =>
              lessonSection(section, { letter: welcome && index === 0 })
            )
          )
        : node.lessonLocked
          ? el(
              "section.step__lesson",
              {},
              el("b.eyebrow", {}, "Lesson"),
              el("p.room__hint", {}, "The lesson unlocks with the access key you receive at enrollment. The tasks below are real.")
            )
          : null,
      welcome ? null : provesBlock(node),
      readingBlock(node, student),
      refsBlock(node, { filmed }),
      node.kind === "future"
        ? placeholder({
            title: "Not open yet",
            note: node.coming,
            when: "You may read this page now. The tasks become available when the step opens.",
          })
        : null,
      welcome || node.kind === "future" || node.type === "builder" ? null : howBlock(node),
      welcome || node.kind === "future"
        ? null
        : node.type === "builder"
          ? builderBlock(current, node)
          : node.chunk && node.tasks?.length
            ? questionsBlock(node)
            : tasksBlock,
      welcome ? null : helpBlock({ node, store: current.store, isAdmin }),
      isCompleteMap(graph) ? changedBlock(node) : null,
      node.kind === "future" || node.completion === "tasks"
        ? null
        : el(
        "section.step__out",
        {},
        el("b.eyebrow", {}, welcome ? "Your first link" : "Turn this in"),
        el("p.step__evidence", {}, node.evidence),
        !welcome && (node.ccvv?.length || node.reviewFor)
          ? el(
              "div.room__grade",
              {},
              node.ccvv?.length
                ? el("p.room__ccvv", {}, el("b", {}, "Graded on "), node.ccvv.map(ccvvLabel).join(" · "))
                : null,
              node.reviewFor
                ? el("p.room__reviewfor", {}, el("b", {}, "A strong turn-in shows "), node.reviewFor)
                : null
            )
          : null,
        blockers.length
          ? el(
              "div.room__blocked",
              {},
              el("p.room__hint", {}, "Complete these prerequisite steps first."),
              el(
                "div.room__prereqs",
                {},
                blockers.map((blocker) =>
                  el(
                    "button.room__goto",
                    { type: "button", onclick: () => current.navigate("map", blocker.id) },
                    `Go to ${stepNumber(blocker)} · ${blocker.title}`
                  )
                )
              )
            )
          : null,
        canTurnIn ? signoffNotice(node) : null,
        canTurnIn && (node.status === STATUS.LIT || node.awaitingSignoff) ? litBlock(node) : null,
        canTurnIn ? evidenceForm(node) : null,
        // Nothing to review until there is a link; the disclosure waits for it.
        canTurnIn && (node.proof?.url || reviewsFor(node))
          ? el(
              "div.room__handoff",
              {},
              node.proof?.url ? handoffDisclosure({ store: current.store, node, label: "Send for review" }) : null,
              reviewsFor(node)
            )
          : null
        ),
      stepBar({ node, graph, student, locked: false }),
      isAdmin ? adminBlock(node, graph) : null
    );
  }

  /** A q-step (complete_map.py `chunk`): its questions, answered here; saving checks its one task (views/answer.js). */
  function questionsBlock(node) {
    const task = node.tasks[0];
    return answerBlock({
      node,
      slug: current.state.slug,
      done: node.status === STATUS.LIT,
      onSaved: () => current.store.setTaskState(task.id, "done"),
    });
  }

  /**
   * The step's footer, stuck to the bottom of the page: back to the map, and once the step is done, one button
   * on to the next step ("Done · Next: Your LinkedIn"). Until then it says what finishes the step instead of
   * showing a button that can't be pressed.
   */
  function stepBar({ node, graph, student, locked = false }) {
    if (locked) return null;
    const ready = canAdvance(node, student);
    const next = nextUp(graph);
    const advance = ready && next && next.id !== node.id ? next : null;
    const left = node.completion === "tasks" ? "Finish the work above to go on." : "Turn this in to go on.";
    return el(
      "footer.step__bar",
      // Stuck to the bottom only once there's somewhere to go; until then it sits after the work, out of its way.
      { class: ready ? "is-ready" : null },
      btn({ label: "← Map", variant: "quiet", onclick: () => current.navigate("map") }),
      el(
        "div.step__bar-next",
        {},
        ready
          ? btn({
              label: advance ? `Done · Next: ${advance.title} →` : "Done · Back to the map",
              variant: "solid",
              onclick: () => (advance ? current.navigate("map", advance.id) : current.navigate("map")),
            })
          : el("span.step__bar-hint", {}, node.awaitingSignoff ? "Waiting for your coach's sign-off." : left)
      )
    );
  }

  /**
   * Required reading, before the work. Each opens over the page; "Done
   * reading" marks it in the column. The Save button waits for these.
   */
  function readingBlock(node, student) {
    if (!node.modules?.length) return null;
    const flags = student.stepFlags?.[node.id] ?? {};
    return el(
      "section.step__mods",
      {},
      el("b.eyebrow", {}, "Read first"),
      el(
        "div.step__modlist",
        {},
        node.modules.map((module) => {
          const mid = module.id ?? moduleHrefToId(module.href);
          const read = Boolean(flags[readFlag(mid)]);
          return el(
            "button.step__mod",
            {
              type: "button",
              class: read ? "is-read" : null,
              onclick: () => mid && reading.open({ ...module, id: mid }, { read }),
            },
            el("b", {}, module.title),
            el("span", {}, read ? "Read" : module.mins ? `${module.mins} min` : "Open")
          );
        })
      )
    );
  }

  function moduleView(node, mid) {
    const article = el("article.step__prose.prose", {}, el("p.muted", {}, "Loading…"));
    return el(
      "div.step.step--module",
      {},
      el(
        "header.step__head",
        {},
        el(
          "div.step__nav",
          {},
          btn({
            label: `← Back to ${node.title}`,
            variant: "quiet",
            onclick: () => current.navigate("map", node.id),
          })
        ),
        el("b.eyebrow", {}, `Deeper reading · ${trackLabel(node.track)}`),
        el("h1.step__title", {}, mid.split("/").pop() ?? mid)
      ),
      article
    );
  }

  async function loadModule(mid) {
    const article = root.querySelector("article.step__prose");
    if (!article) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9/-]*[A-Za-z0-9]$/.test(mid)) {
      article.innerHTML = "<p>This reading link is invalid.</p>";
      return;
    }
    try {
      const res = await fetch(new URL(`../../../read/modules/${mid}.md`, import.meta.url), { cache: "no-store" });
      if (!res.ok) throw new Error("missing");
      const { title, body } = splitTitle(await res.text());
      if (title) {
        const h1 = root.querySelector(".step__title");
        if (h1) h1.textContent = title;
      }
      article.innerHTML = renderMarkdown(body);
      hydrateMermaid(article);
    } catch {
      article.innerHTML = "<p>This reading is unavailable. Report the missing reading in the Asks channel.</p>";
    }
  }

  function moduleHrefToId(href) {
    if (!href) return null;
    const m = String(href).match(/[?&]m=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function reviewsFor(node) {
    const reviews = (current.state.student.reviews ?? []).filter((review) => review.nodeId === node.id);
    if (!reviews.length) return null;
    return el(
      "div.room__rvs",
      {},
      reviews.map((review) =>
        el(
          "div.rv",
          { class: `rv--${review.state}` },
          el(
            "div.rv__head",
            {},
            el("b", {}, review.title),
            el(
              "span.rv__state",
              {},
              review.state === "returned"
                ? review.outcome === "changes"
                  ? "Changes requested"
                  : "Accepted"
                : "In review"
            )
          ),
          review.verdict && el("p.rv__verdict", {}, review.verdict),
          reviewScores(review)
        )
      )
    );
  }

  function litBlock(node) {
    return el(
      "div.room__lit",
      {},
      el("b.eyebrow", {}, "Your link"),
      el("a.room__link", { href: node.proof?.url ?? "#", target: "_blank", rel: "noopener" }, node.proof?.url ?? "Saved link"),
      node.proof?.note && el("p.room__note", {}, node.proof.note),
      node.proof?.at && el("span.room__at", {}, `attached ${node.proof.at}`)
    );
  }

  function evidenceForm(node) {
    const savedUrl = node.proof?.url ?? "";
    const savedNote = node.proof?.note ?? "";
    const slug = current.state.slug;
    const ready = readyToSave(node, current.state.student);
    const url = field({
      label: "The link",
      id: `ev-url-${node.id}`,
      type: "url",
      value: savedUrl,
      placeholder: "https://",
      hint: linkHint(node),
    });
    const note = field({
      label: "What should I look at?",
      id: `ev-note-${node.id}`,
      value: savedNote,
      placeholder: "Name the part you most want reviewed.",
      textarea: true,
    });
    // Drafts outlive a re-render, a reading opened over the page, and a reload.
    bindDraft(url.input, { slug, id: `ev-url-${node.id}`, saved: savedUrl });
    bindDraft(note.input, { slug, id: `ev-note-${node.id}`, saved: savedNote });

    registerLeaveGuard(
      "evidence",
      () => {
        const liveUrl = document.getElementById(`ev-url-${node.id}`);
        const liveNote = document.getElementById(`ev-note-${node.id}`);
        if (!liveUrl) return false;
        return liveUrl.value.trim() !== savedUrl || (liveNote?.value.trim() ?? "") !== savedNote;
      },
      node.status === STATUS.LIT || node.awaitingSignoff
        ? "You changed the link. Click Update the link or you will lose it."
        : `This link is not on the board yet. Click ${submitLabel(node, false)} or you will lose it.`
    );

    return el(
      "form.room__form",
      {
        onsubmit: (event) => {
          event.preventDefault();
          const value = url.input.value.trim();
          if (!/^https?:\/\/.+/.test(value)) {
            toast("Enter a public URL that another person can open.", "warn");
            return;
          }
          if (!readyToSave(node, current.state.student)) {
            toast("Finish the required reading first.", "warn");
            return;
          }
          clearLeaveGuard("evidence");
          clearDraft(slug, `ev-url-${node.id}`);
          clearDraft(slug, `ev-note-${node.id}`);
          const nextState = current.store.submitEvidence(node.id, value, note.input.value.trim());
          const next = nextUp(nextState.graph);
          if (node.id === "or.start") {
            toast(
              next
                ? `Orientation complete. Next step: ${next.title}.`
                : "Orientation complete. Open the Board to see your current work."
            );
          } else {
            toast(`Step ${stepNumber(node)} saved.`);
          }
        },
      },
      url.node,
      note.node,
      el(
        "div.room__acts",
        {},
        btn({
          label: submitLabel(node, node.status === STATUS.LIT || node.awaitingSignoff),
          variant: "solid",
          type: "submit",
          disabled: !ready,
          title: ready ? undefined : "Finish the required reading first",
        }),
        !ready && el("span.room__gate", {}, "Save unlocks after you finish the required reading."),
        (node.status === STATUS.LIT || node.awaitingSignoff) &&
          btn({
            label: "Remove the link",
            variant: "quiet",
            onclick: (event) => {
              event.preventDefault();
              clearLeaveGuard("evidence");
              clearDraft(slug, `ev-url-${node.id}`);
              clearDraft(slug, `ev-note-${node.id}`);
              current.store.clearEvidence(node.id);
              toast("Link removed.", "warn");
            },
          })
      )
    );
  }

  function adminBlock(node, graph) {
    return el(
      "div.room__admin",
      {},
      el("b.eyebrow", {}, "Instructor only"),
      el(
        "div.room__chips",
        {},
        (node.requires ?? []).map((id) => {
          const req = graph.byId.get(id);
          return el("span.chip2", {}, req ? `${stepNumber(req)} ${req.title}` : id);
        }),
        !(node.requires ?? []).length && el("span.muted", {}, "no prerequisites")
      ),
      copyEditor(node)
    );
  }

  /**
   * Edit this step's display copy for every board: title, why, evidence,
   * reading. Saves to the notebook's site overrides, so the change reaches
   * all students on their next load without a deploy. Lesson prose is not
   * editable here on purpose; it lives in git where it is reviewed as writing.
   */
  function copyEditor(node) {
    const live = siteOverridesDoc()?.copy?.nodes?.[node.id] ?? null;
    const body = el("div.room__copyedit", { hidden: true, style: "margin-top:10px;display:grid;gap:8px" });
    const toggle = el(
      "button.room__goto",
      { type: "button" },
      live ? "Edit step copy (live override on this step)" : "Edit step copy for all boards"
    );
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      if (!body.hidden && !body.childElementCount) buildForm();
    });

    function buildForm() {
      const fieldStyle =
        "width:100%;font:inherit;font-size:13px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px 10px;";
      const inputs = {
        title: el("input", { value: node.title ?? "", "aria-label": "Step title", style: fieldStyle }),
        why: el("textarea", { rows: 2, "aria-label": "Step why", style: fieldStyle }, node.why ?? ""),
        evidence: el("textarea", { rows: 3, "aria-label": "Step evidence", style: fieldStyle }, node.evidence ?? ""),
        reading: el("textarea", { rows: 2, "aria-label": "Step reading", style: fieldStyle }, node.reading ?? ""),
      };
      const note = el(
        "p.room__hint",
        {},
        "Saves for every board on next load. Clearing all fields removes the override and the map falls back to the curriculum file. Edit lesson text in the repository."
      );

      async function save(entry) {
        const { fetchSiteOverrides, saveSiteOverrides } = await import("../persist-admin.js?v=a8ec4dc-202610271940");
        const current = await fetchSiteOverrides().catch(() => ({ doc: {} }));
        const doc = current.doc ?? {};
        const nodes = { ...(doc.copy?.nodes ?? {}) };
        if (entry) nodes[node.id] = entry;
        else delete nodes[node.id];
        await saveSiteOverrides({ ...doc, copy: { nodes } });
        dropSiteOverridesCache();
        toast("Saved for all boards. Reloading.");
        setTimeout(() => location.reload(), 600);
      }

      body.append(
        el("label.room__hint", {}, "Title"),
        inputs.title,
        el("label.room__hint", {}, "Why (the lead line)"),
        inputs.why,
        el("label.room__hint", {}, "Turn this in (evidence ask)"),
        inputs.evidence,
        el("label.room__hint", {}, "Reading line"),
        inputs.reading,
        note,
        el(
          "div.room__acts",
          {},
          btn({
            label: "Save for all boards",
            variant: "solid",
            onclick: async (event) => {
              event.target.disabled = true;
              const entry = {};
              for (const [key, input] of Object.entries(inputs)) {
                const value = input.value.trim();
                if (value) entry[key] = value;
              }
              try {
                await save(Object.keys(entry).length ? entry : null);
              } catch (error) {
                event.target.disabled = false;
                toast(`Save failed: ${error.message}. The notebook needs your ADMIN_TOKEN (admin console, Setup).`, "warn");
              }
            },
          }),
          live
            ? btn({
                label: "Remove override",
                variant: "quiet",
                onclick: async (event) => {
                  event.preventDefault();
                  event.target.disabled = true;
                  try {
                    await save(null);
                  } catch (error) {
                    event.target.disabled = false;
                    toast(`Remove failed: ${error.message}`, "warn");
                  }
                },
              })
            : null
        )
      );
    }

    return el("div", {}, toggle, body);
  }

  /** Swap the column and the reading list in place; the form is left alone. */
  function refreshProgress() {
    const { graph, student } = current.state;
    const node = graph.byId.get(currentNodeId);
    if (!node || currentModuleId) return;
    const spine = root.querySelector(".step__spine");
    if (spine) spine.replaceWith(stepSpine({ node, student, store: current.store, onChange: () => paint() }));
    const mods = root.querySelector(".step__mods");
    const next = readingBlock(node, student);
    if (mods && next) mods.replaceWith(next);
    const submit = root.querySelector(".room__form button[type=submit]");
    if (submit && readyToSave(node, student)) {
      submit.disabled = false;
      submit.removeAttribute("title");
      root.querySelector(".room__gate")?.remove();
    }
  }

  function draftOpen() {
    if (isLeaveDirty()) return true;
    const node = current.state.graph.byId.get(currentNodeId);
    const liveUrl = document.getElementById(`ev-url-${currentNodeId}`);
    const liveNote = document.getElementById(`ev-note-${currentNodeId}`);
    if (!liveUrl || !node) return false;
    return (
      liveUrl.value.trim() !== (node.proof?.url ?? "") ||
      (liveNote?.value.trim() ?? "") !== (node.proof?.note ?? "")
    );
  }

  paint();

  return {
    node: root,
    update(nextCtx, nextNodeId = currentNodeId, nextModuleId = null) {
      const same =
        (nextNodeId ?? currentNodeId) === currentNodeId &&
        (nextModuleId ?? null) === currentModuleId;
      current = nextCtx;
      currentNodeId = nextNodeId ?? currentNodeId;
      currentModuleId = nextModuleId ?? null;
      // Typing in progress: the draft is safe on disk, but a full repaint would
      // still drop the caret. Refresh only the parts that can change underneath.
      if (same && draftOpen()) {
        refreshProgress();
        return;
      }
      paint();
    },
    destroy() {
      clearLeaveGuard("evidence");
      if (currentNodeId) clearLeaveGuard(`review-${currentNodeId}`);
      reading.destroy();
    },
  };
}
