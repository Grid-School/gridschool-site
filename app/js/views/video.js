/**
 * One video card. Used on the Library and inside a step.
 *
 * Compact poster first. Playback only happens in a theater layer on top of
 * everything (scroll locked). Dismiss with ×, Escape, or the scrim.
 *
 * Lesson media is on Lightsail CDN. Progressive MP4 quality ladder + optional
 * Safari HLS "Auto". YouTube remains a legacy path if an id is still present.
 */

import { el } from "../dom.js";
import { MEDIA } from "../../../config.js";

const QUALITIES = [
  { id: "360", label: "360p" },
  { id: "720", label: "720p" },
  { id: "1080", label: "1080p" },
  { id: "2160", label: "4K" },
];

/** Resolve a lesson media entry into absolute playback URLs. */
export function resolveMedia(video = {}) {
  if (video.youtube) {
    return { kind: "youtube", youtube: video.youtube };
  }
  const base = (video.base || MEDIA.baseUrl || "").replace(/\/$/, "");
  const path = (video.path || "").replace(/^\//, "").replace(/\/$/, "");
  if (!base || !path) return null;
  const root = `${base}/${path}`;
  return {
    kind: "owned",
    root,
    hls: video.hls === false ? null : `${root}/master.m3u8`,
    qualities: Object.fromEntries(QUALITIES.map((q) => [q.id, `${root}/mp4/${q.id}.mp4`])),
    defaultQuality: video.defaultQuality || MEDIA.defaultQuality || "1080",
  };
}

export function videoCard({
  title,
  mins,
  youtube,
  path,
  base,
  hls,
  defaultQuality,
  watchWhen,
  startOpen = false,
} = {}) {
  const resolved = resolveMedia({ youtube, path, base, hls, defaultQuality });
  if (!resolved) return null;
  return buildCard({ title, mins, media: resolved, watchWhen, startOpen });
}

function buildCard({ title, mins, media, watchWhen, startOpen }) {
  const poster = el(
    "button.vid__poster",
    {
      type: "button",
      "aria-label": title ? `Watch ${title}` : "Watch",
    },
    el("span.vid__poster-play", { "aria-hidden": "true" }),
    el(
      "span.vid__poster-meta",
      {},
      el("b.vid__poster-title", {}, title || "Lesson video"),
      mins ? el("span.vid__poster-mins", {}, `${mins} min`) : null
    )
  );

  const root = el(
    "div.vid",
    { hidden: startOpen ? null : true },
    poster,
    el(
      "div.vid__bar",
      {},
      watchWhen && el("p.vid__when", {}, watchWhen),
      el("span.vid__meta", {}, mins ? `${mins} min` : "")
    )
  );

  let theater = null;

  function enterTheater() {
    if (theater) return;
    theater = openTheater({
      title,
      mins,
      media,
      onClose: () => {
        theater = null;
      },
    });
  }

  poster.addEventListener("click", enterTheater);

  return {
    node: root,
    open() {
      root.hidden = false;
    },
    close() {
      root.hidden = true;
      theater?.dismiss();
      theater = null;
    },
    toggle() {
      if (root.hidden) this.open();
      else this.close();
      return !root.hidden;
    },
    /** Open the theater directly (Library Watch can call this). */
    watch() {
      root.hidden = false;
      enterTheater();
    },
  };
}

/**
 * Full-viewport theater. One at a time. Locks page scroll while open.
 */
function openTheater({ title, mins, media, onClose }) {
  const quality = el(
    "select.vid__quality",
    { "aria-label": "Playback quality" },
    el("option", { value: "auto" }, "Auto"),
    ...QUALITIES.map((q) => el("option", { value: q.id }, q.label))
  );
  quality.value = media.kind === "owned" ? media.defaultQuality : "auto";

  const status = el("span.vid__status", {}, "");
  const closeBtn = el(
    "button.vid-theater__close",
    { type: "button", "aria-label": "Close" },
    "×"
  );

  const stage = el("div.vid-theater__stage");
  const panel = el(
    "div.vid-theater__panel",
    { role: "dialog", "aria-modal": "true", "aria-label": title || "Lesson video", tabindex: "-1" },
    closeBtn,
    stage,
    el(
      "div.vid-theater__bar",
      {},
      el("b.vid-theater__title", {}, title || "Lesson video"),
      mins ? el("span.vid__meta", {}, `${mins} min`) : null,
      media.kind === "owned" ? quality : null,
      status
    )
  );

  const scrim = el("div.vid-theater__scrim");
  const layer = el("div.vid-theater", {}, scrim, panel);
  document.body.append(layer);
  document.documentElement.classList.add("vid-lock");

  let videoEl = null;
  let iframeEl = null;
  let closed = false;

  function dismiss() {
    if (closed) return;
    closed = true;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    }
    iframeEl = null;
    layer.remove();
    document.documentElement.classList.remove("vid-lock");
    window.removeEventListener("keydown", onKey, true);
    onClose();
  }

  function onKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  }

  scrim.addEventListener("click", dismiss);
  closeBtn.addEventListener("click", dismiss);
  window.addEventListener("keydown", onKey, true);

  if (media.kind === "youtube") {
    iframeEl = el("iframe.vid-theater__player", {
      src: `https://www.youtube-nocookie.com/embed/${media.youtube}?rel=0&modestbranding=1&autoplay=1`,
      title: title || "Lesson video",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      allowfullscreen: true,
    });
    stage.append(iframeEl);
  } else {
    videoEl = el("video.vid-theater__player", {
      controls: true,
      playsinline: true,
      preload: "metadata",
      title: title || "Lesson video",
      autoplay: true,
    });
    stage.append(videoEl);

    async function loadQuality(id, { autoplay = true } = {}) {
      const wasPlaying = autoplay && videoEl && !videoEl.paused;
      const t = videoEl?.currentTime || 0;

      if (id === "auto" && media.hls && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
        videoEl.src = media.hls;
        status.textContent = "Auto";
        await seekAndMaybePlay(videoEl, t, wasPlaying);
        return;
      }

      const pick = id === "auto" ? media.defaultQuality : id;
      const url = media.qualities[pick];
      if (!url) return;
      videoEl.src = url;
      status.textContent = QUALITIES.find((q) => q.id === pick)?.label || pick;
      await seekAndMaybePlay(videoEl, t, wasPlaying);
    }

    quality.addEventListener("change", () => loadQuality(quality.value, { autoplay: true }));
    loadQuality(quality.value, { autoplay: true });
  }

  requestAnimationFrame(() => {
    layer.classList.add("is-open");
    panel.focus({ preventScroll: true });
  });

  return { dismiss };
}

function seekAndMaybePlay(videoEl, t, wasPlaying) {
  return new Promise((resolve) => {
    const onMeta = () => {
      videoEl.removeEventListener("loadedmetadata", onMeta);
      try {
        if (t > 0 && Number.isFinite(videoEl.duration)) {
          videoEl.currentTime = Math.min(t, Math.max(0, videoEl.duration - 0.25));
        }
      } catch {
        /* seek may be blocked before ready */
      }
      if (wasPlaying || videoEl.autoplay) videoEl.play().catch(() => {});
      resolve();
    };
    videoEl.addEventListener("loadedmetadata", onMeta);
    videoEl.load();
  });
}
