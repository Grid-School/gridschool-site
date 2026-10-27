/**
 * Today. One next action, a conversation, an input at the bottom, credits on
 * the right. Everything else that used to live here, streaks, quota gadgets,
 * a second copy of the queue, is a tool or it is gone. A first-time student
 * should know what to do and who to talk to in under five seconds.
 *
 * This view is persistent. The camera of the conversation is the scroll
 * position; a task marked done elsewhere must not throw you back to the top.
 */

import { el, mount } from "../dom.js?v=759fedf-202610271938";
import { btn, toast } from "../ui.js?v=759fedf-202610271938";
import { COACH } from "../../../config.js?v=759fedf-202610271938";
import { currentMove } from "../next-live.js?v=759fedf-202610271938";
import { nextUp } from "../graph/model.js?v=759fedf-202610271938";
import { credits, formatUsd, attachmentBudget } from "../coach/credits.js?v=759fedf-202610271938";
import { rememberIntent } from "../coach/memory.js?v=759fedf-202610271938";
import { sendTurn, coachIsLive, lastMonth } from "../coach/client.js?v=759fedf-202610271938";

const TEXT_FILES = /\.(txt|md|markdown|json|diff|patch|py|js|mjs|ts|tsx|jsx|css|html|rs|go|java|rb|sh|yml|yaml|toml|csv)$/i;

export function renderToday(ctx) {
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
      el("span.composer__hint", {}, coachIsLive(ctx.state.slug) ? "Your coach reads your map before answering." : "Practice mode. Replies are scripted until you sign in."),
      creditsEl,
      sendBtn
    ),
    fileInput
  );

  // The steer the coach set on the desk (student.focus), shown only while it names the step you're on.
  const steer = el("p.coach-steer", { hidden: true });
  const root = el("div.view.view--today", {}, steer, thread, composer);

  function paintSteer() {
    const focus = current.state.student.focus;
    const up = nextUp(current.state.graph);
    const names = Boolean(focus) && Boolean(up) &&
      (focus.toLowerCase().includes(up.title.toLowerCase().slice(0, 12)) ||
        (focus.toLowerCase().includes("board") && up.id === "or.start") ||
        (focus.toLowerCase().includes("boot") && up.id === "pf.runs") ||
        (focus.toLowerCase().includes("it runs") && up.id === "pf.runs"));
    steer.hidden = !names;
    if (names) mount(steer, el("b", {}, "From your coach: "), focus);
  }

  function paintCredits() {
    // The hosted coach's allowance comes from the server once it has answered; until then, the local meter.
    const month = lastMonth();
    const budget = month
      ? { cap: month.cap, spent: month.spent, left: Math.max(0, month.cap - month.spent), model: "your coach" }
      : credits(current.state.student);
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

  /** The coach opens on the one next move, the same words as the Next bar under the page. */
  function greeting() {
    const move = currentMove(current.state);
    const line =
      move.kind === "review"
        ? `${move.title}. ${move.why} Mark them read when you have them, then we stay on the work.`
        : `Your next move: ${move.title}. ${move.why} Tell me where you are on it.`;
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
          el("b.bubble__who", {}, turn.role === "assistant" ? "Your coach" : "You"),
          el("p", {}, turn.text),
          turn.files?.length ? el("div.bubble__files", {}, turn.files.map((f) => el("span", {}, f.name))) : null
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
        text: error.status ? error.message : `I could not reach your coach. ${error.message}`,
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

  paintSteer();
  paintCredits();
  paintThread();
  paintFiles();

  return {
    node: root,
    update(nextCtx) {
      current = nextCtx;
      paintSteer();
      paintCredits();
      paintThread();
    },
    destroy() {},
  };
}

