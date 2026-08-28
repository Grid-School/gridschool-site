/**
 * The map, as a list.
 *
 * The graph answers "where am I"; this answers "what have I actually got". They
 * are the same nodes and the same one invariant — a node lights only when a
 * URL exists — so this is a projection, not a second page. That is why Work
 * stopped being its own surface: a page listing your links, sitting next to a
 * map whose whole meaning is your links, was the same data twice.
 *
 * This is also the list a student pastes into a message, which is why copying
 * every link at once is the loudest thing on it.
 */

import { el } from "../dom.js";
import { panel, btn, placeholder, copy, dot } from "../ui.js";
import { STATUS } from "../graph/model.js";
import { statusLabel } from "./parts.js";
import { fmtDay } from "../time.js";
import { link } from "../../../config.js";

export function mapList({ state, onOpenNode }) {
  const { graph, student } = state;
  const ordered = [...graph.nodes].sort((a, b) => a.n - b.n);
  const lit = ordered.filter((node) => node.status === STATUS.LIT);
  const reviewsByNode = groupReviews(student.reviews ?? []);
  const loose = (student.reviews ?? []).filter((review) => !review.nodeId);

  return el(
    "div.maplist",
    {},
    panel(
      {
        eyebrow: `${lit.length} of ${ordered.filter((n) => n.kind !== "future").length} done`,
        title: "Every step, and the link behind it",
        note: "If a link here is dead, the node is a lie. That is the only rule this list has.",
        actions: lit.length
          ? btn({
              label: "Copy all links",
              variant: "solid",
              onclick: () => copy(linkBlock(lit, student.name), "Copied. That block is what you paste into a message."),
            })
          : null,
      },
      el("div.mlrows", {}, familyBlocks(graph, ordered, reviewsByNode, onOpenNode))
    ),
    loose.length
      ? panel(
          { eyebrow: "Not tied to a node", title: "Other reviews" },
          el("div.rvs", {}, loose.map((review) => reviewLine(review)))
        )
      : null,
    panel({ eyebrow: "The shared codebase", title: "Studio repo" }, studioBlock()),
    panel(
      { eyebrow: "Coming", title: "Public contributions" },
      placeholder({
        title: "Merged pull requests on a public tool",
        note: "The capstone ends with a merged public pull request, or an internship if that is the true path. Most people here have the degree and not the job yet. The PR is the usual path.",
        when: "That step sits at the end of the capstone track.",
      })
    )
  );
}

function familyBlocks(graph, ordered, reviewsByNode, onOpenNode) {
  const seen = new Set();
  const blocks = [];
  for (const family of graph.families ?? []) {
    const nodes = ordered.filter((node) => node.family === family.id);
    if (!nodes.length) continue;
    nodes.forEach((node) => seen.add(node.id));
    blocks.push(el("b.mlfam", {}, family.label), ...nodes.map((node) => row(node, reviewsByNode.get(node.id) ?? [], onOpenNode)));
  }
  const rest = ordered.filter((node) => !seen.has(node.id));
  if (rest.length) {
    blocks.push(el("b.mlfam", {}, "Other"), ...rest.map((node) => row(node, reviewsByNode.get(node.id) ?? [], onOpenNode)));
  }
  return blocks;
}

function row(node, reviews, onOpenNode) {
  const latest = reviews[0];
  return el(
    "div.mlrow",
    { class: `mlrow--${node.status}` },
    el(
      "button.mlrow__open",
      {
        type: "button",
        onclick: () => onOpenNode(node.id),
        "aria-label": `Open step ${node.n}, ${node.title}`,
      },
      dot(node.status),
      el("span.mlrow__n", {}, String(node.n).padStart(2, "0")),
      el("span.mlrow__title", {}, node.title)
    ),
    el(
      "div.mlrow__proof",
      {},
      node.proof?.url
        ? el("a.mlrow__url", { href: node.proof.url, target: "_blank", rel: "noopener" }, node.proof.url)
        : el("span.mlrow__need", {}, node.evidence),
      node.proof?.note && el("p.mlrow__note", {}, node.proof.note)
    ),
    el(
      "div.mlrow__side",
      {},
      el("span.mlrow__state", {}, statusLabel(node.status)),
      node.proof?.at && el("span.mlrow__at", {}, fmtDay(node.proof.at)),
      latest && el("span", { class: `mlrow__rv mlrow__rv--${latest.state}` }, latest.state === "returned" ? "reviewed" : "in review")
    )
  );
}

function reviewLine(review) {
  return el(
    "div.rv",
    { class: `rv--${review.state}` },
    el(
      "div.rv__head",
      {},
      el("b", {}, review.title),
      el("span.rv__state", {}, review.state === "returned" ? "returned" : "in review")
    ),
    review.verdict && el("p.rv__verdict", {}, review.verdict),
    review.link && el("a.mlrow__url", { href: review.link, target: "_blank", rel: "noopener" }, "the work ↗")
  );
}

function groupReviews(reviews) {
  const map = new Map();
  for (const review of reviews) {
    if (!review.nodeId) continue;
    if (!map.has(review.nodeId)) map.set(review.nodeId, []);
    map.get(review.nodeId).push(review);
  }
  return map;
}

function linkBlock(nodes, name) {
  return [`${name} — work you can click`, "", ...nodes.map((node) => `${node.title}: ${node.proof.url}`)].join("\n");
}

function studioBlock() {
  const href = link("studioRepo");
  return el(
    "div",
    {},
    el(
      "p.muted",
      {},
      "The repo I hand you is deliberately messy and deliberately real. You are not hunting GitHub for a project that will accept you. Inherited systems are the job."
    ),
    href
      ? btn({ label: "Open the studio repo", variant: "solid", href, target: "_blank" })
      : el("span.notwired", {}, "Repo access is not connected yet. You get an invite on day one.")
  );
}
