/** One button asks the authenticated GridSchool queue for an unseen post. */

import { el } from "../dom.js?v=71f92ac-202610080806";
import { btn, field } from "../ui.js?v=71f92ac-202610080806";
import { formatAge } from "../posts/age.js?v=71f92ac-202610080806";
import { SUGGESTIONS, addKeyword, parseKeywords } from "../posts/search.js?v=71f92ac-202610080806";
import { loadDesk, rememberSeen, saveDesk, todayKey } from "../posts/desk.js?v=71f92ac-202610080806";
import {
  fetchNextOpportunity,
  fetchPreviewOpportunity,
  markOpportunity,
  queueMode,
  retireOpportunity,
} from "../posts/remote.js?v=71f92ac-202610080806";

const OFF_NOTE = {
  demo: "The demo board does not use live posts. Sign in to a student board.",
  other: "The live queue is not connected for this board.",
};

export function renderPosts(ctx) {
  const root = el("div.view.view--posts");
  const slug = ctx.state.slug;
  const today = todayKey();
  const mode = queueMode(slug);
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
          modeNote()
        )
      ),
    ];
    if (desk.current) page.push(currentCard(desk.current));
    root.replaceChildren(...page);
  }

  function modeNote() {
    if (mode === "preview") {
      return el(
        "p.posts__status.posts__status--dev",
        {},
        `Developer preview. Real posts from the live queue, but nothing is recorded on the server and no student slot is used. This browser remembers ${desk.seen.length} post${desk.seen.length === 1 ? "" : "s"} it already opened.`
      );
    }
    if (mode === "off") return el("p.posts__status", {}, slug === "demo" ? OFF_NOTE.demo : OFF_NOTE.other);
    return null;
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
              disabled: post.state === "skipped" || post.state === "comments_closed",
              onclick: () => complete(post, "skipped"),
            }),
            btn({
              label: "Comments closed",
              variant: "quiet",
              disabled: post.state === "comments_closed",
              onclick: () => complete(post, "comments_closed"),
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
    if (mode === "off") {
      status = slug === "demo" ? OFF_NOTE.demo : OFF_NOTE.other;
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
      const interests = parseKeywords(desk.keywords);
      const payload =
        mode === "preview"
          ? await fetchPreviewOpportunity(interests, desk.seen)
          : await fetchNextOpportunity(slug, interests);
      const opportunity = payload.opportunity;
      if (!opportunity) {
        closeTab(tab);
        status =
          mode === "preview"
            ? "No commentable post is left that this browser has not already opened. Try again in a few minutes."
            : "No commentable post is available right now. Try again in a few minutes.";
        return;
      }
      desk.current = normalizeOpportunity(opportunity);
      if (mode === "preview") desk.seen = rememberSeen(desk.seen, opportunity.id);
      persist();
      tab.location = opportunity.url;
      tab.opener = null;
      if (mode === "live") markOpportunity(slug, opportunity.id, "opened").catch(() => {});
      status = `${opportunity.author} is open. ${opportunity.gap_label} Click Next post for another.`;
    } catch (error) {
      closeTab(tab);
      status = failureMessage(error);
    } finally {
      busy = false;
      draw();
    }
  }

  function failureMessage(error) {
    if (mode === "preview" && error.status === 403) {
      return "Developer preview needs the admin token. Open the local admin console, save the admin token there, then come back.";
    }
    if (error.status === 401) {
      return mode === "preview"
        ? "The saved token was refused. Save the current admin token in the local admin console."
        : "Your session expired. Sign in again.";
    }
    return "The opportunity queue is unavailable right now. Try again shortly.";
  }

  async function complete(post, state) {
    if (mode === "off" || busy) return;
    let advance = state === "skipped" || state === "comments_closed";
    if (mode === "preview") {
      desk.current = { ...post, state };
      persist();
      if (state === "comments_closed") {
        await retireOpportunity(post.id || post.post_id).catch(() => {});
      }
      if (advance) {
        status = state === "comments_closed"
          ? "Comments are closed on that post. Finding another."
          : "Skipped. Finding another.";
        draw();
        await nextPost(desk.keywords);
        return;
      }
      status = "Marked on this browser only. Developer preview records nothing on the server.";
      draw();
      return;
    }
    busy = true;
    try {
      const assignment = state === "comments_closed" ? "skipped" : state;
      await markOpportunity(slug, post.id || post.post_id, assignment);
      if (state === "comments_closed") {
        await retireOpportunity(post.id || post.post_id);
      }
      desk.current = { ...post, state };
      persist();
      status =
        state === "commented"
          ? "Comment recorded. Ask for the next post."
          : state === "comments_closed"
            ? "Comments are closed on that post. Finding another."
            : "Skipped. Finding another.";
    } catch {
      status = "That update did not save. Try again.";
      advance = false;
    } finally {
      busy = false;
      draw();
    }
    if (advance) await nextPost(desk.keywords);
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
