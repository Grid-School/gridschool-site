/**
 * Library. Films in watch order. Deep link only; not in the rail.
 * The film for a step also lives on that step. This is one ordered list.
 */

import { el } from "../dom.js";
import { panel, btn } from "../ui.js";
import { loadLibrary } from "../api.js";
import { videoCard } from "./video.js";

export function renderLibrary(ctx) {
  const root = el("div.view.view--library", {}, el("p.muted", {}, "Loading the library."));

  loadLibrary().then((library) => {
    let openId = null;
    const players = new Map();

    function closeOthers(except) {
      players.forEach((player, id) => {
        if (id !== except) player.close();
      });
      root.querySelectorAll(".lib__item.is-open").forEach((row) => {
        if (row.dataset.id !== except) {
          row.classList.remove("is-open");
          const watch = row.querySelector(".lib__watch");
          if (watch) watch.textContent = "Watch";
        }
      });
    }

    root.replaceChildren(
      el(
        "header.view__head",
        {},
        el("b.eyebrow", {}, "Watch in this order"),
        el("h1", {}, "Library"),
        library.note && el("p.muted", {}, library.note)
      ),
      ...library.tracks.map((track) =>
        panel(
          { eyebrow: track.id === "first" ? "Start here" : "Next", title: track.title, note: track.blurb },
          el(
            "ol.lib",
            {},
            track.items.map((item, index) => {
              const player = videoCard({
                title: item.title,
                mins: item.mins,
                youtube: item.youtube,
                path: item.path || (item.youtube ? undefined : "test-bbb"),
                thumb: item.thumb,
              });
              if (player) players.set(item.id, player);

              const watch = btn({
                label: "Watch",
                variant: "quiet",
                disabled: !player,
                onclick: () => {
                  if (!player) return;
                  const open = player.toggle();
                  row.classList.toggle("is-open", open);
                  watch.textContent = open ? "Hide" : "Watch";
                  if (open) {
                    closeOthers(item.id);
                    openId = item.id;
                  } else if (openId === item.id) {
                    openId = null;
                  }
                },
              });

              const row = el(
                "li.lib__item",
                { "data-id": item.id, class: player ? "is-ready" : "" },
                el("span.lib__n", {}, String(item.order ?? index + 1).padStart(2, "0")),
                el(
                  "div.lib__body",
                  {},
                  el("b", {}, item.title),
                  el("span.lib__meta", {}, `${item.mins} min`),
                  player?.node
                ),
                watch
              );
              watch.classList.add("lib__watch");
              return row;
            })
          )
        )
      )
    );
  });

  return root;
}
