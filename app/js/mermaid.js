/**
 * Diagrams. Readings and lessons carry mermaid source inside a ```mermaid
 * fence (markdown) or a `mermaid` string on a lesson section (curriculum.json).
 * The renderer leaves that source as <code class="lang-mermaid"> text, so a
 * page with no diagram never loads the library. This module fetches mermaid
 * once, on the first page that needs it, and draws each block in place.
 *
 * If a diagram fails to parse, the source stays visible: readable text beats
 * an empty box, and the student can still learn the notation from it.
 */

import { el } from "./dom.js";

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";

/* Brand tokens from landing.css, restated here because mermaid paints SVG
   with its own palette and cannot read CSS variables. */
const THEME = {
  background: "#05070c",
  primaryColor: "#0e1a2e",
  primaryTextColor: "#e8ecf4",
  primaryBorderColor: "#28e1ff",
  secondaryColor: "#080c15",
  secondaryTextColor: "#cfdcea",
  secondaryBorderColor: "#16233d",
  tertiaryColor: "#10203a",
  tertiaryTextColor: "#cfdcea",
  tertiaryBorderColor: "#24344f",
  lineColor: "#7a8fa3",
  textColor: "#cfdcea",
  mainBkg: "#0e1a2e",
  nodeBorder: "#28e1ff",
  clusterBkg: "#080c15",
  clusterBorder: "#16233d",
  titleColor: "#ffffff",
  edgeLabelBackground: "#05070c",
  actorBkg: "#0e1a2e",
  actorBorder: "#28e1ff",
  actorTextColor: "#e8ecf4",
  signalColor: "#cfdcea",
  signalTextColor: "#cfdcea",
  labelBoxBkgColor: "#10203a",
  labelBoxBorderColor: "#24344f",
  labelTextColor: "#e8ecf4",
  noteBkgColor: "#10203a",
  noteBorderColor: "#ffb32b",
  noteTextColor: "#e8ecf4",
  fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  fontSize: "14px",
};

let loading = null;
let counter = 0;

/**
 * Mermaid sizes each box by measuring its label once, at render time. If the
 * webfont lands after that measurement, the fallback face is narrower and
 * every label is clipped by a few pixels. Wait for the fonts first.
 */
function fontsReady() {
  return document.fonts?.ready ?? Promise.resolve();
}

function load() {
  if (!loading) {
    loading = Promise.all([import(MERMAID_URL), fontsReady()]).then(([mod]) => {
      const mermaid = mod.default ?? mod;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: THEME,
        flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
        sequence: { mirrorActors: false },
      });
      return mermaid;
    });
  }
  return loading;
}

/** Build the source block a lesson section's `mermaid` string renders from. */
export function mermaidSource(src) {
  return el("pre", {}, el("code.lang-mermaid", {}, src));
}

/**
 * Replace every <code class="lang-mermaid"> under `root` with its drawing.
 * Returns how many diagrams were drawn. Safe to call more than once.
 */
export async function hydrateMermaid(root = document) {
  const blocks = [...root.querySelectorAll("code.lang-mermaid")].filter(
    (code) => !code.closest("pre")?.classList.contains("diagram--failed")
  );
  if (!blocks.length) return 0;

  let mermaid;
  try {
    mermaid = await load();
  } catch {
    // Offline or blocked CDN: leave the source readable and try again later.
    loading = null;
    return 0;
  }

  let drawn = 0;
  for (const code of blocks) {
    const pre = code.closest("pre") ?? code;
    if (!pre.isConnected) continue;
    const src = code.textContent;
    try {
      counter += 1;
      const { svg } = await mermaid.render(`mmd-${counter}`, src);
      const holder = el("div.diagram", { html: svg });
      pre.replaceWith(holder);
      drawn += 1;
    } catch {
      pre.classList.add("diagram--failed");
    }
  }
  return drawn;
}
