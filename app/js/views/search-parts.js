/**
 * The job search, drawn. Shared by the student's Hire page and the desk's
 * Search tab, so both read the same picture: the route to a hire as six rings
 * (Findable → Applying → Replies → Screens → Interviews → Offer), this week's
 * numbers against the targets, eight weeks of volume, and one sentence on
 * where it stalls. The rules live in search.js; this file only draws them.
 */

import { el } from "../dom.js?v=15fea56-202610100117";
import { STATUS } from "../graph/model.js?v=15fea56-202610100117";
import {
  STAGES,
  KINDS,
  funnel,
  thisWeek,
  weeklySeries,
  diagnose,
  searchOf,
  careerOf,
  stageIndex,
} from "../search.js?v=15fea56-202610100117";

/** Presence steps on their own map: the "findable" ring lights when they are all done. */
export function presenceProgress(graph) {
  const nodes = (graph?.nodes ?? []).filter((node) => node.family === "presence");
  return { lit: nodes.filter((node) => node.status === STATUS.LIT).length, total: nodes.length };
}

function findable({ student, graph }) {
  const career = careerOf(student);
  const presence = presenceProgress(graph);
  const story = Boolean(career.headline || career.story.who);
  const profile = Boolean(career.linkedin || searchOf(student).linkedin);
  const live = Boolean(searchOf(student).profileAt);
  const lit = live || (presence.total > 0 && presence.lit === presence.total) || (story && profile && presence.lit > 0);
  const detail = live ? "profile live" : presence.total ? `${presence.lit}/${presence.total} profile steps` : story ? "story set" : "no story yet";
  return { lit, partial: !lit && (story || presence.lit > 0), detail };
}

/** The route: one ring per stage, lit when reached, the stall ring marked. */
export function searchRoute({ student, graph, now = new Date() }) {
  const { apps } = searchOf(student);
  const counts = funnel(apps);
  const stall = diagnose({ student, now });
  const find = findable({ student, graph });
  const stallAt = { findable: 0, start: 1, volume: 1, replies: 2, screens: 3, interviews: 4, offers: 5 }[stall.id];
  const rings = [
    { id: "findable", label: "Findable", count: null, detail: find.detail, lit: find.lit, partial: find.partial },
    ...counts.map((stage, index) => ({
      id: stage.id,
      label: index === 0 ? "Applying" : stage.label === "Replied" ? "Replies" : stage.label === "Screen" ? "Screens" : stage.label === "Interview" ? "Interviews" : stage.label,
      count: stage.count,
      lit: stage.count > 0,
      partial: false,
    })),
  ];
  return el(
    "div.sroute",
    { role: "list", "aria-label": "Where the search stands" },
    rings.map((ring, index) =>
      el(
        "div.sroute__stop",
        {
          role: "listitem",
          class: [ring.lit ? "is-lit" : null, ring.partial ? "is-partial" : null, index === stallAt ? `is-stall sroute__stop--${stall.tone}` : null]
            .filter(Boolean)
            .join(" "),
        },
        el("span.sroute__ring", { "aria-hidden": "true" }, ring.count == null ? (ring.lit ? "✓" : "") : String(ring.count)),
        el("b.sroute__label", {}, ring.label),
        el("span.sroute__detail", {}, ring.count == null ? ring.detail : ring.count === 0 ? "none yet" : index === 1 ? "sent" : "so far")
      )
    )
  );
}

export function stallLine({ student, now = new Date() }) {
  const stall = diagnose({ student, now });
  return el("p.sstall", { class: `sstall--${stall.tone}` }, el("b", {}, "Where it stalls: "), stall.text);
}

function meterRow(label, value, target) {
  const pct = target ? Math.min(100, Math.round((100 * value) / target)) : 0;
  return el(
    "div.smeter",
    { class: value >= target ? "is-met" : null },
    el("span.smeter__label", {}, label),
    el("span.smeter__bar", { "aria-hidden": "true" }, el("span", { style: `width:${pct}%` })),
    el("b.smeter__num", {}, `${value} / ${target}`)
  );
}

/** This week against the targets, then eight weeks as bars. */
export function weekBlock({ student, now = new Date() }) {
  const { apps } = searchOf(student);
  const { targets } = careerOf(student);
  const week = thisWeek(apps, now);
  const series = weeklySeries(apps, now, 8);
  const peak = Math.max(targets.apply, ...series.map((w) => w.apply + w.warm), 1);
  return el(
    "div.sweek",
    {},
    el(
      "div.sweek__meters",
      {},
      meterRow("Applications this week", week.apply, targets.apply),
      meterRow("Warm messages this week", week.warm, targets.warm)
    ),
    el(
      "div.sweek__bars",
      { "aria-label": `Sent per week, last 8 weeks: ${series.map((w) => w.apply + w.warm).join(", ")}` },
      series.map((w, index) =>
        el(
          "span.sweek__bar",
          { title: `Week of ${w.week}: ${w.apply} applications, ${w.warm} warm`, class: index === series.length - 1 ? "is-now" : null },
          el("span.sweek__apply", { style: `height:${Math.round((100 * w.apply) / peak)}%` }),
          el("span.sweek__warm", { style: `height:${Math.round((100 * w.warm) / peak)}%` })
        )
      ),
      el("span.sweek__caption", {}, "8 weeks · applications and warm messages")
    )
  );
}

/** The story Aden set, in the three parts a stranger should get in five seconds. */
export function storyCard(student, { empty = "Aden fills this in with you on your next call." } = {}) {
  const career = careerOf(student);
  const parts = [
    ["Who you're for", career.story.who],
    ["What you do", career.story.what],
    ["What they should do next", career.story.next],
  ].filter(([, text]) => text);
  if (!parts.length && !career.headline) return el("p.muted", {}, empty);
  return el(
    "div.sstory",
    {},
    career.headline ? el("p.sstory__headline", {}, career.headline) : null,
    parts.map(([label, text]) => el("div.sstory__part", {}, el("b", {}, label), el("span", {}, text))),
    career.titles.length ? el("div.sstory__titles", {}, career.titles.map((title) => el("span.chip2", {}, title))) : null
  );
}

/** One application row. `actions` is the board's controls, or nothing on the desk. */
export function appRow(app, { actions = null, now = new Date() } = {}) {
  const stage = STAGES[stageIndex(app.stage)];
  const days = Math.round((now - new Date(`${app.date}T12:00:00`)) / 86400000);
  return el(
    "div.sapp",
    { class: [app.closed ? "is-closed" : null, `sapp--${app.stage}`].filter(Boolean).join(" ") },
    el(
      "div.sapp__main",
      {},
      el(
        "b.sapp__who",
        {},
        app.link ? el("a", { href: app.link, target: "_blank", rel: "noopener" }, app.company || "(no company)") : app.company || "(no company)"
      ),
      el("span.sapp__role", {}, [app.role, app.contact ? `via ${app.contact}` : null].filter(Boolean).join(" · ")),
      app.note ? el("span.sapp__note", {}, app.note) : null
    ),
    el(
      "div.sapp__meta",
      {},
      el("span.chip2", { class: app.kind === "warm" ? "chip2--verification" : null }, KINDS[app.kind]),
      el("span.sapp__stage", {}, app.closed ? `${stage.label} · closed` : stage.label),
      el("span.sapp__date", {}, days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`)
    ),
    actions
  );
}
