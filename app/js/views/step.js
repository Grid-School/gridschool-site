/**
 * Full step page. Replaces the map modal: everything for one node lives here.
 * Optional long modules (nanograph, briefs) open as a subview under the same step.
 *
 * Route: #/map/<nodeId> or #/map/<nodeId>/m/<module/path/segments>
 */

import { el, mount } from "../dom.js";
import { btn, placeholder, toast, field } from "../ui.js";
import { STATUS, blockedBy, progress, isSpine } from "../graph/model.js";
import { taskRow, reviewScores } from "./parts.js";
import { statusLabel, trackLabel, ccvvLabel, RULE } from "../copy.js";
import { videoCard, resolveMedia } from "./video.js";
import { handoffDisclosure } from "./handoff.js";
import { TASK_STATE } from "../tasks.js";
import { renderMarkdown } from "../markdown.js";

const FALLBACK_VIDEO = {
  title: "Stream test · Big Buck Bunny (CC)",
  mins: 1,
  path: "test-bbb",
  watchWhen: "Test clip on our CDN. Play, scrub, and switch quality. Real lesson films replace this.",
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
        btn({ label: "Back to map", variant: "solid", onclick: () => current.navigate("map") })
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
    const family = (graph.families ?? []).find((item) => item.id === node.family);
    const prog = progress(graph);
    const track = trackLabel(node.track);
    const count = isSpine(node)
      ? ` · ${prog.spine.lit} of ${prog.spine.total} required`
      : "";
    const weeks =
      Array.isArray(node.weeks) && node.weeks.length
        ? ` · week ${node.weeks[0] === node.weeks[1] ? node.weeks[0] : `${node.weeks[0]}–${node.weeks[1]}`}`
        : "";
    return `${track}${count} · ${family?.label ?? "Step"} · ${String(node.n).padStart(2, "0")} · ${statusLabel(node.status)}${weeks}`;
  }

  function stepView(node, graph, student) {
    const isAdmin = current.role === "admin";
    const blockers = blockedBy(graph, node.id);
    const canTurnIn = node.status === STATUS.OPEN || node.status === STATUS.LIT;
    // Planned films still get a poster + playable placeholder (CDN test clip) so
    // the step has the same shape once real media lands.
    const filmed = Boolean(node.video && resolveMedia(node.video));
    const video = filmed ? node.video : node.video ? { ...FALLBACK_VIDEO, title: node.video.title || FALLBACK_VIDEO.title, mins: node.video.mins || FALLBACK_VIDEO.mins, watchWhen: node.video.watchWhen || FALLBACK_VIDEO.watchWhen } : null;
    const card = video
      ? videoCard({
          title: video.title,
          mins: video.mins,
          youtube: video.youtube,
          path: video.path,
          thumb: video.thumb,
          watchWhen: filmed
            ? video.watchWhen ?? "Watch this, then do the steps."
            : "Placeholder stream until this lesson is filmed. Play to confirm the player; the real film replaces this.",
          startOpen: true,
        })
      : null;

    return el(
      "div.step",
      {},
      el(
        "header.step__head",
        {},
        el(
          "div.step__nav",
          {},
          btn({ label: "← Back to map", variant: "quiet", onclick: () => current.navigate("map") }),
          el("span.step__rule", {}, RULE)
        ),
        el("b.eyebrow", {}, stepEyebrow(node, graph)),
        el("h1.step__title", {}, node.title),
        el(
          "p.step__lead",
          {},
          "Leave able to inherit a messy system, change it, prove it, and defend it. Everything for this step is on this page. Optional deeper reading appears only if named below."
        )
      ),
      el(
        "section.step__do",
        {},
        el("b.eyebrow", {}, "Do this step"),
        el("p.step__evidence", {}, node.evidence)
      ),
      node.why
        ? el("section.step__why", {}, el("b.eyebrow", {}, "Why"), el("p", {}, node.why))
        : null,
      card
        ? el(
            "section.step__video",
            {},
            el("b.eyebrow", {}, filmed ? "Watch" : "Watch · placeholder until filmed"),
            el("p.step__vidtitle", {}, `${node.video?.title || video.title} · ${node.video?.mins || video.mins} min`),
            node.video?.watchWhen && el("p.muted", {}, node.video.watchWhen),
            card.node
          )
        : null,
      node.lesson?.length
        ? el(
            "section.step__lesson",
            {},
            el("b.eyebrow", {}, "Understand"),
            node.lesson.map((section) =>
              el(
                "section.lesson__sec",
                {},
                section.h && el("h2", {}, section.h),
                (section.p ?? []).map((paragraph) => el("p", {}, paragraph))
              )
            )
          )
        : node.lessonLocked
          ? el(
              "section.step__lesson",
              {},
              el("b.eyebrow", {}, "Understand"),
              el(
                "p.room__hint",
                {},
                "The full lesson text lives here. It unlocks with the access key you receive at enrollment. The tasks and the done-when below are real; only the teaching is held back."
              )
            )
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
            el("b.eyebrow", {}, "Do the work"),
            el("p.room__hint", {}, "Check a box when its Done when is true. Open Show steps only if you want the how-to."),
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
        el("b.eyebrow", {}, "Turn this in"),
        el("p.room__done", {}, el("b", {}, "Done when "), node.evidence),
        node.ccvv?.length || node.reviewFor
          ? el(
              "div.room__grade",
              {},
              node.ccvv?.length
                ? el("p.room__ccvv", {}, el("b", {}, "Graded on "), node.ccvv.map(ccvvLabel).join(" · "))
                : null,
              node.reviewFor ? el("p.room__reviewfor", {}, el("b", {}, "Aden looks for "), node.reviewFor) : null
            )
          : null,
        blockers.length
          ? el(
              "div.room__blocked",
              {},
              el("p.room__hint", {}, "This step stays locked until the ones below are done."),
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
              "Not required to light this step. Opens on this board under this step, not a separate school."
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
      isAdmin ? adminBlock(node, graph) : null
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
          current.store.submitEvidence(node.id, value, note.input.value.trim());
          toast(`Step ${String(node.n).padStart(2, "0")} saved.`);
        },
      },
      url.node,
      note.node,
      el(
        "div.room__acts",
        {},
        btn({ label: node.status === STATUS.LIT ? "Update the link" : "Save the link", variant: "solid", type: "submit" }),
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
