/**
 * The map, as a list.
 *
 * The graph answers "where am I"; this answers "what have I actually got". They
 * are the same nodes and the same one invariant, a node lights only when a
 * URL exists, so this is a projection, not a second page. That is why Work
 * stopped being its own surface: a page listing your links, sitting next to a
 * map whose whole meaning is your links, was the same data twice.
 *
 * This is also the list a student pastes into a message, which is why copying
 * every link at once is the loudest thing on it.
 */

import { el } from "../dom.js";
import { panel, btn, copy, dot } from "../ui.js";
import { STATUS, isSpine, nextUp } from "../graph/model.js";
import { inSequence, standingOf, STANDING_LABEL, STANDING_TONE } from "../graph/standing.js";
import { reviewScores } from "./parts.js";
import { trackLabel } from "../copy.js";
import { fmtDay } from "../time.js";
import { link } from "../../../config.js";

export function mapList({ state, onOpenNode }) {
  const { graph, student } = state;
  // The same sequence the floor walks, so the two projections cannot disagree.
  const ordered = inSequence(graph.nodes);
  const nextId = nextUp(graph)?.id ?? null;
  const lit = ordered.filter((node) => node.status === STATUS.LIT);
  const spine = ordered.filter((node) => node.kind !== "future" && isSpine(node));
  const spineLit = spine.filter((node) => node.status === STATUS.LIT);
  const reviewsByNode = groupReviews(student.reviews ?? []);
  const loose = (student.reviews ?? []).filter((review) => !review.nodeId);

  return el(
    "div.maplist",
    {},
    panel(
      {
        eyebrow: `Required ${spineLit.length} of ${spine.length} · ${lit.length} links on the board`,
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
      el("div.mlrows", {}, sequenceRows(graph, ordered, reviewsByNode, nextId, onOpenNode))
    ),
    loose.length
      ? panel(
          { eyebrow: "Not tied to a node", title: "Other reviews" },
          el("div.rvs", {}, loose.map((review) => reviewLine(review)))
        )
      : null,
    panel({ eyebrow: "The shared codebases", title: "The world, and GridSeak" }, studioBlock())
  );
}

/**
 * One list, in walking order, with the family as a tag on each row. Grouping
 * by family was a second ordering beside the map's; a student reading both
 * should see one path.
 */
function sequenceRows(graph, ordered, reviewsByNode, nextId, onOpenNode) {
  const familyLabel = new Map((graph.families ?? []).map((family) => [family.id, family.label]));
  return ordered.map((node) => row(node, reviewsByNode.get(node.id) ?? [], onOpenNode, nextId, familyLabel.get(node.family)));
}

function row(node, reviews, onOpenNode, nextId, family) {
  const latest = reviews[0];
  const standing = standingOf(node, nextId);
  return el(
    "div.mlrow",
    { class: `mlrow--${node.status} mlrow--s-${standing}` },
    el(
      "button.mlrow__open",
      {
        type: "button",
        onclick: () => onOpenNode(node.id),
        "aria-label": `Open step ${node.n}, ${node.title}`,
      },
      dot(standing),
      el("span.mlrow__n", {}, String(node.n).padStart(2, "0")),
      el("span.mlrow__title", {}, node.title),
      family && el("span.mlrow__fam", {}, `${family} · ${trackLabel(node.track)}`)
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
      el("span", { class: `mlrow__state mlrow__state--${STANDING_TONE[standing]}` }, STANDING_LABEL[standing]),
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
    reviewScores(review),
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
  return [`${name}: work you can click`, "", ...nodes.map((node) => `${node.title}: ${node.proof.url}`)].join("\n");
}

function studioBlock() {
  const play = link("play");
  const server = link("worldServer");
  const client = link("worldClient");
  const jira = link("jira");
  return el(
    "div",
    {},
    el(
      "p.muted",
      {},
      "The world is the live game. Features you ship stay there with a maker's mark, and anyone you send the link to can walk in. GridSeak is the graph engine. How much you take on there follows your goals, and I review that work the same way. Daily stories live on the ticket board."
    ),
    el(
      "div.room__acts",
      {},
      play && btn({ label: "Open the world", variant: "solid", href: play, target: "_blank" }),
      server && btn({ label: "World server", variant: "quiet", href: server, target: "_blank" }),
      client && btn({ label: "World client", variant: "quiet", href: client, target: "_blank" }),
      jira
        ? btn({ label: "Open the ticket board", variant: "quiet", href: jira, target: "_blank" })
        : el("span.notwired", {}, "The ticket board is not connected yet. It arrives on day one.")
    )
  );
}
