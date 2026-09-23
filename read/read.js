/**
 * Public reading surface. Catalog is the allow-list; a module id that is not
 * in catalog.json is not fetched. Markdown is rendered with the same module
 * the board uses, so a page reads the same in both places. Diagrams are drawn
 * after render by mermaid.js, only on pages that carry one.
 */

import { renderMarkdown, splitTitle } from "../app/js/markdown.js";
import { hydrateMermaid } from "../app/js/mermaid.js";
import { bareReadingTitle } from "../app/js/reading-order.js";

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
  if (!/^[A-Za-z0-9][A-Za-z0-9/-]*[A-Za-z0-9]$/.test(id)) return null;
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

function displayTitle(item) {
  const title = bareReadingTitle(item.title);
  return item.walk ? `${String(item.walk).padStart(2, "0")} · ${title}` : title;
}

function walkSort(items) {
  return [...items].sort((a, b) => {
    const left = a.walk ?? 1000;
    const right = b.walk ?? 1000;
    if (left !== right) return left - right;
    return String(a.title).localeCompare(String(b.title));
  });
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
  list.replaceChildren(
    ...walkSort(catalog.modules ?? []).map((mod) =>
      link({ ...mod, title: displayTitle(mod) }, `${mod.series ?? ""}${mod.mins ? ` · ${mod.mins} min` : ""}`)
    )
  );
  if (catalog.briefs?.length) {
    const briefNav = $("nav.briefs");
    briefNav.hidden = false;
    briefNav.replaceChildren(
      ...walkSort(catalog.briefs).map((brief) => link({ ...brief, title: displayTitle(brief) }, brief.date ?? "This month"))
    );
  }
  if (catalog.readings?.length) {
    let readNav = $("nav.readings");
    if (!readNav) {
      readNav = document.createElement("nav");
      readNav.className = "readings";
      $("nav.briefs").after(readNav);
    }
    readNav.hidden = false;
    readNav.replaceChildren(
      ...walkSort(catalog.readings).map((item) =>
        link({ ...item, title: displayTitle(item) }, item.series ?? "reading")
      )
    );
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
  document.title = `${displayTitle(meta)}. GridSchool`;
  $("h1").textContent = displayTitle(meta);
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
