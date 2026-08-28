/**
 * Renders terms/ and privacy/ from data/legal.json so the copy is edited as
 * content, not as markup. Both pages are the same component with a different key,
 * which is the only way two legal pages stay consistent with each other.
 *
 * Facts that only a person can supply (entity, jurisdiction, address) come from
 * LEGAL in config.js. Anything still unset renders as a visible gap rather than
 * as an invented company name.
 */

import { LEGAL, LINKS, isPlaceholder } from "../config.js";

const MISSING = "not set yet";

export async function renderLegal(key) {
  const mount = document.getElementById("doc");
  const response = await fetch("../data/legal.json");
  const { documents } = await response.json();
  const doc = documents[key];

  if (!doc) {
    mount.append(paragraph("This document is missing from data/legal.json."));
    return;
  }

  document.title = `${doc.title} · GridSchool`;
  mount.append(head(doc));

  for (const section of doc.sections) {
    mount.append(sectionCard(section));
  }

  mount.append(who());
}

function head(doc) {
  const wrap = document.createElement("div");
  wrap.className = "fhead";
  wrap.append(
    chip(`Effective ${fact(LEGAL.effective)}`),
    heading("h1", doc.title),
    paragraph(doc.lede, "muted")
  );
  return wrap;
}

function sectionCard(section) {
  const card = document.createElement("div");
  card.className = "fcard";
  card.append(heading("h2", section.heading));

  const lines = [...section.body, ...(section.whenAdTracking && LEGAL.adTracking ? section.whenAdTracking : [])];
  for (const line of lines) card.append(paragraph(line));

  return card;
}

/** Who is on the other side of this agreement. Vague here is a red flag. */
function who() {
  const card = document.createElement("div");
  card.className = "fcard";
  card.append(heading("h2", "Who you are dealing with"));

  const list = document.createElement("dl");
  list.className = "legalwho";
  for (const [label, value] of [
    ["Operator", fact(LEGAL.entity)],
    ["Governed by the laws of", fact(LEGAL.jurisdiction)],
    ["Address", fact(LEGAL.contactAddress)],
    ["Contact", LINKS.email],
  ]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    if (value === MISSING) detail.className = "legalwho__gap";
    list.append(term, detail);
  }

  card.append(list);
  return card;
}

function fact(value) {
  return isPlaceholder(value) ? MISSING : value;
}

function heading(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function paragraph(text, className) {
  const node = document.createElement("p");
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function chip(text) {
  const node = document.createElement("div");
  node.className = "chip";
  node.textContent = text;
  return node;
}
