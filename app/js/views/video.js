/**
 * One video card. Used on the Library and inside a step. The iframe is created
 * only when the player is shown, so a page of eight titles does not load eight
 * YouTube players.
 */

import { el } from "../dom.js";

export function videoCard({ title, mins, youtube, watchWhen, startOpen = false, startWide = false } = {}) {
  if (!youtube) return null;

  const frame = el("div.vid__frame");
  const wideBtn = el("button.vid__mode", { type: "button" }, "Wider");
  const root = el(
    "div.vid",
    { hidden: startOpen ? null : true },
    frame,
    el(
      "div.vid__bar",
      {},
      watchWhen && el("p.vid__when", {}, watchWhen),
      el("span.vid__meta", {}, mins ? `${mins} min` : ""),
      wideBtn,
      el(
        "a.vid__ext",
        { href: `https://www.youtube.com/watch?v=${youtube}`, target: "_blank", rel: "noopener" },
        "YouTube ↗"
      )
    )
  );

  function mountPlayer() {
    if (!frame.querySelector("iframe")) frame.append(iframe(youtube, title));
  }

  function unmountPlayer() {
    frame.replaceChildren();
    root.classList.remove("is-wide");
    wideBtn.textContent = "Wider";
  }

  wideBtn.onclick = () => {
    const wide = root.classList.toggle("is-wide");
    wideBtn.textContent = wide ? "Smaller" : "Wider";
  };

  const api = {
    node: root,
    open() {
      root.hidden = false;
      mountPlayer();
    },
    close() {
      root.hidden = true;
      unmountPlayer();
    },
    toggle() {
      if (root.hidden) this.open();
      else this.close();
      return !root.hidden;
    },
  };

  if (startOpen) mountPlayer();
  if (startWide) {
    root.classList.add("is-wide");
    wideBtn.textContent = "Smaller";
  }
  return api;
}

function iframe(id, title) {
  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  return el("iframe", {
    src,
    title: title || "Lesson video",
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    allowfullscreen: true,
    loading: "lazy",
  });
}
