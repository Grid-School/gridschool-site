/**
 * Minimal markdown → HTML for reading modules and step lessons. One renderer
 * for the in-board module view and the public /read mirror, so a page looks
 * the same in both places.
 *
 * Supported: h1-h3, paragraphs, bullet and numbered lists, blockquotes,
 * fenced code, pipe tables, inline code / bold / italic / links.
 *
 * A ```mermaid fence is emitted as <code class="lang-mermaid"> and left as
 * text. `mermaid.js` draws it in place after mount, on pages that have one.
 */

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

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line);

function splitCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(header, rows) {
  const head = `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead>`;
  const body = rows.length
    ? `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : "";
  return `<table>${head}${body}</table>`;
}

/**
 * A module file opens with its own `# Title` so it reads whole on GitHub. The
 * pages that show it already print a title in their header, so they take the
 * heading here and render only the body. A file with no leading H1 comes back
 * with `title: null` and its text untouched.
 */
export function splitTitle(src) {
  const text = String(src).replace(/\r\n/g, "\n");
  const match = text.match(/^\s*# ([^\n]*)\n+/);
  if (!match) return { title: null, body: text };
  return { title: match[1].trim(), body: text.slice(match[0].length) };
}

export function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
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
    if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      flush();
      const header = splitCells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      out.push(renderTable(header, rows));
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
