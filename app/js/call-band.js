/**
 * The 1:1 when it is within a day: a thin band above every view saying when,
 * and the way in. The join button turns solid ten minutes before and stays
 * until the call's end. Same record and math as the calendar (time.js).
 */

import { el, mount } from "./dom.js?v=022c412-202610100125";
import { btn } from "./ui.js?v=022c412-202610100125";
import { nextCall, fmtTime, relativeDay } from "./time.js?v=022c412-202610100125";
import { joinIsLive, zoneLabel } from "./call-slot.js?v=022c412-202610100125";

const DAY_MS = 24 * 3600000;

export function createCallBand(getState) {
  const root = el("div.callstrip", { hidden: true, role: "status" });

  function render(state = getState()) {
    const now = new Date();
    const call = state?.cohort && state.slug !== "demo" ? nextCall(state.cohort, state.student, now) : null;
    const soon = Boolean(call) && call.at.getTime() - now.getTime() < DAY_MS;
    root.hidden = !soon;
    if (!soon) return;
    const live = joinIsLive(call.at, call.mins ?? 0, now);
    const when = live ? "now" : `${relativeDay(call.date, now)} at ${fmtTime(call.time)} ${zoneLabel(call.tz, call.at)}`;
    root.classList.toggle("is-live", live);
    mount(
      root,
      el("span.callstrip__when", {}, el("b", {}, "Your 1:1 "), when, call.where ? ` · ${call.where}` : ""),
      call.href
        ? btn({ label: "Join your 1:1", variant: live ? "solid" : "quiet", href: call.href, target: "_blank" })
        : el("span.callstrip__note", {}, "Aden sends the link in Discord.")
    );
  }

  // The clock moves even when the state does not.
  setInterval(() => render(), 30000);
  return { root, render };
}
