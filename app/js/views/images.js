/**
 * Profile images (server/images_api.py, images_gen.py), opened from the profile-images step on the map.
 *
 * Four nodes: Photos (they add 1 to 3 photos of their face, and their current photo and banner if they
 * like), Headshot and Banner (we make three options from their photos and their taste; they pick one),
 * Download (each picked image cropped to LinkedIn's sizes, then they post it). When making images is
 * switched off on the server, the page says so and Download crops their own photo and banner instead.
 * Everything they upload is private to them.
 */

import { el, mount } from "../dom.js?v=22c446e-202610271853";
import { btn, toast } from "../ui.js?v=22c446e-202610271853";
import { nodeRail, nodeIntro } from "./node-rail.js?v=22c446e-202610271853";
import * as api from "../images-remote.js?v=22c446e-202610271853";
import { STAGES, cropBox, needsShrink, shrinkTo, doneStages, firstOpen, sourceFor, allowanceLine } from "../image-crop.js?v=22c446e-202610271853";

const ACCEPT = "image/jpeg,image/png,image/webp";
const LINKEDIN = { headshot: { width: 800, height: 800 }, banner: { width: 1584, height: 396 } };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file isn't an image this browser can open. Use a JPEG or PNG."));
    img.src = src;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(blob);
  });
}

