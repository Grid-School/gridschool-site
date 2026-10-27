/**
 * Talk to the Coach. When `COACH.endpoint` is a live proxy this POSTs the
 * packed messages and records billed usage. When it is not, a local reply is
 * composed from the same pack so the product is walkable without a key.
 *
 * The local reply is labelled in the thread. Credits still move, using the
 * estimate, so a student learns the meter before anyone pastes an API key.
 */

import { COACH, PERSIST, isPlaceholder } from "../../../config.js?v=759fedf-202610271938";
import { loadCoachPrompt } from "../api.js?v=759fedf-202610271938";
import { persistToken } from "../session.js?v=759fedf-202610271938";
import { packContext, recentTurns } from "./pack.js?v=759fedf-202610271938";
import { estimateTokens, costUsd, monthKey, wouldExceed } from "./credits.js?v=759fedf-202610271938";
import { lowerFirst } from "../copy.js?v=759fedf-202610271938";

const corpusCache = { text: null, promise: null };

async function loadCorpus() {
  if (corpusCache.text !== null) return corpusCache.text;
  if (!corpusCache.promise) {
    corpusCache.promise = fetch(COACH.corpusUrl, { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : ""))
      .catch(() => "");
  }
  corpusCache.text = await corpusCache.promise;
  return corpusCache.text;
}

/**
 * The hosted coach lives on the notebook server (server/coach_api.py): COACH.endpoint "persist" means
 * POST <PERSIST.endpoint>/students/<slug>/coach with the student's own token. The demo board and a
 * device without a token stay on practice replies.
 */
export function coachUrl(slug, { coach = COACH, persist = PERSIST, token = persistToken() } = {}) {
  if (!coach.hosted || !coach.endpoint || isPlaceholder(coach.endpoint)) return null;
  if (coach.endpoint !== "persist") return coach.endpoint;
  if (!slug || slug === "demo" || !token || !persist?.endpoint || isPlaceholder(persist.endpoint)) return null;
  return `${persist.endpoint.replace(/\/$/, "")}/students/${encodeURIComponent(slug)}/coach`;
}

let liveSlug = null;

function live(slug = liveSlug) {
  return Boolean(coachUrl(slug));
}

/** What the server said about this month the last time it answered: { spent, cap }. */
let serverMonth = null;
export const lastMonth = () => serverMonth;

function localReply(pack, userText) {
  const { next } = pack;
  const opener =
    next.kind === "review"
      ? `Read the returned review first: ${next.title}. ${next.why}`
      : next.kind === "wait"
        ? `${next.title} Continue with another open step while you wait.`
        : `Your next action is: ${next.title}.`;

  const asked = /how|what|why|where|stuck|review|help|don't|dont|can't|cant/i.test(userText);
  const closer = asked
    ? "List the checks you ran in order, starting with the most recent file, page, or command you opened."
    : next.task
      ? `Done when ${lowerFirst(next.task.done_when ?? "a stranger can open a URL")}. What is the first thing you will check?`
      : "Open the step on the Board, save the required URL, or describe the most recent action you tried.";

  return `${opener} ${closer}`;
}

async function postLive({ url, board, history, userText, files }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${persistToken()}` },
    body: JSON.stringify({
      message: userText,
      board,
      history: history.map((turn) => ({ role: turn.role, text: turn.content })),
      files: files.map((file) => ({ name: file.name, text: file.text })),
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (payload?.month) serverMonth = payload.month;
  if (!res.ok) {
    const error = new Error(payload?.error || `The coach answered ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return payload;
}

/**
 * One turn. Callers persist the returned usage and the assistant text.
 * Throws if the month is spent, the proxy fails, or the pack cannot load.
 */
export async function sendTurn({ state, userText, files = [] }) {
  const prompt = await loadCoachPrompt(COACH.promptUrl);
  const corpus = await loadCorpus();
  const pack = packContext({ state, prompt, corpus, userText, files });
  // Practice replies keep the local meter; the hosted coach's allowance is the server's to enforce.
  const gate = coachUrl(state.slug) ? { blocked: false } : wouldExceed(state.student, `${pack.system}\n${pack.user}`);
  if (gate.blocked) {
    return {
      ok: false,
      reason: "credits",
      text: `You have used this month's ${COACH.monthlyUsd}-dollar Coach budget. The budget resets on the first day of the month. Continue with the next action shown on the Board.`,
      usage: null,
      live: false,
      next: pack.next,
    };
  }

  const history = recentTurns(state.student.chat?.turns);
  const inputTokens = estimateTokens([pack.system, ...history.map((t) => t.content), pack.user].join("\n"));

  liveSlug = state.slug;
  const url = coachUrl(state.slug);
  if (url) {
    // The server holds the real monthly allowance and answers 429 when it is spent.
    const payload = await postLive({ url, board: pack.board, history, userText, files });
    const text = String(payload?.text ?? "");
    const usage = payload?.usage ?? {};
    const inTok = usage.inTokens ?? inputTokens;
    const outTok = usage.outTokens ?? estimateTokens(text);
    return {
      ok: true,
      text: text.trim(),
      live: true,
      next: pack.next,
      usage: {
        at: new Date().toISOString(),
        month: monthKey(),
        inTokens: inTok,
        outTokens: outTok,
        usd: usage.usd ?? costUsd({ inputTokens: inTok, outputTokens: outTok }),
      },
    };
  }

  const text = localReply(pack, userText);
  return {
    ok: true,
    text,
    live: false,
    next: pack.next,
    usage: {
      at: new Date().toISOString(),
      month: monthKey(),
      inTokens: inputTokens,
      outTokens: estimateTokens(text),
      usd: costUsd({ inputTokens, outputTokens: estimateTokens(text) }),
    },
  };
}

export const coachIsLive = live;
