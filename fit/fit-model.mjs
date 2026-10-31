/**
 * fit/: the step before any call (server/fit_api.py; ops/filter-and-funnels-2026-10-31.md §3). Pure parts:
 * the intro (film 1's script, shown as text until it's filmed), the questions with their starter sentences,
 * what gets sent, and the words for each route.
 */

/** Set to the film's embed URL once film 1 exists; until then the script below is the intro. */
export const FILM_URL = "";

export const INTRO = {
  title: "Before we talk: what changed, and who this is for",
  paras: [
    "I'm Aden. I'm a working engineer: I build applied AI and agentic graph systems for real problems engineering teams have. I started GridSchool because I watched the first job in this field get much harder to land.",
    "Here's what changed. Companies are hiring far fewer people aged 22 to 25 into work that AI can now do. The drop comes from fewer hires; layoffs barely moved. The tasks juniors used to learn on are the ones AI does well. What companies still need, and pay for, is someone who can find out what a real person needs, write down what good looks like, build it with AI tools, and answer for the result.",
    "Hiring itself got noisy too. Applications per job roughly doubled since 2022, and many are written by AI, so a pile of applications rarely gets read closely. Trust moved to people: someone who knows you, a short honest note, and work a hiring manager can check in ten minutes.",
    "Here's what GridSchool does. Every morning you get roles that fit you, the person to reach at each, and a note written for you. You send them yourself, in your own words, and every reply is tracked. Once your resume is ready, that's 5 sends a week (3 at the least), plus one step a week on a project with a real user.",
  ],
  asks: [
    "About 10 to 15 hours a week.",
    "Sending to real people, with respect, every week.",
    "Talking to a real person about what they need, and building something for them.",
    "Honest answers, including when something isn't working.",
  ],
  notFor: "It isn't for someone who wants us to apply for them, who wants a guarantee before doing anything, or who doesn't enjoy solving problems for people. That's fine, and the free tools stay free.",
};

export const QUESTIONS = [
  {
    id: "built",
    label: "The last thing you built or fixed that someone else used",
    starter: "The last thing I built or fixed that someone else used was ",
    example: "Example: a shift-swap sheet with a small script that texted people when a swap opened. Eight of us used it every week.",
  },
  {
    id: "builtFor",
    label: "Who it was for",
    starter: "It was for ",
    example: "Example: the student staff at the campus library.",
    short: true,
  },
  {
    id: "tried",
    label: "What you've tried in your search so far",
    starter: "So far in my search I've tried ",
    example: "Example: about 240 applications since May on LinkedIn and Handshake. Two recruiter calls, no interviews.",
  },
  {
    id: "why",
    label: "Why this field",
    starter: "I want to work in this field because ",
    example: "Example: I like finding out what slows people down and building the thing that fixes it.",
  },
];

export const HOURS = [
  { value: "lt5", label: "Under 5 hours a week" },
  { value: "5to10", label: "5 to 10 hours a week" },
  { value: "10to15", label: "10 to 15 hours a week" },
  { value: "gt15", label: "More than 15 hours a week" },
];

export const PAYERS = [
  { value: "me", label: "I'd pay for it myself" },
  { value: "parent", label: "A parent or family member would" },
  { value: "cant", label: "I couldn't right now" },
  { value: "wont", label: "I wouldn't pay for this" },
];

/** What they typed, without the starter sentence (the server scores their words, not ours). */
export function ownWords(q, value) {
  const text = String(value ?? "").trim();
  const starter = q.starter.trim();
  return text.toLowerCase().startsWith(starter.toLowerCase()) ? text.slice(starter.length).trim() : text;
}

/** The request body for POST /fit/<id>, or a problem to show. */
export function payload(values, { read = false, watched = 0 } = {}) {
  if (!read) return { problem: "Read the part above first, then answer." };
  const body = { read: true, watched, hours: values.hours || "", payer: values.payer || "" };
  for (const q of QUESTIONS) body[q.id] = ownWords(q, values[q.id]);
  if (!QUESTIONS.some((q) => body[q.id])) return { problem: "Answer the questions in your own words. A sentence or two each is enough." };
  if (!body.hours) return { problem: "Pick how many hours a week you can give this." };
  if (!body.payer) return { problem: "Pick how it would be paid for." };
  return { body };
}

const MONTHS = { lt1: "less than a month", "1to3": "1 to 3 months", "3to6": "3 to 6 months", "6to12": "6 to 12 months", gt12: "more than a year" };
const APPS = { none: "no", "1to20": "up to 20", "21to75": "21 to 75", "76to200": "76 to 200", gt200: "more than 200" };

/** The grad's note to a parent, with their own numbers filled in where the check has them. */
export function parentScript(facts = {}, link = "") {
  const months = MONTHS[facts.months] || "___ months";
  const apps = APPS[facts.apps] ? `${APPS[facts.apps]} applications` : "about ___ applications";
  return [
    `I've been looking for ${months} and sent ${apps}. I've heard back from ___.`,
    "I found a program called GridSchool. Every morning it gives me roles that fit, the person to reach and a note, and I send them myself. It asks me for 10 to 15 hours a week.",
    "I read what it asks and answered their questions, and they think I'm a fit for a call.",
    `Would you read this page and come on the call with me? I want to make the decision, and I want you to see it first.${link ? ` ${link}` : ""}`,
  ].join(" ");
}

/** The words on the result screen for each route (fit_api.next_for gives the links). */
export function result(next, first = "") {
  const name = first ? `${first}, ` : "";
  switch (next?.route) {
    case "call":
      return {
        badge: "A call fits",
        title: `${name}let's talk.`,
        lede: next.booking
          ? "Pick a time that suits you. I read your answers before the call, and the call starts with what you want."
          : "I read every answer myself. I'll email you within a day with a few times for a call. The call starts with what you want.",
      };
    case "sprint":
      return {
        badge: "The free sprint",
        title: `${name}the free sprint is your next step.`,
        lede: "You'd do well in it. It's six weeks of the same daily roles and sends, free, with a few written commitments. If a family member could help pay later, the founding cohort opens in December.",
      };
    case "self":
      return {
        badge: "Self-serve for now",
        title: `${name}start on your own, and come back when you have the time.`,
        lede: "The program needs about 10 hours a week to work. Until you have that, the self-serve plan gives you the daily roles and the tools. Come back to this page whenever your week opens up.",
      };
    default:
      return {
        badge: "The free map",
        title: `${name}start with your free map.`,
        lede: "Your map and the free tools are yours. Get your resume ready and log 3 sends, then come back to this page. What you do there tells us more than any answer here.",
      };
  }
}
