/**
 * The headline and About, drafted from the resume they built (positioning_api.py), with copy buttons, the
 * questions to answer before posting, and a draft to compare when the coach wrote theirs. One piece, used by
 * the "Your LinkedIn" step (views/step-checklist.js) and, on maps without that step, Jobs → Profile.
 *
 *   const card = createPositioningCard({ getCtx, onTitles });  card.node; card.render();
 */

import { el, mount } from "../dom.js?v=1fa97ed-202610310654";
import { btn, copy, toast } from "../ui.js?v=1fa97ed-202610310654";
import { careerOf } from "../search.js?v=1fa97ed-202610310654";
import { draftPositioning, radarReady } from "../roles-remote.js?v=1fa97ed-202610310654";
import { isProgressReadOnly } from "../store.js?v=1fa97ed-202610310654";

export function createPositioningCard({ getCtx, onTitles = null, onDrafted = null }) {
  const node = el("div.poscard");
  let state = { busy: false, result: null, error: "" };

  async function run() {
    const ctx = getCtx();
    if (state.busy || isProgressReadOnly()) return;
    state = { busy: true, result: null, error: "" };
    render();
    try {
      const result = await draftPositioning(ctx.state.slug);
      state = { busy: false, result, error: "" };
      toast(result.saved ? "Your headline and About are ready." : "Your draft is ready to compare.");
      if (result.titles?.length) onTitles?.(result.titles);
      if (result.saved) queueMicrotask(() => onDrafted?.());
    } catch (error) {
      state = { busy: false, result: null, error: error.message };
    }
    render();
  }

  function render() {
    const ctx = getCtx();
    const student = ctx.state.student;
    const career = careerOf(student);
    const ro = isProgressReadOnly();
    const result = state.result;
    const mine = Boolean(student?.career?.auto?.positioning) || Boolean(result?.saved);
    const headline = result?.saved ? result.draft.headline : career.headline;
    const about = result?.saved ? result.draft.about : career.about;
    const status = state.busy
      ? el("p.muted", {}, "Drafting from your resume. This takes up to a minute.")
      : state.error
        ? el("p.poscard__error", {}, state.error)
        : result
          ? el("p.muted", {}, result.note)
          : null;
    const draftBtn = ro || !radarReady()
      ? null
      : btn({
          label: state.busy ? "Drafting…" : !headline ? "Draft my headline and About" : mine ? "Draft again" : "Draft my own to compare",
          variant: headline ? "quiet" : "solid",
          onclick: () => run(),
        });
    const compare =
      result && !result.saved
        ? el(
            "div.sstory",
            {},
            el("b", {}, "Your draft"),
            result.draft.headline ? el("p.sstory__headline", {}, result.draft.headline) : null,
            el(
              "div.row",
              {},
              result.draft.headline ? btn({ label: "Copy headline", variant: "ghost", onclick: () => copy(result.draft.headline, "Headline copied.") }) : null,
              result.draft.about ? btn({ label: "Copy About", variant: "quiet", onclick: () => copy(result.draft.about, "About copied.") }) : null
            )
          )
        : null;
    const confirm = (result?.draft?.confirm ?? (mine ? career.confirm : [])).filter(Boolean);
    const check = confirm.length ? el("div.sstory__part", {}, el("b", {}, "Answer these for yourself before you post"), el("ul", {}, confirm.map((q) => el("li", {}, q)))) : null;
    if (!headline) {
      mount(node, el("p.muted", {}, "Written from the resume you built. About a minute, then make it sound like you."), el("div.row", {}, draftBtn), status);
      return;
    }
    mount(
      node,
      el("p.poscard__headline", {}, headline),
      about ? el("p.poscard__about", {}, about) : null,
      el(
        "div.row",
        {},
        btn({ label: "Copy headline", variant: "ghost", onclick: () => copy(headline, "Headline copied.") }),
        about ? btn({ label: "Copy About", variant: "ghost", onclick: () => copy(about, "About copied.") }) : null,
        draftBtn
      ),
      status,
      check,
      compare
    );
  }

  render();
  /** The headline as it stands now: a draft just saved, else the one on the record. The page's copy of the
   * record doesn't hear about a draft saved on the server until the next sync, so callers ask here. */
  const headline = () => (state.result?.saved ? state.result.draft.headline : careerOf(getCtx().state.student).headline) || "";
  return { node, render, headline };
}
