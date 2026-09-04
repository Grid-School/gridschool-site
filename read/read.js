/**
 * Public reading surface. Catalog is the allow-list; a module id that is not
 * in catalog.json is not fetched. Markdown is rendered with the same module
 * the board uses, so a page reads the same in both places. Diagrams are drawn
 * after render by mermaid.js, only on pages that carry one.
 */

import { renderMarkdown, splitTitle } from "../app/js/markdown.js";
import { hydrateMermaid } from "../app/js/mermaid.js";

const CATALOG = new URL("./catalog.json", import.meta.url);
const MODULES = new URL("./modules/", import.meta.url);

const $ = (sel) => document.querySelector(sel);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function modulePath(id) {
  if (!/^[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(id)) return null;
  return new URL(`${id}.md`, MODULES);
}

async function loadCatalog() {
  const res = await fetch(CATALOG, { cache: "no-store" });
  if (!res.ok) throw new Error("catalog missing");
  return res.json();
}

function catalogItems(catalog) {
  return [
    ...(catalog.modules ?? []),
    ...(catalog.briefs ?? []),
    ...(catalog.readings ?? []),
  ];
}

function link(item, meta) {
  const a = document.createElement("a");
  a.href = `?m=${encodeURIComponent(item.id)}`;
  a.innerHTML = `<b>${escapeHtml(item.title)}</b><span>${escapeHtml(meta)}</span>`;
  return a;
}

/** Series in catalog order; a series header names what the group is for. */
function seriesGroups(modules) {
  const groups = new Map();
  for (const mod of modules) {
    const key = mod.series ?? "reading";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mod);
  }
  return groups;
}

function renderIndex(catalog) {
  document.title = "Reading. GridSchool";
  $("h1").textContent = catalog.title ?? "Reading";
  $(".lede").textContent = catalog.note ?? "";
  const list = $("nav.mods");
  const notes = catalog.seriesNotes ?? {};
  list.replaceChildren(
    ...[...seriesGroups(catalog.modules ?? [])].flatMap(([series, mods]) => {
      const head = document.createElement("p");
      head.className = "mods__series";
      head.innerHTML = `<b>${escapeHtml(series)}</b>${notes[series] ? `<span>${escapeHtml(notes[series])}</span>` : ""}`;
      return [head, ...mods.map((mod) => link(mod, `${mod.series ?? ""}${mod.mins ? ` · ${mod.mins} min` : ""}`))];
    })
  );
  if (catalog.briefs?.length) {
    const briefNav = $("nav.briefs");
    briefNav.hidden = false;
    briefNav.replaceChildren(...catalog.briefs.map((brief) => link(brief, brief.date ?? "This month")));
  }
  if (catalog.readings?.length) {
    let readNav = $("nav.readings");
    if (!readNav) {
      readNav = document.createElement("nav");
      readNav.className = "readings";
      $("nav.briefs").after(readNav);
    }
    readNav.hidden = false;
    readNav.replaceChildren(...catalog.readings.map((item) => link(item, item.series ?? "reading")));
  }
}

async function renderModule(catalog, id) {
  const meta = catalogItems(catalog).find((item) => item.id === id);
  const path = modulePath(id);
  if (!meta || !path) {
    $("article").innerHTML = "<p>That module is not in the catalog.</p>";
    return;
  }
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    $("article").innerHTML = "<p>The file is listed and not on disk yet.</p>";
    return;
  }
  document.title = `${meta.title}. GridSchool`;
  $("h1").textContent = meta.title;
  $(".lede").textContent = meta.series ? `${meta.series}${meta.mins ? ` · ${meta.mins} min` : ""}` : meta.date ?? "";
  const article = $("article");
  // The page header owns the title; the file's own H1 would print it twice.
  article.innerHTML = renderMarkdown(splitTitle(await res.text()).body);
  $("nav.mods").hidden = true;
  const briefs = $("nav.briefs");
  if (briefs) briefs.hidden = true;
  const readings = $("nav.readings");
  if (readings) readings.hidden = true;
  hydrateMermaid(article);
}

const catalog = await loadCatalog();
const id = new URLSearchParams(location.search).get("m");
if (id) await renderModule(catalog, id);
else renderIndex(catalog);
