/**
 * The public syllabus, unlit. Cards render from the same curriculum the map
 * reads, so this page cannot drift from the board. Locally the plaintext is
 * present; on the live site only the tour copy (lesson text stripped) is
 * public, and that is all a syllabus needs: number, track, title, why.
 */

import { trackOf, TRACK } from "../app/js/graph/model.js";

const DATA = "../data/";

async function loadCurriculum() {
  const plain = await fetch(`${DATA}curriculum.json`, { cache: "no-store" });
  if (plain.ok) return plain.json();
  const tour = await fetch(`${DATA}curriculum.public.json`, { cache: "no-store" });
  if (!tour.ok) throw new Error(`curriculum.public.json returned ${tour.status}`);
  return tour.json();
}

/** The one-sentence lead: `why` up to its first full stop. */
function lead(node) {
  const why = node.why ?? "";
  const stop = why.indexOf(". ");
  return stop === -1 ? why : why.slice(0, stop + 1);
}

function card(node, families) {
  const article = document.createElement("article");
  article.className = "node";
  article.dataset.id = node.id;
  const label =
    node.kind === "future" ? "Later" : trackOf(node, families) === TRACK.SPINE ? "Required" : "Depth";
  const b = document.createElement("b");
  b.textContent = `${String(node.n).padStart(2, "0")} · ${label}`;
  const h3 = document.createElement("h3");
  h3.textContent = node.title;
  const p = document.createElement("p");
  p.textContent = lead(node);
  article.append(b, h3, p);
  return article;
}

export async function renderSyllabus(grid) {
  const cur = await loadCurriculum();
  const families = cur.families ?? [];
  const nodes = [...cur.nodes].sort((a, b) => a.n - b.n);
  grid.replaceChildren(...nodes.map((node) => card(node, families)));
  return nodes.length;
}
