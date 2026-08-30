/**
 * Hero evidence record. Renders real receipts from data/receipts.json.
 * Lit = URL. Dark = pending. System rows vs student rows stay distinct.
 */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "htmlFor") node.htmlFor = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function renderRail(rail) {
  const wrap = el("div", { className: "evidence__rail", "aria-hidden": "true" });
  rail.forEach((step, i) => {
    wrap.append(
      el("span", {
        className: `evidence__step${step.lit ? " is-lit" : ""}`,
        text: step.label,
      }),
    );
    if (i < rail.length - 1) wrap.append(el("span", { className: "evidence__sep" }));
  });
  return wrap;
}

function renderRow(row) {
  const lit = Boolean(row.lit);
  const bodyChildren = [];
  const title = el("div", { className: "evidence__title", text: row.title });
  if (lit && row.href) {
    const linkAttrs = { href: row.href };
    if (row.href.startsWith("http")) {
      linkAttrs.target = "_blank";
      linkAttrs.rel = "noopener";
    }
    const link = el("a", linkAttrs);
    link.append(title);
    bodyChildren.push(link);
  } else {
    bodyChildren.push(title);
  }
  if (row.detail) {
    bodyChildren.push(el("div", { className: "evidence__detail", text: row.detail }));
  }

  return el("div", {
    className: `evidence__row ${lit ? "is-lit" : "is-pending"}`,
    "data-id": row.id,
    "data-group": row.group || "system",
  }, [
    el("i", { className: "evidence__dot", "aria-hidden": "true" }),
    el("span", { className: "evidence__label", text: row.label }),
    el("div", { className: "evidence__body" }, bodyChildren),
    el("span", { className: "evidence__state", text: row.state || (lit ? "lit" : "pending") }),
  ]);
}

function renderRows(rows) {
  const wrap = el("div", { className: "evidence__rows" });
  let lastGroup = null;
  for (const row of rows) {
    const group = row.group || "system";
    if (lastGroup && group !== lastGroup) {
      wrap.append(
        el("div", {
          className: "evidence__divider",
          text: group === "student" ? "Student zero" : "System",
        }),
      );
    }
    wrap.append(renderRow(row));
    lastGroup = group;
  }
  return wrap;
}

export function mountEvidence(root, data) {
  if (!root || !data) return;

  root.replaceChildren();
  root.classList.add("evidence");
  root.setAttribute("aria-label", "GridSchool evidence record");

  root.append(
    el("div", { className: "evidence__head" }, [
      el("span", { className: "evidence__id", text: data.id }),
      el("span", { className: "evidence__meta", text: data.meta || "" }),
    ]),
    renderRail(data.rail || []),
    renderRows(data.rows || []),
  );

  if (data.foot) {
    root.append(el("p", { className: "evidence__foot", text: data.foot }));
  }

  root.classList.add("is-ready");
}

export async function loadReceipts(url = "data/receipts.json") {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`receipts load failed: ${res.status}`);
  return res.json();
}
