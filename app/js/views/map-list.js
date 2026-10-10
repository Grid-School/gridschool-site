/**
 * The map, as a list.
 *
 * The graph answers "where am I"; this answers "what have I actually got".
 * Both views project the same node state, including in-app answers, saved
 * links, and accepted reviews. That is why Work stopped being a separate
 * surface: it repeated the evidence already available from the map.
 *
 * This is also the list a student pastes into a message, which is why copying
 * every link at once is the loudest thing on it.
 *
 * Side quests get their own section after the path, the way they get their
 * own column on the floor: listed, never in the required count.
 */

import { el } from "../dom.js?v=d696edf-202610102057";
import { panel, btn, copy, dot } from "../ui.js?v=d696edf-202610102057";
import { STATUS, isSide, isSpine, nextUp, stepNumber } from "../graph/model.js?v=d696edf-202610102057";
import { inSequence, standingOf, STANDING_LABEL, STANDING_TONE } from "../graph/standing.js?v=d696edf-202610102057";
import { reviewScores } from "./parts.js?v=d696edf-202610102057";
import { trackLabel } from "../copy.js?v=d696edf-202610102057";
import { fmtDay } from "../time.js?v=d696edf-202610102057";
import { dueBadge } from "./from-aden.js?v=d696edf-202610102057";

export function mapList({ state, onOpenNode }) {
  const { graph, student } = state;
  // The same sequence the floor walks, so the two projections cannot disagree.
  const all = inSequence(graph.nodes);
  const ordered = all.filter((node) => !isSide(node));
  const side = all.filter(isSide);
  const nextId = nextUp(graph)?.id ?? null;
  const lit = all.filter((node) => node.status === STATUS.LIT);
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
    side.length
      ? panel(
          {
            eyebrow: `Side quests · ${side.filter((node) => node.status === STATUS.LIT).length} of ${side.length} done`,
            title: "Side quests",
            note: "Optional, any time. None of these is required, and none of them is ever the next step.",
          },
          el("div.mlrows", {}, sequenceRows(graph, side, reviewsByNode, nextId, onOpenNode))
        )
      : null,
    loose.length
      ? panel(
          { eyebrow: "Not tied to a node", title: "Other reviews" },
          el("div.rvs", {}, loose.map((review) => reviewLine(review)))
        )
      : null
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
        "aria-label": `Open step ${stepNumber(node)}, ${node.title}`,
      },
      dot(standing),
      el("span.mlrow__n", {}, stepNumber(node)),
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
      node.status !== STATUS.LIT && node.fromAden?.due ? dueBadge(node.fromAden.due) : null,
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
