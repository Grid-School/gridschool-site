/**
 * Public reading surface. Catalog is the allow-list; a module id that is not
 * in catalog.json is not fetched. Markdown is rendered here so the source of
 * truth can stay a .md file.
 */

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

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let para = [];
  let list = null;

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const lang = escapeHtml(line.slice(3).trim());
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      out.push(`<pre><code class="lang-${lang}">${escapeHtml(buf.join("\n"))}</code></pre>`);
      i += 1;
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      flush();
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#{1,3} /, ""))}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^> /.test(line)) {
      flush();
      out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      flushPara();
      if (!list || list.tag !== "ul") {
        flushList();
        list = { tag: "ul", items: [] };
      }
      list.items.push(line.slice(2));
      i += 1;
      continue;
    }
    if (/^\d+\. /.test(line)) {
      flushPara();
      if (!list || list.tag !== "ol") {
        flushList();
        list = { tag: "ol", items: [] };
      }
      list.items.push(line.replace(/^\d+\. /, ""));
      i += 1;
      continue;
    }
    if (!line.trim()) {
      flush();
      i += 1;
      continue;
    }
    flushList();
    para.push(line.trim());
    i += 1;
  }
  flush();
  return out.join("\n");
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

function renderIndex(catalog) {
  document.title = "Reading. GridSchool";
  $("h1").textContent = catalog.title ?? "Reading";
  $(".lede").textContent = catalog.note ?? "";
  const list = $("nav.mods");
  list.replaceChildren(
    ...catalog.modules.map((mod) => {
      const a = document.createElement("a");
      a.href = `?m=${encodeURIComponent(mod.id)}`;
      a.innerHTML = `<b>${escapeHtml(mod.title)}</b><span>${escapeHtml(mod.series ?? "")}${mod.mins ? ` · ${mod.mins} min` : ""}</span>`;
      return a;
    })
  );
  if (catalog.briefs?.length) {
    const briefNav = $("nav.briefs");
    briefNav.hidden = false;
    briefNav.replaceChildren(
      ...catalog.briefs.map((brief) => {
        const a = document.createElement("a");
        a.href = `?m=${encodeURIComponent(brief.id)}`;
        a.innerHTML = `<b>${escapeHtml(brief.title)}</b><span>${escapeHtml(brief.date ?? "This month")}</span>`;
        return a;
      })
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
      ...catalog.readings.map((item) => {
        const a = document.createElement("a");
        a.href = `?m=${encodeURIComponent(item.id)}`;
        a.innerHTML = `<b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.series ?? "reading")}</span>`;
        return a;
      })
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
  document.title = `${meta.title}. GridSchool`;
  $("h1").textContent = meta.title;
  $(".lede").textContent = meta.series ? `${meta.series}${meta.mins ? ` · ${meta.mins} min` : ""}` : meta.date ?? "";
  $("article").innerHTML = renderMarkdown(await res.text());
  $("nav.mods").hidden = true;
  const briefs = $("nav.briefs");
  if (briefs) briefs.hidden = true;
  const readings = $("nav.readings");
  if (readings) readings.hidden = true;
}

const catalog = await loadCatalog();
const id = new URLSearchParams(location.search).get("m");
if (id) await renderModule(catalog, id);
else renderIndex(catalog);
