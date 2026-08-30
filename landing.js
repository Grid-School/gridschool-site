/**
 * Landing page: weekly-loop diagram + reveal-on-scroll.
 * The Living World hero boots from js/landing-world.js.
 */

import { loadReceipts, mountEvidence } from "./js/evidence.js";

const evidenceRoot = document.getElementById("evidence-record");
if (evidenceRoot) {
  loadReceipts()
    .then((data) => mountEvidence(evidenceRoot, data))
    .catch((err) => {
      console.warn("[landing] evidence panel:", err);
      evidenceRoot.innerHTML =
        '<p class="evidence__foot">Evidence panel failed to load. The receipts still exist: world server, GitHub, platform demo.</p>';
      evidenceRoot.classList.add("evidence", "is-ready");
    });
}

// The weekly loop: selecting a phase lights it and explains it.
// One light at a time, immediate feedback, keyboard included.
const loop = document.querySelector(".loop");
if (loop) {
  const read = loop.querySelector(".loop__read");
  const phases = loop.querySelectorAll("[data-phase]");
  const lines = {
    build: "Build. Ship a real change on the messy repo. Every week has one.",
    check: "Check. Show how you verified the model's work. Tests, evals, a failure log.",
    defend: "Defend. Explain the change out loud, to me and four others who read it.",
    publish: "Publish. Put it where a stranger can find it. The post, the PR, the demo.",
    proof: "Four moves, one output: evidence a hiring manager can check. That is what fills your board.",
  };
  const select = (node) => {
    phases.forEach((p) => p.classList.toggle("is-active", p === node));
    read.textContent = lines[node.dataset.phase];
  };
  phases.forEach((node) => {
    node.addEventListener("click", () => select(node));
    node.addEventListener("mouseenter", () => select(node));
    node.addEventListener("focus", () => select(node));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(node);
      }
    });
  });
}

const revealables = document.querySelectorAll("section.wrap, .seats");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 },
);
revealables.forEach((el) => {
  el.classList.add("reveal");
  io.observe(el);
});
