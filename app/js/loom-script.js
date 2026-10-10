/**
 * The Loom script, written by the student as fill-in-the-blanks. Same shape
 * as the video planner's beats (data/video/formula.json): each beat has a job,
 * each blank a question, a hint, a starter sentence to finish, and a made-up
 * example that shows the tone. The answers become the script the rehearsal
 * prompter reads. Pure, so it runs in node tests.
 *
 * The voice is casual and specific: what they read, which role, what they
 * built, why they care. The check below flags the phrases that make a
 * script sound like a template.
 */

/** Words per second when someone talks at a relaxed pace (about 150 a minute). */
export const WORDS_PER_SECOND = 2.5;

export const BEATS = [
  {
    id: "hello",
    name: "Hello, and what caught your eye",
    blanks: [
      {
        id: "hello",
        q: "Say hi and who you are, the way you'd introduce yourself to someone at a meetup.",
        starter: "Hey ___, I'm ___. I'm a software engineer, and most of my work has been ___.",
        example: "Hey Priya, I'm Sam. I'm a software engineer, and most of my work has been backend integrations for insurance and payments.",
      },
      {
        id: "noticed",
        q: "What did you notice when you looked into them? Pick something you actually read, used or watched: their product, a blog post, the changelog, a talk, a customer story.",
        hint: "One specific thing is enough. If you can't name one yet, spend ten more minutes on their site before you record.",
        starter: "I was reading ___, and ___ stuck with me.",
        example: "I was reading your post about moving claim payouts to background jobs, and the part about a person approving anything over $5,000 stuck with me.",
      },
    ],
  },
  {
    id: "role",
    name: "The role",
    blanks: [
      {
        id: "role",
        q: "Which role are you reaching out about, and what part of it would you enjoy doing on a normal Tuesday?",
        starter: "I'm reaching out about the ___ role. The part I'd really enjoy is ___.",
        example: "I'm reaching out about the forward deployed engineer role. The part I'd really enjoy is sitting with a customer's team and getting the agent working inside the systems they already have.",
      },
    ],
  },
  {
    id: "proof",
    name: "Something you've done that's close",
    blanks: [
      {
        id: "match",
        q: "What have you worked on that's close to what they need? Say what it was, what was hard about it, and how it turned out.",
        hint: "\"What they need owned\" above has ideas. Use real numbers only, and leave a number out rather than guess it.",
        starter: "Something close to that I've worked on is ___. The hard part was ___, and ___.",
        example: "Something close to that I've worked on is an approval step for an insurance claims tool. The hard part was making sure nothing paid out until a person signed off, and every action ended up in a log the ops team could search.",
      },
      {
        id: "show",
        q: "What will be on your screen while you say that?",
        hint: "A repo, a running demo, a pull request or a diagram. Open it before you start recording.",
        starter: "",
        example: "The repo, scrolled to the approval check and the test that fails without it.",
        stage: true,
      },
    ],
  },
  {
    id: "personal",
    name: "Why this company, for you",
    blanks: [
      {
        id: "personal",
        q: "Why does this company matter to you? Their mission, the people they serve, how the team works, or something from your own life.",
        hint: "Say the real reason, even if it's small. \"The problems look fun and the team seems kind\" is a fine answer if it's true.",
        starter: "Honestly, the reason this one stands out to me is ___.",
        example: "Honestly, the reason this one stands out to me is that my mom spent months chasing a claim that should've taken a week. Making that faster without making it careless is work I'd be proud of.",
      },
    ],
  },
  {
    id: "ask",
    name: "One easy next step",
    blanks: [
      {
        id: "ask",
        q: "What's one small next step they could say yes to?",
        starter: "If it's useful, I'd like 15 minutes to talk about ___. And if you're not the right person, a pointer would really help. Thanks for watching.",
        example: "If it's useful, I'd like 15 minutes to talk about how you're handling approvals as the agent takes on more. And if you're not the right person, a pointer would really help. Thanks for watching.",
      },
    ],
  },
];