/** A picked file as base64, redrawn as a JPEG first when it is large or not a type the server takes. */
export async function filePayload(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!needsShrink(file, { width: img.naturalWidth, height: img.naturalHeight })) return blobToBase64(file);
    const size = shrinkTo(img.naturalWidth, img.naturalHeight) ?? { width: img.naturalWidth, height: img.naturalHeight };
    const canvas = el("canvas", { width: size.width, height: size.height });
    canvas.getContext("2d").drawImage(img, 0, 0, size.width, size.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("That photo couldn't be prepared. Try a JPEG.");
    return blobToBase64(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A crop frame at the target's shape with zoom and position sliders, and a download at full size. */
function cropper({ src, kind, onDownload }) {
  const target = LINKEDIN[kind];
  const view = { zoom: 1, x: 0, y: 0 };
  const preview = el("canvas.im__crop", { width: kind === "banner" ? 792 : 400, height: kind === "banner" ? 198 : 400, class: kind === "headshot" ? "is-round" : null });
  let img = null;
  const draw = (canvas, w, h) => {
    if (!img) return;
    const { sx, sy, sw, sh } = cropBox(img.naturalWidth, img.naturalHeight, w, h, view);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };
  const paint = () => draw(preview, preview.width, preview.height);
  loadImage(src).then((loaded) => {
    img = loaded;
    paint();
  }).catch((e) => toast(e.message, "warn"));
  const slider = (label, key, min, max, step) =>
    el("label.im__slider", {}, el("span", {}, label),
      el("input", { type: "range", min, max, step, value: view[key], oninput: (event) => { view[key] = Number(event.target.value); paint(); } }));
  return el("div.im__cropper", {},
    preview,
    el("div.im__sliders", {}, slider("Zoom", "zoom", 1, 3, 0.01), slider("Left and right", "x", -1, 1, 0.01), slider("Up and down", "y", -1, 1, 0.01)),
    el("div.im__row", {}, btn({
      label: `Download ${target.width} x ${target.height}`,
      variant: "solid",
      onclick: () => {
        if (!img) return;
        const canvas = el("canvas", { width: target.width, height: target.height });
        draw(canvas, target.width, target.height);
        canvas.toBlob((blob) => {
          if (!blob) return toast("That download didn't work. Try again.", "warn");
          saveBlob(`linkedin-${kind}-${target.width}x${target.height}.jpg`, blob);
          onDownload?.();
        }, "image/jpeg", 0.92);
      },
    })));
}

export function renderImages(ctx) {
  const node = el("div.view.view--images");
  let slug = ctx.state.slug;
  let rec = null;
  let stage = null;
  let busy = "";
  let error = "";
  const downloaded = {};

  async function load() {
    if (!api.imagesReady()) {
      error = "Sign in to add your photos. They're saved to your account and only you can see them.";
      return render();
    }
    try {
      rec = await api.loadImages(slug);
      // Open on the first step not done, then stay put: adding one photo shouldn't jump the page.
      stage = stage || firstOpen(rec, downloaded);
      error = "";
    } catch (e) {
      error = e.message;
    }
    render();
  }

  async function run(label, fn) {
    if (busy) return;
    busy = label;
    render();
    try {
      const out = await fn();
      if (out) rec = out;
    } catch (e) {
      toast(e.message, "warn", { ms: 7000 });
    } finally {
      busy = "";
      render();
    }
  }

  const go = (id) => {
    stage = id;
    render();
  };

  /** An <img> for a stored image, filled once its private bytes arrive. */
  function thumb(id, cls = "im__thumb") {
    const img = el(`img.${cls}`, { alt: "", loading: "lazy" });
    api.imageUrl(slug, id).then((url) => { img.src = url; }).catch(() => img.classList.add("is-broken"));
    return img;
  }

  function uploader(kind, label, hint) {
    const input = el("input", { type: "file", accept: ACCEPT, class: "im__file" });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      run("Uploading.", async () => api.uploadImage(slug, kind, await filePayload(file)));
    });
    return el("label.im__drop", {}, el("b", {}, label), hint ? el("span", {}, hint) : null, input);
  }

  /* ---------- Photos ---------- */
  function photosBody() {
    const faces = rec.uploads.face || [];
    const full = faces.length >= rec.limits.faces;
    const one = (item, label) =>
      el("figure.im__item", {}, thumb(item.id), el("figcaption", {}, label),
        btn({ label: "Remove", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Removing.", () => api.removeImage(slug, item.id)) }));
    return [
      nodeIntro("Add 1 to 3 photos of your face", "Face a window, hold the phone at eye level, no sunglasses. Your headshot is made from these and still looks like you. Only you can see them."),
      el("div.im__grid", {}, faces.map((f, i) => one(f, `Photo ${i + 1}`))),
      full ? el("p.im__why", {}, "That's three. Remove one to add a different photo.") : uploader("face", faces.length ? "Add another photo" : "Choose a photo", "JPEG, PNG or WebP"),
      el("div.im__more", {},
        el("h3", {}, "Your current photo and banner (optional)"),
        el("p.im__why", {}, "If you have them, add them here. You can also crop them to LinkedIn's sizes on the last step."),
        el("div.im__grid", {},
          rec.uploads.photo_current ? one(rec.uploads.photo_current, "Current photo") : uploader("photo_current", "Current profile photo"),
          rec.uploads.banner_current ? one(rec.uploads.banner_current, "Current banner") : uploader("banner_current", "Current banner"))),
      faces.length ? el("div.im__row", {}, btn({ label: "Next: your headshot", variant: "solid", onclick: () => go("headshot") })) : null,
    ];
  }

  /* ---------- Headshot / Banner ---------- */
  function makeBody(kind) {
    const isHead = kind === "headshot";
    const options = rec.options[kind] || [];
    const picked = rec.picked[kind];
    const month = rec.month[kind];
    const room = month.limit - month.used >= 3;
    const ask = el("input.im__input", { placeholder: isHead ? "Anything to change? For example: a navy blazer" : "Anything to change? For example: deep blue, no circuit boards", maxLength: 200 });
    const needFace = isHead && !(rec.uploads.face || []).length && !rec.uploads.photo_current;
    const intro = isHead
      ? nodeIntro("Pick your headshot", "We make three from your photos, dressed for the job you want, with the same face. Pick the one that looks most like you on a good day.")
      : nodeIntro("Pick your banner", "We make three from the job you're aiming at and the style words you gave us. Pick the one you'd be glad to have behind your name.");
    const choices = options.length
      ? el("div.im__options", { class: isHead ? "is-square" : "is-wide" }, options.map((o) =>
        el("button.im__option", { type: "button", class: o.id === picked ? "is-picked" : null, "aria-pressed": o.id === picked ? "true" : "false", disabled: Boolean(busy),
          onclick: () => run("Saving your pick.", () => api.pickImage(slug, o.id === picked ? null : o.id, kind)) },
        thumb(o.id, "im__opt"), el("span.im__check", {}, o.id === picked ? "✓ Picked" : "Pick this"))))
      : null;
    if (!rec.ready) {
      // Making is off on the server: say so, keep any options made earlier pickable, and offer the crop.
      return [intro, el("p.im__note", {}, rec.note), choices,
        el("div.im__row", {}, btn({ label: picked ? "Next: download" : "Crop my own instead", variant: "solid", onclick: () => go("post") }))];
    }
    return [
      intro,
      needFace ? el("p.im__note", {}, "Add a photo of your face first.") : null,
      choices,
      el("div.im__make", {},
        options.length ? ask : null,
        el("div.im__row", {},
          btn({ label: busy ? "Making…" : options.length ? "Make three more" : `Make three ${isHead ? "headshots" : "banners"}`, variant: options.length ? "ghost" : "solid",
            disabled: Boolean(busy) || needFace || !room,
            onclick: () => run(`Making three ${isHead ? "headshots" : "banners"}. About a minute.`, () => api.makeImages(slug, kind, ask.value.trim())) }),
          el("span.im__meta", {}, room ? allowanceLine(month) : "That's this month's. Pick from what you have; more on the 1st."))),
      picked ? el("div.im__row", {}, btn({ label: isHead ? "Next: your banner" : "Next: download", variant: "solid", onclick: () => go(isHead ? "banner" : "post") })) : null,
    ];
  }

  /* ---------- Download ---------- */
  function postBody() {
    const piece = (kind) => {
      const source = sourceFor(rec, kind);
      const label = kind === "headshot" ? "Profile photo" : "Banner";
      if (!source) {
        return el("section.im__piece", {}, el("h3", {}, label),
          el("p.im__why", {}, kind === "headshot" ? "Pick a headshot, or add your current photo on the first step." : "Pick a banner, or add your current banner on the first step."));
      }
      const holder = el("div.im__holder", {}, el("p.im__why", {}, "Opening."));
      api.imageUrl(slug, source.id).then((src) => mount(holder, cropper({ src, kind, onDownload: () => { downloaded[kind] = true; render(); } })))
        .catch((e) => mount(holder, el("p.im__why", {}, e.message)));
      return el("section.im__piece", {}, el("h3", {}, `${label}${source.made ? "" : " (your own)"}`), holder);
    };
    return [
      nodeIntro("Download them at LinkedIn's sizes, then post them", "Drag the sliders until it sits right, then download. On LinkedIn, open your profile: click your photo to change it, and the camera on the banner to change that."),
      piece("headshot"),
      piece("banner"),
      el("p.im__why", {}, "Then tick the last task on this step of your map."),
    ];
  }

  function render() {
    if (error && !rec) return mount(node, el("div.im", {}, el("p.im__empty", {}, error), btn({ label: "← Map", variant: "quiet", onclick: () => ctx.navigate("map") })));
    if (!rec) return mount(node, el("div.im", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening your images."))));
    const here = stage || firstOpen(rec, downloaded);
    const body = { photos: photosBody, headshot: () => makeBody("headshot"), banner: () => makeBody("banner"), post: postBody }[here]();
    const head = el("header.im__head", {},
      el("div", {}, el("b.eyebrow", {}, "Profile images"), el("h1.im__title", {}, "Your headshot and banner")),
      btn({ label: "← Map", variant: "quiet", onclick: () => ctx.navigate("map") }));
    mount(node, el("div.im", {}, head,
      nodeRail({ nodes: STAGES, done: doneStages(rec, downloaded), here, onGo: go, label: "Image steps" }),
      el("div.im__card", { "aria-busy": busy ? "true" : null }, busy ? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body)));
  }

  render();
  load();
  return {
    node,
    update(next) {
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        rec = null;
        api.forgetImages();
        load();
      }
    },
    destroy() {
      api.forgetImages();
    },
  };
}
