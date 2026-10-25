/**
 * The studio (server/studio_api.py), opened from a step on the map: no tab of its own.
 *
 *   #/studio/projects[/<taskId>]  five practice projects written for them; the one they pick becomes a step
 *   #/studio/posts[/<taskId>]     their voice doc, five post ideas from their week, drafts in their voice
 *
 * Done-for-you: we generate, they pick, edit and ship. When a step's task opened the studio, finishing
 * the work here (picking, posting) checks that task too.
 */

import { el, mount } from "../dom.js?v=d177a03-202610252138";
import { btn, toast } from "../ui.js?v=d177a03-202610252138";
import { nodeRail, nodeIntro } from "./node-rail.js?v=d177a03-202610252138";
import * as api from "../studio-remote.js?v=d177a03-202610252138";
import * as model from "../studio-model.js?v=d177a03-202610252138";

function wait(text) {
  return el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, text));
}

export function renderStudio(ctx, toolArg, taskArg) {
  const node = el("div.view.view--resume.view--studio");
  let slug = ctx.state.slug;
  let tool = model.toolOf(toolArg);
  let taskId = taskArg || null;
  let rec = null;
  let here = null;
  let busy = "";
  let error = "";
  let openDraft = null;
  let state = ctx.state;

  async function load() {
    if (!api.studioReady()) {
      error = "Sign in to use this. Everything here is saved to your account.";
      return render();
    }
    try {
      take(await api.loadStudio(slug));
    } catch (e) {
      error = e.message;
      render();
    }
  }

  function take(next) {
    rec = { ...(rec || {}), ...next, studio: next.studio ?? rec?.studio ?? {} };
    error = "";
    render();
  }

  async function run(label, fn, after) {
    if (busy) return;
    busy = label;
    render();
    try {
      const out = await fn();
      if (out) take(out);
      after?.(out);
    } catch (e) {
      toast(e.message, "warn", { ms: 7000 });
    } finally {
      busy = "";
      render();
    }
  }

  const go = (id) => {
    here = id;
    render();
    node.querySelector(".rz__main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  /** The step task that opened the studio, checked when the work it asks for is done here. */
  function checkTask({ url = "" } = {}) {
    const found = model.launchingTask(state.graph, taskId);
    if (!found) return false;
    const answers = model.completionFor(found.task, { url });
    if (!answers) return false;
    ctx.store.setTaskState(found.task.id, "done", Object.keys(answers).length ? answers : null);
    return true;
  }

  /* ---------- Projects ---------- */
  function projectIdeasBody() {
    const s = rec.studio;
    const hints = model.seedHints(rec.seeds);
    const titles = rec.seeds?.titles ?? [];
    return [
      nodeIntro(
        (s.projects?.ideas ?? []).length ? "Want a different five?" : "Five practice projects, written for you",
        titles.length
          ? `Each one is aimed at ${titles.slice(0, 2).join(" or ")}, ships in days, and proves something your resume can't prove yet.`
          : "Each one ships in days and proves something your resume can't prove yet."
      ),
      hints.length ? el("p.rz__why", {}, `They get sharper once your map knows ${hints.join(", ")}. Answer those questions on your map any time.`) : null,
      el("div.rz__row", {},
        btn({ label: (s.projects?.ideas ?? []).length ? "Make a fresh five" : "Write my five ideas", variant: "solid", disabled: Boolean(busy),
          onclick: () => run("Writing five project ideas from your record. About 30 seconds.", () => api.makeProjects(slug), () => (here = "pick")) }),
        el("span.rz__meta", {}, model.weekLine(rec.week, "projects", "rounds"))),
    ];
  }

  function projectCard(p, picked) {
    const isPicked = picked?.id === p.id;
    return el("li.rz__line.st__card", { class: isPicked ? "is-ok" : null },
      el("h3.st__title", {}, p.title, el("span.st__days", {}, ` · about ${p.days} ${p.days === 1 ? "day" : "days"}`)),
      el("p.rz__linetext", {}, p.pitch),
      p.why ? el("p.st__line", {}, el("b", {}, "Why it matters: "), p.why) : null,
      p.proves ? el("p.st__line", {}, el("b", {}, "What it proves: "), p.proves) : null,
      (p.stack ?? []).length ? el("p.st__line", {}, el("b", {}, "Stack: "), p.stack.join(", ")) : null,
      el("ol.st__steps", {}, (p.steps ?? []).map((step) => el("li", {}, step))),
      el("div.rz__row", {},
        isPicked
          ? btn({ label: "Open it on your map", variant: "solid", onclick: () => openOnMap(picked.node) })
          : btn({ label: "Pick this one", variant: picked ? "ghost" : "solid", disabled: Boolean(busy),
            onclick: () => run("Putting it on your map.", () => api.pickProject(slug, p.id), (out) => {
              const checked = checkTask();
              toast(checked ? "It's on your map, and this step is checked." : "It's on your map.", "ok");
              if (out?.node) setTimeout(() => openOnMap(out.node), 900);
            }) })));
  }

  /** The new step lives in a new version of the map, so the board reloads onto it. */
  function openOnMap(nodeId) {
    location.hash = `#/map/${nodeId}`;
    location.reload();
  }

  function projectPickBody() {
    const s = rec.studio;
    const ideas = s.projects?.ideas ?? [];
    if (!ideas.length) return projectIdeasBody();
    const picked = s.projects?.picked;
    return [
      nodeIntro("Pick the one you'd enjoy building", "It becomes a step on your map with this brief. Change anything in it once it's there; it's yours."),
      el("ul.rz__lines", {}, ideas.map((p) => projectCard(p, picked))),
      picked && !ideas.some((p) => p.id === picked.id) ? el("p.rz__why", {}, `On your map now: ${picked.title}.`) : null,
    ];
  }

  /* ---------- Posts ---------- */
  function voiceBody() {
    const voice = rec.studio.voice;
    const paste = el("textarea.rz__text", { rows: 8, placeholder: "Paste two or three things you wrote: posts, long messages, a paragraph from anything. Put a line with three dashes (---) between them." });
    const samples = () => paste.value.split(/\n-{3,}\n/).map((t) => t.trim()).filter(Boolean);
    const parts = [
      nodeIntro(model.hasVoice(rec.studio) ? "Your voice doc" : "Your voice doc, from your own writing",
        "Every draft follows it, so posts sound like you. It comes from what you wrote."),
    ];
    if (model.hasVoice(rec.studio)) {
      const edit = el("textarea.rz__text", { rows: 7 }, voice.edited || [voice.summary, ...(voice.do ?? []).map((d) => `Do: ${d}`), ...(voice.avoid ?? []).map((a) => `Avoid: ${a}`)].join("\n"));
      parts.push(
        el("label.st__label", {}, "Read it, and change anything that doesn't sound like you"),
        edit,
        el("div.rz__row", {},
          btn({ label: "This reads like me", variant: "solid", disabled: Boolean(busy),
            onclick: () => run("Saving your voice doc.", () => api.editVoice(slug, edit.value), () => {
              if (taskId?.endsWith(".voice") && checkTask()) toast("Saved, and this step is checked.", "ok");
              else toast("Saved. Drafts follow it from now on.", "ok");
              here = "ideas";
            }) })),
        el("details.st__more", {}, el("summary", {}, "Rebuild it from other writing"), paste,
          el("div.rz__row", {}, btn({ label: "Rebuild my voice doc", variant: "ghost", disabled: Boolean(busy),
            onclick: () => run("Reading how you write.", () => api.buildVoice(slug, samples())) }))));
    } else {
      parts.push(
        rec.seeds?.voiceSample ? el("p.rz__why", {}, "Your answers already include a writing sample. Add more here, or build the voice doc from that sample alone.") : null,
        paste,
        el("div.rz__row", {},
          btn({ label: "Build my voice doc", variant: "solid", disabled: Boolean(busy),
            onclick: () => run("Reading how you write. About 15 seconds.", () => api.buildVoice(slug, samples())) }),
          el("span.rz__meta", {}, model.weekLine(rec.week, "voice", "rebuilds"))));
    }
    return parts;
  }

  function postIdeasBody() {
    const ideas = rec.studio.posts?.ideas ?? [];
    const hook = el("input.rz__input", { placeholder: "Or your own idea: the first line" });
    const angle = el("textarea.rz__text", { rows: 3, placeholder: "What the post says, in a sentence or two" });
    return [
      nodeIntro(ideas.length ? "Post ideas from your week" : "Five post ideas from your week",
        "Built from the steps you finished, your practice project and what you're into. Pick one and the drafter writes it in your voice."),
      model.hasVoice(rec.studio) ? null : el("p.rz__why", {}, "Tip: build your voice doc first, so drafts sound like you."),
      ideas.length ? el("ul.rz__lines", {}, ideas.map((i) => el("li.rz__line.st__card", {},
        el("p.st__shape", {}, model.SHAPE_LABEL[i.shape] ?? ""),
        el("h3.st__title", {}, i.hook),
        el("p.rz__linetext", {}, i.angle),
        i.from ? el("p.rz__was", {}, `From: ${i.from}`) : null,
        el("div.rz__row", {}, btn({ label: "Draft this one", variant: "solid", disabled: Boolean(busy),
          onclick: () => run("Drafting it in your voice. About 15 seconds.", () => api.draftFromIdea(slug, i.id), (out) => { openDraft = out?.studio?.posts?.drafts?.[0]?.id ?? null; here = "drafts"; }) }))))) : null,
      el("div.rz__row", {},
        btn({ label: ideas.length ? "Five fresh ideas" : "Write my five ideas", variant: ideas.length ? "ghost" : "solid", disabled: Boolean(busy),
          onclick: () => run("Reading your week for post ideas. About 20 seconds.", () => api.makePostIdeas(slug)) }),
        el("span.rz__meta", {}, model.weekLine(rec.week, "post-ideas", "rounds"))),
      el("details.st__more", {}, el("summary", {}, "Draft your own idea"), hook, angle,
        el("div.rz__row", {}, btn({ label: "Draft it", variant: "ghost", disabled: Boolean(busy),
          onclick: () => run("Drafting it in your voice.", () => api.draftOwnIdea(slug, hook.value, angle.value), (out) => { openDraft = out?.studio?.posts?.drafts?.[0]?.id ?? null; here = "drafts"; }) }))),
    ];
  }

  function draftCard(d) {
    const open = openDraft === d.id || (!openDraft && d === (rec.studio.posts?.drafts ?? [])[0] && d.status !== "posted");
    if (!open) {
      return el("li.rz__line.st__card", { class: d.status === "posted" ? "is-ok" : null },
        el("p.st__shape", {}, d.status === "posted" ? "Posted" : "Draft"),
        el("h3.st__title", {}, d.hook || d.text.split("\n")[0]),
        el("div.rz__row", {}, btn({ label: d.status === "posted" ? "Read it" : "Open draft", variant: "quiet", onclick: () => { openDraft = d.id; render(); } })));
    }
    const text = el("textarea.rz__text.st__draft", { rows: 12 }, d.text);
    const left = el("p.rz__why");
    const showLeft = () => {
      const marks = model.placeholdersIn(text.value);
      left.textContent = marks.length ? `Fill ${marks.length === 1 ? "this bracket" : `these ${marks.length} brackets`} with what really happened: ${marks.join(" ")}` : "Every bracket is filled. Read it once more as a stranger would.";
      left.className = marks.length ? "rz__why st__warn" : "rz__why";
    };
    text.addEventListener("input", showLeft);
    showLeft();
    const url = el("input.rz__input", { placeholder: "Link to the post once it's live (https://...)", value: d.url || "" });
    const save = () => api.saveDraft(slug, d.id, text.value);
    return el("li.rz__line.st__card.is-open", { class: d.status === "posted" ? "is-ok" : null },
      el("p.st__shape", {}, d.status === "posted" ? "Posted" : "Your draft"),
      text,
      left,
      (d.problems ?? []).length ? el("p.rz__why.st__warn", {}, `Check: ${d.problems.join("; ")}.`) : null,
      el("div.rz__row", {},
        btn({ label: "Save", variant: "ghost", disabled: Boolean(busy), onclick: () => run("Saving.", save, () => toast("Saved.", "ok")) }),
        btn({ label: "Copy", variant: "solid", onclick: async () => {
          if (model.placeholdersIn(text.value).length) toast("Some brackets are still empty. Fill them before you post.", "warn");
          try {
            await navigator.clipboard.writeText(text.value);
            toast("Copied. Paste it into a new LinkedIn post.", "ok");
          } catch {
            text.select();
            toast("Select all and copy it from the box.", "warn");
          }
          if (text.value !== d.text) run("Saving.", save);
        } })),
      el("label.st__label", {}, "Posted it?"),
      url,
      el("div.rz__row", {},
        btn({ label: d.status === "posted" ? "Update the link" : "I posted it", variant: d.status === "posted" ? "quiet" : "solid", disabled: Boolean(busy),
          onclick: () => run("Saving.", async () => {
            if (text.value !== d.text) await save();
            return api.markPosted(slug, d.id, url.value.trim());
          }, () => {
            const checked = checkTask({ url: url.value.trim() });
            toast(checked ? "Nice. This step's task is checked." : "Nice. Marked as posted.", "ok");
          }) })));
  }

  function draftsBody() {
    const drafts = rec.studio.posts?.drafts ?? [];
    if (!drafts.length) return postIdeasBody();
    return [
      nodeIntro("Your drafts", "Make each one yours: fill the brackets, cut anything that isn't true, change any line that doesn't sound like you. Then copy, post, and paste the link back."),
      el("ul.rz__lines", {}, drafts.map(draftCard)),
      el("div.rz__row", {}, btn({ label: "More ideas", variant: "quiet", onclick: () => go("ideas") }),
        el("span.rz__meta", {}, model.weekLine(rec.week, "draft", "drafts"))),
    ];
  }

  function render() {
    if (error && !rec) {
      mount(node, el("div.rz", {}, el("p.rz__empty", {}, error), btn({ label: "Back to the map", variant: "quiet", onclick: () => ctx.navigate("map") })));
      return;
    }
    if (!rec) {
      mount(node, el("div.rz", {}, wait("Opening your studio.")));
      return;
    }
    const s = rec.studio;
    const posts = tool === "posts";
    const nodes = posts ? model.POST_NODES : model.PROJECT_NODES;
    const at = nodes.some((n) => n.id === here) ? here : posts ? model.autoPostNode(s) : model.autoProjectNode(s);
    const done = posts ? model.postDone(s) : model.projectDone(s);
    const body = posts ? { voice: voiceBody, ideas: postIdeasBody, drafts: draftsBody }[at]() : { ideas: projectIdeasBody, pick: projectPickBody }[at]();
    const launched = model.launchingTask(state.graph, taskId);
    const head = el("header.rz__head", {},
      el("div", {}, el("b.eyebrow", {}, posts ? "Posts" : "Practice project"),
        el("h1.rz__title", {}, posts ? "Posts in your voice, from your week" : "A practice project aimed at the job you want")),
      launched ? el("p.rz__meta", {}, `From your step: ${launched.node.title}`) : null,
      btn({ label: "← Map", variant: "quiet", onclick: () => ctx.navigate("map", ...(launched ? [launched.node.id] : [])) }));
    const main = el("section.rz__main", {}, nodeRail({ nodes, done, here: at, onGo: go, label: posts ? "Post steps" : "Project steps" }),
      el("div.rz__card", { "aria-busy": busy ? "true" : null }, busy ? wait(busy) : body));
    mount(node, el("div.rz", {}, head, main));
  }

  render();
  load();
  return {
    node,
    update(next, nextTool, nextTask) {
      state = next.state;
      const changedTool = model.toolOf(nextTool) !== tool || (nextTask || null) !== taskId;
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        rec = null;
        load();
      }
      if (changedTool) {
        tool = model.toolOf(nextTool);
        taskId = nextTask || null;
        here = null;
        openDraft = null;
        render();
      }
    },
  };
}
