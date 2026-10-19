/**
 * Injects the mark into any header on a static page, so the logo lives in one
 * file instead of being pasted into every document. The wordmark stays in the
 * HTML so the brand still reads with JavaScript off.
 */

import { gmark } from "./brand.js?v=59b2c4a-202610190812";

for (const brand of document.querySelectorAll(".nav__brand")) {
  if (!brand.querySelector("svg")) brand.prepend(gmark());
}
