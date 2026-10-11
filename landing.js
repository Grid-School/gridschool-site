/**
 * Landing page behaviour. The page reads fully with JS off: the hero sentence
 * is a form, the specimens and copy are plain HTML. Script adds the drawn map
 * (js/landing-map.js), the one-time rez on the four specimens, the horizon at
 * the end, and B to focus Book.
 */

import { mountLandingMap } from "./js/landing-map.js?v=dc96989-202610110117";
import { enhancePickers } from "./js/picker.js?v=dc96989-202610110117";

enhancePickers();
mountLandingMap();

const nav = document.getElementById("nav");
const onScroll = () => nav?.classList.toggle("is-scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "b" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? "")) return;
  document.getElementById("cta")?.focus();
});

/* The recorded defense: a fixed waveform, the same on every load. */
const wave = document.getElementById("wave");
if (wave) {
  for (let i = 0; i < 90; i += 1) {
    const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11 + 1));
    const bar = document.createElement("i");
    bar.style.height = `${Math.round(v * 100)}%`;
    wave.append(bar);
  }
}

/* Rez once, on first sight. Never again on scroll back. */
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add(entry.target.id === "statement" ? "is-lit" : "is-in");
      io.unobserve(entry.target);
    }
  },
  { threshold: 0.35 }
);
document.querySelectorAll(".rez, #statement, #final").forEach((node, index) => {
  if (node.classList.contains("rez")) node.style.transitionDelay = `${(index % 2) * 120}ms`;
  io.observe(node);
});
