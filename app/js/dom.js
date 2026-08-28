/**
 * The smallest element builder that keeps views out of innerHTML soup.
 * el("div.card", { onclick }, "text", el("b", {}, "bold"))
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set([
  "svg", "g", "circle", "rect", "path", "line", "text", "tspan",
  "defs", "pattern", "polygon", "polyline", "ellipse", "use", "clipPath",
]);

function parseTag(spec) {
  const [head, ...classes] = spec.split(".");
  const [tag, id] = head.split("#");
  return { tag: tag || "div", id, classes };
}

export function el(spec, props = {}, ...children) {
  const { tag, id, classes } = parseTag(spec);
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (id) node.id = id;
  if (classes.length) node.setAttribute("class", classes.join(" "));

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") {
      node.setAttribute("class", [...classes, value].join(" "));
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (key === "html") {
      node.innerHTML = value;
    } else if (key in node && !SVG_TAGS.has(tag)) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }

  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(parent, ...children) {
  clear(parent);
  append(parent, children);
  return parent;
}

/** Download a blob without a server round trip. Used by the JSON exports. */
export function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
