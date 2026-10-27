/**
 * Pure logic for the studio (views/studio.js): which node of each tool is done and where to open,
 * the brackets a draft still holds, and what checking the step's task needs. No DOM, no fetch.
 */

export const PROJECT_NODES = [
  { id: "ideas", label: "Ideas" },
  { id: "pick", label: "Pick" },
];

export const POST_NODES = [
  { id: "voice", label: "Voice" },
  { id: "ideas", label: "Ideas" },
  { id: "drafts", label: "Drafts" },
];

export const TOOLS = { projects: "projects", posts: "posts" };

/** Earlier rounds of ideas, newest first, each with a readable date. */
export function earlierRounds(section) {
  return (section?.rounds ?? []).filter((r) => (r?.ideas ?? []).length).map((r) => ({ ideas: r.ideas, when: roundDate(r.at) }));
}

export function roundDate(iso) {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Earlier";
}

export function toolOf(arg) {
  return arg === "posts" ? "posts" : "projects";
}

const ideasOf = (studio) => studio?.projects?.ideas ?? [];
const draftsOf = (studio) => studio?.posts?.drafts ?? [];

export function hasVoice(studio) {
  const voice = studio?.voice;
  return Boolean(voice && (voice.summary || voice.edited));
}

export function projectDone(studio) {
  const done = [];
  if (ideasOf(studio).length) done.push("ideas");
  if (studio?.projects?.picked?.node) done.push("pick");
  return done;
}

export function postDone(studio) {
  const done = [];
  if (hasVoice(studio)) done.push("voice");
  if ((studio?.posts?.ideas ?? []).length) done.push("ideas");
  if (draftsOf(studio).some((d) => d.status === "posted")) done.push("drafts");
  return done;
}

/** Where the posts tool opens: the voice doc first, then ideas, then the drafts. */
export function autoPostNode(studio) {
  if (draftsOf(studio).length) return "drafts";
  if ((studio?.posts?.ideas ?? []).length) return "ideas";
  if (!hasVoice(studio)) return "voice";
  return "ideas";
}

export function autoProjectNode(studio) {
  return ideasOf(studio).length ? "pick" : "ideas";
}

const BRACKET = /\[[^\]\n]{2,80}\]/g;

/** The square brackets a draft still holds: facts only the student has. Twin of studio.py placeholders. */
export function placeholdersIn(text) {
  return String(text ?? "").match(BRACKET) ?? [];
}

/** The step task that opened the studio, from the board's graph, or null. */
export function launchingTask(graph, taskId) {
  if (!taskId || !graph?.nodes) return null;
  for (const node of graph.nodes) {
    const task = (node.tasks ?? []).find((t) => t.id === taskId);
    if (task) return { node, task };
  }
  return null;
}

/**
 * The answers that check this task, or null when a required field has nothing to fill it.
 * A task's `url` field takes the post's link; a task without fields needs nothing.
 */
export function completionFor(task, { url = "" } = {}) {
  if (!task) return null;
  const answers = {};
  for (const field of task.fields ?? []) {
    const value = field.id === "url" ? String(url || "").trim() : "";
    if (field.required && !value) return null;
    if (value) answers[field.id] = value;
  }
  return answers;
}

/** "3 left this week" for one action, only when three or fewer are left (a limit is said where it bites), else "". */
export function weekLine(week, action, noun) {
  const row = week?.[action];
  if (!row || typeof row.limit !== "number" || row.limit <= 0) return "";
  const left = Math.max(0, row.limit - (row.used ?? 0));
  return left <= 3 ? `${left} ${noun} left this week` : "";
}

/** What would sharpen the ideas, from the seeds summary the server sends. */
export function seedHints(seeds) {
  const complete = seeds?.complete ?? {};
  const hints = [];
  if (!complete.target) hints.push("the job you want");
  if (!complete.interests) hints.push("what you're interested in");
  if (!complete.proof) hints.push("a few confirmed lines on your resume");
  return hints;
}

/** A post idea's shape, in words. */
export const SHAPE_LABEL = {
  noticed: "Something you noticed",
  decision: "A decision you made",
  build: "Your build, working",
  comment: "A pattern you keep seeing",
  lesson: "What went wrong",
};
