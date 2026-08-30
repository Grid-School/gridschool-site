/**
 * Full step page. Replaces the map modal: everything for one node lives here.
 * Optional long modules (nanograph, briefs) open as a subview under the same step.
 *
 * Route: #/map/<nodeId> or #/map/<nodeId>/m/<module/path/segments>
 */

import { el, mount } from "../dom.js";
import { btn, placeholder, toast, field } from "../ui.js";
import { STATUS, blockedBy, progress, isSpine, nextUp } from "../graph/model.js";
import { taskRow, reviewScores } from "./parts.js";
import { statusLabel, trackLabel, ccvvLabel, RULE } from "../copy.js";
import { videoCard, resolveMedia } from "./video.js";
import { handoffDisclosure } from "./handoff.js";
import { TASK_STATE } from "../tasks.js";
import { renderMarkdown } from "../markdown.js";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js";
import { welcomeSchedule, welcomeReadiness, welcomeSubmitWarn, isStepComplete } from "./welcome.js";

const FALLBACK_VIDEO = {
  title: "Lesson",
  mins: 1,
  path: "test-bbb",
};

/** True when #/map/<id> should be the step page rather than the graph. */
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

  function paint() {
    const { graph, student } = current.state;
    const node = graph.byId.get(currentNodeId);
    if (!node) {
      mount(
        root,
        el("header.view__head", {}, el("h1", {}, "That step is not on this board")),
        btn({ label: "Back to board", variant: "solid", onclick: () => current.navigate("map") })
      );
      return;
    }
    if (currentModuleId) {
      mount(root, moduleView(node, currentModuleId));
      loadModule(currentModuleId);
      return;
    }
    mount(root, stepView(node, graph, student));
  }

  function stepEyebrow(node, graph) {
    if (node.id === "or.start") {
      return "Week 1 · Orientation · take your time";
    }
    const family = (graph.families ?? []).find((item) => item.id === node.family);
    const prog = progress(graph);
    const track = trackLabel(node.track);
    const count = isSpine(node)
      ? ` · ${prog.spine.lit} of ${prog.spine.total} required`
      : "";
    const weeks =
      Array.isArray(node.weeks) && node.weeks.length
        ? ` · week ${node.weeks[0] === node.weeks[1] ? node.weeks[0] : `${node.weeks[0]} to ${node.weeks[1]}`}`
        : "";
    return `${track}${count} · ${family?.label ?? "Step"} · ${String(node.n).padStart(2, "0")} · ${statusLabel(node.status)}${weeks}`;
  }

  function stepView(node, graph, student) {
    const isAdmin = current.role === "admin";
    const blockers = blockedBy(graph, node.id);
    const canTurnIn = node.status === STATUS.OPEN || node.status === STATUS.LIT;
    const welcome = node.id === "or.start";
    // Every chapter has a player. If the lesson file is not on the CDN yet,
    // the same player still opens so the page shape stays one film per step.
    const filmed = Boolean(node.video && resolveMedia(node.video));
    const video = filmed ? node.video : node.video ? { ...FALLBACK_VIDEO, title: node.video.title || FALLBACK_VIDEO.title, mins: node.video.mins || FALLBACK_VIDEO.mins } : null;
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
          el(
            "div.step__nav",
            {},
            btn({ label: "← Board", variant: "quiet", onclick: () => current.navigate("map") })
          ),
          el("b.eyebrow", {}, statusLabel(node.status)),
          el("h1.step__title", {}, node.title),
          el(
            "p.step__lead",
            {},
            "This step opens after the ones before it. You are welcome to read ahead."
          )
        ),
        lockNotice({
          graph,
          node,
          onGo: (id) => current.navigate("map", id),
          onDismiss: () => current.navigate("map"),
        }),
        node.lesson?.length
          ? el(
              "section.step__lesson",
              {},
              el("b.eyebrow", {}, "Preview"),
              node.lesson.map((section) =>
                el(
                  "section.lesson__sec",
                  {},
                  section.h && el("h2", {}, section.h),
                  (section.p ?? []).map((paragraph) => el("p", {}, paragraph))
                )
              )
            )
          : null,
        stepBar({ node, graph, student, locked: true })
      );
    }

    return el(
      "div.step",
      { class: welcome ? "step--welcome" : "" },
      el(
        "header.step__head",
        {},
        el(
          "div.step__nav",
          {},
          btn({ label: "← Board", variant: "quiet", onclick: () => current.navigate("map") }),
          welcome ? null : el("span.step__rule", {}, RULE)
        ),
        el("b.eyebrow", {}, stepEyebrow(node, graph)),
        el("h1.step__title", {}, node.title),
        node.why ? el("p.step__lead", {}, node.why) : null,
        welcome
          ? el(
              "p.step__scope",
              {},
              "Watch first. Everything you need is on this page, and your first short write sits at the bottom."
            )
          : el(
              "p.step__scope",
              {},
              "Everything for this step is on this page. Optional deeper reading appears only if named below."
            )
      ),
      card
        ? el(
            "section.step__video",
            {},
            el("b.eyebrow", {}, "Watch"),
            el("p.step__vidtitle", {}, `${node.video?.title || video.title} · ${node.video?.mins || video.mins} min`),
            card.node
          )
        : null,
      node.lesson?.length
        ? el(
            "section.step__lesson",
            {},
            el("b.eyebrow", {}, welcome ? "Welcome" : "Lesson"),
            node.lesson.map((section, index) =>
              el(
                "section.lesson__sec",
                { class: welcome && index === 0 ? "lesson__sec--letter" : "" },
                section.h && el("h2", {}, section.h),
                (section.p ?? []).map((paragraph) => el("p", {}, paragraph))
              )
            )
          )
        : node.lessonLocked
          ? el(
              "section.step__lesson",
              {},
              el("b.eyebrow", {}, "Lesson"),
              el(
                "p.room__hint",
                {},
                "The full lesson text lives here. It unlocks with the access key you receive at enrollment. The tasks and the done-when below are real; only the teaching is held back."
              )
            )
          : null,
      welcome ? welcomeSchedule(current.state.cohort) : null,
      welcome
        ? welcomeReadiness({
            node,
            student,
            store: current.store,
            onMarked: () => paint(),
          })
        : null,
      node.kind === "future"
        ? placeholder({
            title: "Not open yet",
            note: node.coming,
            when: "You can still look around. The work opens when this step does.",
          })
        : null,
      node.tasks?.length
        ? el(
            "section.step__tasks",
            {},
            el("b.eyebrow", {}, welcome ? "When you are ready" : "Do the work"),
            el(
              "p.room__hint",
              {},
              welcome
                ? "Two short writes that go in one note. Check each box when its Done when line is true, then paste the note's link below."
                : "Check a box when its Done when is true. Open Show steps only if you want the how-to."
            ),
            el(
              "div.tasks.tasks--tight",
              {},
              node.tasks.map((task) =>
                taskRow(
                  {
                    ...task,
                    nodeId: node.id,
                    nodeN: node.n,
                    nodeTitle: node.title,
                    state: student.tasks?.[task.id]?.state ?? TASK_STATE.TODO,
                  },
                  { store: current.store, navigate: current.navigate }
                )
              )
            )
          )
        : null,
      el(
        "section.step__out",
        {},
        el("b.eyebrow", {}, welcome ? "Your first link" : "Turn this in"),
        el("p.step__evidence", {}, node.evidence),
        el(
          "p.room__hint",
          {},
          welcome
            ? "Paste the URL below when the note is done. That link lights the step."
            : "Paste that URL in the field below. The link is what finishes the step."
        ),
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
        isSpine(node) && node.id !== "or.start"
          ? el(
              "details.reveal.step__rubric",
              {},
              el("summary", {}, "How week 7 scores you (the four skills)"),
              el(
                "p.room__hint",
                {},
                "Communication · Comprehension · Vision · Verification. The outside reader uses these. Write every turn-in so a stranger could score you on them. You will reuse that muscle in the live defense."
              )
            )
          : null,
        blockers.length
          ? el(
              "div.room__blocked",
              {},
              el("p.room__hint", {}, "This step opens after the ones below."),
              el(
                "div.room__prereqs",
                {},
                blockers.map((blocker) =>
                  el(
                    "button.room__goto",
                    { type: "button", onclick: () => current.navigate("map", blocker.id) },
                    `Go to ${String(blocker.n).padStart(2, "0")} · ${blocker.title}`
                  )
                )
              )
            )
          : null,
        canTurnIn && node.status === STATUS.LIT ? litBlock(node) : null,
        canTurnIn ? evidenceForm(node) : null,
        canTurnIn
          ? el(
              "div.room__handoff",
              {},
              handoffDisclosure({ store: current.store, node, label: "Send for review" }),
              reviewsFor(node)
            )
          : null
      ),
      node.modules?.length
        ? el(
            "section.step__mods",
            {},
            el("b.eyebrow", {}, "Optional deeper reading"),
            el(
              "p.room__hint",
              {},
              "Optional reading that opens right here, under this step."
            ),
            el(
              "div.step__modlist",
              {},
              node.modules.map((module) => {
                const mid = module.id ?? moduleHrefToId(module.href);
                return el(
                  "button.step__mod",
                  {
                    type: "button",
                    onclick: () => {
                      if (!mid) return;
                      current.navigate("map", node.id, "m", ...mid.split("/"));
                    },
                  },
                  el("b", {}, module.title),
                  el("span", {}, "Open on this step")
                );
              })
            )
          )
        : null,
      stepBar({ node, graph, student, locked: false }),
      isAdmin ? adminBlock(node, graph) : null
    );
  }

  /** Sticky exit + continue. Next enables only when this step is actually done. */
  function stepBar({ node, graph, student, locked = false }) {
    const complete = !locked && isStepComplete(node, student);
    const next = nextUp(graph);
    const advance =
      complete && next && next.id !== node.id
        ? next
        : complete
          ? null
          : null;
    const nextLabel = advance
      ? `Next · ${advance.title}`
      : complete
        ? "See the board"
        : "Next";

    return el(
      "footer.step__bar",
      {},
      btn({
        label: "Back to board",
        variant: "quiet",
        onclick: () => current.navigate("map"),
      }),
      el(
        "div.step__bar-next",
        {},
        !complete &&
          !locked &&
          el("span.step__bar-hint", {}, "Save your link below to unlock Next"),
        btn({
          label: nextLabel,
          variant: "solid",
          disabled: locked || !complete,
          title: complete ? undefined : "Finish this step first",
          onclick: () => {
            if (!complete) return;
            if (advance) current.navigate("map", advance.id);
            else current.navigate("map");
          },
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
    if (!/^[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(mid)) {
      article.innerHTML = "<p>That reading id is not allowed.</p>";
      return;
    }
    try {
      const res = await fetch(new URL(`../../../read/modules/${mid}.md`, import.meta.url), { cache: "no-store" });
      if (!res.ok) throw new Error("missing");
      const text = await res.text();
      const title = text.match(/^#\s+(.+)$/m)?.[1];
      if (title) {
        const h1 = root.querySelector(".step__title");
        if (h1) h1.textContent = title;
      }
      article.innerHTML = renderMarkdown(text);
    } catch {
      article.innerHTML =
        "<p>That file is not on disk yet. If this is a graph module, sync reading before deploy.</p>";
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
            el("span.rv__state", {}, review.state === "returned" ? "returned" : "in review")
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
      el("a.room__link", { href: node.proof?.url ?? "#", target: "_blank", rel: "noopener" }, node.proof?.url ?? "evidence"),
      node.proof?.note && el("p.room__note", {}, node.proof.note),
      node.proof?.at && el("span.room__at", {}, `attached ${node.proof.at}`)
    );
  }

  function evidenceForm(node) {
    const url = field({
      label: "The link",
      id: `ev-url-${node.id}`,
      type: "url",
      value: node.proof?.url ?? "",
      placeholder: "https://",
      hint: "Paste the link. That is what marks this step done.",
    });
    const note = field({
      label: "What should I look at",
      id: `ev-note-${node.id}`,
      value: node.proof?.note ?? "",
      placeholder: "What should I look at hardest?",
      textarea: true,
    });

    return el(
      "form.room__form",
      {
        onsubmit: (event) => {
          event.preventDefault();
          const value = url.input.value.trim();
          if (!/^https?:\/\/.+/.test(value)) {
            toast("That needs to be a URL a stranger can open.", "warn");
            return;
          }
          const warn = welcomeSubmitWarn(node, current.state.student);
          if (warn) {
            toast(warn, "warn");
            return;
          }
          const nextState = current.store.submitEvidence(node.id, value, note.input.value.trim());
          const next = nextUp(nextState.graph);
          if (node.id === "or.start") {
            toast(
              next
                ? `Orientation lit. Next open: ${next.title}.`
                : "Orientation lit. Open the map for what is current."
            );
          } else {
            toast(`Step ${String(node.n).padStart(2, "0")} saved.`);
          }
        },
      },
      url.node,
      note.node,
      el(
        "div.room__acts",
        {},
        btn({ label: node.status === STATUS.LIT ? "Update the link" : "Mark this step done", variant: "solid", type: "submit" }),
        node.status === STATUS.LIT &&
          btn({
            label: "Remove the link",
            variant: "quiet",
            onclick: (event) => {
              event.preventDefault();
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
          return el("span.chip2", {}, req ? `${String(req.n).padStart(2, "0")} ${req.title}` : id);
        }),
        !(node.requires ?? []).length && el("span.muted", {}, "no prerequisites")
      )
    );
  }

  paint();

  return {
    node: root,
    update(nextCtx, nextNodeId = currentNodeId, nextModuleId = null) {
      current = nextCtx;
      currentNodeId = nextNodeId ?? currentNodeId;
      currentModuleId = nextModuleId ?? null;
      paint();
    },
  };
}
