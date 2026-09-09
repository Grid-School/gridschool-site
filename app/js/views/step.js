/**
 * Full step page. Everything for one node lives here: lesson, required
 * reading (opens in a modal over the page), tasks, the link. A thin column on
 * the right (step-progress.js) shows the parts filling bottom-up; Save
 * unlocks once the reading is done, Next once the link is saved.
 *
 * Route: #/map/<nodeId> or #/map/<nodeId>/m/<module/path/segments> (the
 * reading as a shareable page).
 */

import { el, mount } from "../dom.js";
import { btn, placeholder, toast, field } from "../ui.js";
import { STATUS, blockedBy, progress, isSpine, nextUp } from "../graph/model.js";
import { taskRow, reviewScores } from "./parts.js";
import { statusLabel, trackLabel, ccvvLabel, RULE } from "../copy.js";
import { videoCard, resolveMedia, filmSummary } from "./video.js";
import { handoffDisclosure } from "./handoff.js";
import { TASK_STATE } from "../tasks.js";
import { renderMarkdown, splitTitle } from "../markdown.js";
import { hydrateMermaid, mermaidSource } from "../mermaid.js";
import { provesBlock } from "./proves.js";
import { modeLine } from "./mode.js";
import { artifactLine } from "./artifact.js";
import { refsBlock } from "./refs.js";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js";
import { electiveBlock } from "./elective.js";
import { signoffNotice, submitLabel, linkHint } from "./signoff.js";
import { stepSpine, isStepComplete, readyToSave, readFlag } from "./step-progress.js";
import { createReadingModal } from "./reading-modal.js";
import { bindDraft, clearDraft } from "../drafts.js";
import { registerLeaveGuard, clearLeaveGuard, isLeaveDirty } from "../leave-guard.js";
import { isPreviewMedia } from "../preview-mode.js";
import { siteOverridesDoc, dropSiteOverridesCache } from "../../../js/site-overrides.js";

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
    mount(root, stepView(node, graph, student), reading.layer);
    hydrateMermaid(root);
  }

  function stepEyebrow(node, graph) {
    if (node.id === "or.start") return "Week 1 · Orientation";
    const family = (graph.families ?? []).find((item) => item.id === node.family);
    const prog = progress(graph);
    const track = isSpine(node) ? `${trackLabel(node.track)} ${prog.spine.lit} of ${prog.spine.total}` : trackLabel(node.track);
    /* Weeks are typical pace inside the intensive sequence, not a calendar
       promise: the residency runs a year and nothing on the map expires. */
    const weeks =
      Array.isArray(node.weeks) && node.weeks.length
        ? ` · week ${node.weeks[0] === node.weeks[1] ? node.weeks[0] : `${node.weeks[0]} to ${node.weeks[1]}`}`
        : "";
    return `${track} · ${family?.label ?? "Step"} · ${String(node.n).padStart(2, "0")} · ${statusLabel(node.status)}${weeks}`;
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
    const filmed = Boolean(node.video && resolveMedia(node.video));
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
          el(
            "div.step__nav",
            {},
            btn({ label: "← Board", variant: "quiet", onclick: () => current.navigate("map") })
          ),
          el("b.eyebrow", {}, statusLabel(node.status)),
          el("h1.step__title", {}, node.title),
          el("p.step__lead", {}, "Opens after the steps before it. Read ahead if you like."),
          artifactLine(node)
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
              node.lesson.map((section) => lessonSection(section))
            )
          : null,
        refsBlock(node, { filmed }),
        stepBar({ node, graph, student, locked: true })
      );
    }

    const spine = stepSpine({ node, student, store: current.store, onChange: () => paint() });

    return el(
      "div.step",
      { class: welcome ? "step--welcome" : "" },
      spine,
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
        welcome ? null : modeLine(node),
        welcome ? null : artifactLine(node)
      ),
      electiveBlock({ node, store: current.store }),
      card || (preview && !filmed && node.video?.summary)
        ? el(
            "section.step__video",
            {},
            card ? card.node : null,
            preview ? filmSummary({ summary: node.video?.summary, filmed }) : null
          )
        : null,
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
            when: "You can still look around. The work opens when this step does.",
          })
        : null,
      node.tasks?.length
        ? el(
            "section.step__tasks",
            {},
            el("b.eyebrow", {}, "Do the work"),
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
      btn({
        label: "Ask the Coach",
        variant: "quiet",
        title: "Talk the next move through",
        onclick: () => current.navigate("coach"),
      }),
      el(
        "div.step__bar-next",
        {},
        btn({
          label: nextLabel,
          variant: "solid",
          disabled: locked || !complete,
          title: complete ? undefined : "Opens when the link is saved",
          onclick: () => {
            if (!complete) return;
            if (advance) current.navigate("map", advance.id);
            else current.navigate("map");
          },
        })
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
    if (!/^[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(mid)) {
      article.innerHTML = "<p>That reading id is not allowed.</p>";
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
      label: "What should I look at",
      id: `ev-note-${node.id}`,
      value: savedNote,
      placeholder: "What should I look at hardest?",
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
            toast("That needs to be a URL a stranger can open.", "warn");
            return;
          }
          if (!readyToSave(node, current.state.student)) {
            toast("Finish the reading first. It is short and it is the point.", "warn");
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
        btn({
          label: submitLabel(node, node.status === STATUS.LIT || node.awaitingSignoff),
          variant: "solid",
          type: "submit",
          disabled: !ready,
          title: ready ? undefined : "Finish the reading first",
        }),
        !ready && el("span.room__gate", {}, "Unlocks after the reading."),
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
          return el("span.chip2", {}, req ? `${String(req.n).padStart(2, "0")} ${req.title}` : id);
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
        "Saves for every board on next load. Clearing all fields removes the override and the map falls back to the curriculum file. Lesson text is edited in the repo, not here."
      );

      async function save(entry) {
        const { fetchSiteOverrides, saveSiteOverrides } = await import("../persist-admin.js");
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
