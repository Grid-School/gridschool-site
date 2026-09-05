/**
 * Landing page: reveal-on-scroll only. Garnish, never load-bearing; the page
 * reads fully with JS off. The former hero world and evidence panel live in
 * archive/2026-09-04-lock-era/site-hero-world/.
 */

const revealables = document.querySelectorAll("section.wrap, section.sec");
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
