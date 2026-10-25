/**
 * What the welcome page (begin.js) says, kept pure so welcome-copy.test.mjs can read it.
 *
 * GridSchool Complete is self-serve: the map changes when the student answers its questions (it rebuilds
 * itself, server/onboarding_api.py), never on a person's schedule. So nothing here promises a review.
 * A buyer who paid from a plan button never took the free check, and nothing here pretends they did.
 */

/** What the map starts on, by the check's first finding (ids from intake_rules.RULES). */
export const STARTING_ON = {
  reach: "getting your applications in front of a person",
  story: "making your resume read like the role you want",
  volume: "sending more of the right applications",
  target: "settling on one role to aim for",
  gap: "showing what you're doing now",
  proof: "giving reviewers something of yours they can open",
  screen: "winning the first recruiter call",
  technical: "getting you through the technical round",
  final: "turning final rounds into offers",
  level: "aiming at the level your work supports",
};

const tookCheck = (me) => Array.isArray(me?.checks) && me.checks.length > 0;

export function startingOn(me) {
  // Paid from a plan button, never took the check: the map opens on a few questions instead.
  if (!tookCheck(me)) return "Your map starts with a few short questions about where you stand, a couple of minutes each. Every answer rebuilds your map around you.";
  const first = me.checks.find((check) => Array.isArray(check.top) && check.top.length)?.top[0];
  if (!first) return "Your map starts with what you told us in the free check. Each step says why it's there and what we're preparing for you.";
  if (STARTING_ON[first.id]) return `We're starting where your free check pointed first: ${STARTING_ON[first.id]}.`;
  return first.title ? `We're starting where your free check pointed first: ${first.title.replace(/\.$/, "")}.` : "Your map starts with what your free check found.";
}

/** What happens next, as [when, what] rows. */
export function nextSteps(me) {
  return [
    [
      "Today",
      tookCheck(me)
        ? "Answer the short question steps on your map whenever you like. Each time you save, your map rebuilds itself around your answers."
        : "Start with the questions at the top of your map. Each time you save, your map rebuilds itself around your answers.",
    ],
    ["This week", "We start on the work marked Prepared for you on each step. When a piece is ready, it shows up on your map."],
    ["Your part", "Only what needs you: sending from your own accounts, and confirming facts about yourself."],
  ];
}

/** The line under "Setting up your map": the check's answers carry over only when there was a check. */
export const WAIT_LINE = "Getting your map ready.";
