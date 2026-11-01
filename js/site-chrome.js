/**
 * Injects the mark into any header on a static page, so the logo lives in one
 * file instead of being pasted into every document. The wordmark stays in the
 * HTML so the brand still reads with JavaScript off.
 */

import { gmark } from "./brand.js?v=7b0c6e7-202611010037";

for (const brand of document.querySelectorAll(".nav__brand")) {
  if (!brand.querySelector("svg")) brand.prepend(gmark());
}
