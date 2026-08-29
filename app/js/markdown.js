/**
 * Minimal markdown → HTML for step modules. Same rules as /read/read.js so
 * nanograph pages look the same in-board and on the public mirror.
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
