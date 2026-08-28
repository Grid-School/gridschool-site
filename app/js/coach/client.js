/**
 * Talk to the Coach. When `COACH.endpoint` is a live proxy this POSTs the
 * packed messages and records billed usage. When it is not, a local reply is
 * composed from the same pack so the product is walkable without a key.
 *
 * The local reply is labelled in the thread. Credits still move, using the
 * estimate, so a student learns the meter before anyone pastes an API key.
 */

import { COACH, isPlaceholder } from "../../../config.js";
import { loadCoachPrompt } from "../api.js";
import { packContext, recentTurns } from "./pack.js";
import { estimateTokens, costUsd, monthKey, wouldExceed } from "./credits.js";

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

function live() {
  return Boolean(COACH.hosted && COACH.endpoint && !isPlaceholder(COACH.endpoint));
}

function localReply(pack, userText) {
  const { next } = pack;
  const opener =
    next.kind === "review"
      ? `Read this first: ${next.title}. ${next.why}`
      : next.kind === "wait"
        ? `Nothing is on you. ${next.title}.`
        : `Do this next: ${next.title}.`;

  const asked = /how|what|why|where|stuck|review|help|don't|dont|can't|cant/i.test(userText);
  const closer = asked
    ? "What did you actually check, in order? Start with the last thing you opened."
    : next.task
      ? `Done when ${next.task.done_when ?? "a stranger can open a URL"}. What is the first thing you will check?`
      : "Open the step on the Grid, attach the URL, or tell me the last thing you tried.";

  return `${opener} ${closer}`;
}

async function postLive({ system, history, user }) {
  const res = await fetch(COACH.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: COACH.model,
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Coach proxy returned ${res.status}`);
  }
  return res.json();
}

/**
 * One turn. Callers persist the returned usage and the assistant text.
 * Throws if the month is spent, the proxy fails, or the pack cannot load.
 */
export async function sendTurn({ state, userText, files = [] }) {
  const prompt = await loadCoachPrompt(COACH.promptUrl);
  const corpus = await loadCorpus();
  const pack = packContext({ state, prompt, corpus, userText, files });
  const gate = wouldExceed(state.student, `${pack.system}\n${pack.user}`);
  if (gate.blocked) {
    return {
      ok: false,
      reason: "credits",
      text: `This month's ${COACH.monthlyUsd} dollars of Grok are spent. The meter resets on the first of the month. Work the next action without me until then.`,
      usage: null,
      live: false,
      next: pack.next,
    };
  }

  const history = recentTurns(state.student.chat?.turns);
  const inputTokens = estimateTokens([pack.system, ...history.map((t) => t.content), pack.user].join("\n"));

  if (live()) {
    const payload = await postLive({ system: pack.system, history, user: pack.user });
    const text = payload?.text ?? payload?.choices?.[0]?.message?.content ?? "";
    const usage = payload?.usage ?? {};
    const inTok = usage.prompt_tokens ?? inputTokens;
    const outTok = usage.completion_tokens ?? estimateTokens(text);
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
        usd: costUsd({ inputTokens: inTok, outputTokens: outTok }),
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
