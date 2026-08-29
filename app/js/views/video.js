/**
 * One video card. Used on the Library and inside a step.
 *
 * Lesson media is hosted on Lightsail object storage + CDN (not YouTube).
 * Progressive MP4 quality ladder: play / pause / scrub via native controls,
 * plus an explicit quality menu (360 / 720 / 1080 / 2160). HLS is used when
 * the browser can play it natively (Safari) or when hls.js can fetch with CORS.
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
  startWide = false,
} = {}) {
  const resolved = resolveMedia({ youtube, path, base, hls, defaultQuality });
  if (!resolved) return null;

  if (resolved.kind === "youtube") {
    return youtubeCard({ title, mins, youtube: resolved.youtube, watchWhen, startOpen, startWide });
  }

  return ownedCard({ title, mins, media: resolved, watchWhen, startOpen, startWide });
}

function ownedCard({ title, mins, media, watchWhen, startOpen, startWide }) {
  const frame = el("div.vid__frame");
  const wideBtn = el("button.vid__mode", { type: "button" }, "Wider");
  const quality = el(
    "select.vid__quality",
    { "aria-label": "Playback quality" },
    el("option", { value: "auto" }, "Auto"),
    QUALITIES.map((q) =>
      el("option", { value: q.id, selected: q.id === media.defaultQuality ? true : null }, q.label)
    )
  );
  const status = el("span.vid__status", {}, "");

  const root = el(
    "div.vid",
    { hidden: startOpen ? null : true },
    frame,
    el(
      "div.vid__bar",
      {},
      watchWhen && el("p.vid__when", {}, watchWhen),
      el("span.vid__meta", {}, mins ? `${mins} min` : ""),
      quality,
      status,
      wideBtn
    )
  );

  let videoEl = null;
  let hlsInstance = null;
  let usingHls = false;

  function destroyHls() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    usingHls = false;
  }

  function mountPlayer() {
    if (videoEl) return;
    videoEl = el("video.vid__player", {
      controls: true,
      playsinline: true,
      preload: "metadata",
      title: title || "Lesson video",
    });
    frame.append(videoEl);
    loadQuality(quality.value, { autoplay: false });
  }

  function unmountPlayer() {
    destroyHls();
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    }
    frame.replaceChildren();
    videoEl = null;
    root.classList.remove("is-wide");
    wideBtn.textContent = "Wider";
    status.textContent = "";
  }

  async function loadQuality(id, { autoplay = true } = {}) {
    if (!videoEl) return;
    const wasPlaying = autoplay && !videoEl.paused;
    const t = videoEl.currentTime || 0;
    destroyHls();

    /* Auto = HLS when the browser can play it natively (Safari). Otherwise 1080p MP4. */
    if (id === "auto" && media.hls && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = media.hls;
      usingHls = true;
      status.textContent = "HLS · Auto";
      await seekAndMaybePlay(t, wasPlaying);
      return;
    }

    const pick = id === "auto" ? media.defaultQuality : id;
    const url = media.qualities[pick];
    if (!url) return;
    videoEl.src = url;
    status.textContent = QUALITIES.find((q) => q.id === pick)?.label || pick;
    await seekAndMaybePlay(t, wasPlaying);
  }

  function seekAndMaybePlay(t, wasPlaying) {
    return new Promise((resolve) => {
      const onMeta = () => {
        videoEl.removeEventListener("loadedmetadata", onMeta);
        try {
          if (t > 0 && Number.isFinite(videoEl.duration)) {
            videoEl.currentTime = Math.min(t, Math.max(0, videoEl.duration - 0.25));
          }
        } catch {
          /* some browsers block seek before ready */
        }
        if (wasPlaying) videoEl.play().catch(() => {});
        resolve();
      };
      videoEl.addEventListener("loadedmetadata", onMeta);
      videoEl.load();
    });
  }

  quality.addEventListener("change", () => {
    loadQuality(quality.value, { autoplay: true });
  });

  /* Default the select to the configured quality (not Auto) so first paint is predictable. */
  quality.value = media.defaultQuality;

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

/** Legacy path: still works if a youtube id is present on old entries. */
function youtubeCard({ title, mins, youtube, watchWhen, startOpen, startWide }) {
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
    if (!frame.querySelector("iframe")) {
      frame.append(
        el("iframe", {
          src: `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&modestbranding=1`,
          title: title || "Lesson video",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowfullscreen: true,
          loading: "lazy",
        })
      );
    }
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
