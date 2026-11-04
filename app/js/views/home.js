/**
 * Home, after the first week (ops/home-after-the-first-week.md): the record in the walk's words, with the map one
 * door away. Key Connections with the first week's row, the rule behind "next", the meanwhile solid and the
 * week's rhythm. The Map door opens this once the first note is out; the full map lives at #/map/all.
 */

import { el, mount } from "../dom.js?v=3c8024f-202611042144";
import { renderConnections } from "./connections.js?v=3c8024f-202611042144";

export function renderHome(ctx) {
  const root = el("div.view.view--hire.view--home.is-wide");
  let inner = renderConnections(ctx, { home: true });
  mount(root, inner.node);
  return {
    node: root,
    update(next) {
      inner.update(next);
    },
  };
}
