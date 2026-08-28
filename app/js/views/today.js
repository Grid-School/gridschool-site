/**
 * Today. One next action, a conversation, an input at the bottom, credits on
 * the right. Everything else that used to live here — streaks, quota gadgets,
 * a second copy of the queue — is a tool or it is gone. A first-time student
 * should know what to do and who to talk to in under five seconds.
 *
 * This view is persistent. The camera of the conversation is the scroll
 * position; a task marked done elsewhere must not throw you back to the top.
 */

import { el, mount } from "../dom.js";
import { btn, toast } from "../ui.js";
import { COACH } from "../../../config.js";
import { nextAction } from "../coach/next.js";
import { credits, formatUsd, attachmentBudget } from "../coach/credits.js";
import { rememberIntent } from "../coach/memory.js";
import { sendTurn, coachIsLive } from "../coach/client.js";

const TEXT_FILES = /\.(txt|md|markdown|json|diff|patch|py|js|mjs|ts|tsx|jsx|css|html|rs|go|java|rb|sh|yml|yaml|toml|csv)$/i;

export function renderToday(ctx) {
  const nextbar = el("div.nextbar");
  const thread = el("div.thread", { "aria-live": "polite" });
  const creditsEl = el("span.composer__credits");
  const attachList = el("div.composer__files");
  const input = el("textarea.composer__input", {
    rows: 1,
    placeholder: "Talk about the next action. Shift+Enter for a new line.",
    "aria-label": "Message the Coach",
  });
  const fileInput = el("input", { type: "file", hidden: true, multiple: true, accept: ".txt,.md,.json,.diff,.py,.js,.ts,.tsx,.css,.html" });

  let current = ctx;
  let pending = [];
  let sending = false;

  const sendBtn = btn({ label: "Send", variant: "solid", onclick: () => submit() });
  const attachBtn = btn({
    label: "Add file",
    variant: "quiet",
    onclick: () => fileInput.click(),
  });

  const composer = el(
    "form.composer",
    {
      onsubmit: (event) => {
        event.preventDefault();
        submit();
      },
    },
    attachList,
    input,
    el(
      "div.composer__bar",
      {},
      attachBtn,
      el("span.composer__hint", {}, coachIsLive() ? COACH.model : "Demo reply. Same context, no Grok key yet."),
      creditsEl,
      sendBtn
    ),
    fileInput
  );

  const root = el("div.view.view--today", {}, nextbar, thread, composer);

  function paintNext() {
    const next = nextAction(current.state);
    const { store, navigate } = current;
    mount(
      nextbar,
      el("b.eyebrow", {}, next.kind === "review" ? "Read this first" : "Do this next"),
      el("h1.nextbar__title", {}, next.title),
      el("p.nextbar__why", {}, next.why),
      current.state.student.focus && el("p.nextbar__focus", {}, current.state.student.focus),
      el(
        "div.nextbar__acts",
        {},
        next.kind === "review"
          ? [
              btn({ label: "Got it", variant: "solid", onclick: () => store.markReviewRead(next.review.id) }),
              next.review.link && btn({ label: "The work ↗", variant: "quiet", href: next.review.link, target: "_blank" }),
            ]
          : next.node
            ? btn({
                label: "Go to this step",
                variant: "solid",
                onclick: () => navigate("map", next.node.id),
              })
            : btn({ label: "Open the Grid", variant: "solid", onclick: () => navigate("map") })
      )
    );
  }

  function paintCredits() {
    const budget = credits(current.state.student);
    creditsEl.textContent = `${formatUsd(budget.left)} left`;
    creditsEl.title = `${formatUsd(budget.spent)} of ${formatUsd(budget.cap)} used this month on ${budget.model}`;
    creditsEl.classList.toggle("is-low", budget.left < 5);
    creditsEl.classList.toggle("is-empty", budget.left <= 0);
  }

  function paintFiles() {
    mount(
      attachList,
      pending.map((file, index) =>
        el(
          "span.composer__chip",
          {},
          file.name,
          el(
            "button.composer__x",
            { type: "button", "aria-label": `Remove ${file.name}`, onclick: () => {
              pending.splice(index, 1);
              paintFiles();
            } },
            "×"
          )
        )
      )
    );
  }

  function greeting() {
    const next = nextAction(current.state);
    const line =
      next.kind === "review"
        ? `${next.title}. ${next.why} Mark it read when you have it, then we stay on the work.`
        : `Do this next: ${next.title}. ${next.why} Tell me where you are on it.`;
    return { role: "assistant", text: line, at: "seed", seed: true };
  }

  function paintThread() {
    const turns = current.state.student.chat?.turns ?? [];
    const rows = turns.length ? turns : [greeting()];
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
    mount(
      thread,
      rows.map((turn) =>
        el(
          "div.bubble",
          { class: `bubble--${turn.role}${turn.live === false ? " is-demo" : ""}` },
          el("b.bubble__who", {}, turn.role === "assistant" ? "Coach" : "You"),
          el("p", {}, turn.text),
          turn.files?.length && el("div.bubble__files", {}, turn.files.map((f) => el("span", {}, f.name)))
        )
      )
    );
    if (atBottom || !turns.length) thread.scrollTop = thread.scrollHeight;
  }

  async function submit() {
    if (sending) return;
    const text = input.value.trim();
    if (!text && !pending.length) return;

    const budget = attachmentBudget(pending, text);
    if (budget.over) {
      toast(`That paste is over the ${Math.round(COACH.maxPasteChars / 1000)}k character limit. Cut it down.`, "warn");
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    const files = pending.slice();
    const memoryNote = rememberIntent(text);
    input.value = "";
    pending = [];
    paintFiles();
    resize();

    const userTurn = {
      role: "user",
      text,
      at: new Date().toISOString(),
      files: files.map((file) => ({ name: file.name })),
    };

    try {
      const result = await sendTurn({ state: current.state, userText: text, files });
      current.store.recordTurn({
        user: userTurn,
        assistant: {
          role: "assistant",
          text: result.text,
          at: new Date().toISOString(),
          live: result.live,
        },
        usage: result.usage,
        memoryNote,
        memoryFiles: files,
      });
    } catch (error) {
      current.store.appendChat(userTurn);
      current.store.appendChat({
        role: "assistant",
        text: `I could not reach the model. ${error.message}`,
        at: new Date().toISOString(),
        live: false,
      });
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function resize() {
    input.style.height = "auto";
    input.style.height = `${Math.min(160, input.scrollHeight)}px`;
  }

  input.addEventListener("input", resize);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  fileInput.addEventListener("change", async () => {
    const picked = [...fileInput.files];
    fileInput.value = "";
    if (pending.length + picked.length > COACH.maxFiles) {
      toast(`At most ${COACH.maxFiles} files on one turn.`, "warn");
      return;
    }
    for (const file of picked) {
      if (!TEXT_FILES.test(file.name)) {
        toast(`${file.name} is not a text file I can read.`, "warn");
        continue;
      }
      if (file.size > COACH.maxFileBytes) {
        toast(`${file.name} is over ${Math.round(COACH.maxFileBytes / 1000)}k. Cut it down.`, "warn");
        continue;
      }
      pending.push({ name: file.name, text: await file.text() });
    }
    paintFiles();
  });

  paintNext();
  paintCredits();
  paintThread();
  paintFiles();

  return {
    node: root,
    update(nextCtx) {
      current = nextCtx;
      paintNext();
      paintCredits();
      paintThread();
    },
    destroy() {},
  };
}
