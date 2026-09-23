/** One button asks the authenticated GridSchool queue for an unseen post. */

import { el } from "../dom.js";
import { btn, field } from "../ui.js";
import { formatAge } from "../posts/age.js";
import { SUGGESTIONS, addKeyword, parseKeywords } from "../posts/search.js";
import { loadDesk, saveDesk, todayKey } from "../posts/desk.js";
import { fetchNextOpportunity, markOpportunity, queueEnabled } from "../posts/remote.js";

export function renderPosts(ctx) {
  const root = el("div.view.view--posts");
  const slug = ctx.state.slug;
  const today = todayKey();
  let desk = loadDesk(safeStorage(), slug, today);
  let status = "";
  let busy = false;

  function persist() {
    try {
      saveDesk(safeStorage(), slug, desk);
    } catch {
      status = "This browser blocked saving your interests. The server still remembers assigned posts.";
    }
  }

  function draw() {
    const keywords = field({
      label: "Interests",
      id: "post-interests",
      value: desk.keywords,
      placeholder: "observability, evaluation, incident response",
      hint: "Separate interests with commas. Six at most.",
    });
    keywords.input.addEventListener("input", () => {
      desk.keywords = keywords.input.value;
      persist();
    });

    const page = [
      el(
        "header.view__head",
        {},
        el("b.eyebrow", {}, "Today"),
        el("h1", {}, "Next post"),
        el(
          "p.muted",
          {},
          "Click once. GridSchool opens the best fresh post you have not received before. Every author is a vetted US founder or technical leader with a real 2 to 300 person company and 2,000 to 50,000 followers."
        )
      ),
      el(
        "section.panel",
        {},
        el(
          "div.panel__body",
          {},
          keywords.node,
          suggest(keywords),
          el(
            "div.view__nav",
            {},
            btn({
              label: busy ? "Finding the next one" : "Next post",
              variant: "solid",
              disabled: busy,
              onclick: () => nextPost(keywords.input.value),
            })
          ),
          status ? el("p.posts__status", { role: "status" }, status) : null,
          !queueEnabled(slug)
            ? el(
                "p.posts__status",
                {},
                slug === "demo"
                  ? "The demo board does not consume live opportunities. Sign in to a student board to use the shared queue."
                  : "This board is not connected to the live opportunity queue."
              )
            : null
        )
      ),
    ];
    if (desk.current) page.push(currentCard(desk.current));
    root.replaceChildren(...page);
  }

  function suggest(keywords) {
    return el(
      "div.posts__suggest",
      {},
      ...SUGGESTIONS.map((phrase) =>
        el(
          "button.chip2",
          {
            type: "button",
            onclick: () => {
              desk.keywords = addKeyword(keywords.input.value, phrase);
              persist();
              draw();
            },
          },
          phrase
        )
      )
    );
  }

  function currentCard(post) {
    const snippet = post.text.length > 280 ? `${post.text.slice(0, 277)}...` : post.text;
    return el(
      "section.panel",
      {},
      el(
        "div.panel__body",
        {},
        el(
          "article.posts__row",
          {},
          el("div.posts__score", {}, String(post.score ?? "")),
          el(
            "div",
            {},
            el("b.posts__who", {}, post.author || "LinkedIn member"),
            post.headline ? el("span.posts__headline", {}, post.headline) : null,
            el(
              "span.posts__meta",
              {},
              [formatAge(post.ageMinutes), countLabel(post.comments, "comment"), countLabel(post.reactions, "reaction")]
                .filter(Boolean)
                .join(" · ")
            ),
            el("p.posts__text", {}, snippet),
            post.gapLabel ? el("span.posts__gap", {}, post.gapLabel) : null,
            post.reason ? el("p.posts__why", {}, post.reason) : null
          ),
          el(
            "div.posts__actions",
            {},
            btn({ label: "Open again", variant: "ghost", href: post.url, target: "_blank" }),
            btn({
              label: post.state === "commented" ? "Commented" : "I commented",
              variant: "quiet",
              disabled: post.state === "commented",
              onclick: () => complete(post, "commented"),
            }),
            btn({
              label: "Skip",
              variant: "quiet",
              disabled: post.state === "skipped",
              onclick: () => complete(post, "skipped"),
            })
          )
        )
      )
    );
  }

  async function nextPost(rawKeywords) {
    desk.keywords = rawKeywords;
    persist();
    if (!parseKeywords(desk.keywords).length) {
      status = "Add at least one interest, separated by commas.";
      draw();
      return;
    }
    if (!queueEnabled(slug)) {
      status =
        slug === "demo"
          ? "The demo board does not use live posts. Sign in to a student board."
          : "The live queue is not connected for this board.";
      draw();
      return;
    }
    const tab = window.open("about:blank", "gridschool-posts");
    if (!tab) {
      status = "The browser blocked the new tab. Allow popups for this site, then click Next post again.";
      draw();
      return;
    }
    busy = true;
    status = "Choosing the best unseen post.";
    draw();
    try {
      const payload = await fetchNextOpportunity(slug, parseKeywords(desk.keywords));
      const opportunity = payload.opportunity;
      if (!opportunity) {
        closeTab(tab);
        status =
          "No fresh qualified post is available right now. The next refresh will add one when a vetted leader posts.";
        return;
      }
      desk.current = normalizeOpportunity(opportunity);
      persist();
      tab.location = opportunity.url;
      tab.opener = null;
      markOpportunity(slug, opportunity.id, "opened").catch(() => {});
      status = `${opportunity.author} is open. ${opportunity.gap_label} Click Next post for another.`;
    } catch (error) {
      closeTab(tab);
      status = error.status === 401
        ? "Your session expired. Sign in again."
        : "The opportunity queue is unavailable right now. Try again shortly.";
    } finally {
      busy = false;
      draw();
    }
  }

  async function complete(post, state) {
    if (!queueEnabled(slug) || busy) return;
    busy = true;
    try {
      await markOpportunity(slug, post.id || post.post_id, state);
      desk.current = { ...post, state };
      persist();
      status = state === "commented" ? "Comment recorded. Ask for the next post." : "Skipped. Ask for the next post.";
    } catch {
      status = "That update did not save. Try again.";
    } finally {
      busy = false;
      draw();
    }
  }

  draw();
  return root;
}

function countLabel(count, word) {
  if (count == null) return "";
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function normalizeOpportunity(opportunity) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(opportunity.published_at).getTime()) / 60000)
  );
  return {
    ...opportunity,
    post_id: opportunity.id,
    ageMinutes: Number.isFinite(minutes) ? minutes : null,
    gapLabel: opportunity.gap_label,
  };
}

function closeTab(tab) {
  try {
    tab.close();
  } catch {
    /* The student may already have closed it. */
  }
}

function safeStorage() {
  try {
    return localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
