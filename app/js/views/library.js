/**
 * Library. One watch order. The first two before you send anything. After that,
 * the video sits on the step it belongs to. A real player is here so the size
 * and the spacing can be judged before the films exist.
 */

import { el } from "../dom.js";
import { panel, btn, empty } from "../ui.js";
import { loadLibrary } from "../api.js";
import { videoCard } from "./video.js";

export function renderLibrary(ctx) {
  const root = el("div.view.view--library", {}, el("p.muted", {}, "Loading the library."));

  loadLibrary().then((library) => {
    const nodeVideos = ctx.state.graph.nodes
      .filter((node) => node.video)
      .sort((a, b) => a.n - b.n);

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
        el("p.muted", {}, library.watchWhen)
      ),
      ...library.tracks.map((track) =>
        panel(
          { eyebrow: track.id === "first" ? "Start here" : "Next", title: track.title, note: track.blurb },
          el(
            "ol.lib",
            {},
            track.items.map((item, index) => {
              const ready = Boolean(item.path || item.youtube);
              const player = videoCard({
                title: item.title,
                mins: item.mins,
                youtube: item.youtube,
                path: item.path,
                thumb: item.thumb,
                watchWhen: item.watchWhen,
              });
              if (player) players.set(item.id, player);

              const watch = btn({
                label: ready ? "Watch" : "Not filmed yet",
                variant: "quiet",
                disabled: !ready,
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
                { "data-id": item.id, class: ready ? "is-ready" : "is-planned" },
                el("span.lib__n", {}, String(item.order ?? index + 1).padStart(2, "0")),
                el(
                  "div.lib__body",
                  {},
                  el("b", {}, item.title),
                  el("span.lib__meta", {}, `${item.mins} min`),
                  item.watchWhen && el("p.lib__when", {}, item.watchWhen),
                  player?.node
                ),
                watch
              );
              watch.classList.add("lib__watch");
              return row;
            })
          )
        )
      ),
      panel(
        {
          eyebrow: "On each step",
          title: "The same videos, on the Grid",
          note: "When you open a step you will see its video there too. You do not have to come back here.",
        },
        nodeVideos.length
          ? el(
              "div.lib__nodes",
              {},
              nodeVideos.map((node) =>
                el(
                  "button.libnode",
                  { type: "button", onclick: () => ctx.navigate("map", node.id) },
                  el("b", {}, `${String(node.n).padStart(2, "0")} · ${node.video.title}`),
                  el("span", {}, `${node.video.mins} min · ${node.title}`)
                )
              )
            )
          : empty("No step videos yet.")
      )
    );
  });

  return root;
}