export const BLANK_IDS = BEATS.flatMap((beat) => beat.blanks.map((blank) => blank.id));

const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const stamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export const wordCount = (text) => (clean(text).match(/\S+/g) ?? []).length;

/** Only the known blanks, trimmed, nothing empty. */
export function tidyAnswers(answers) {
  const out = {};
  for (const id of BLANK_IDS) {
    const text = String(answers?.[id] ?? "").trim().slice(0, 1200);
    if (text) out[id] = text;
  }
  return out;
}

/**
 * The answers as timed beats, in the shape the prompter reads:
 * [{ t: "0:00", say: "Hey Priya, I'm Sam..." }]. The screen note goes in
 * brackets so the prompter shows it as a stage direction. Empty beats drop out.
 */
export function composeBeats(answers) {
  const a = tidyAnswers(answers);
  const beats = [];
  let seconds = 0;
  for (const beat of BEATS) {
    const spoken = beat.blanks.filter((b) => !b.stage).map((b) => clean(a[b.id])).filter(Boolean).join(" ");
    const stage = beat.blanks.filter((b) => b.stage).map((b) => clean(a[b.id])).filter(Boolean);
    if (!spoken) continue;
    beats.push({ t: stamp(seconds), say: stage.length ? `[${stage.join("; ")}] ${spoken}` : spoken });
    seconds += wordCount(spoken) / WORDS_PER_SECOND;
  }
  return beats;
}

/** Roughly how long the script runs out loud. */
export function scriptSeconds(answers) {
  const a = tidyAnswers(answers);
  const words = BEATS.flatMap((beat) => beat.blanks.filter((b) => !b.stage)).reduce((n, b) => n + wordCount(a[b.id]), 0);
  return Math.round(words / WORDS_PER_SECOND);
}

/** How many "___" are still waiting for their words. */
export function blanksLeft(answers) {
  return Object.values(tidyAnswers(answers)).reduce((n, text) => n + (text.match(/_{2,}/g) ?? []).length, 0);
}

/** Phrases that make a script sound like a template, with what to do instead. */
const TELLS = [
  [/—/, "—", "Spoken sentences don't have dashes. Split it into two sentences."],
  [/\bpassionate\b/i, "passionate", "Say what you actually did or want to do."],
  [/\bleverag(e|ing)\b/i, "leverage", "Say \"use\"."],
  [/\bsynerg/i, "synergy", "Say what would actually happen."],
  [/\bcutting[- ]edge\b/i, "cutting-edge", "Name the thing."],
  [/\binnovative\b/i, "innovative", "Name what's new about it."],
  [/\bthrilled\b|\bexcited to\b/i, "excited / thrilled", "Show it with the specific thing you noticed."],
  [/\bgame[- ]?changer\b/i, "game-changer", "Say what changes, for whom."],
  [/\bseamless(ly)?\b/i, "seamless", "Say what works without a hitch."],
  [/\brobust\b/i, "robust", "Say what it survives."],
  [/\bfast[- ]paced\b/i, "fast-paced", "Leave it out."],
  [/\bresults[- ]driven\b|\bdetail[- ]oriented\b|\bteam player\b/i, "a resume adjective", "Tell the story that shows it."],
  [/\badd value\b|\bvalue[- ]add\b/i, "add value", "Say what you'd build or fix."],
  [/\bhit the ground running\b/i, "hit the ground running", "Say what you'd do in the first week."],
  [/\bpick your brain\b/i, "pick your brain", "Ask for 15 minutes about one topic."],
  [/\b(great|perfect|ideal) fit\b/i, "great fit", "Let the example make the case."],
  [/\bdeep dive\b/i, "deep dive", "Say \"look closely at\"."],
  [/\bin today's\b/i, "in today's world", "Start with the specific thing."],
];

/** Every template phrase found in the answers, once each. */
export function voiceFlags(answers) {
  const text = Object.values(tidyAnswers(answers)).join("\n");
  return TELLS.filter(([re]) => re.test(text)).map(([, phrase, fix]) => ({ phrase, fix }));
}
