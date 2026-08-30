/**
 * Library. Films in watch order when they exist. Graph textbook modules open
 * from the step they belong to, not a second school at /read/.
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

    const moduleHosts = [];
    for (const node of ctx.state.graph.nodes) {
      for (const module of node.modules ?? []) {
        const mid = module.id ?? moduleHrefToId(module.href);
        if (!mid) continue;
        moduleHosts.push({ node, module, mid });
      }
    }

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
      ),
      moduleHosts.length
        ? panel(
            {
              eyebrow: "Deeper reading",
              title: "Graph textbook and briefs",
              note: "These open under the step they belong to, and your progress stays on the board.",
            },
            el(
              "div.lib__nodes",
              {},
              moduleHosts.map(({ node, module, mid }) =>
                el(
                  "button.libnode",
                  {
                    type: "button",
                    onclick: () => ctx.navigate("map", node.id, "m", ...mid.split("/")),
                  },
                  el("b", {}, module.title),
                  el("span", {}, `${String(node.n).padStart(2, "0")} · ${node.title}`)
                )
              )
            )
          )
        : null,
      el(
        "p.lib__foot.muted",
        {},
        "Public mirror URLs under /read/ still work for sharing. You never need to browse that index to finish a step."
      )
    );
  });

  return root;
}

function moduleHrefToId(href) {
  if (!href) return null;
  const m = String(href).match(/[?&]m=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
