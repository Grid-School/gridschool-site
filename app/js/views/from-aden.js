/**
 * "From Aden": the per-student fields on a module step (modules.js puts them
 * on `node.fromAden`). Notes from the 1:1, links, a due date.
 *
 * Notes are a deliberately small markdown: paragraphs, **bold**, "- " bullets
 * and "> " quotes. Everything else is literal text, and the card is built with
 * text nodes only (never innerHTML), so nothing in a note can become markup or
 * a link. Links come from `fromAden.links` and only http(s) ones are shown.
 *
 * The parsing and formatting are pure and tested; the DOM builders sit on top.
 */

import { el } from "../dom.js?v=e80d53a-202610060435";
import { isHttpUrl, isValidDate } from "../modules.js?v=e80d53a-202610060435";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "**a** b" → [{text:"a", bold:true}, {text:" b", bold:false}]. Unclosed ** stays literal. */
export function parseInline(text) {
  const spans = [];
  const source = String(text ?? "");
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) spans.push({ text: source.slice(last, match.index), bold: false });
    spans.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < source.length) spans.push({ text: source.slice(last), bold: false });
  return spans;
}

/**
 * Notes → blocks: {type:"p", spans}, {type:"ul", items:[spans]}, {type:"quote", lines:[spans]}.
 * A blank line ends a block; consecutive plain lines join into one paragraph.
 */
export function parseNotes(text) {
  const blocks = [];
  let current = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (bullet) {
      if (current?.type !== "ul") flush();
      current ??= { type: "ul", items: [] };
      current.items.push(parseInline(bullet[1]));
    } else if (quote) {
      if (current?.type !== "quote") flush();
      current ??= { type: "quote", lines: [] };
      current.lines.push(parseInline(quote[1]));
    } else {
      if (current?.type !== "p") flush();
      if (current) current.text += ` ${line.trim()}`;
      else current = { type: "p", text: line.trim() };
    }
  }
  flush();
  return blocks.map((block) => (block.type === "p" ? { type: "p", spans: parseInline(block.text) } : block));
}

/** "2026-10-10" → "Due Sat Oct 10". Read as a calendar day, never shifted by time zone. */
export function dueLabel(iso) {
  if (!isValidDate(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `Due ${DAYS[day]} ${MONTHS[m - 1]} ${d}`;
}

/** Days from `today` (a Date) to the due day; negative when past. */
export function daysUntil(iso, today = new Date()) {
  if (!isValidDate(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86400000);
}

export function dueTone(iso, today = new Date()) {
  const days = daysUntil(iso, today);
  if (days === null) return null;
  if (days < 0) return "late";
  if (days <= 2) return "soon";
  return "later";
}

/** Only labelled http(s) links; anything else is dropped before it reaches the page. */
export function safeLinks(links) {
  return (Array.isArray(links) ? links : [])
    .filter((link) => link && typeof link.label === "string" && link.label.trim() && isHttpUrl(link.url))
    .map((link) => ({ label: link.label.trim(), url: link.url }));
}

/** What the card shows, or null when Aden left nothing for this step. */
export function fromAdenModel(node) {
  const fill = node?.fromAden;
  if (!fill) return null;
  const blocks = typeof fill.notes === "string" && fill.notes.trim() ? parseNotes(fill.notes) : [];
  const links = safeLinks(fill.links);
  const due = dueLabel(fill.due);
  if (!blocks.length && !links.length && !due) return null;
  return { blocks, links, due, dueIso: due ? fill.due : null };
}

function spansEl(spans) {
  return spans.map((span) => (span.bold ? el("strong", {}, span.text) : span.text));
}

export function dueBadge(iso, { today = new Date() } = {}) {
  const label = dueLabel(iso);
  if (!label) return null;
  return el("span.due", { class: `due--${dueTone(iso, today)}`, title: iso }, label);
}

/** The card on the step page, between the header and the lesson. Null when empty. */
export function fromAdenCard(node) {
  const model = fromAdenModel(node);
  if (!model) return null;
  return el(
    "section.fromaden",
    { "aria-label": "From Aden" },
    el("header.fromaden__head", {}, el("b.eyebrow", {}, "From Aden"), model.dueIso ? dueBadge(model.dueIso) : null),
    model.blocks.length
      ? el(
          "div.fromaden__notes",
          {},
          model.blocks.map((block) => {
            if (block.type === "ul") return el("ul", {}, block.items.map((item) => el("li", {}, spansEl(item))));
            if (block.type === "quote") return el("blockquote", {}, block.lines.map((line) => el("p", {}, spansEl(line))));
            return el("p", {}, spansEl(block.spans));
          })
        )
      : null,
    model.links.length
      ? el(
          "div.fromaden__links",
          {},
          model.links.map((link) => el("a.b.b--ghost", { href: link.url, target: "_blank", rel: "noopener noreferrer" }, `${link.label} ↗`))
        )
      : null
  );
}
