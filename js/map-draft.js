/**
 * The draft map. Three answers from the landing (where you are, the role you
 * want, where the search stops) become a map in the same shape a resident's
 * published map has (data/maps/*.json): module instances from
 * data/modules/, on the five career families, in three phases. The apply form
 * carries it to the desk, so the first version of a resident's real map is
 * the one they drew before the call.
 *
 * Pure. The landing draws it with js/rez/road.js; tests in map-draft.test.mjs.
 */

export const STAGES = {
  grad: "a new CS grad",
  self: "self-taught or from a bootcamp",
  working: "a working engineer",
  laidoff: "between roles",
};

export const ROLES = {
  fullstack: { label: "full-stack", user: "A product one real person uses every week" },
  backend: { label: "backend", user: "A service someone else depends on, with its failure log" },
  ai: { label: "applied AI", user: "An agent workflow one real team uses" },
  frontend: { label: "frontend", user: "An interface one real person works in daily" },
  platform: { label: "platform", user: "A pipeline another engineer relies on" },
};

export const STOPS = {
  replies: "no replies",
  screen: "the recruiter screen",
  technical: "the technical round",
  final: "the final round",
};

export const FAMILIES = [
  { id: "interview", label: "Interview", lane: 0, track: "spine" },
  { id: "pipeline", label: "Pipeline", lane: 1, track: "spine" },
  { id: "proof", label: "Proof", lane: 2, track: "spine" },
  { id: "network", label: "Network", lane: 3, track: "spine" },
  { id: "presence", label: "Presence", lane: 4, track: "spine" },
];

export const PHASES = [
  { id: "position", label: "Get findable", short: "Findable", pace: "weeks 1 to 2" },
  { id: "prove", label: "Ship the proof", short: "Proof", pace: "weeks 2 to 5" },
  { id: "land", label: "Land the seat", short: "Land", pace: "weeks 5 to 8, then until hired" },
];

/** The call cheat sheet's routes, picked from the same answers. */
export function routeFor({ stage, stop }) {
  if (stage === "laidoff") return "career-first, sprint";
  if (stage === "grad" || stage === "self") return "build";
  return stop === "technical" || stop === "final" ? "defense-first" : "career-first";
}

/** Unknown answers fall back to the most common lead, never to an error. */
export function normalize(answers = {}) {
  return {
    stage: answers.stage in STAGES ? answers.stage : "working",
    role: answers.role in ROLES ? answers.role : "fullstack",
    stop: answers.stop in STOPS ? answers.stop : "technical",
  };
}

export function draftMap(input) {
  const answers = normalize(input);
  const { stage, role, stop } = answers;
  const early = stage === "grad" || stage === "self";
  const want = ROLES[role].label;
  const steps = [];
  const add = (phase, id, module, family, title) => steps.push({ phase, id, module: `${module}@1`, family, title });

  // Get findable
  if (early) add("position", "pr.codebase", "inherited-codebase", "proof");
  else add("position", "p.questionnaire", "proof-questionnaire", "presence", "Answer the six proof questions about work you already shipped");
  // The rewrite follows the proof questions: they decide what the profile may claim.
  if (!early || stop === "replies") add("position", "p.rewrite", "profile-rewrite", "presence", "LinkedIn rewritten for the role you want next");
  add("position", "n.targets", "target-list", "network", `List 25 to 30 people in ${want} roles`);
  if (stage === "laidoff") add("position", "pi.engine", "application-engine", "pipeline");
  else if (!early) add("position", "pi.titles", "title-cluster", "pipeline");

  // Ship the proof
  if (early) add("prove", "pr.change", "reviewed-change", "proof");
  if (role === "ai") add("prove", "pr.build", "build-agentic-feature", "proof");
  else add("prove", "pr.pick", "pick-feature", "proof");
  add("prove", "pr.user", "real-user", "proof", ROLES[role].user);
  add("prove", "pr.case", "case-study", "proof", "Case study: before and after, measured");
  if (stop === "replies" || stop === "screen") add("prove", "n.posts", "build-posts", "network");
  if (early || stop === "replies") add("prove", "p.site", "portfolio-site", "presence");

  // Land the seat
  if (stop === "replies") add("land", "pi.warm", "warm-path", "pipeline");
  if (stop === "screen" || stop === "final") add("land", "iv.stories", "story-bank", "interview");
  if (stop === "technical" || early) add("land", "iv.explain", "mock-interview", "interview", "Explain your strongest change with AI closed");
  if (stop === "technical") add("land", "iv.technical", "mock-interview", "interview", `Mock technical round, ${want}`);
  if (stop === "final") add("land", "iv.panel", "mock-interview", "interview", "Mock final panel");
  add("land", "pi.prep", "company-prep", "pipeline");
  add("land", "iv.defense", "mock-interview", "interview", "The defense: an outside engineer's written verdict");

  const nodes = steps.map((step, index) => ({
    id: step.id,
    n: index + 1,
    requires: index ? [steps[index - 1].id] : [],
    module: step.module,
    family: step.family,
    phase: step.phase,
    ...(step.title ? { title: step.title } : {}),
  }));

  return {
    version: `draft-${stage}-${role}-${stop}`,
    title: `Draft: ${STAGES[stage]}, ${want}, stops at ${STOPS[stop]}`,
    answers,
    route: routeFor(answers),
    law: "Every step ends in something a recruiter, a hiring manager, or a stranger can open.",
    families: FAMILIES,
    phases: PHASES,
    weekly: [],
    nodes,
  };
}

/** The title a step reads with: the instance's own, else the module's. */
export function stepTitle(node, library = {}) {
  return node.title ?? library[node.module.split("@")[0]]?.title ?? node.module;
}

/** The compact record the apply form sends: answers, route, and the step refs. */
export function draftRecord(map) {
  return {
    ...map.answers,
    route: map.route,
    steps: map.nodes.map((node) => (node.title ? `${node.module} · ${node.title}` : node.module)),
  };
}
